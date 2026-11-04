# TypeIran Cloud Attendance

This project runs a small Playwright browser task on GitHub-hosted runners. It does not use Render or TinyFish, so there is no Render cron charge or TinyFish metered browser charge.

## Schedule

GitHub Actions attempts one run every 30 minutes (UTC). GitHub may delay scheduled runs, so this is not an exact real-time timer. Manual runs are available from the Actions tab.

## One-time TypeIran login setup

The browser session is stored as a GitHub Actions secret. To create it:

1. Install Node.js 22 on a Windows computer.
2. Download this repository ZIP from GitHub and extract it.
3. Open CMD in the extracted folder.
4. Run:
   `npm install`
   `npx playwright install chromium`
   `npm run auth:setup`
5. A browser opens. Sign in to TypeIran yourself. Do not share your password or one-time codes.
6. Return to CMD and press Enter. The setup creates `typeiran-storage-state-b64.txt`.
7. In GitHub, open this repository → Settings → Secrets and variables → Actions → New repository secret.
8. Name it `TYPEIRAN_STORAGE_STATE_B64`. Paste the complete contents of `typeiran-storage-state-b64.txt` as its value.
9. Under Settings → Secrets and variables → Actions → Variables, create:
   - Name: `TYPEIRAN_AUTOMATION_ENABLED`
   - Value: `true`

The state files contain login session credentials. Never commit them, upload them as ordinary repository files, or send them in chat. Delete the local copies after adding the secret. When TypeIran expires the session, repeat the login setup and replace the secret.

## Safety rules

- Inspect the worker page first.
- If exactly one visible, enabled element has exact `aria-label="اعلام حضور"`, click it once.
- Only if that element is absent, inspect the online page and click exactly one visible, enabled button with exact accessible name `دریافت نوبت`.
- Never click, focus, hover, or otherwise interact with `حذف نوبت` or `بررسی نوبت`.
- Never accept, reject, close, or dismiss dialogs, modals, or popups.
- Stop on login-required, ambiguous, duplicate, disabled, or unclear states.
- No fuzzy matching or coordinate-based clicks.

## Cost

GitHub standard hosted runners are free for public repositories. TinyFish and Render are not used by this Playwright workflow. This relies on GitHub's free public-repository Actions offering and remains subject to GitHub's policies and scheduling delays.
