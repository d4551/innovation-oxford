import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';
const b = await launchBrowser();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${BASE}/index.html`);
const active = () => p.evaluate(() => {
  const el = document.activeElement;
  return el ? `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${el.className ? '.'+String(el.className).split(' ')[0] : ''}` : 'none';
});
// Sign in without touching the mouse at all.
console.log('focus on load:', await active());
await p.keyboard.type('KeyboardKid');
await p.keyboard.press('Tab');
await p.keyboard.type('hunter2');
await p.keyboard.press('Tab');
console.log('tab reaches:', await active());
await p.keyboard.press('Enter');
await p.waitForSelector('.btn-center', { timeout: 5000 });
console.log('signed in by keyboard; focus:', await active());
await p.keyboard.press('Escape');           // skip dial-up
await p.waitForSelector('.desktop:not(.hidden)', { timeout: 6000 });
await p.waitForTimeout(400);
console.log('desktop reached via Escape; focus:', await active());

// Walk the tab order and make sure everything reachable is a real control.
const order = [];
for (let i = 0; i < 22; i++) { await p.keyboard.press('Tab'); order.push(await active()); }
console.log('tab order:', order.join(' -> '));

// Ctrl+T should open the terminal, and typing must land in it.
await p.keyboard.press('Control+t');
await p.waitForSelector('.terminal-window', { timeout: 6000 });
await p.waitForTimeout(600);
await p.keyboard.type('ver');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
console.log('Ctrl+T terminal + typed "ver":', /Version 4\.00\.950/.test(await p.locator('.terminal-window').innerText()) ? 'OK' : 'FAILED');

// Start menu by keyboard.
await p.keyboard.press('Escape');
await p.locator('.start-btn').focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
console.log('start menu focus:', await active());
await p.keyboard.press('ArrowDown');
console.log('ArrowDown moves to:', await active());
await p.keyboard.press('Escape');
console.log('Escape returns focus to:', await active());
await b.close();
