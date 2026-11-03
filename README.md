# TypeIran Cloud Attendance

A cloud-only scheduled automation. Render Cron starts the job every 30 minutes (UTC); the job calls the TinyFish hosted MCP API and reuses the saved TinyFish Browser Context Profile. No local computer, local browser, Playwright storage-state export, or TypeIran password is required.

## Exact safety rules

- Inspect the worker page first.
- Click exactly one visible, enabled element with exact `aria-label="اعلام حضور"`, if present.
- Only if that target is absent, inspect the online page and click exactly one visible, enabled button with exact accessible name `دریافت نوبت`.
- Never click, focus, hover, or otherwise interact with `حذف نوبت` or `بررسی نوبت`.
- Never accept, reject, close, or dismiss dialogs, modals, or popups.
- Stop without clicking when authentication is invalid, targets are ambiguous, or state is unclear.
- No fuzzy matching, coordinates, or fallback selectors.

## Render environment

Set `TINYFISH_API_KEY` as a Render secret. Do not commit it to GitHub or send it in chat.

`TINYFISH_PROFILE_ID` is already configured in `render.yaml` for the saved profile `prof_9a2ee95796624b37`.

## Schedule

`*/30 * * * *` — every 30 minutes, evaluated in UTC by Render.

## API behavior

The runner uses the official TinyFish hosted MCP endpoint `https://agent.tinyfish.ai/mcp`, authenticates with `X-API-Key`, initializes an MCP session, starts one `run_web_automation` call with the saved profile, and waits for its terminal result. It logs only a concise outcome and run ID; it does not log the API key or browser session data.

A successful deployment is not considered verified until the Render build succeeds and a scheduled/manual run completes with a confirmed TypeIran action in its logs.
