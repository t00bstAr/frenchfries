// QR / link joining and screen addresses: host shows a QR for /join/<code>; opening it joins (asking for a name first if needed); browser back leaves.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  .replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: 'https://test.supabase.co'")
  .replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: 'test-key'");
const mock = fs.readFileSync(__dirname + '/mock-supabase.js', 'utf8');
const matter = fs.readFileSync(require.resolve('matter-js/build/matter.min.js'), 'utf8');
const qr = fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'), 'utf8');
const prof = n => JSON.stringify({ mode: 'online', tricks: 2, bestOf: 1, stake: '', muted: true, profileDone: true, me: { id: 'me', name: n, photo: null }, players: [] });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://game.test/')) return r.fulfill({ contentType: 'text/html', body: html });
    if (u.includes('supabase-js')) return r.fulfill({ contentType: 'application/javascript', body: mock });
    if (u.includes('matter')) return r.fulfill({ contentType: 'application/javascript', body: matter });
    if (u.includes('qrcode')) return r.fulfill({ contentType: 'application/javascript', body: qr });
    return r.abort();
  });
  const errs = [];
  const page = async (name, setup) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); if (setup) await setup(p); return p; };
  const urlPath = p => new URL(p.url()).pathname;

  const A = await page('A');
  await A.goto('http://game.test/'); await A.evaluate(v => localStorage.setItem('ffg.v2', v), prof('Anna')); await A.reload();
  console.log('A start:', urlPath(A));
  await A.click('#play'); console.log('A after Play:', urlPath(A));
  
  await A.waitForFunction(() => document.querySelector('#online-note').dataset.state === 'connected');
  await A.click('#start'); await A.waitForSelector('#lobby:not([hidden])');
  const code = (await A.textContent('#lobby-code')).trim();
  const link = await A.getAttribute('#lobby-qr', 'data-link');
  console.log('A lobby:', urlPath(A), '| QR visible:', await A.isVisible('#lobby-qr-img svg'), '| QR link:', link);

  const B = await page('B');
  await B.goto(link);
  await B.waitForSelector('#lobby:not([hidden])', { timeout: 8000 });
  await A.waitForFunction(() => document.querySelectorAll('#lobby-seats .seat-row').length === 2, null, { timeout: 8000 });
  console.log('B (guest) sees QR:', await B.isVisible('#lobby-qr'), '| host sees QR:', await A.isVisible('#lobby-qr'));
  console.log('B (has player) opened QR link -> screen lobby, url', urlPath(B), '| seats:', (await B.$$eval('#lobby-seats .n', e => e.map(x => x.textContent))).join(', '));

  const C = await page('C', p => p.addInitScript(() => { if (!sessionStorage.cleared) { localStorage.removeItem('ffg.v2'); sessionStorage.cleared = 1; } }));
  await C.goto(link);
  await C.waitForSelector('#profile:not([hidden])');
  console.log('C (no player) opened QR link -> profile, url', urlPath(C), '| button:', await C.textContent('#profile-save'));
  await C.fill('#profile-name', 'Carl'); await C.click('#profile-save');
  await C.waitForSelector('#lobby:not([hidden])', { timeout: 8000 });
  await A.waitForFunction(() => document.querySelectorAll('#lobby-seats .seat-row').length === 3, null, { timeout: 8000 });
  console.log('C after save -> lobby, url', urlPath(C), '| A seats:', (await A.$$eval('#lobby-seats .n', e => e.map(x => x.textContent))).join(', '));
  

  await C.goBack();
  await C.waitForSelector('#setup:not([hidden])', { timeout: 5000 });
  await A.waitForFunction(() => document.querySelectorAll('#lobby-seats .seat-row').length === 2, null, { timeout: 8000 });
  console.log('C pressed browser back -> setup, url', urlPath(C), '| A seats now:', await A.$$eval('#lobby-seats .n', e => e.length));

  await A.click('#lobby-start'); await B.waitForSelector('#game:not([hidden])', { timeout: 8000 });
  console.log('game started; A url', urlPath(A), '| B url', urlPath(B));

  const D = await page('D'); await D.goto('http://game.test/new'); console.log('D direct /new (shared profile) ->', await D.evaluate(() => ['intro','profile','setup','lobby','game'].find(s => !document.getElementById(s).hidden)), urlPath(D));
  await D.click('#to-intro'); console.log('D back arrow ->', urlPath(D)); await D.goBack(); console.log('D browser back ->', urlPath(D), await D.evaluate(() => ['intro','profile','setup'].find(s => !document.getElementById(s).hidden)));
  console.log('page errors:', errs.length ? errs : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e.message); process.exit(1); });
