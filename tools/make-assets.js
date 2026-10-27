// Renders the share image (og-image.png) and app icons (icons/) from the game's own carton drawing.
// Run: node tools/make-assets.js   (needs the dev dependencies: npm install, npx playwright install chromium)
const path = require('path');
const OUT = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito+Sans:opsz,wght@6..12,700;6..12,800&display=swap">';
// the game's own carton drawing from index.html (viewBox 0 0 120 120)
const fries = `<g clip-path="url(#fc)">
  <g fill="#e0c133"><rect x="33" y="20" width="9" height="50" rx="1.5"/><rect x="50" y="16" width="9" height="52" rx="1.5"/><rect x="66" y="18" width="9" height="52" rx="1.5"/><rect x="81" y="22" width="9" height="50" rx="1.5"/></g>
  <g fill="#f5dc4e"><rect x="27" y="28" width="9" height="46" rx="1.5"/><rect x="41" y="25" width="9" height="48" rx="1.5"/><rect x="57" y="23" width="9" height="50" rx="1.5"/><rect x="72" y="27" width="9" height="46" rx="1.5"/><rect x="86" y="30" width="8" height="44" rx="1.5"/></g>
  <g fill="#fff09a"><rect x="27" y="28" width="9" height="3"/><rect x="41" y="25" width="9" height="3"/><rect x="57" y="23" width="9" height="3"/><rect x="72" y="27" width="9" height="3"/><rect x="86" y="30" width="8" height="3"/></g></g>`;
const carton = (shadow = true) => `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="fc"><polygon points="-20,-80 140,-80 140,52 98,52 90,106 30,106 22,52 -20,52"/></clipPath></defs>
  ${shadow ? '<ellipse cx="60" cy="108" rx="34" ry="4.5" fill="rgba(28,41,69,.35)"/>' : ''}
  ${fries}
  <polygon points="22,52 98,52 90,106 30,106" fill="#e2534b"/><polygon points="66,52 98,52 90,106 46,106" fill="#c9433c"/>
</svg>`;
const fry = (x, y, r, s = 1) => `<div class="fly" style="left:${x}px;top:${y}px;transform:rotate(${r}deg) scale(${s})"><i></i></div>`;
const bg = 'radial-gradient(120% 90% at 50% 120%, #3f72c4 0%, transparent 60%), #5a8ee0';

function icon(size, inset, rounded) {
  return `<!doctype html><html><head>${FONTS}<style>
  html,body{margin:0;width:${size}px;height:${size}px;background:transparent}
  .bg{position:absolute;inset:0;background:${bg};${rounded ? `border-radius:${size * .22}px;` : ''}overflow:hidden}
  .bg::before{content:"";position:absolute;left:50%;top:46%;width:${size * 2}px;height:${size * 2}px;margin:-${size}px 0 0 -${size}px;
    background:repeating-conic-gradient(rgba(255,255,255,.10) 0 9deg,transparent 9deg 18deg);border-radius:50%}
  svg{position:absolute;left:${inset}%;top:${inset - 2}%;width:${100 - 2 * inset}%;height:${100 - 2 * inset}%}
  </style></head><body><div class="bg"></div>${carton()}</body></html>`;
}

const og = `<!doctype html><html><head>${FONTS}<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:${bg};font-family:"Nunito Sans",sans-serif;position:relative}
  .burst{position:absolute;left:840px;top:330px;width:1100px;height:1100px;margin:-550px 0 0 -550px;border-radius:50%;
    background:repeating-conic-gradient(rgba(245,220,78,.55) 0 8deg,transparent 8deg 16deg);
    -webkit-mask:radial-gradient(closest-side,#000 30%,transparent 75%)}
  .glow{position:absolute;left:840px;top:330px;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,240,154,.9),rgba(255,240,154,0))}
  .carton{position:absolute;left:600px;top:70px;width:480px;height:480px}
  .carton svg{width:100%;height:100%;filter:drop-shadow(0 10px 0 rgba(36,71,127,.35))}
  .fly{position:absolute;width:30px;height:150px}
  .fly i{position:absolute;inset:0;border-radius:5px;background:linear-gradient(90deg,#f5dc4e 0 62%,#e0c133 62%);box-shadow:inset 0 10px 0 #fff09a}
  .bit{position:absolute;width:16px;height:26px;border-radius:3px}
  .text{position:absolute;left:72px;top:58px;width:560px}
  h1{font-family:"Lilita One";font-weight:400;font-size:104px;line-height:.95;margin:0;color:#fff;text-shadow:0 7px 0 #24477f;letter-spacing:.5px}
  h1 span{display:block;color:#f5dc4e}
  p{margin:34px 0 0;font-size:31px;line-height:1.3;font-weight:800;color:#fff;max-width:520px;text-shadow:0 2px 0 rgba(36,71,127,.45)}
  .chips{display:flex;gap:12px;margin-top:34px}
  .chips b{background:#fff;color:#1c2945;border-radius:999px;padding:10px 20px;font-size:21px;font-weight:800;box-shadow:0 5px 0 #24477f}
</style></head><body>
  <div class="glow"></div><div class="burst"></div>
  ${fry(700, 40, -28, .95)}${fry(1040, 10, 24, 1.05)}${fry(1110, 250, 58, .8)}${fry(640, 300, -62, .75)}
  <div class="carton">${carton()}</div>
  ${[[760,120,'#e2534b',20],[1000,170,'#fff',-30],[680,200,'#f5dc4e',45],[1130,120,'#e2534b',-10],[930,40,'#fff',60],[1150,420,'#f5dc4e',30],[620,470,'#fff',-40],[1080,520,'#e2534b',15]]
     .map(([x,y,c,r]) => `<i class="bit" style="left:${x}px;top:${y}px;background:${c};transform:rotate(${r}deg)"></i>`).join('')}
  <div class="text">
    <h1>The Frenchfries <span>Game</span></h1>
    <p>Everyone pulls a fry. Pull the trick fry and the whole carton blows.</p>
    <div class="chips"><b>Vs computer</b><b>Pass the phone</b><b>Own phones</b></div>
  </div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, file, transparent) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: OUT + '/' + file, omitBackground: !!transparent });
    await p.close(); console.log('wrote', file);
  };
  await shot(og, 1200, 630, 'og-image.png');
  await shot(icon(512, 12, false), 512, 512, 'icons/icon-512.png');
  await shot(icon(192, 12, false), 192, 192, 'icons/icon-192.png');
  await shot(icon(512, 21, false), 512, 512, 'icons/icon-maskable-512.png'); // carton inside the 80% safe zone
  await shot(icon(180, 12, false), 180, 180, 'icons/apple-touch-icon.png');
  await shot(icon(64, 6, true), 64, 64, 'icons/favicon-64.png', true);
  await b.close();
})();
