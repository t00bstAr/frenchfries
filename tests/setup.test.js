// Setup screen: pass-the-phone player rules, the open-games count, and the QR scanner (fake camera, built-in reader and jsQR fallback).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const jsqr = fs.readFileSync(require.resolve('jsqr/dist/jsQR.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: 'https://test.supabase.co'").replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: 'test-key'");
const mock = fs.readFileSync(__dirname + '/mock-supabase.js', 'utf8');
const matter = fs.readFileSync(require.resolve('matter-js/build/matter.min.js'), 'utf8');
const qrlib = fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'), 'utf8');
const prof = (n, o) => JSON.stringify(Object.assign({ mode: 'online', tricks: 2, bestOf: 1, stake: '', muted: true, profileDone: true, me: { id: 'me', name: n, photo: null }, players: [{ id: 'p1', name: 'Tobias', photo: null }, { id: 'p2', name: 'Mia', photo: null }] }, o || {}));
// fake camera: a canvas stream showing a QR code for the given text
const fakeCam = (text, noDetector) => `${qrlib}
  ${noDetector ? 'delete window.BarcodeDetector;' : ''}
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas'); c.width = 480; c.height = 480; const g = c.getContext('2d');
    const q = qrcode(0, 'M'); q.addData(${JSON.stringify(text)}); q.make(); const n = q.getModuleCount(), cell = Math.floor(360 / n), off = (480 - cell * n) / 2;
    const draw = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 480); g.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell); requestAnimationFrame(draw); };
    draw(); return c.captureStream(15);
  };`;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('https://game.test/')) return r.fulfill({ contentType: 'text/html', body: html });
    if (u.includes('supabase-js')) return r.fulfill({ contentType: 'application/javascript', body: mock });
    if (u.includes('matter')) return r.fulfill({ contentType: 'application/javascript', body: matter });
    if (u.includes('qrcode-generator')) return r.fulfill({ contentType: 'application/javascript', body: qrlib });
    if (u.includes('jsqr')) return r.fulfill({ contentType: 'application/javascript', body: jsqr });
    return r.abort(); });
  const page = async (n, init) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message)); if (init) await p.addInitScript(init); return p; };
  const vis = (p, sel) => p.isVisible(sel);

  // ---- pass the phone ----
  const P1 = await page('pass'); await P1.goto('https://game.test/'); await P1.evaluate(v => localStorage.setItem('ffg.v2', v), prof('Chomparoo', { mode: 'pass' })); await P1.goto('https://game.test/new');
  const rows = () => P1.$$eval('#plist .prow', e => e.map(r => (r.querySelector('.me-name') || r.querySelector('input')).textContent || r.querySelector('input').value).join(', '));
  const state = async label => console.log(label.padEnd(26), '| rows:', await rows(), '| add buttons:', await P1.$$eval('#plist .add', e => e.map(x => x.textContent).join(' / ')), '| need-two:', await vis(P1, '.need-two'), '| start disabled:', await P1.$eval('#start', e => e.disabled));
  await state('start');
  await P1.click('[data-rm="me"]'); await state('removed me');
  await P1.click('[data-rm="p1"]'); await state('removed Tobias');
  await P1.click('[data-rm="p2"]'); await state('removed everyone');
  await P1.click('#add-me'); await state('added myself');
  await P1.click('[data-rm="me"]'); await P1.click('#add-player'); await P1.click('#add-player'); await state('no me, 2 others');
  await P1.click('#start'); await P1.waitForSelector('#game:not([hidden])');
  console.log('game started without me; seats:', await P1.$$eval('.strip .cn', e => e.map(x => x.textContent).join(', ')));

  // ---- online: 3 hosts -> count ----
  const hosts = [];
  for (const n of ['Anna', 'Bo', 'Carl']) { const h = await page(n); await h.goto('https://game.test/'); await h.evaluate(v => localStorage.setItem('ffg.v2', v), prof(n)); await h.goto('https://game.test/new');
    await h.waitForFunction(() => document.querySelector('#online-note').dataset.state === 'connected'); await h.click('#start'); await h.waitForSelector('#lobby:not([hidden])'); hosts.push(h); }
  const code = (await hosts[0].textContent('#lobby-code')).trim();
  const link = await hosts[0].getAttribute('#lobby-qr', 'data-link');

  for (const [label, noDet] of [['built-in BarcodeDetector', false], ['jsQR fallback (Safari)', true]]) {
    const V = await page('viewer', fakeCam(link, noDet)); await V.goto('https://game.test/'); await V.evaluate(v => localStorage.setItem('ffg.v2', v), prof('Viewer')); await V.goto('https://game.test/new');
    await V.waitForFunction(() => document.querySelector('.games-count'), null, { timeout: 8000 });
    if (!noDet) { console.log('viewer with 3 hosts sees:', (await V.textContent('#open-games')).trim().replace(/\s+/g, ' ')); }
    console.log('has BarcodeDetector:', await V.evaluate(() => 'BarcodeDetector' in window));
    await V.click('#scan-btn');
    await V.waitForSelector('#lobby:not([hidden])', { timeout: 15000 });
    console.log(label.padEnd(26), '| scanned and joined game', (await V.textContent('#lobby-code')).trim(), '(host code ' + code + ') | scanner closed:', await V.$eval('#scan', e => e.hidden));
    await V.close();
  }
  // a QR that isn't a game
  const W = await page('wrong', fakeCam('https://example.com/hello', true)); await W.goto('https://game.test/'); await W.evaluate(v => localStorage.setItem('ffg.v2', v), prof('W')); await W.goto('https://game.test/new');
  await W.waitForFunction(() => document.querySelector('#online-note').dataset.state === 'connected');
  await W.click('#scan-btn'); await W.waitForFunction(() => /not a game code/.test(document.querySelector('#scan-tip').textContent), null, { timeout: 10000 });
  console.log('wrong QR tip:', await W.textContent('#scan-tip')); await W.click('#scan-cancel'); console.log('cancel closes scanner:', await W.$eval('#scan', e => e.hidden));
  console.log('page errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
