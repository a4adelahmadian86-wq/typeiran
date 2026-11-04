import { chromium } from 'playwright';

const WORKER_URL = 'https://typeiran.com/projects/online/worker';
const ONLINE_URL = 'https://typeiran.com/projects/online';
const STATE_B64 = process.env.TYPEIRAN_STORAGE_STATE_B64;

const log = (event, extra = {}) => console.log(JSON.stringify({
  time: new Date().toISOString(),
  event,
  ...extra
}));

function isLoginUrl(url) {
  return /\/login(?:[/?#]|$)/i.test(url);
}

async function main() {
  if (!STATE_B64) {
    log('CONFIGURATION_REQUIRED', { code: 'MISSING_TYPEIRAN_STORAGE_STATE_B64' });
    process.exitCode = 2;
    return;
  }

  let storageState;
  try {
    storageState = JSON.parse(Buffer.from(STATE_B64, 'base64').toString('utf8'));
    if (!storageState || !Array.isArray(storageState.cookies)) throw new Error('invalid storage state');
  } catch {
    log('CONFIGURATION_REQUIRED', { code: 'INVALID_TYPEIRAN_STORAGE_STATE_B64' });
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);

  let dialogDetected = false;
  page.on('dialog', () => {
    dialogDetected = true;
    log('SAFE_STOP_DIALOG_DETECTED');
    // Deliberately do not accept, dismiss, or otherwise interact with the dialog.
  });

  try {
    log('RUN_STARTED');
    await page.goto(WORKER_URL, { waitUntil: 'domcontentloaded' });

    if (dialogDetected) {
      process.exitCode = 1;
      return;
    }
    if (isLoginUrl(page.url())) {
      log('AUTH_REQUIRED', { page: 'worker' });
      process.exitCode = 1;
      return;
    }

    const dialogs = page.locator('[role="dialog"], [aria-modal="true"], dialog[open]');
    if (await dialogs.count() > 0) {
      log('SAFE_STOP_DIALOG_DETECTED', { page: 'worker' });
      process.exitCode = 1;
      return;
    }

    const attendance = page.locator('[aria-label="اعلام حضور"]');
    const attendanceCount = await attendance.count();
    if (attendanceCount > 0) {
      if (attendanceCount !== 1 || !(await attendance.isVisible()) || !(await attendance.isEnabled())) {
        log('SAFE_STOP_AMBIGUOUS_TARGET', { target: 'اعلام حضور', count: attendanceCount });
        process.exitCode = 1;
        return;
      }

      await attendance.click({ timeout: 10000, noWaitAfter: true });
      await page.waitForTimeout(1200);
      if (dialogDetected) {
        log('CLICKED_DIALOG_APPEARED', { target: 'اعلام حضور' });
        process.exitCode = 1;
        return;
      }
      const postDialogs = page.locator('[role="dialog"], [aria-modal="true"], dialog[open]');
      if (await postDialogs.count() > 0) {
        log('CLICKED_DIALOG_APPEARED', { target: 'اعلام حضور' });
        process.exitCode = 1;
        return;
      }
      log('ACTION_CLICKED_ONCE', { target: 'اعلام حضور', verified: 'page remained accessible; inspect site state for final confirmation' });
      return;
    }

    await page.goto(ONLINE_URL, { waitUntil: 'domcontentloaded' });
    if (dialogDetected) {
      log('SAFE_STOP_DIALOG_DETECTED', { page: 'online' });
      process.exitCode = 1;
      return;
    }
    if (isLoginUrl(page.url())) {
      log('AUTH_REQUIRED', { page: 'online' });
      process.exitCode = 1;
      return;
    }

    const onlineDialogs = page.locator('[role="dialog"], [aria-modal="true"], dialog[open]');
    if (await onlineDialogs.count() > 0) {
      log('SAFE_STOP_DIALOG_DETECTED', { page: 'online' });
      process.exitCode = 1;
      return;
    }

    const booking = page.getByRole('button', { name: 'دریافت نوبت', exact: true });
    const bookingCount = await booking.count();
    if (bookingCount === 0) {
      log('NO_ELIGIBLE_TARGET');
      return;
    }
    if (bookingCount !== 1 || !(await booking.isVisible()) || !(await booking.isEnabled())) {
      log('SAFE_STOP_AMBIGUOUS_TARGET', { target: 'دریافت نوبت', count: bookingCount });
      process.exitCode = 1;
      return;
    }

    await booking.click({ timeout: 10000, noWaitAfter: true });
    await page.waitForTimeout(1200);
    if (dialogDetected) {
      log('CLICKED_DIALOG_APPEARED', { target: 'دریافت نوبت' });
      process.exitCode = 1;
      return;
    }
    const afterDialogs = page.locator('[role="dialog"], [aria-modal="true"], dialog[open]');
    if (await afterDialogs.count() > 0) {
      log('CLICKED_DIALOG_APPEARED', { target: 'دریافت نوبت' });
      process.exitCode = 1;
      return;
    }
    log('ACTION_CLICKED_ONCE', { target: 'دریافت نوبت', verified: 'page remained accessible; inspect site state for final confirmation' });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch(error => {
  log('RUN_FAILED', { message: String(error?.message || 'unknown').slice(0, 400) });
  process.exitCode = 1;
});
