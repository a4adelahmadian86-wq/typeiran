# TypeIran Cloud Attendance

A scheduled Playwright task for TypeIran. It is designed to run from Render Cron and does not depend on a local computer.

## Safety contract

- Checks the worker page for exactly one visible, enabled element whose exact attribute is `aria-label="اعلام حضور"`.
- Only if no eligible attendance element exists, checks the online projects page for exactly one visible, enabled button whose exact accessible name is `دریافت نوبت`.
- Stops on multiple matches, login redirects, unstable target state, unexpected origin, or a visible modal.
- Does not select or interact with `حذف نوبت` or `بررسی نوبت`.
- Does not accept, dismiss, or close JavaScript dialogs.
- No fuzzy matching, coordinates, or alternate selectors are used.
- Logs each run as JSON. It never logs cookies or the storage-state secret.

## Required Render secret

Set `TYPEIRAN_STORAGE_STATE` as a **secret environment variable** in Render. Its value must be the complete Playwright storage-state JSON for an authenticated TypeIran session (cookies and local storage). Never commit it to GitHub and never send it in chat.

The repository does not contain credentials or session data.

## Render Cron

- Runtime: Node
- Build: `npm ci && npx playwright install --with-deps chromium`
- Start: `npm run run`
- Schedule: `*/30 * * * *` (UTC)

## Important limitations

A click is not a guarantee that TypeIran accepted the action. The logs record the click attempt and a limited post-click DOM check. If TypeIran changes its interface or presents a confirmation dialog, the runner stops without interacting with that dialog. Verify the first live run in Render logs before relying on the schedule.
