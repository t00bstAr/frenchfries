const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
// REAL=1 uses the Supabase project configured in index.html instead of the mock.
const REAL = !!process.env.REAL;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!REAL) html = html
  .replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: 'https://test.supabase.co'")
  .replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: 'test-key'");
const mock = fs.readFileSync(__dirname + '/mock-supabase.js', 'utf8');
const matter = fs.readFileSync(require.resolve('matter-js/build/matter.min.js'), 'utf8');
const prof = n => JSON.stringify({ mode: 'online', tricks: 2, bestOf: 1, stake: '', muted: true, profileDone: true, me: { id: 'me', name: n, photo: null }, players: [] });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: false });
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://game.test/')) return r.fulfill({ contentType: 'text/html', body: html });
    if (!REAL && u.includes('supabase-js')) return r.fulfill({ contentType: 'application/javascript', body: mock });
    if (u.includes('matter')) return r.fulfill({ contentType: 'application/javascript', body: matter });
    return REAL ? r.continue() : r.abort();
  });
  const errs = [];
  const open = async name => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://game.test/');
    await p.evaluate(v => { localStorage.setItem('ffg.v2', v); }, prof(name));
    await p.reload();
    await p.click('#play');
    await p.waitForFunction(() => document.querySelector('#online-note').dataset.state === 'connected', null, { timeout: 8000 });
    return p;
  };
  const A = await open('Anna');
  await A.click('#start');
  await A.waitForSelector('#lobby:not([hidden])');
  const code = (await A.textContent('#lobby-code')).trim();
  console.log('host code', code);

  const B = await open('Mads');
  await B.waitForSelector(`[data-join="${code}"]`, { timeout: 8000 });
  console.log('B sees open game:', await B.textContent(`[data-join="${code}"] b`), '| B connected:', await B.getAttribute('#online-note', 'data-state'));
  await B.click(`[data-join="${code}"]`);
  await A.waitForFunction(() => document.querySelectorAll('#lobby-seats .seat-row').length === 2, null, { timeout: 8000 });
  await B.waitForFunction(() => document.querySelectorAll('#lobby-seats .seat-row').length === 2, null, { timeout: 8000 });
  console.log('A lobby:', (await A.$$eval('#lobby-seats .seat-row .n', e => e.map(x => x.textContent))).join(', '));
  console.log('B lobby:', (await B.$$eval('#lobby-seats .seat-row .n', e => e.map(x => x.textContent))).join(', '), '|', await B.textContent('#lobby-wait'));

  await A.click('#lobby-start');
  await A.waitForSelector('#game:not([hidden])');
  await B.waitForSelector('#game:not([hidden])', { timeout: 8000 });
  console.log('both in game');

  // live drag: whoever's turn drags a fry halfway; the other screen should see it move
  const turnName = async p => (await p.textContent('.turn-name')).trim();
  const mover = async () => ((await turnName(A)) === 'Your turn' ? [A, B, 'A'] : [B, A, 'B']);
  let [M, W, who] = await mover();
  // find a fry the mover can drag without it being a trick (guest knows tk too via state)
  const idx = await M.evaluate(() => {
    const fries = [...document.querySelectorAll('#fries .fry')];
    return fries.findIndex(f => !f.classList.contains('backrow'));
  });
  const box = await M.$$eval('#fries .fry', (els, i) => { const r = els[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, idx);
  await M.mouse.move(box.x, box.y); await M.mouse.down();
  await M.mouse.move(box.x, box.y - 10, { steps: 3 });
  await M.mouse.move(box.x, box.y - 22, { steps: 4 });
  await W.waitForTimeout(400);
  const seen = await W.$$eval('#fries .fry', (els, i) => els[i] ? els[i].style.transform : 'gone', idx);
  console.log(`${who} dragging fry ${idx}; other screen sees transform:`, seen || '(none)');
  await M.mouse.move(box.x, box.y + 5); await M.mouse.up();
  await M.waitForTimeout(300);

  // play the round out with keyboard pulls
  let pulls = 0;
  for (let guard = 0; guard < 40; guard++) {
    if (await A.$('#result:not([hidden])') && await B.$('#result:not([hidden])')) break;
    const aTurn = (await turnName(A)) === 'Your turn';
    const bTurn = (await turnName(B)) === 'Your turn';
    const P = aTurn ? A : bTurn ? B : null;
    if (!P) { await A.waitForTimeout(250); continue; }
    const before = await A.evaluate(() => document.querySelector('#left').textContent);
    const ok = await P.evaluate(() => {
      const f = [...document.querySelectorAll('#fries .fry')].find(el => el.style.opacity !== '0' && !el.style.transform);
      if (!f) return false;
      f.focus(); f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    });
    if (!ok) { await A.waitForTimeout(250); continue; }
    pulls++;
    await A.waitForFunction(b => document.querySelector('#left').textContent !== b || !document.querySelector('#result').hidden || document.querySelector('.stage').classList.contains('jump'), before, { timeout: 5000 }).catch(() => {});
    await A.waitForTimeout(250);
  }
  await A.waitForSelector('#result:not([hidden])', { timeout: 8000 });
  await B.waitForSelector('#result:not([hidden])', { timeout: 8000 });
  const res = p => p.evaluate(() => ({ loser: document.querySelector('.res-card').dataset.loser, title: document.querySelector('.res-big').textContent }));
  const ra = await res(A), rb = await res(B);
  console.log(`after ${pulls} pulls -> A: ${ra.title} | B: ${rb.title} | loser on both: ${ra.loser} / ${rb.loser} | agree: ${ra.loser === rb.loser && ra.title !== rb.title}`);
  console.log('A buttons:', await A.$$eval('.res-actions button', e => e.map(x => x.textContent)), '| B:', (await B.textContent('.res-actions')).trim().slice(0, 60));

  // new match from host reaches guest
  await A.click('#r-main');
  await B.waitForFunction(() => document.querySelector('#result').hidden, null, { timeout: 8000 });
  console.log('new match reached guest:', await B.textContent('#left'));

  // host leaves -> guest told
  await A.close({ runBeforeUnload: true });
  await B.waitForSelector('#toast:not([hidden])', { timeout: 8000 }).catch(() => {});
  console.log('guest after host left:', (await B.textContent('#toast')).trim(), '| screen setup visible:', !!(await B.$('#setup:not([hidden])')));
  console.log('page errors:', errs.length ? errs : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e.message); process.exit(1); });
