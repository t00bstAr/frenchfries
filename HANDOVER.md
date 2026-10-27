# Handover: The Frenchfries Game → Supabase + Netlify

You're picking up a finished browser game and need to wire it up for real: connect online play to Supabase, test it, push it to GitHub and deploy it on Netlify. The game code is done. Treat this as wiring and verification, not a rewrite.

## Status from the owner

- The project folder is on disk (originally from `frenchfries-game.zip`: `index.html`, `README.md` and this file).
- **A Supabase project has been created, but nothing is set up in it.** No keys have been copied, and no settings have been checked.
- **A git repo has been created** and is meant to be deployed to Netlify once everything works.
- Goal: the owner opens the Netlify link on two phones, one hosts a game, the other sees it under "Open games", and they play together.

## What the game is

A party / "draw straws" game. A carton of 16 fries contains 1–3 hidden trick fries. Players take turns dragging a fry out of the carton, and whoever pulls a trick fry makes the whole carton explode and loses the round. Modes: **Vs computer**, **Pass the phone**, and **Online** (each player on their own phone). Best of 1/3/5 rounds, optional "What are we deciding?" stake, selfie avatars, and a one-time "Your player" profile.

Everything lives in **one file, `index.html`**: HTML, CSS and JS, no build step and no framework. Libraries load from CDNs:
- `matter-js@0.19.0` (cdnjs): physics for the explosion
- `@supabase/supabase-js@2.45.4` (jsdelivr UMD build, global `window.supabase`)
- Google Fonts: Lilita One, Nunito Sans

Player profile and settings are kept in `localStorage` (key `ffg.v2`). Nothing is stored server-side.

## How online play works (read before touching it)

The game was first built inside Claude's own page sandbox, which had a built-in real-time "room" API. That has been swapped for a small **Supabase Realtime adapter** that exposes the same API, so the game logic didn't change.

- **Where:** in `index.html`, find `window.FFG_CONFIG` (the "ONLINE PLAY SETTINGS" block in `<head>`) and `window.createFfgRoom` right after it. The game calls `window.createFfgRoom()`.
- **Channels:**
  - `ffg-lobby`: everyone with the site open joins it. A host announces an open game in its presence as `{ host: { c: "<4-digit code>", n: "<name>", k: <players>, w: 1 } }`. That's how "Open games" fills up.
  - `ffg-room-ffg-<code>`: one per game.
- **Presence vs broadcast:** Supabase lets each client update presence only ~5 times per 30 s (more and it closes the channel with "Client presence rate limit exceeded"). So Supabase **presence** is tracked once per channel and only says *who is here* (presence key = random per-tab id). Each client's state travels as a **broadcast** `event: 's'` (`{ k, v: <counter>, s: state }`), re-sent whenever someone new joins since broadcasts aren't stored. Fast drag updates (the `d` field) go as broadcast `event: 'd'`. The adapter merges it all back, so the game sees one presence object per player.
- **Host is the referee:** the host's state holds the whole game (`{ r: 'h', n, ph, s: <state> }`). Guests send `{ r: 'g', n, ph }`, plus a pull request `{ pull: { i, k, r, m } }` that the host validates (right turn, round and match, fresh counter) before applying.
- **Throttling:** state broadcasts are coalesced to at most about one every 150 ms. Drag broadcasts go out at most every 80 ms. The client is created with `realtime.params.eventsPerSecond = 20`. Keep total traffic under that.
- **Ending:** if the host leaves, guests get "The host left the game." and return to setup.
- No database tables, no Row Level Security policies and no auth are needed. Clients connect anonymously with the anon/publishable key.

## Your tasks

### 1. Get the Supabase connection details
You need the **Project URL** (`https://<ref>.supabase.co`) and the **anon public key**. Newer dashboards call it the **publishable key** (`sb_publishable_...`); supabase-js accepts either.

