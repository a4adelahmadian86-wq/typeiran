const ENDPOINT = 'https://agent.tinyfish.ai/mcp';
const API_KEY = process.env.TINYFISH_API_KEY;
const PROFILE_ID = process.env.TINYFISH_PROFILE_ID || 'prof_9a2ee95796624b37';
const MAX_POLLS = Number(process.env.MAX_POLLS || 8);

const log = (event, details = {}) => console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  event,
  ...details
}));

if (!API_KEY) {
  log('CONFIGURATION_REQUIRED', { code: 'MISSING_TINYFISH_API_KEY' });
  process.exit(2);
}

let sessionId = null;
let protocolVersion = null;
let requestId = 0;

function parseSse(text) {
  const messages = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .join('\n');
    if (!data || data === '[DONE]') continue;
    try { messages.push(JSON.parse(data)); } catch {}
  }
  return messages;
}

async function rpc(method, params = {}, { notification = false } = {}) {
  const headers = {
    'content-type': 'application/json',
    'accept': 'application/json, text/event-stream',
    'X-API-Key': API_KEY
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion;

  const body = {
    jsonrpc: '2.0',
    method,
    params
  };
  if (!notification) body.id = ++requestId;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65000)
  });

  sessionId = response.headers.get('mcp-session-id') || sessionId;
  const raw = await response.text();

  if (!response.ok) {
    throw new Error('TINYFISH_HTTP_' + response.status + ':' + raw.slice(0, 500));
  }
  if (notification || response.status === 202 || !raw.trim()) return null;

  const contentType = response.headers.get('content-type') || '';
  let messages = [];
  if (contentType.includes('text/event-stream')) messages = parseSse(raw);
  else {
    try { messages = [JSON.parse(raw)]; } catch {
      throw new Error('INVALID_MCP_RESPONSE');
    }
  }

  const message = messages.find(item => item && (notification || item.id === body.id)) || messages.at(-1);
  if (!message) throw new Error('EMPTY_MCP_RESPONSE');
  if (message.error) throw new Error('MCP_RPC_ERROR:' + JSON.stringify(message.error).slice(0, 500));
  return message.result ?? message;
}

async function callTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result?.isError) {
    const message = (result.content || []).map(x => x.text || '').join(' ');
    throw new Error('TINYFISH_TOOL_ERROR:' + message.slice(0, 700));
  }
  return result;
}

function contentText(result) {
  if (typeof result === 'string') return result;
  if (result?.structuredContent) return JSON.stringify(result.structuredContent);
  return (result?.content || []).map(item => item.text || '').join('\n');
}

function extractObject(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = contentText(result);
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return { raw: text };
}

function summarize(text) {
  const value = String(text || '');
  if (/login_required|login page|sign.?in required|not authenticated/i.test(value)) return 'AUTH_REQUIRED';
  if (/ambiguous|multiple matches|target.*unclear/i.test(value)) return 'SAFE_STOP_AMBIGUOUS_TARGET';
  if (/dialog|modal|popup/i.test(value)) return 'SAFE_STOP_DIALOG_PRESENT_OR_DETECTED';
  if (/successfully completed|successfully registered|attendance.*registered|clicked it exactly once/i.test(value)) return 'ACTION_COMPLETED';
  if (/no eligible target|no.*target.*found/i.test(value)) return 'NO_ELIGIBLE_TARGET';
  return 'RUN_FINISHED_REVIEW_REQUIRED';
}

async function main() {
  const init = await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'typeiran-cloud-cron', version: '1.1.0' }
  });
  if (init?.protocolVersion) protocolVersion = init.protocolVersion;
  await rpc('notifications/initialized', {}, { notification: true });

  log('RUN_STARTED', { profileId: PROFILE_ID });

  const goal = [
    'Perform one TypeIran attendance/appointment cycle using this saved authenticated browser profile.',
    'First inspect https://typeiran.com/projects/online/worker.',
    'If and only if exactly one visible and enabled element has the exact aria-label "اعلام حضور", click it exactly once and verify the resulting state.',
    'Only if there is no such attendance element, inspect https://typeiran.com/projects/online. If and only if exactly one visible and enabled button has the exact normalized accessible name "دریافت نوبت", click it exactly once and verify the resulting state.',
    'Never click, focus, hover, or otherwise interact with "حذف نوبت" or "بررسی نوبت".',
    'Never interact with, accept, reject, close, or dismiss any dialog, modal, or popup. If one is present, stop without clicking anything.',
    'If login is invalid, the target is ambiguous, the exact target is not unique, or state is unclear, stop without clicking.',
    'Do not use fuzzy matching, coordinates, or alternative controls. This is one execution only.'
  ].join(' ');

  const started = await callTool('run_web_automation', {
    url: 'https://typeiran.com/projects/online/worker',
    goal,
    use_profile: true,
    profile_id: PROFILE_ID,
    capture_config: { elements: true, snapshots: false, screenshots: false, recording: false, html: false }
  });

  const startData = extractObject(started);
  const runId = startData.runId || startData.run_id || startData.structuredContent?.runId;
  if (!runId) {
    log('START_RESPONSE_UNCLEAR', { summary: summarize(contentText(started)) });
    process.exitCode = 1;
    return;
  }

  log('BROWSER_RUN_QUEUED', { runId });
  let finalData = null;
  for (let i = 0; i < MAX_POLLS; i++) {
    const waited = await callTool('wait_for_run', { run_id: runId });
    finalData = extractObject(waited);
    const status = String(finalData.status || '').toLowerCase();
    if (['completed', 'failed', 'cancelled'].includes(status)) break;
    log('BROWSER_RUN_PENDING', { poll: i + 1 });
  }

  if (!finalData) throw new Error('MISSING_FINAL_RESULT');
  const resultText = finalData.result?.result || finalData.result?.error || finalData.error || contentText(finalData);
  const outcome = summarize(typeof resultText === 'string' ? resultText : JSON.stringify(resultText));
  log('RUN_FINISHED', {
    status: finalData.status || 'unknown',
    outcome,
    runId
  });

  if (finalData.status && !['completed'].includes(String(finalData.status).toLowerCase())) {
    process.exitCode = 1;
  }
  if (outcome === 'AUTH_REQUIRED' || outcome === 'SAFE_STOP_AMBIGUOUS_TARGET' || outcome === 'SAFE_STOP_DIALOG_PRESENT_OR_DETECTED' || outcome === 'RUN_FINISHED_REVIEW_REQUIRED') {
    process.exitCode = 1;
  }
}

main().catch(error => {
  log('RUN_FAILED', { code: String(error.message || 'UNKNOWN_ERROR').slice(0, 700) });
  process.exitCode = 1;
});
