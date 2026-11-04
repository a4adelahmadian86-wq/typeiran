# TypeIran Cloud Attendance

A cloud-only scheduled automation using GitHub Actions and the TinyFish hosted MCP browser runner. No local computer or local browser is required.

## Schedule

GitHub Actions runs this workflow every 30 minutes (UTC) and also supports manual runs from the Actions tab:
`.github/workflows/typeiran-attendance.yml`

## Required GitHub secret

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- Name: `TINYFISH_API_KEY`
- Secret: a newly generated TinyFish API key

Never commit the key to this repository or send it in chat. If an earlier key was pasted into a chat, revoke it and use a replacement.

The workflow uses browser profile `prof_9a2ee95796624b37`. That profile must remain authenticated to TypeIran.

## Exact safety rules

- Inspect the worker page first.
- Click exactly one visible, enabled element with exact `aria-label="اعلام حضور"`, if present.
- Only if that target is absent, inspect the online page and click exactly one visible, enabled button with exact accessible name `دریافت نوبت`.
- Never click, focus, hover, or otherwise interact with `حذف نوبت` or `بررسی نوبت`.
- Never accept, reject, close, or dismiss dialogs, modals, or popups.
- Stop without clicking when authentication is invalid, targets are ambiguous, or state is unclear.
- No fuzzy matching, coordinates, or fallback selectors.

## Cost and reliability

GitHub-hosted standard runner usage is free for public repositories. TinyFish browser automation is a separate metered service and may consume TinyFish wallet credits or incur charges. Therefore, GitHub scheduling can be free, but total end-to-end operation is not guaranteed to be free unless the TinyFish account has a free allowance or credits.

GitHub scheduled events are not guaranteed to start at the exact minute and may be delayed during periods of high load. A successful workflow run alone does not prove that TypeIran action occurred; inspect its log outcome.
