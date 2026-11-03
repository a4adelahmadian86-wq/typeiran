import { chromium } from 'playwright';

const BASE = 'https://typeiran.com';
const WORKER_URL = BASE + '/projects/online/worker';
const ONLINE_URL = BASE + '/projects/online';
const TIMEOUT = Number(process.env.ACTION_TIMEOUT_MS || 15000);

const log = (event, details = {}) => console.log(JSON.stringify({
  timestamp: new Date().toISOString(), event, ...details
}));

function normalize(value) {
  return String(value ?? '').replace(/\\s+/g, ' ').trim();
}

async function visibleEnabled(locator) {
  const matches = [];
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    try {
      if (await item.isVisible() && await item.isEnabled()) matches.push(item);
    } catch {
      // A detached or unstable target is not safe to click.
      throw new Error('TARGET_STATE_UNSTABLE');
    }
  }
  return matches;
}

async function hasBlockingDialog(page) {
  const modal = page.locator('[role="dialog"], [aria-modal="true"], dialog:visible');
  return (await modal.count()) > 0;
}

async function assertAuthenticated(page) {
  const url = page.url();
  if (/\/login(?:[/?#]|$)/i.test(url)) throw new Error('LOGIN_REQUIRED');
  if (!url.startsWith(BASE)) throw new Error('UNEXPECTED_ORIGIN');
}

async function clickExactTarget(page, kind) {
  if (await hasBlockingDialog(page)) throw new Error('DIALOG_PRESENT');

  if (kind === 'attendance') {
    const matches = await visibleEnabled(page.locator('[aria-label="اعلام حضور"]'));
    if (matches.length > 1) throw new Error('AMBIGUOUS_ATTENDANCE_TARGET');
    if (matches.length === 0) return { found: false };
    await matches[0].click({ timeout: TIMEOUT });
    return { found: true, target: 'attendance', url: page.url() };
  }

  // Exact button role/name only. No fuzzy text, coordinates, or fallback selectors.
  const allButtons = page.getByRole('button', { name: 'دریافت نوبت', exact: true });
  const matches = await visibleEnabled(allButtons);
  if (matches.length > 1) throw new Error('AMBIGUOUS_APPOINTMENT_TARGET');
  if (matches.length === 0) return { found: false };
  await matches[0].click({ timeout: TIMEOUT });
  return { found: true, target: 'appointment', url: page.url() };
}

async function main() {
  const rawState = process.env.TYPEIRAN_STORAGE_STATE;
  if (!rawState) throw new Error('MISSING_TYPEIRAN_STORAGE_STATE');

  let storageState;
  try { storageState = JSON.parse(rawState); }
  catch { throw new Error('INVALID_TYPEIRAN_STORAGE_STATE_JSON'); }

  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({ storageState });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Do not accept, dismiss, or otherwise handle JavaScript dialogs.
    let dialogObserved = false;
    page.on('dialog', () => { dialogObserved = true; });

    await page.goto(WORKER_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await assertAuthenticated(page);
    if (dialogObserved) throw new Error('DIALOG_PRESENT');

    const attendance = await clickExactTarget(page, 'attendance');
    if (attendance.found) {
      log('ACTION_CLICKED', attendance);
      await page.waitForTimeout(1500);
      if (dialogObserved) {
        log('POST_CLICK_DIALOG_UNTOUCHED', { target: 'attendance' });
        return;
      }
      const stillVisible = await page.locator('[aria-label="اعلام حضور"]').count();
      log('POST_CLICK_CHECK', { target: 'attendance', matchingElementsAfterClick: stillVisible });
      return;
    }

    await page.goto(ONLINE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await assertAuthenticated(page);
    if (dialogObserved || await hasBlockingDialog(page)) throw new Error('DIALOG_PRESENT');

    const appointment = await clickExactTarget(page, 'appointment');
    if (!appointment.found) {
      log('NO_ELIGIBLE_TARGET', { checked: [WORKER_URL, ONLINE_URL] });
      return;
    }

    log('ACTION_CLICKED', appointment);
    await page.waitForTimeout(1500);
    if (dialogObserved) {
      log('POST_CLICK_DIALOG_UNTOUCHED', { target: 'appointment' });
      return;
    }
    const remaining = await page.getByRole('button', { name: 'دریافت نوبت', exact: true }).count();
    log('POST_CLICK_CHECK', { target: 'appointment', matchingButtonsAfterClick: remaining });
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main().catch(error => {
  log('SAFE_STOP', { code: error.message || 'UNKNOWN_ERROR' });
  process.exitCode = 1;
});