Use whatever is available to you, in this order:
- A Supabase MCP server, if one is configured.
- The Supabase CLI: `supabase login`, then `supabase projects list` to find the ref, then `supabase projects api-keys --project-ref <ref>`.
- Otherwise, ask the owner to paste both values. They're in the dashboard under Project Settings → API (or API Keys).

**Never use the `service_role` or secret key.** It would be exposed in a public page.

### 2. Check the Realtime settings
In the Supabase dashboard, go to Realtime → Settings. **"Private channels only" must be OFF**, because the game uses public channels with the anon key. It's off by default for new projects. If you can't check this yourself, ask the owner to confirm. This is the most likely reason two devices both connect (green dot by "Open games") but never see each other's games.

### 3. Put the keys in
Edit the `window.FFG_CONFIG` block in `index.html`:

```js
window.FFG_CONFIG = {
  SUPABASE_URL: 'https://<ref>.supabase.co',
  SUPABASE_ANON_KEY: '<anon or publishable key>'
};
```

The anon key is meant to be public, so committing it is fine.

### 4. Test locally
1. **Automated two-player test, no Supabase needed.** Appendix A is a mock Supabase that links browser tabs through a `BroadcastChannel`. Appendix B is a Playwright script. It hosts a game, joins from a second tab, checks live drag, plays a round to the explosion, checks both screens agree, starts a rematch, and checks what happens when the host leaves. Save them as `tests/mock-supabase.js` and `tests/two-player.test.js`, run `npm i -D playwright matter-js@0.19.0` and `npx playwright install chromium`, then `node tests/two-player.test.js`. A passing run prints `agree: true`, `The host left the game.` and `page errors: none`.
2. **Real Supabase test.** Serve the folder (`npx serve -s .`) and open it in two separate browser windows (or a normal and a private window). In each one, set up a player, tap Play, and choose **Online**. The dot next to "Open games" should turn green, and the hosted game should appear in the other window's list. Host in one window and join from the other, then play a round.
   - If the line says "Online play isn't set up yet": the config still has placeholders.
   - If it says "Can't reach the game server": the URL or key is wrong, or the network is blocking it. Check the browser console.
   - If both dots are green but neither sees the other's game: re-check step 2.

### 5. Git and Netlify
- Add a `.gitignore` containing `node_modules/`, `.DS_Store` and `.netlify/`. Commit `index.html`, `README.md`, `HANDOVER.md`, `tests/`, `netlify.toml` and `package.json` (if created). Push to the owner's existing repo. Ask which remote and branch if it isn't already configured.
- Add `netlify.toml`:

  ```toml
  [build]
    publish = "."
    command = ""

  [[headers]]
    for = "/index.html"
    [headers.values]
      Cache-Control = "public, max-age=0, must-revalidate"
  ```

- Deploy: with the Netlify CLI (`npm i -g netlify-cli`, `netlify login`, `netlify init`), link the site to the GitHub repo so every push deploys. There's no build command and the publish directory is `.`. If the CLI isn't an option, tell the owner to use app.netlify.com → Add new site → Import from Git and pick the repo.
- Suggest a site name such as `frenchfries-game`, and confirm it with the owner first.
- After deploying, open the live URL in two windows and repeat the real test from step 4.

### 6. Report back to the owner
Give them the live URL, what you tested, and that on phones they can use Share → Add to Home Screen.

## Things not to change without asking
- Game feel: drag gearing (lift = 1.8 × thumb travel until the fry clears the rim), trick fry snapping at 45% of the pull, tension, heartbeat, explosion physics.
- The design: colours come from the original app icon (blue `#5a8ee0`, red carton `#e2534b`, yellow fries `#f5dc4e`).
- The adapter's public shape (`peers`, `onPeers`, `onConnection`, `presence`, `join`, `leave`, `connected`), because the game code depends on it.

