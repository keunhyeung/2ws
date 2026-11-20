'use strict';
/*
 * Renders the README images from hero.html and screens.html in headless Edge/Chrome,
 * then palette-compresses them with compress.py (needs Python + Pillow, optional).
 *
 *   node docs/readme/src/build.js
 *   EDGE="C:/path/to/chrome.exe" node docs/readme/src/build.js
 *
 * Output: docs/readme/hero-{light,dark}.png and docs/readme/screens/{name}-{light,dark}.png
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = __dirname;
const OUT = path.resolve(SRC, '..');
const NAMES = ['quiz', 'explain', 'dict', 'map', 'history', 'welcome'];
const THEMES = ['light', 'dark'];
const CANDIDATES = [
  process.env.EDGE,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) { console.error('No Edge/Chrome found. Set the EDGE environment variable.'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(width, height) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-build-'));
  const proc = spawn(BROWSER, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--allow-file-access-from-files',
    '--window-size=' + width + ',' + height, 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json'); target = (await r.json()).find((t) => t.type === 'page'); } catch (e) {}
    if (!target) await sleep(200);
  }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Page.enable'); await send('Runtime.enable');
  return { send, close: async () => { try { ws.close(); } catch (e) {} proc.kill(); await sleep(500); } };
}

async function render(b, file, query, width, height, dest) {
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await b.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await b.send('Page.navigate', { url: pathToFileURL(path.join(SRC, file)).href + '?' + query });
  for (let i = 0; i < 100; i++) {
    const r = await b.send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-ready')", returnByValue: true });
    if (r.result.value === '1') break;
    await sleep(100);
  }
  await sleep(200);
  const shot = await b.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(shot.data, 'base64'));
  console.log('wrote', path.relative(OUT, dest));
}

(async () => {
  const b = await launch(880, 400);
  try {
    for (const t of THEMES) await render(b, 'hero.html', 'theme=' + t, 880, 400, path.join(OUT, 'hero-' + t + '.png'));
    for (const t of THEMES) for (const n of NAMES) {
      await render(b, 'screens.html', 'theme=' + t + '&name=' + n, 300, 620, path.join(OUT, 'screens', n + '-' + t + '.png'));
    }
  } finally { await b.close(); }
  const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-X', 'utf8', path.join(SRC, 'compress.py')], { stdio: 'inherit' });
  if (py.status !== 0) console.warn('compress.py did not run; the PNGs are uncompressed.');
})().catch((e) => { console.error(e); process.exit(1); });
