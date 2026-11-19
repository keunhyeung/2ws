(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TermFigures = api;
})(typeof globalThis === 'object' ? globalThis : window, function () {
  'use strict';

  const W = 300, H = 190, MARGIN = 2;

  const finite = n => {
    if (!Number.isFinite(n)) throw new Error('figure coordinate is not finite: ' + n);
    return n;
  };
  const fmt = n => String(Math.round(finite(n) * 10) / 10);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const linspace = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  const sample = (fn, a, b, n = 64) => linspace(a, b, n).map(x => [x, fn(x)]);
  const sum = list => list.reduce((a, b) => a + b, 0);

  const math = {};

  math.frontierUpper = (p, s) => p.m0 + Math.sqrt(Math.max(s - p.s0, 0) / p.k);
  math.frontierLower = (p, s) => p.m0 - Math.sqrt(Math.max(s - p.s0, 0) / p.k);
  math.frontierRisk = (p, mu) => p.s0 + p.k * (mu - p.m0) ** 2;
  math.frontierSlope = (p, s) => 1 / (2 * Math.sqrt(p.k * (s - p.s0)));
  math.tangentFromIntercept = (p, rf) => {
    const gap = p.m0 - rf, d = -gap + Math.sqrt(gap * gap + p.s0 / p.k);
    const sigma = p.s0 + p.k * d * d;
    return { sigma, mu: p.m0 + d, slope: 1 / (2 * p.k * d), intercept: rf };
  };
  math.indifferenceThrough = (p, sp, q) => {
    const mu = math.frontierUpper(p, sp), slope = math.frontierSlope(p, sp);
    return s => mu + slope * (s - sp) + q * (s - sp) ** 2;
  };
  math.utilityCurve = (level, c, s) => level + c * s * s;
  math.portfolioRisk = (n, variance, cov) => Math.sqrt(cov + (variance - cov) / n);

  const gUp = (x, tau) => (1 - Math.exp(-x / tau)) / (1 - Math.exp(-1 / tau));
  const gDown = (x, tau) => (Math.exp(-x / tau) - Math.exp(-1 / tau)) / (1 - Math.exp(-1 / tau));
  math.rise = (x, y0, y1, tau) => y0 + (y1 - y0) * gUp(x, tau);
  math.fall = (x, y0, y1, tau) => y1 + (y0 - y1) * gDown(x, tau);

  math.bondPrice = (y, n) => 100 / (1 + y) ** n;
  math.bondSlope = (y, n) => -n * math.bondPrice(y, n) / (1 + y);

  const SPOT = 100;
  const PREMIUM = { call: { 80: 23, 100: 8, 120: 2 }, put: { 80: 3, 100: 8, 120: 22 } };
  const call = (strike, qty) => ({ type: 'call', strike, qty });
  const put = (strike, qty) => ({ type: 'put', strike, qty });
  const POSITIONS = {
    'long-call': [call(100, 1)],
    'short-call': [call(100, -1)],
    'long-put': [put(100, 1)],
    'short-put': [put(100, -1)],
    'long-straddle': [call(100, 1), put(100, 1)],
    'short-straddle': [call(100, -1), put(100, -1)],
    'long-strangle': [put(80, 1), call(120, 1)],
    'short-strangle': [put(80, -1), call(120, -1)],
    'bull-spread': [call(80, 1), call(120, -1)],
    'bear-spread': [call(80, -1), call(120, 1)],
    'butterfly': [call(80, 1), call(100, -2), call(120, 1)],
    'covered-call': [{ type: 'stock', qty: 1 }, call(100, -1)],
    'protective-put': [{ type: 'stock', qty: 1 }, put(100, 1)],
  };
  const legPayoff = (leg, price) => {
    if (leg.type === 'stock') return leg.qty * (price - SPOT);
    const intrinsic = leg.type === 'call' ? Math.max(price - leg.strike, 0) : Math.max(leg.strike - price, 0);
    return leg.qty * (intrinsic - PREMIUM[leg.type][leg.strike]);
  };
  math.payoff = (kind, price) => {
    const legs = POSITIONS[kind];
    if (!legs) throw new Error('unknown option position: ' + kind);
    return sum(legs.map(leg => legPayoff(leg, price)));
  };
  math.strikes = kind => [...new Set(POSITIONS[kind].filter(leg => leg.type !== 'stock').map(leg => leg.strike))].sort((a, b) => a - b);
  const PRICE_RANGE = [60, 140];
  math.kinks = (kind, range = PRICE_RANGE) => [...new Set([...range, ...math.strikes(kind)])].sort((a, b) => a - b);
  math.breakEvens = (kind, range = PRICE_RANGE) => {
    const ks = math.kinks(kind, range), out = [];
    for (let i = 0; i + 1 < ks.length; i++) {
      const a = ks[i], b = ks[i + 1], pa = math.payoff(kind, a), pb = math.payoff(kind, b);
      if (pa === 0) out.push(a);
      else if (pa * pb < 0) out.push(a + (b - a) * pa / (pa - pb));
    }
    if (math.payoff(kind, ks[ks.length - 1]) === 0) out.push(ks[ks.length - 1]);
    return out;
  };
  math.optionKinds = Object.keys(POSITIONS);

  math.normalPdf = (x, mean = 0, sd = 1) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  math.erf = x => {
    const ax = Math.abs(x);
    if (ax > 6) return Math.sign(x);
    let term = ax, total = ax;
    for (let n = 1; n < 80; n++) {
      term *= -ax * ax / n;
      total += term / (2 * n + 1);
    }
    return Math.sign(x) * 2 / Math.sqrt(Math.PI) * total;
  };
  math.normalCdf = x => 0.5 * (1 + math.erf(x / Math.SQRT2));
  math.normalQuantile = p => {
    let lo = -8, hi = 8;
    for (let i = 0; i < 90; i++) {
      const mid = (lo + hi) / 2;
      if (math.normalCdf(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  math.gamma3Pdf = x => (x > 0 ? x * x * Math.exp(-x) / 2 : 0);
  const FAT = { w: 0.7, s1: 0.5, s2: 1.9 };
  math.fatTailPdf = x => FAT.w * math.normalPdf(x, 0, FAT.s1) + (1 - FAT.w) * math.normalPdf(x, 0, FAT.s2);
  math.fatTailVariance = () => FAT.w * FAT.s1 ** 2 + (1 - FAT.w) * FAT.s2 ** 2;
  math.integrate = (fn, a, b, n = 4000) => {
    const h = (b - a) / n;
    let total = (fn(a) + fn(b)) / 2;
    for (let i = 1; i < n; i++) total += fn(a + i * h);
    return total * h;
  };
  math.moments = (pdf, a, b) => {
    const mass = math.integrate(pdf, a, b);
    const mean = math.integrate(x => x * pdf(x), a, b) / mass;
    const variance = math.integrate(x => (x - mean) ** 2 * pdf(x), a, b) / mass;
    const skew = math.integrate(x => (x - mean) ** 3 * pdf(x), a, b) / mass / variance ** 1.5;
    const kurtosis = math.integrate(x => (x - mean) ** 4 * pdf(x), a, b) / mass / variance ** 2;
    return { mass, mean, variance, skew, kurtosis };
  };

  math.spot = t => 0.45 + 0.1 * t;
  math.futures = (t, basis0) => math.spot(t) + basis0 * (1 - t);

  math.longMA = x => 0.38 + 0.24 * x;
  math.shortMA = (x, direction) => math.longMA(x) + direction * 0.2 * Math.tanh(4.5 * (x - 0.45));

  const models = {
    frontier: { s0: 0.22, m0: 0.5, k: 4, sMax: 1 },
    optimal: { s0: 0.2, m0: 0.45, k: 4.5, sp: 0.55, q: 0.7, sMin: 0.33, sMax: 0.9 },
    cml: { s0: 0.3, m0: 0.42, k: 4.5, rf: 0.37, sMax: 1 },
    cal: { rf: 0.2, point: [0.45, 0.55], uMax: 0.95 },
    sml: { rf: 0.25, market: [1, 0.55], above: [1.5, 0.88], below: [1.45, 0.28], betaMax: 2 },
    cmlSml: { rf: 0.22, rise: 0.62 },
    indifference: { levels: [0.06, 0.22, 0.38], c: 1.5, sMax: 0.6, dxMax: 0.65 },
    diversification: { variance: 1, cov: 0.0625, nMax: 20, vMax: 1.05 },
    yieldCurve: { tau: 0.35, start: 0.5, up: 0.8, flat: 0.5, down: 0.2, xEnd: 0.82 },
    steepen: { tau: 0.35, y0: 0.3, before: 0.55, after: 0.82, xEnd: 0.82 },
    flatten: { tau: 0.35, y0: 0.3, before: 0.78, after: 0.52, xEnd: 0.82 },
    roll: { tau: 0.3, y0: 0.2, y1: 0.85, xEnd: 0.95, rolldown: [0.7, 0.4], shoulder: [0.4, 0.1] },
    priceYield: { n: 12, yMax: 0.15, yTangent: 0.075, vScale: 108, yGap: 0.015 },
    bars: {
      barbell: [0.42, 0.05, 0.06, 0.05, 0.42],
      bullet: [0.06, 0.12, 0.64, 0.12, 0.06],
      ladder: [0.2, 0.2, 0.2, 0.2, 0.2],
      yMax: 0.7,
    },
    macro: { is: { y0: 0.86, slope: -0.62 }, lm: { y0: 0.16, slope: 0.8 }, uMin: 0.08, uMax: 0.92 },
    normal: { zMax: 3.4, vMax: 0.46 },
    skew: { xMax: 9, vMax: 0.31 },
    kurtosis: { zMax: 3.4, vMax: 0.68 },
    futures: { contango: { basis0: 0.22, dy: [0.3, 0.75] }, backwardation: { basis0: -0.22, dy: [0.15, 0.6] } },
    patterns: {
      'head-shoulders': { points: [[0, 0.2], [0.2, 0.6], [0.34, 0.4], [0.5, 0.84], [0.66, 0.42], [0.8, 0.62], [0.93, 0.24]] },
      'double-top': { points: [[0, 0.18], [0.24, 0.78], [0.5, 0.44], [0.76, 0.77], [0.94, 0.2]], level: 0.44 },
      'double-bottom': { points: [[0, 0.82], [0.24, 0.22], [0.5, 0.56], [0.76, 0.23], [0.94, 0.8]], level: 0.56 },
      support: { points: [[0, 0.78], [0.12, 0.3], [0.26, 0.62], [0.4, 0.3], [0.56, 0.7], [0.7, 0.3], [0.88, 0.66]], level: 0.3 },
      resistance: { points: [[0, 0.22], [0.12, 0.7], [0.26, 0.38], [0.4, 0.7], [0.56, 0.3], [0.7, 0.7], [0.88, 0.34]], level: 0.7 },
      trendline: { intercept: 0.16, slope: 0.52, lows: [0.1, 0.4, 0.7], highs: [[0.24, 0.3], [0.55, 0.32], [0.84, 0.3]] },
    },
  };
  const hs = models.patterns['head-shoulders'];
  hs.neckline = { through: hs.points[2], slope: (hs.points[4][1] - hs.points[2][1]) / (hs.points[4][0] - hs.points[2][0]) };
  models.neckline = u => hs.neckline.through[1] + hs.neckline.slope * (u - hs.neckline.through[0]);
  models.trendline = u => models.patterns.trendline.intercept + models.patterns.trendline.slope * u;
  models.trendPoints = () => {
    const m = models.patterns.trendline, L = models.trendline;
    const points = [[0, L(0) + 0.15]];
    const highs = m.highs;
    m.lows.forEach((u, i) => {
      points.push([u, L(u)]);
      if (highs[i]) points.push([highs[i][0], L(highs[i][0]) + highs[i][1]]);
    });
    points.push([0.96, L(0.96) + 0.12]);
    return points;
  };
  models.isLm = () => {
    const m = models.macro;
    const u = (m.lm.y0 - m.is.y0) / (m.is.slope - m.lm.slope);
    return { u, v: m.is.y0 + m.is.slope * u };
  };

  const frame = ({ left, right, top, bottom, dx = [0, 1], dy = [0, 1] }) => ({
    left, right, top, bottom,
    X: u => left + (u - dx[0]) * (right - left) / (dx[1] - dx[0]),
    Y: v => bottom - (v - dy[0]) * (bottom - top) / (dy[1] - dy[0]),
  });
  const FULL = { left: 34, right: 280, top: 26, bottom: 156 };
  const withRows = list => list.map(p => ({ ...p, top: 50, bottom: 152 }));
  const PANELS = withRows([{ left: 18, right: 134 }, { left: 168, right: 284 }]);
  const PANELS_WIDE = withRows([{ left: 16, right: 126 }, { left: 176, right: 286 }]);

  const newScene = kind => ({ kind, items: [], texts: [], obst: [], warnings: [], skipped: [] });
  const mapPts = (f, pts) => pts.map(([u, v]) => [f.X(u), f.Y(v)]);
  const closed = pts => [...pts, pts[0]];

  const LINE_CLASS = { main: 'v2-fig-main', sub: 'v2-fig-sub', dash: 'v2-fig-sub v2-fig-dash', axis: 'v2-fig-axis' };
  function addLine(s, kind, pts) {
    if (pts.length < 2) return;
    s.items.push({ k: 'line', cls: LINE_CLASS[kind], pts, kind });
    s.obst.push({ k: 'poly', pts });
  }
  const addArea = (s, pts) => s.items.push({ k: 'area', pts });
  function addDot(s, x, y, r = 4) {
    s.items.push({ k: 'dot', x, y, r });
    s.obst.push({ k: 'circle', x, y, r });
  }
  function addRect(s, x, y, w, h) {
    s.items.push({ k: 'rect', x, y, w, h });
    s.obst.push({ k: 'box', box: { x0: x, x1: x + w, y0: y, y1: y + h } });
  }
  function addHead(s, tip, dir, len = 8, half = 3.6) {
    const n = Math.hypot(dir[0], dir[1]), d = [dir[0] / n, dir[1] / n];
    const base = [tip[0] - d[0] * len, tip[1] - d[1] * len];
    const pts = [tip, [base[0] - d[1] * half, base[1] + d[0] * half], [base[0] + d[1] * half, base[1] - d[0] * half]];
    s.items.push({ k: 'head', pts });
    s.obst.push({ k: 'poly', pts: closed(pts) });
  }
  function addArrow(s, a, b, kind = 'main') {
    const dir = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(dir[0], dir[1]);
    const stem = [b[0] - dir[0] / n * 6, b[1] - dir[1] / n * 6];
    addLine(s, kind, [a, stem]);
    addHead(s, b, dir);
  }

  function clipSegment(a, b, box) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const test = (p, q) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (test(-dx, a[0] - box.x0) && test(dx, box.x1 - a[0]) && test(-dy, a[1] - box.y0) && test(dy, box.y1 - a[1])) {
      return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
    }
    return null;
  }
  function clipPolyline(pts, box) {
    const pieces = [];
    let current = null;
    for (let i = 0; i + 1 < pts.length; i++) {
      const seg = clipSegment(pts[i], pts[i + 1], box);
      if (!seg) { current = null; continue; }
      const last = current && current[current.length - 1];
      if (last && Math.hypot(last[0] - seg[0][0], last[1] - seg[0][1]) < 1e-6) current.push(seg[1]);
      else { current = [seg[0], seg[1]]; pieces.push(current); }
    }
    return pieces;
  }
  function addCurve(s, f, kind, dataPts) {
    const box = { x0: f.left - 1e-6, x1: f.right + 1e-6, y0: f.top - 1e-6, y1: f.bottom + 1e-6 };
    for (const piece of clipPolyline(mapPts(f, dataPts), box)) addLine(s, kind, piece);
  }

  const SIZE = { note: 12, name: 11, title: 12, small: 10.5 };
  const BOLD = { note: true, name: false, title: true, small: true };
  function textWidth(text, size, bold) {
    let units = 0;
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) units += 0.9;
      else if (ch === ' ') units += 0.3;
      else if (ch >= '0' && ch <= '9') units += 0.66;
      else if (ch === '%') units += 0.98;
      else if (ch === '(' || ch === ')') units += 0.38;
      else if (ch >= 'A' && ch <= 'Z') units += 0.72;
      else units += 0.58;
    }
    return units * size * (bold ? 1.02 : 1);
  }
  const boxOf = (x, y, anchor, size, w) => {
    const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    return { x0, x1: x0 + w, y0: y - size * 0.9, y1: y + size * 0.22 };
  };
  const inflate = (b, p) => ({ x0: b.x0 - p, x1: b.x1 + p, y0: b.y0 - p, y1: b.y1 + p });
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const PAD_LINE = 2.5, PAD_TEXT = 1.5, PAD_DOT = 2.5;

  function addText(s, text, x, y, anchor, cls) {
    const size = SIZE[cls], w = textWidth(text, size, BOLD[cls]);
    const t = { text, x, y, anchor, cls, size, w, box: boxOf(x, y, anchor, size, w) };
    s.texts.push(t);
    return t;
  }
  function firstHit(s, box, ignore) {
    if (box.x0 < MARGIN || box.x1 > W - MARGIN || box.y0 < MARGIN || box.y1 > H - MARGIN) return 'outside the figure';
    for (const t of s.texts) if (t !== ignore && overlap(inflate(box, PAD_TEXT), t.box)) return 'text ' + t.text;
    const line = inflate(box, PAD_LINE);
    for (const o of s.obst) {
      if (o.k === 'poly') {
        for (let i = 0; i + 1 < o.pts.length; i++) {
          const a = o.pts[i], b = o.pts[i + 1];
          if (Math.max(a[0], b[0]) < line.x0 || Math.min(a[0], b[0]) > line.x1 || Math.max(a[1], b[1]) < line.y0 || Math.min(a[1], b[1]) > line.y1) continue;
          if (clipSegment(a, b, line)) return 'line';
        }
      } else if (o.k === 'circle') {
        const nx = Math.min(Math.max(o.x, box.x0), box.x1), ny = Math.min(Math.max(o.y, box.y0), box.y1);
        if (Math.hypot(nx - o.x, ny - o.y) < o.r + PAD_DOT) return 'dot';
      } else if (o.k === 'box' && overlap(inflate(box, PAD_TEXT), o.box)) return 'bar';
    }
    return null;
  }
  function candidate(dir, g, size, px, py) {
    const d = g * 0.72;
    switch (dir) {
      case 'E': return { x: px + g, y: py + size * 0.35, anchor: 'start' };
      case 'W': return { x: px - g, y: py + size * 0.35, anchor: 'end' };
      case 'N': return { x: px, y: py - g - size * 0.22, anchor: 'middle' };
      case 'S': return { x: px, y: py + g + size * 0.9, anchor: 'middle' };
      case 'NE': return { x: px + d, y: py - d - size * 0.22, anchor: 'start' };
      case 'NW': return { x: px - d, y: py - d - size * 0.22, anchor: 'end' };
      case 'SE': return { x: px + d, y: py + d + size * 0.9, anchor: 'start' };
      default: return { x: px - d, y: py + d + size * 0.9, anchor: 'end' };
    }
  }
  function place(s, text, point, o = {}) {
    const cls = o.cls || 'note', size = SIZE[cls], w = textWidth(text, size, BOLD[cls]);
    const tries = (o.at || []).map(c => ({ ...c }));
    for (const step of o.steps || [1, 1.5, 2.2, 3]) {
      for (const dir of o.dirs || ['E', 'NE', 'SE', 'N', 'S', 'W', 'NW', 'SW']) {
        tries.push(candidate(dir, (o.gap || 8) * step, size, point[0], point[1]));
      }
    }
    for (const c of tries) {
      if (!firstHit(s, boxOf(c.x, c.y, c.anchor, size, w))) return addText(s, text, c.x, c.y, c.anchor, cls);
    }
    if (o.optional) { s.skipped.push(text); return null; }
    s.warnings.push(text + ' has no free spot');
    const c = tries[0];
    return addText(s, text, c.x, c.y, c.anchor, cls);
  }
  function collisions(s) {
    const out = [];
    for (const t of s.texts) {
      const hit = firstHit(s, t.box, t);
      if (hit) out.push({ text: t.text, hit });
    }
    return out;
  }

  function plot(kind, xName, yName, o = {}) {
    const f = frame({ ...FULL, ...o.box, dx: o.dx, dy: o.dy });
    const s = newScene(kind);
    s.frame = f;
    addLine(s, 'axis', [[f.left, f.top - 4], [f.left, f.bottom], [f.right + 10, f.bottom]]);
    if (yName) addText(s, yName, 6, 13, 'start', 'name');
    addText(s, xName, f.right + 12, f.bottom + (o.xDy || 20), 'end', 'name');
    return s;
  }
  function panels(kind, spec, layout = PANELS) {
    const s = newScene(kind);
    s.frames = spec.map((p, i) => {
      const f = frame({ ...layout[i], dx: p.dx, dy: p.dy });
      addText(s, p.title, (f.left + f.right) / 2 + 4, 15, 'middle', 'title');
      if (p.yName) addText(s, p.yName, f.left - 12, 34, 'start', 'name');
      addLine(s, 'axis', [[f.left, f.top - 4], [f.left, f.bottom], [f.right + 8, f.bottom]]);
      addText(s, p.xName, f.right + 10, f.bottom + (p.xNameDy || 19), 'end', 'name');
      return f;
    });
    return s;
  }

  const RISK = '위험(표준편차)', RET = '기대수익률', RF = '무위험수익률';
  const FIG = {};
  const define = (kinds, label, caption, build) => {
    for (const kind of [].concat(kinds)) FIG[kind] = { kind, label: label[kind] || label, caption: caption[kind] || caption, build: () => build({ kind }) };
  };

  const branches = (p, smax, n = 56) => {
    const reach = Math.sqrt((smax - p.s0) / p.k);
    return {
      upper: linspace(p.m0, p.m0 + reach, n).map(mu => [math.frontierRisk(p, mu), mu]),
      lower: linspace(p.m0, p.m0 - reach, n).map(mu => [math.frontierRisk(p, mu), mu]),
    };
  };
  const upperPoint = (f, p, s) => [f.X(s), f.Y(math.frontierUpper(p, s))];

  define(['frontier', 'frontier-mvp'], {
    frontier: '위험을 가로축, 기대수익률을 세로축으로 한 평면에서 오른쪽으로 열린 곡선의 가장 왼쪽 점이 최소분산 포트폴리오이고 그 점에서 위로 뻗은 굵은 선이 효율적 투자기회선이다.',
    'frontier-mvp': '위험을 가로축, 기대수익률을 세로축으로 한 평면에서 오른쪽으로 열린 곡선의 가장 왼쪽 점이 위험이 가장 작은 최소분산 포트폴리오다.',
  }, {
    frontier: '굵은 선이 효율적 투자기회선이다. 같은 위험에서 기대수익률이 가장 높은 포트폴리오만 이은 것이다.',
    'frontier-mvp': '곡선의 가장 왼쪽 점이 최소분산 포트폴리오다. 위험이 가장 작은 조합이다.',
  }, s0 => {
    const s = plot(s0.kind, RISK, RET), f = s.frame, p = models.frontier;
    const { upper, lower } = branches(p, p.sMax);
    addArea(s, mapPts(f, [...upper, ...lower.slice().reverse()]));
    addCurve(s, f, 'dash', lower);
    addCurve(s, f, 'main', upper);
    const vertex = [f.X(p.s0), f.Y(p.m0)];
    addDot(s, vertex[0], vertex[1]);
    place(s, '최소분산 포트폴리오', vertex, { dirs: ['E'], steps: [1, 1.5, 2, 2.6, 3.4] });
    place(s, '효율적 투자기회선', upperPoint(f, p, 0.5), { dirs: ['NW', 'W', 'N'], gap: 6 });
    return s;
  });

  define('indifference', '위험을 가로축, 기대수익률을 세로축으로 한 평면에 오른쪽 위로 휘며 올라가는 곡선 세 개가 겹치지 않게 쌓여 있고 왼쪽 위로 가는 화살표가 효용이 높아지는 방향을 가리킨다.',
    '한 곡선 위의 조합은 만족도가 같다. 왼쪽 위에 있는 곡선일수록 효용이 높다.', s0 => {
      const m = models.indifference;
      const s = plot(s0.kind, RISK, RET, { dx: [0, m.dxMax] }), f = s.frame;
      for (const level of m.levels) addCurve(s, f, 'main', sample(x => math.utilityCurve(level, m.c, x), 0, m.sMax, 48));
      addArrow(s, [f.X(0.2), f.Y(0.7)], [f.X(0.06), f.Y(0.82)]);
      addText(s, '효용이 높아지는 방향', f.X(0.03), f.Y(0.92) + 2, 'start', 'note');
      return s;
    });

  define('optimal', '위험을 가로축, 기대수익률을 세로축으로 한 평면에서 무차별 효용곡선 하나가 효율적 투자기회선의 위쪽 가지에 한 점에서만 맞닿고 그 점이 최적 포트폴리오다.',
    '효율적 투자기회선과 무차별 효용곡선이 맞닿는 점이 그 투자자의 최적 포트폴리오다.', s0 => {
      const s = plot(s0.kind, RISK, RET), f = s.frame, p = models.optimal;
      const { upper, lower } = branches(p, p.sMax);
      const indifference = math.indifferenceThrough(p, p.sp, p.q);
      addCurve(s, f, 'dash', lower);
      addCurve(s, f, 'sub', sample(indifference, p.sMin, p.sMax, 56));
      addCurve(s, f, 'main', upper);
      const tangent = upperPoint(f, p, p.sp);
      addDot(s, tangent[0], tangent[1]);
      place(s, '최적 포트폴리오', tangent, { dirs: ['SE', 'S', 'E', 'SW'], gap: 7 });
      place(s, '효율적 투자기회선', upperPoint(f, p, 0.3), { dirs: ['SE', 'E', 'S', 'NW'], gap: 6, optional: true });
      place(s, '무차별 효용곡선', [f.X(p.sMax), f.Y(indifference(p.sMax))], { dirs: ['NW', 'W', 'N'], gap: 6, optional: true });
      return s;
    });

  define('cml', '위험을 가로축, 기대수익률을 세로축으로 한 평면에서 세로축 위의 무위험수익률 점에서 나온 직선이 효율적 투자기회선에 시장 포트폴리오에서 맞닿고 그 너머로도 이어진 것이 자본시장선이다.',
    '무위험자산과 시장 포트폴리오를 섞은 조합이다. 기울기는 위험 한 단위당 초과수익이다.', s0 => {
      const s = plot(s0.kind, RISK, RET), f = s.frame, p = models.cml;
      const t = math.tangentFromIntercept(p, p.rf);
      addCurve(s, f, 'sub', sample(x => math.frontierUpper(p, x), p.s0, p.sMax, 56));
      addCurve(s, f, 'main', [[0, p.rf], [p.sMax, p.rf + t.slope * p.sMax]]);
      addDot(s, f.X(0), f.Y(p.rf));
      addDot(s, f.X(t.sigma), f.Y(t.mu));
      place(s, RF, [f.X(0), f.Y(p.rf)], { dirs: ['SE', 'E', 'NE'], gap: 8 });
      place(s, '시장 포트폴리오', [f.X(t.sigma), f.Y(t.mu)], { dirs: ['SE', 'S', 'E', 'SW'], gap: 7 });
      place(s, '자본시장선', [f.X(0.86), f.Y(p.rf + t.slope * 0.86)], { dirs: ['NW', 'N', 'W'], gap: 7 });
      return s;
    });

  define('cal', '위험을 가로축, 기대수익률을 세로축으로 한 평면에서 세로축 위의 무위험수익률 점에서 나온 직선이 위험자산 포트폴리오 점을 지나 오른쪽 위로 이어진 것이 자본배분선이다.',
    '무위험자산과 위험자산 포트폴리오를 섞을 때 가능한 조합이다. 기울기는 샤프비율이다.', s0 => {
      const s = plot(s0.kind, RISK, RET), f = s.frame, m = models.cal;
      const slope = (m.point[1] - m.rf) / m.point[0];
      addCurve(s, f, 'main', [[0, m.rf], [m.uMax, m.rf + slope * m.uMax]]);
      addDot(s, f.X(0), f.Y(m.rf));
      addDot(s, f.X(m.point[0]), f.Y(m.point[1]));
      place(s, RF, [f.X(0), f.Y(m.rf)], { dirs: ['SE', 'E'], gap: 8 });
      place(s, '위험자산 포트폴리오', [f.X(m.point[0]), f.Y(m.point[1])], { dirs: ['SE', 'S', 'E'], gap: 7 });
      return s;
    });

  define('sml', '베타를 가로축, 기대수익률을 세로축으로 한 평면에서 무위험수익률에서 시작해 베타 1의 시장 포트폴리오를 지나는 직선 위쪽의 점은 저평가, 아래쪽의 점은 고평가다.',
    '베타가 클수록 요구되는 기대수익률이 높다. 선보다 위에 있으면 저평가, 아래에 있으면 고평가다.', s0 => {
      const s = plot(s0.kind, '베타', RET, { dx: [0, models.sml.betaMax] }), f = s.frame, m = models.sml;
      const slope = m.market[1] - m.rf, line = b => m.rf + slope * b;
      addLine(s, 'dash', [[f.X(0), f.Y(m.market[1])], [f.X(m.market[0]), f.Y(m.market[1])]]);
      addLine(s, 'dash', [[f.X(m.market[0]), f.Y(0)], [f.X(m.market[0]), f.Y(m.market[1])]]);
      addCurve(s, f, 'main', [[0, line(0)], [m.betaMax, line(m.betaMax)]]);
      addDot(s, f.X(0), f.Y(m.rf));
      addDot(s, f.X(m.market[0]), f.Y(m.market[1]));
      addDot(s, f.X(m.above[0]), f.Y(m.above[1]));
      addDot(s, f.X(m.below[0]), f.Y(m.below[1]));
      addText(s, '1', f.X(m.market[0]), f.bottom + 14, 'middle', 'name');
      place(s, RF, [f.X(0), f.Y(m.rf)], { dirs: ['SE', 'E'], gap: 8 });
      place(s, '시장 포트폴리오', [f.X(m.market[0]), f.Y(m.market[1])], { dirs: ['SE', 'NW', 'S'], gap: 7 });
      place(s, '저평가', [f.X(m.above[0]), f.Y(m.above[1])], { dirs: ['E', 'W', 'N'], gap: 8 });
      place(s, '고평가', [f.X(m.below[0]), f.Y(m.below[1])], { dirs: ['E', 'W', 'S'], gap: 8 });
      return s;
    });

  define('cml-sml', '자본시장선과 증권시장선을 나란히 그린 두 그림에서 둘 다 무위험수익률에서 시작해 오른쪽 위로 올라가는 직선이고 가로축은 각각 표준편차와 베타다.',
    '자본시장선의 가로축은 총위험(표준편차)이고 증권시장선의 가로축은 체계적 위험(베타)이다.', s0 => {
      const spec = [{ title: '자본시장선', xName: '표준편차' }, { title: '증권시장선', xName: '베타' }].map(p => ({ ...p, yName: RET }));
      const s = panels(s0.kind, spec), m = models.cmlSml;
      for (const f of s.frames) {
        addCurve(s, f, 'main', [[0, m.rf], [0.96, m.rf + m.rise * 0.96]]);
        addDot(s, f.X(0), f.Y(m.rf));
        place(s, RF, [f.X(0), f.Y(m.rf)], { dirs: ['SE', 'E'], gap: 8 });
      }
      return s;
    });

  define('diversification', '종목 수를 가로축, 포트폴리오 위험을 세로축으로 한 평면에서 위험 곡선이 오른쪽 아래로 내려가며 수평 점선에 가까워지고 점선 아래는 체계적 위험, 곡선과 점선 사이는 비체계적 위험이다.',
    '종목을 늘리면 비체계적 위험은 줄지만 체계적 위험은 남는다.', s0 => {
      const m = models.diversification;
      const s = plot(s0.kind, '종목 수', '포트폴리오 위험', { dx: [1, m.nMax], dy: [0, m.vMax] }), f = s.frame;
      const risk = n => math.portfolioRisk(n, m.variance, m.cov), floor = Math.sqrt(m.cov);
      const curve = sample(risk, 1, m.nMax, 80);
      addArea(s, mapPts(f, [...curve, [m.nMax, floor], [1, floor]]));
      addCurve(s, f, 'dash', [[1, floor], [m.nMax, floor]]);
      addCurve(s, f, 'main', curve);
      place(s, '체계적 위험', [f.X(0.55 * m.nMax + 0.45), f.Y(floor)], { dirs: ['S', 'SE', 'SW'], gap: 8 });
      place(s, '비체계적 위험', [f.X(2.2), f.Y(floor)], {
        at: [{ x: f.X(2.1), y: f.Y(floor) - 6, anchor: 'start' }],
        dirs: ['NE', 'E', 'N'], gap: 6,
      });
      return s;
    });

  define('yield-curve', '잔존만기를 가로축, 수익률을 세로축으로 한 평면에서 한 점에서 출발한 세 선이 각각 올라가는 우상향, 그대로인 수평, 내려가는 우하향을 보여 준다.',
    '만기가 길수록 수익률이 높으면 우상향, 낮으면 우하향이다.', s0 => {
      const s = plot(s0.kind, '잔존만기', '수익률'), f = s.frame, m = models.yieldCurve;
      const up = x => math.rise(x, m.start, m.up, m.tau), down = x => math.fall(x, m.start, m.down, m.tau);
      addCurve(s, f, 'dash', sample(down, 0, m.xEnd, 56));
      addCurve(s, f, 'sub', [[0, m.flat], [m.xEnd, m.flat]]);
      addCurve(s, f, 'main', sample(up, 0, m.xEnd, 56));
      place(s, '우상향', [f.X(m.xEnd), f.Y(up(m.xEnd))], { dirs: ['E'], gap: 7 });
      place(s, '수평', [f.X(m.xEnd), f.Y(m.flat)], { dirs: ['E'], gap: 7 });
      place(s, '우하향', [f.X(m.xEnd), f.Y(down(m.xEnd))], { dirs: ['E'], gap: 7 });
      return s;
    });

  define(['steepen', 'flatten'], {
    steepen: '잔존만기를 가로축, 수익률을 세로축으로 한 평면에서 이전 곡선보다 이후 곡선이 단기 수익률은 비슷하고 장기 수익률이 더 높아 더 가파르다.',
    flatten: '잔존만기를 가로축, 수익률을 세로축으로 한 평면에서 이전 곡선보다 이후 곡선이 단기 수익률은 비슷하고 장기 수익률이 더 낮아 더 완만하다.',
  }, {
    steepen: '장기 금리와 단기 금리의 차이가 벌어진다.',
    flatten: '장기 금리와 단기 금리의 차이가 좁아진다.',
  }, s0 => {
    const s = plot(s0.kind, '잔존만기', '수익률'), f = s.frame, m = models[s0.kind];
    const before = x => math.rise(x, m.y0, m.before, m.tau), after = x => math.rise(x, m.y0, m.after, m.tau);
    addCurve(s, f, 'dash', sample(before, 0, m.xEnd, 56));
    addCurve(s, f, 'main', sample(after, 0, m.xEnd, 56));
    place(s, '이전', [f.X(m.xEnd), f.Y(before(m.xEnd))], { dirs: ['E'], gap: 7 });
    place(s, '이후', [f.X(m.xEnd), f.Y(after(m.xEnd))], { dirs: ['E'], gap: 7 });
    return s;
  });

  define(['rolldown', 'shoulder'], {
    rolldown: '잔존만기를 가로축, 수익률을 세로축으로 한 평면에서 오른쪽 위로 올라가는 곡선 위의 매입 시점에서 만기가 줄어 왼쪽 아래의 보유 후 점으로 곡선을 따라 내려간다.',
    shoulder: '잔존만기를 가로축, 수익률을 세로축으로 한 평면에서 곡선이 가파른 단기 구간의 매입 시점에서 만기가 줄어 보유 후 점으로 내려가며 수익률이 크게 낮아진다.',
  }, {
    rolldown: '곡선이 그대로면 만기가 줄면서 수익률이 내려가고 채권가격이 오른다.',
    shoulder: '곡선이 가파른 단기 구간에서는 만기가 줄 때 수익률이 더 크게 내려간다.',
  }, s0 => {
    const s = plot(s0.kind, '잔존만기', '수익률'), f = s.frame, m = models.roll;
    const curve = x => math.rise(x, m.y0, m.y1, m.tau);
    const [uRight, uLeft] = m[s0.kind];
    addCurve(s, f, 'main', sample(curve, 0, m.xEnd, 64));
    const path = linspace(uRight, uLeft, 24).map(u => [f.X(u), f.Y(curve(u))]);
    const shifted = path.map((p, i) => {
      const a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, path.length - 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty);
      return [p[0] + (ty / n) * 11, p[1] - (tx / n) * 11];
    });
    const stemEnd = shifted[shifted.length - 3], tip = shifted[shifted.length - 1];
    addLine(s, 'main', shifted.slice(0, shifted.length - 2).concat([stemEnd]));
    addHead(s, tip, [tip[0] - stemEnd[0], tip[1] - stemEnd[1]]);
    for (const u of [uRight, uLeft]) {
      addLine(s, 'dash', [[f.X(0), f.Y(curve(u))], [f.X(u), f.Y(curve(u))]]);
      addDot(s, f.X(u), f.Y(curve(u)));
    }
    place(s, '매입 시점', [f.X(uRight), f.Y(curve(uRight))], { dirs: ['SE', 'S', 'E'], gap: 7 });
    place(s, '보유 후', [f.X(uLeft), f.Y(curve(uLeft))], { dirs: ['SE', 'S', 'E'], gap: 7 });
    return s;
  });

  define(['price-yield-convexity', 'price-yield-duration'], {
    'price-yield-convexity': '수익률을 가로축, 채권가격을 세로축으로 한 평면에서 오른쪽 아래로 내려가며 휘는 실제 가격 곡선이 듀레이션으로 본 점선 직선보다 양쪽에서 위에 있고 그 차이가 볼록성이다.',
    'price-yield-duration': '수익률을 가로축, 채권가격을 세로축으로 한 평면에서 오른쪽 아래로 내려가는 가격 곡선에 한 점에서 맞닿는 점선 직선이 듀레이션으로 본 가격 변화다.',
  }, {
    'price-yield-convexity': '실제 가격 곡선은 직선보다 위에 있다. 그 차이가 볼록성이다.',
    'price-yield-duration': '수익률이 오르면 채권가격은 내린다. 듀레이션은 이 변화를 직선으로 어림한다.',
  }, s0 => {
    const s = plot(s0.kind, '수익률', '채권가격'), f = s.frame, m = models.priceYield;
    const price = y => math.bondPrice(y, m.n) / m.vScale, ty = m.yTangent, tp = price(ty), ts = math.bondSlope(ty, m.n) / m.vScale;
    const line = y => tp + ts * (y - ty);
    const u = y => y / m.yMax;
    addCurve(s, f, 'dash', [[0.02, line(0.02 * m.yMax)], [0.98, line(0.98 * m.yMax)]]);
    addCurve(s, f, 'main', sample(x => price(x * m.yMax), 0, 1, 64));
    addDot(s, f.X(u(ty)), f.Y(tp));
    place(s, '실제 가격', [f.X(0.58), f.Y(price(0.58 * m.yMax))], { dirs: ['NE', 'E', 'N'], gap: 7 });
    place(s, '듀레이션으로 본 직선', [f.X(0.7), f.Y(line(0.7 * m.yMax))], { dirs: ['SW', 'S', 'SE'], gap: 7, steps: [1, 1.5, 2.2, 3] });
    if (s0.kind === 'price-yield-convexity') {
      const g = m.yGap, top = [f.X(u(g)), f.Y(price(g))], bottom = [f.X(u(g)), f.Y(line(g))];
      addLine(s, 'main', [top, bottom]);
      addLine(s, 'main', [[top[0] - 3, top[1]], [top[0] + 3, top[1]]]);
      addLine(s, 'main', [[bottom[0] - 3, bottom[1]], [bottom[0] + 3, bottom[1]]]);
      place(s, '볼록성', [top[0], (top[1] + bottom[1]) / 2], { dirs: ['E', 'NE'], gap: 7, steps: [1, 1.5, 2.2, 3] });
    }
    return s;
  });

  const BAR_NAMES = { 0: '단기', 2: '중기', 4: '장기' };
  const drawBars = (s, f, weights, small) => {
    const slot = (f.right - f.left) / weights.length, width = small ? 14 : 28;
    weights.forEach((w, i) => {
      const h = f.bottom - f.Y(w), x = f.left + slot * (i + 0.5) - width / 2;
      addRect(s, x, f.bottom - h, width, h);
      if (BAR_NAMES[i]) addText(s, BAR_NAMES[i], f.left + slot * (i + 0.5), f.bottom + (small ? 14 : 15), 'middle', 'name');
    });
  };
  define(['barbell', 'bullet', 'ladder'], {
    barbell: '만기별 투자 비중을 나타낸 막대 다섯 개 가운데 가장 짧은 만기와 가장 긴 만기의 막대가 높고 가운데 막대 세 개는 아주 낮다.',
    bullet: '만기별 투자 비중을 나타낸 막대 다섯 개 가운데 가운데 중기 막대가 가장 높고 양옆 막대는 낮다.',
    ladder: '만기별 투자 비중을 나타낸 같은 높이의 막대 다섯 개다.',
  }, {
    barbell: '단기와 장기 양쪽에 나누어 담는다.',
    bullet: '한 만기 구간에 모아 담는다.',
    ladder: '만기마다 같은 비중으로 담는다.',
  }, s0 => {
    const s = plot(s0.kind, '만기', '투자 비중', { box: { bottom: 144, top: 28 }, dy: [0, models.bars.yMax] });
    drawBars(s, s.frame, models.bars[s0.kind], false);
    return s;
  });

  define('barbell-bullet', '만기별 투자 비중을 나타낸 막대 그림 두 개에서 바벨형은 양 끝 막대가 높고 가운데가 낮으며 불릿형은 가운데 막대가 가장 높다.',
    '바벨형은 양 끝에, 불릿형은 가운데에 모은다.', s0 => {
      const spec = ['바벨형', '불릿형'].map(title => ({ title, xName: '만기', xNameDy: 28, yName: '투자 비중', dy: [0, models.bars.yMax] }));
      const s = panels(s0.kind, spec);
      drawBars(s, s.frames[0], models.bars.barbell, true);
      drawBars(s, s.frames[1], models.bars.bullet, true);
      return s;
    });

  const PANEL_RANGE = [70, 130];
  const payoffDomain = (kinds, range = PRICE_RANGE) => {
    const values = [0];
    for (const kind of kinds) for (const price of math.kinks(kind, range)) values.push(math.payoff(kind, price));
    const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo) * 0.16;
    return [lo - pad, hi + pad];
  };
  function drawPayoff(s, f, kind, range, o = {}) {
    const zero = f.Y(0);
    addLine(s, 'dash', [[f.left, zero], [f.right, zero]]);
    addText(s, '0', f.left - 4, zero + 4, 'end', 'name');
    addLine(s, 'main', math.kinks(kind, range).map(price => [f.X(price), f.Y(math.payoff(kind, price))]));
    for (const k of math.strikes(kind)) {
      addLine(s, 'axis', [[f.X(k), zero - 4], [f.X(k), zero + 4]]);
      addLine(s, 'dash', [[f.X(k), zero + 4], [f.X(k), f.bottom]]);
      addText(s, '행사가격', f.X(k), f.bottom + (o.strikeDy || 14), 'middle', 'name');
    }
    const points = math.breakEvens(kind, range).map(price => [f.X(price), zero]);
    for (const p of points) addDot(s, p[0], p[1]);
    const dirs = ['NE', 'NW', 'SE', 'SW', 'N', 'S'];
    points.forEach((p, i) => {
      if (o.names === 'all' || (o.names === 'first' && i === 0)) {
        place(s, '손익분기점', p, { cls: o.small ? 'small' : 'note', dirs: (o.dirs && o.dirs[i]) || dirs, gap: 7, steps: [1, 1.5, 2.2, 3, 4] });
      }
    });
  }
  const OPTION_LABELS = {
    'long-call': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격 왼쪽은 손실이 일정하고 오른쪽은 가격이 오를수록 이익이 한 단위씩 커진다.',
    'short-call': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격 왼쪽은 이익이 일정하고 오른쪽은 가격이 오를수록 손실이 커진다.',
    'long-put': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격 왼쪽은 가격이 내릴수록 이익이 커지고 오른쪽은 손실이 일정하다.',
    'short-put': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격 오른쪽은 이익이 일정하고 왼쪽은 가격이 내릴수록 손실이 커진다.',
    'long-straddle': '만기 기초자산 가격에 따른 손익 그래프가 행사가격에서 손실이 가장 큰 브이(V) 모양이어서 양쪽으로 크게 움직이면 이익이 난다.',
    'short-straddle': '만기 기초자산 가격에 따른 손익 그래프가 행사가격에서 이익이 가장 큰 뒤집힌 브이(V) 모양이어서 양쪽으로 크게 움직이면 손실이 난다.',
    'long-strangle': '만기 기초자산 가격에 따른 손익 그래프에서 두 행사가격 사이는 손실이 일정하고 바깥쪽으로 갈수록 이익이 커진다.',
    'short-strangle': '만기 기초자산 가격에 따른 손익 그래프에서 두 행사가격 사이는 이익이 일정하고 바깥쪽으로 갈수록 손실이 커진다.',
    'bull-spread': '만기 기초자산 가격에 따른 손익 그래프에서 낮은 행사가격 아래는 손실이 일정하고 두 행사가격 사이에서 오르며 높은 행사가격 위는 이익이 일정하다.',
    'bear-spread': '만기 기초자산 가격에 따른 손익 그래프에서 낮은 행사가격 아래는 이익이 일정하고 두 행사가격 사이에서 내리며 높은 행사가격 위는 손실이 일정하다.',
    butterfly: '만기 기초자산 가격에 따른 손익 그래프에서 양 끝은 작은 손실이 일정하고 가운데 행사가격에서 이익이 가장 크다.',
    'covered-call': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격까지는 가격과 함께 오르고 그 위에서는 이익이 일정하다.',
    'protective-put': '만기 기초자산 가격에 따른 손익 그래프에서 행사가격 아래는 손실이 한정되고 그 위에서는 가격과 함께 오른다.',
  };
  const OPTION_CAPTIONS = {
    'long-call': '가격이 행사가격보다 오를수록 이익이 커진다. 손실은 낸 프리미엄까지다.',
    'short-call': '받은 프리미엄이 최대 이익이다. 가격이 오를수록 손실이 커진다.',
    'long-put': '가격이 행사가격보다 내릴수록 이익이 커진다. 손실은 낸 프리미엄까지다.',
    'short-put': '받은 프리미엄이 최대 이익이다. 가격이 내릴수록 손실이 커진다.',
    'long-straddle': '같은 행사가격의 콜과 풋을 함께 산다. 어느 쪽으로든 크게 움직이면 이익이다.',
    'short-straddle': '같은 행사가격의 콜과 풋을 함께 판다. 가격이 덜 움직일수록 이익이다.',
    'long-strangle': '행사가격이 다른 콜과 풋을 함께 산다. 스트래들보다 더 크게 움직여야 이익이다.',
    'short-strangle': '행사가격이 다른 콜과 풋을 함께 판다. 가격이 두 행사가격 사이에 머물면 이익이다.',
    'bull-spread': '가격이 오르면 이익이다. 이익과 손실이 모두 한정된다.',
    'bear-spread': '가격이 내리면 이익이다. 이익과 손실이 모두 한정된다.',
    butterfly: '가격이 가운데 행사가격 근처에 머물 때 이익이 가장 크다.',
    'covered-call': '주식을 들고 콜을 판다. 크게 오를 때의 이익을 프리미엄과 바꾼다.',
    'protective-put': '주식을 들고 풋을 산다. 내릴 때의 손실이 한정된다.',
  };
  define(math.optionKinds, OPTION_LABELS, OPTION_CAPTIONS, s0 => {
    const s = plot(s0.kind, '만기 기초자산 가격', '손익', { dx: PRICE_RANGE, dy: payoffDomain([s0.kind]), xDy: 28 });
    drawPayoff(s, s.frame, s0.kind, PRICE_RANGE, { names: 'all' });
    return s;
  });
  define('straddle-strangle', '만기 기초자산 가격에 따른 손익 그래프 두 개에서 스트래들 매수는 행사가격에서 손실이 가장 큰 브이(V) 모양이고 스트랭글 매수는 두 행사가격 사이에서 손실이 작고 평평하다.',
    '스트랭글은 손실 구간이 넓지만 드는 프리미엄이 적다.', s0 => {
      const dy = payoffDomain(['long-straddle', 'long-strangle'], PANEL_RANGE);
      const spec = ['스트래들 매수', '스트랭글 매수'].map(title => ({ title, xName: '만기 기초자산 가격', xNameDy: 28, yName: '손익', dx: PANEL_RANGE, dy }));
      const s = panels(s0.kind, spec, PANELS_WIDE);
      drawPayoff(s, s.frames[0], 'long-straddle', PANEL_RANGE, { names: 'first', small: true, dirs: [['NE', 'N']] });
      drawPayoff(s, s.frames[1], 'long-strangle', PANEL_RANGE, { names: 'first', small: true, dirs: [['NE', 'N']] });
      return s;
    });

  define(['is', 'lm', 'is-lm'], {
    is: '국민소득을 가로축, 이자율을 세로축으로 한 평면에서 오른쪽 아래로 내려가는 굵은 IS선과 오른쪽 위로 올라가는 LM선이 한 점에서 만나 균형을 이룬다.',
    lm: '국민소득을 가로축, 이자율을 세로축으로 한 평면에서 오른쪽 위로 올라가는 굵은 LM선과 오른쪽 아래로 내려가는 IS선이 한 점에서 만나 균형을 이룬다.',
    'is-lm': '국민소득을 가로축, 이자율을 세로축으로 한 평면에서 오른쪽 아래로 내려가는 IS선과 오른쪽 위로 올라가는 LM선이 한 점에서 만나 균형을 이룬다.',
  }, {
    is: '이자율이 내리면 투자가 늘어 소득이 커진다. 그래서 우하향한다.',
    lm: '소득이 늘면 화폐수요가 늘어 이자율이 오른다. 그래서 우상향한다.',
    'is-lm': '두 곡선이 만나는 점에서 재화시장과 화폐시장이 함께 균형을 이룬다.',
  }, s0 => {
    const s = plot(s0.kind, '국민소득', '이자율'), f = s.frame, m = models.macro;
    const isLine = u => m.is.y0 + m.is.slope * u, lmLine = u => m.lm.y0 + m.lm.slope * u;
    const mainIs = s0.kind !== 'lm', mainLm = s0.kind !== 'is';
    addCurve(s, f, mainIs ? 'main' : 'sub', [[m.uMin, isLine(m.uMin)], [m.uMax, isLine(m.uMax)]]);
    addCurve(s, f, mainLm ? 'main' : 'sub', [[m.uMin, lmLine(m.uMin)], [m.uMax, lmLine(m.uMax)]]);
    const eq = models.isLm();
    addDot(s, f.X(eq.u), f.Y(eq.v));
    place(s, 'IS', [f.X(m.uMax), f.Y(isLine(m.uMax))], { dirs: ['E'], gap: 7 });
    place(s, 'LM', [f.X(m.uMax), f.Y(lmLine(m.uMax))], { dirs: ['E'], gap: 7 });
    place(s, '균형', [f.X(eq.u), f.Y(eq.v)], { dirs: ['E', 'W', 'N', 'S'], gap: 8 });
    return s;
  });

  const bell = (pdf, z0, z1, n = 90) => sample(pdf, z0, z1, n);
  define('normal', '값을 가로축으로 한 종 모양 곡선은 평균에서 가장 높고 좌우가 대칭이며 평균에서 표준편차 하나 안의 옅게 칠한 구간이 약 68%다.',
    '평균을 중심으로 좌우가 대칭이다. 평균에서 표준편차 하나 안에 약 68%가 들어 있다.', s0 => {
      const m = models.normal;
      const s = plot(s0.kind, '값', null, { dx: [-m.zMax, m.zMax], dy: [0, m.vMax], box: { bottom: 148 } }), f = s.frame;
      addArea(s, mapPts(f, [[-1, 0], ...sample(math.normalPdf, -1, 1, 40), [1, 0]]));
      addCurve(s, f, 'main', bell(math.normalPdf, -m.zMax, m.zMax));
      const top = [f.X(0), f.Y(math.normalPdf(0) + 0.05)];
      addLine(s, 'dash', [[f.X(0), f.bottom], top]);
      place(s, '평균', top, { dirs: ['N'], gap: 3 });
      const y = f.bottom + 7;
      addLine(s, 'axis', [[f.X(-1), y - 3], [f.X(-1), y], [f.X(1), y], [f.X(1), y - 3]]);
      addText(s, '약 68%', f.X(0), y + 15, 'middle', 'note');
      return s;
    });
  define('normal-var', '손익을 가로축으로 한 종 모양 곡선에서 왼쪽 꼬리의 VaR 점선보다 왼쪽에 옅게 칠한 면적이 5%다.',
    '신뢰수준 95%라면 손실이 이 선을 넘을 확률이 5%다.', s0 => {
      const m = models.normal;
      const s = plot(s0.kind, '손익', null, { dx: [-m.zMax, m.zMax], dy: [0, m.vMax] }), f = s.frame;
      const z = math.normalQuantile(0.05);
      addArea(s, mapPts(f, [[-m.zMax, 0], ...sample(math.normalPdf, -m.zMax, z, 40), [z, 0]]));
      addCurve(s, f, 'main', bell(math.normalPdf, -m.zMax, m.zMax));
      const top = [f.X(z), f.Y(0.2)];
      addLine(s, 'dash', [[f.X(z), f.bottom], top]);
      place(s, 'VaR', top, { dirs: ['N'], gap: 3 });
      place(s, '5%', [f.X((z - m.zMax) / 2 + 0.2), f.Y(math.normalPdf(-2.4))], { dirs: ['N', 'NW'], gap: 7 });
      return s;
    });
  define('skew', '값을 가로축으로 한 곡선 두 개에서 양의 왜도는 봉우리가 왼쪽에 있고 긴 꼬리가 오른쪽으로 늘어지며 음의 왜도는 봉우리가 오른쪽에 있고 긴 꼬리가 왼쪽으로 늘어진다.',
    '꼬리가 길게 늘어진 쪽이 왜도의 부호다.', s0 => {
      const m = models.skew, dx = [0, m.xMax], dy = [0, m.vMax];
      const s = panels(s0.kind, [{ title: '양의 왜도', xName: '값', dx, dy }, { title: '음의 왜도', xName: '값', dx, dy }]);
      addCurve(s, s.frames[0], 'main', sample(math.gamma3Pdf, 0, m.xMax, 70));
      addCurve(s, s.frames[1], 'main', sample(x => math.gamma3Pdf(m.xMax - x), 0, m.xMax, 70));
      return s;
    });
  define('kurtosis', '값을 가로축으로 한 곡선 두 개에서 가운데가 같은 점선의 정규분포보다 굵은 선의 첨도가 큰 분포가 가운데는 더 높고 뾰족하며 양쪽 꼬리는 더 두껍다.',
    '첨도가 크면 가운데가 뾰족하고 꼬리가 두껍다.', s0 => {
      const m = models.kurtosis;
      const s = plot(s0.kind, '값', null, { dx: [-m.zMax, m.zMax], dy: [0, m.vMax] }), f = s.frame;
      const sd = Math.sqrt(math.fatTailVariance()), normal = z => math.normalPdf(z, 0, sd);
      addCurve(s, f, 'dash', sample(normal, -m.zMax, m.zMax, 90));
      addCurve(s, f, 'main', sample(math.fatTailPdf, -m.zMax, m.zMax, 120));
      place(s, '정규분포', [f.X(1.5), f.Y(normal(1.5))], { dirs: ['NE', 'E', 'N'], gap: 7 });
      place(s, '첨도가 큰 분포', [f.X(0.45), f.Y(math.fatTailPdf(0.45))], { dirs: ['NE', 'E', 'N'], gap: 7 });
      return s;
    });

  function futuresFigure(s0, scenario, withBasis) {
    const m = models.futures[scenario], basis0 = m.basis0;
    const s = plot(s0.kind, '시간', '가격', { dy: m.dy }), f = s.frame;
    addLine(s, 'dash', [[f.right, f.bottom], [f.right, f.top + 2]]);
    addText(s, '만기', f.right, f.top - 4, 'middle', 'name');
    const spot = t => math.spot(t), fut = t => math.futures(t, basis0);
    addCurve(s, f, 'sub', sample(spot, 0, 1, 40));
    addCurve(s, f, 'main', sample(fut, 0, 1, 40));
    if (withBasis) {
      const t = 0.18, a = [f.X(t), f.Y(fut(t))], b = [f.X(t), f.Y(spot(t))], mid = (a[1] + b[1]) / 2;
      addArrow(s, [a[0], mid], a);
      addArrow(s, [b[0], mid], b);
      place(s, '베이시스', [a[0], mid], { dirs: ['E'], gap: 8, steps: [1, 1.5, 2.2] });
    }
    place(s, '선물가격', [f.X(0.6), f.Y(fut(0.6))], { dirs: basis0 > 0 ? ['N', 'NW', 'NE'] : ['S', 'SW', 'SE'], gap: 7 });
    place(s, '현물가격', [f.X(0.6), f.Y(spot(0.6))], { dirs: basis0 > 0 ? ['S', 'SE', 'SW'] : ['N', 'NW', 'NE'], gap: 7 });
    return s;
  }
  define('contango', '시간을 가로축, 가격을 세로축으로 한 평면에서 선물가격 선이 현물가격 선보다 위에서 시작해 만기에 현물가격과 만난다.',
    '선물가격이 현물가격보다 높은 상태다. 만기가 가까워지면 두 가격이 만난다.', s0 => futuresFigure(s0, 'contango', false));
  define('backwardation', '시간을 가로축, 가격을 세로축으로 한 평면에서 선물가격 선이 현물가격 선보다 아래에서 시작해 만기에 현물가격과 만난다.',
    '선물가격이 현물가격보다 낮은 상태다. 만기가 가까워지면 두 가격이 만난다.', s0 => futuresFigure(s0, 'backwardation', false));
  define('basis', '시간을 가로축, 가격을 세로축으로 한 평면에서 선물가격 선이 현물가격 선보다 위에 있고, 둘 사이의 세로 간격이 베이시스이며 만기에 0이 된다.',
    '베이시스는 선물가격과 현물가격의 차이다. 만기에는 0이 된다.', s0 => futuresFigure(s0, 'contango', true));

  const priceLine = (s, f, points) => addCurve(s, f, 'main', points);
  const patternScene = kind => plot(kind, '시간', '가격');
  define('head-shoulders', '시간을 가로축, 가격을 세로축으로 한 평면에서 가운데 머리가 가장 높은 봉우리 세 개 뒤에 가격이 두 골을 이은 목선을 아래로 뚫는다.',
    '오른쪽 어깨 뒤에 목선을 아래로 뚫으면 하락 전환으로 본다.', s0 => {
      const s = patternScene(s0.kind), f = s.frame, m = models.patterns['head-shoulders'];
      addCurve(s, f, 'dash', [[0.28, models.neckline(0.28)], [0.98, models.neckline(0.98)]]);
      priceLine(s, f, m.points);
      const tops = [[1, '왼쪽 어깨'], [3, '머리'], [5, '오른쪽 어깨']];
      for (const [i, name] of tops) place(s, name, [f.X(m.points[i][0]), f.Y(m.points[i][1])], { dirs: ['N'], gap: 6 });
      place(s, '목선', [f.X(0.97), f.Y(models.neckline(0.97))], { dirs: ['N', 'NW', 'S'], gap: 6 });
      return s;
    });
  const twoPeaks = (s0, side) => {
    const s = patternScene(s0.kind), f = s.frame, m = models.patterns[s0.kind];
    addCurve(s, f, 'dash', [[0.3, m.level], [0.98, m.level]]);
    priceLine(s, f, m.points);
    place(s, '목선', [f.X(0.97), f.Y(m.level)], { dirs: side, gap: 6 });
    return s;
  };
  define('double-top', '시간을 가로축, 가격을 세로축으로 한 평면에서 비슷한 높이의 봉우리 두 개가 있고, 둘 사이 골에 그은 목선을 가격이 아래로 뚫는다.',
    '비슷한 높이의 고점이 두 번 생긴 뒤 목선을 아래로 뚫으면 하락 전환으로 본다.', s0 => twoPeaks(s0, ['N', 'NW', 'S']));
  define('double-bottom', '시간을 가로축, 가격을 세로축으로 한 평면에서 비슷한 깊이의 골 두 개가 있고, 둘 사이 봉우리에 그은 목선을 가격이 위로 뚫는다.',
    '비슷한 깊이의 저점이 두 번 생긴 뒤 목선을 위로 뚫으면 상승 전환으로 본다.', s0 => twoPeaks(s0, ['S', 'SW', 'N']));
  const touches = (s0, name, side) => {
    const s = patternScene(s0.kind), f = s.frame, m = models.patterns[s0.kind];
    addCurve(s, f, 'dash', [[0, m.level], [1, m.level]]);
    priceLine(s, f, m.points);
    for (const p of m.points) if (Math.abs(p[1] - m.level) < 1e-9) addDot(s, f.X(p[0]), f.Y(p[1]));
    place(s, name, [f.X(0.97), f.Y(m.level)], { dirs: side, gap: 6 });
    return s;
  };
  define('support', '시간을 가로축, 가격을 세로축으로 한 평면에서 가격이 수평 점선인 지지선까지 세 번 내려왔다가 되돌아 오른다.',
    '가격이 내려오다 여러 번 되돌아 오른 수준이다.', s0 => touches(s0, '지지선', ['S', 'SW', 'N']));
  define('resistance', '시간을 가로축, 가격을 세로축으로 한 평면에서 가격이 수평 점선인 저항선까지 세 번 올라갔다가 되밀려 내려온다.',
    '가격이 오르다 여러 번 되밀린 수준이다.', s0 => touches(s0, '저항선', ['N', 'NW', 'S']));
  define('trendline', '시간을 가로축, 가격을 세로축으로 한 평면에서 오르내리며 올라가는 가격의 저점들이 오른쪽 위로 향하는 점선 위에 놓여 있다.',
    '저점을 이은 선이 오른쪽 위로 향하면 상승 추세다.', s0 => {
      const s = patternScene(s0.kind), f = s.frame, m = models.patterns.trendline;
      addCurve(s, f, 'dash', [[0, models.trendline(0)], [1, models.trendline(1)]]);
      priceLine(s, f, models.trendPoints());
      for (const u of m.lows) addDot(s, f.X(u), f.Y(models.trendline(u)));
      place(s, '상승 추세선', [f.X(0.22), f.Y(models.trendline(0.22))], { dirs: ['SE', 'S', 'SW'], gap: 7 });
      return s;
    });
  const cross = (s0, direction) => {
    const s = patternScene(s0.kind), f = s.frame;
    const L = x => math.longMA(x), S = x => math.shortMA(x, direction);
    addCurve(s, f, 'sub', sample(L, 0, 1, 60));
    addCurve(s, f, 'main', sample(S, 0, 1, 60));
    addDot(s, f.X(0.45), f.Y(L(0.45)));
    const shortAbove = direction > 0;
    place(s, '단기 이동평균선', [f.X(1), f.Y(S(1))], { dirs: shortAbove ? ['NW', 'N', 'W'] : ['SW', 'S', 'W'], gap: 7 });
    place(s, '장기 이동평균선', [f.X(1), f.Y(L(1))], { dirs: shortAbove ? ['SW', 'S', 'W'] : ['NW', 'N', 'W'], gap: 7 });
    return s;
  };
  define('golden-cross', '시간을 가로축, 가격을 세로축으로 한 평면에서 단기 이동평균선이 장기 이동평균선 아래에서 시작해 한 점에서 위로 뚫고 올라간다.',
    '단기 이동평균선이 장기 이동평균선을 아래에서 위로 뚫는다.', s0 => cross(s0, 1));
  define('dead-cross', '시간을 가로축, 가격을 세로축으로 한 평면에서 단기 이동평균선이 장기 이동평균선 위에서 시작해 한 점에서 아래로 뚫고 내려간다.',
    '단기 이동평균선이 장기 이동평균선을 위에서 아래로 뚫는다.', s0 => cross(s0, -1));

  const pathOf = (pts, close) => pts.map((p, i) => (i ? 'L' : 'M') + fmt(p[0]) + ' ' + fmt(p[1])).join('') + (close ? 'Z' : '');
  function markup(s, def) {
    const body = s.items.map(it => {
      if (it.k === 'area') return `<path class="v2-fig-area" d="${pathOf(it.pts, true)}"/>`;
      if (it.k === 'line') return `<path class="${it.cls}" d="${pathOf(it.pts)}"/>`;
      if (it.k === 'dot') return `<circle class="v2-fig-dot" cx="${fmt(it.x)}" cy="${fmt(it.y)}" r="${it.r}"/>`;
      if (it.k === 'head') return `<path class="v2-fig-dot" d="${pathOf(it.pts, true)}"/>`;
      return `<rect class="v2-fig-bar" x="${fmt(it.x)}" y="${fmt(it.y)}" width="${fmt(it.w)}" height="${fmt(it.h)}" rx="2"/>`;
    }).join('');
    const texts = s.texts.map(t => `<text class="v2-fig-${t.cls}" x="${fmt(t.x)}" y="${fmt(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`}>${esc(t.text)}</text>`).join('');
    return `<figure class="v2-figure" data-figure="${def.kind}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.label)}">${body}${texts}</svg><figcaption>${esc(def.caption)}</figcaption></figure>`;
  }

  const kinds = Object.keys(FIG);
  const sceneCache = new Map(), markupCache = new Map();
  function scene(kind) {
    if (!FIG[kind]) throw new Error('unknown figure kind: ' + kind);
    if (!sceneCache.has(kind)) sceneCache.set(kind, FIG[kind].build());
    return sceneCache.get(kind);
  }
  function render(kind, note) {
    if (!markupCache.has(kind)) markupCache.set(kind, markup(scene(kind), FIG[kind]));
    const base = markupCache.get(kind);
    return note ? base.replace('</figcaption>', ' ' + esc(note) + '</figcaption>') : base;
  }

  const ROWS = [
  ['atlas-c-efficient-frontier', '효율적 투자기회선', 'frontier'], ['atlas-a-markowitz', '마코위츠 분산투자이론', 'frontier'],
  ['term-80b12678e1f75e3d', '최소분산포트폴리오', 'frontier-mvp'],
  ['atlas-a-indifference-curve', '무차별 효용곡선', 'indifference'],
  ['atlas-c-optimal-portfolio', '최적 포트폴리오', 'optimal'], ['glossary-7b5baea427e9092045b1', '효율적 포트폴리오와 최적 포트폴리오', 'optimal'], ['glossary-0e53bf7b7f0210e3801b', '마코위츠 분산투자이론과 무차별 효용곡선', 'optimal'],
  ['term-20d1ed90891ed1cc', '자본시장선', 'cml'],
  ['foundation-capital-allocation-line', '자본배분선', 'cal'],
  ['term-8a591af40b145e90', '증권시장선', 'sml'],
  ['glossary-73843b33fd3e68011c5d', 'CML과 SML 비교', 'cml-sml'],
  ['term-5cb8638c83dda6e8', '분산투자', 'diversification'], ['glossary-2fc2998209e927c30ea2', '체계적 위험', 'diversification'], ['glossary-6446f9e0217040bd9bad', '비체계적 위험', 'diversification'],
  ['term-20aa821eb7df84ad', '수익률곡선', 'yield-curve'], ['glossary-b0cc820a82565c3ba5a3', '채권수익률곡선', 'yield-curve'], ['term-d8ab16eeac8836de', '기간구조', 'yield-curve'],
  ['atlas-c-curve-steepening', '수익률곡선 가팔라짐', 'steepen'],
  ['atlas-c-curve-flattening', '수익률곡선 완만화', 'flatten'],
  ['term-38d09f81f7271b92', '수익률곡선타기', 'rolldown'], ['glossary-3ca73bd59fbca65cbe32', '수익률곡선타기전략', 'rolldown'], ['glossary-4e258369813107531b6c', '롤링효과', 'rolldown'],
  ['glossary-b11e518b32f600be39aa', '숄더효과', 'shoulder'],
  ['term-3f155088614b0ce0', '볼록성', 'price-yield-convexity'], ['glossary-a6c973705614d4ff61bc', '컨벡시티', 'price-yield-convexity'],
  ['glossary-ea8d223951f4898c79a4', '듀레이션', 'price-yield-duration'], ['term-9846010cc13821ec', '수정듀레이션', 'price-yield-duration'],
  ['term-03b090d32fa641c8', '바벨전략', 'barbell'],
  ['atlas-c-bullet-strategy', '불릿전략', 'bullet'],
  ['term-e3ed936216e24a0f', '사다리전략', 'ladder'], ['glossary-87682cfe910074a126c6', '사다리형만기전략', 'ladder'],
  ['glossary-8c8a12ebce8ee64b98c2', '바벨형과 불릿형 채권포트폴리오', 'barbell-bullet'],
  ['term-a1c27a81d248f5ed', '옵션의 만기 순손익', 'long-call'],
  ['term-f393f290169a20af', '스트래들 매수', 'long-straddle'], ['foundation-straddle', '스트래들', 'long-straddle', '그림은 매수한 경우다. 매도하면 위아래가 뒤집힌다.'],
  ['term-8731852f6fb251c5', '스트래들 매도', 'short-straddle'], ['glossary-a1436cbe543c404ef573', '스트래들 매도 포지션', 'short-straddle'],
  ['term-56f2b571458bdc16', '스트랭글 매수', 'long-strangle'], ['foundation-strangle', '스트랭글', 'long-strangle', '그림은 매수한 경우다. 매도하면 위아래가 뒤집힌다.'],
  ['term-788e3981bb3022c6', '스트랭글 매도', 'short-strangle'],
  ['glossary-d30bc67d218f6c81563a', '스트래들 매수와 스트랭글 매수', 'straddle-strangle'],
  ['term-1d5fd08f24877cb0', '강세 콜 스프레드', 'bull-spread'], ['term-e7d75df5f09bfc73', '강세 풋 스프레드', 'bull-spread'], ['glossary-9c36d3e7ebbbc56cb16c', '강세 콜 스프레드와 강세 풋 스프레드', 'bull-spread'],
  ['term-e2be5dbdc507a4fc', '약세 콜 스프레드', 'bear-spread'], ['term-2ab03696f6dbaa2f', '약세 풋 스프레드', 'bear-spread'], ['glossary-79ad7905eae7375f2ed9', '베어스프레드', 'bear-spread'],
  ['term-8e49d76e582c49cd', '버터플라이 스프레드', 'butterfly'],
  ['atlas-c-covered-call', '커버드 콜', 'covered-call'],
  ['glossary-7064f109c08e315ea830', '보호적 풋', 'protective-put'],
  ['atlas-c-is-curve', '재화시장 균형곡선', 'is'],
  ['atlas-c-lm-curve', '화폐시장 균형곡선', 'lm'],
  ['glossary-cce565406bdad83ec872', '정규분포', 'normal'],
  ['glossary-c86872dc97dd35aabbbd', 'VaR', 'normal-var'],
  ['atlas-b-b795ec07a0f8a9', '왜도', 'skew'], ['glossary-f89002d6488b1d32027c', '왜도와 첨도', 'skew'],
  ['atlas-b-18a73ee6e3b86e', '첨도', 'kurtosis'],
  ['atlas-b-b4b6d23a35a407', '콘탱고', 'contango'],
  ['atlas-b-a5a05dded8dfab', '백워데이션', 'backwardation'],
  ['glossary-748acb42a7abd8c5923f', '베이시스', 'basis'],
  ['glossary-3c6d0cf17c3f896ac7cd', '헤드 앤 숄더형', 'head-shoulders'],
  ['atlas-c-double-top', '이중천장형', 'double-top'],
  ['glossary-ec192bc859bfc1bfb321', '이중바닥형', 'double-bottom'],
  ['glossary-c9bfba0e709ddb16ccc8', '지지선', 'support'],
  ['glossary-8ed5426dcc1a1bea58be', '저항선', 'resistance'],
  ['glossary-04f7cdf4dd367d149fb5', '추세선', 'trendline'],
  ['glossary-46606bd7fdca7db61420', '골든크로스', 'golden-cross'],
  ['glossary-cbee9f87dd1add3b01b8', '데드크로스', 'dead-cross'],
  ['c69', '재화시장 균형곡선–화폐시장 균형곡선, 구축효과, 피구, 리카르도 구분', 'is-lm'],
  ['c72', '자본시장선, 증권시장선, 베타, 알파', 'cml-sml'],
  ['c71', '효율적, 최적, 기대수익, 최소분산', 'optimal'],
  ['c57', '볼록성: 0.01을 제곱한다', 'price-yield-convexity'],
  ['c46', '최대예상손실액: 초과확률과 계산 단위', 'normal-var', '신뢰수준을 99%로 높이면 선이 더 왼쪽으로 가고 넘을 확률은 1%가 된다.'],
  ];
  const registry = ROWS.map(([id, title, kind, note]) => ({ id, title, kind, note: note || '' }));
  const byId = new Map(registry.map(row => [row.id, row]));
  function forTerm(id) {
    const row = byId.get(id);
    if (!row || !FIG[row.kind]) return null;
    return { kind: row.kind, markup: render(row.kind, row.note) };
  }

  return { forTerm, render, scene, collisions, registry, kinds, math, models, textWidth, captions: Object.fromEntries(kinds.map(k => [k, FIG[k].caption])), labels: Object.fromEntries(kinds.map(k => [k, FIG[k].label])) };
});
