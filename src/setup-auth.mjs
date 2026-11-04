import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
const rl = createInterface({ input, output });

try {
  console.log('A browser will open. Sign in to TypeIran yourself.');
  console.log('Do not share your password or one-time codes with anyone.');
  await page.goto('https://typeiran.com/login', { waitUntil: 'domcontentloaded' });
  await rl.question('\nAfter you have signed in successfully and can open your TypeIran account, return here and press ENTER... ');
  await page.goto('https://typeiran.com/projects/online/worker', { waitUntil: 'domcontentloaded' });
  if (/\/login(?:[/?#]|$)/i.test(page.url())) {
    throw new Error('TypeIran still shows the login page. Sign in first, then run this setup again.');
  }

  const state = await context.storageState();
  const json = JSON.stringify(state);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  await writeFile('typeiran-storage-state.json', json, { mode: 0o600 });
  await writeFile('typeiran-storage-state-b64.txt', b64, { mode: 0o600 });
  console.log('\nSUCCESS: session files created in this folder.');
  console.log('Open typeiran-storage-state-b64.txt and copy its entire contents into GitHub Actions secret: TYPEIRAN_STORAGE_STATE_B64');
  console.log('These files contain private login session data. Never upload them to the repository or send them in chat.');
} finally {
  rl.close();
  await browser.close();
}