## Possible next steps (only if the owner asks)
- A server-side referee (Supabase Edge Function or PartyKit), so a game survives the host leaving.
- A PWA manifest and service worker for offline play against the computer.
- Wrapping it with Capacitor for the App Store, with real nearby/Bluetooth discovery (Apple Multipeer Connectivity, Google Nearby Connections).

---

## Appendix A: `tests/mock-supabase.js`

```js
// Fake Supabase Realtime for tests: tabs in the same browser share a BroadcastChannel bus.
(function () {
  const bus = new BroadcastChannel('mock-rt');
  const chans = new Set();
  bus.onmessage = e => chans.forEach(c => c._in(e.data));
  function channel(topic, opts) {
    const key = opts.config.presence.key;
    const state = {}; // key -> {s}
    const H = { sync: [], bc: {} };
    let mine = null, subbed = false;
    const c = {
      on(type, filter, cb) { if (type === 'presence') H.sync.push(cb); else (H.bc[filter.event] = H.bc[filter.event] || []).push(cb); return c; },
      subscribe(cb) {
        chans.add(c); subbed = true;
        setTimeout(() => { bus.postMessage({ t: topic, k: 'hello', from: key }); cb('SUBSCRIBED'); }, 30);
        return c;
      },
      track(s) { mine = s; state[key] = [s]; bus.postMessage({ t: topic, k: 'track', from: key, s }); fire(); return Promise.resolve('ok'); },
      send(m) { bus.postMessage({ t: topic, k: 'bc', from: key, ev: m.event, payload: m.payload }); return Promise.resolve('ok'); },
      presenceState() { return state; },
      _in(m) {
        if (m.t !== topic || m.from === key || !subbed) return;
        if (m.k === 'hello') { if (mine) bus.postMessage({ t: topic, k: 'track', from: key, s: mine }); }
        else if (m.k === 'track') { state[m.from] = [m.s]; fire(); }
        else if (m.k === 'leave') { delete state[m.from]; fire(); }
        else if (m.k === 'bc') (H.bc[m.ev] || []).forEach(f => f({ payload: m.payload }));
      },
      _leave() { subbed = false; chans.delete(c); bus.postMessage({ t: topic, k: 'leave', from: key }); }
    };
    function fire() { setTimeout(() => H.sync.forEach(f => f()), 5); }
    addEventListener('pagehide', () => c._leave());
    return c;
  }
  window.supabase = { createClient: () => ({ channel, removeChannel: c => { c._leave(); return Promise.resolve('ok'); } }) };
})();
```

## Appendix B: `tests/two-player.test.js`

Expects `index.html` one level up from `tests/`. It loads the game from a fake origin, swaps the Supabase CDN script for the mock, injects test keys, and blocks all other network requests (fonts fall back, which is fine).

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
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
    if (u.includes('supabase-js')) return r.fulfill({ contentType: 'application/javascript', body: mock });
    if (u.includes('matter')) return r.fulfill({ contentType: 'application/javascript', body: matter });
    return r.abort();
  });
  const errs = [];
  const open = async name => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://game.test/');
    await p.evaluate(v => { localStorage.setItem('ffg.v2', v); }, prof(name));
    await p.reload();
    await p.click('#play');
    await p.waitForFunction(() => /Connected/.test(document.querySelector('#online-note').textContent), null, { timeout: 8000 });
    return p;
  };
  const A = await open('Anna');
  await A.click('#start');
  await A.waitForSelector('#lobby:not([hidden])');
  const code = (await A.textContent('#lobby-code')).trim();
  console.log('host code', code);

  const B = await open('Mads');
  await B.waitForSelector('[data-join]', { timeout: 8000 });
  console.log('B sees open game:', await B.textContent('.game-row b'), '| B status:', await B.textContent('#online-note'));
  await B.click('[data-join]');
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
  const ra = (await A.textContent('.res-name')).trim(), rb = (await B.textContent('.res-name')).trim();
  console.log(`after ${pulls} pulls -> A result: ${ra} | B result: ${rb} | agree: ${ra === rb}`);
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
```
