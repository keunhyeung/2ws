(function () {
  'use strict';

  var KEY = '2ws-welcome';
  var VERSION = 'v1';
  var DONE_EVENT = 'ws-welcome-done';
  var announced = false;
  var STYLE_ID = 'ws-welcome-style';
  var ROOT_ID = 'ws-welcome-root';

  var TEXT = {
    label: '환영 인사',
    hint: '화면을 탭해 다음 문장 보기',
    skip: '바로 시작',
    slides: [
      ['안녕하세요!', '투자자산운용사 입문을 환영합니다.'],
      ['투운사엔 일주일, 사흘, 몇 시간...', '기적 같은 합격 후기가 참 많죠.'],
      ['화려한 무용담에 눈길은 가지만', '하나씩 채우는 재미도 쏠쏠해요.'],
      ['차곡차곡 쌓아 올린 끝에서', '합격의 기쁨을 만나시길 기원합니다.'],
      ['자, 이제 2WS와 함께', '시작해 볼까요?']
    ]
  };

  var LOCK_MS = 450;
  var SLIDE_OUT_MS = 260;
  var CLOSE_MS = 500;
  var TAU = Math.PI * 2;

  var CSS = [
    '.ws-welcome{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483200;overflow:hidden;box-sizing:border-box;',
    'color:#f5f5f5;font-family:var(--font-sans,"Pretendard Variable",Pretendard,system-ui,sans-serif);',
    'background:#0a0a0a radial-gradient(ellipse 120% 80% at 50% 45%,#121212 0%,#0a0a0a 55%,#050505 100%);',
    'opacity:0;transition:opacity .6s cubic-bezier(.2,.8,.2,1);cursor:pointer;outline:none;touch-action:none;overscroll-behavior:contain;',
    '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
    '.ws-welcome.ws-w-on{opacity:1}',
    '.ws-welcome.ws-w-off{opacity:0;transition-duration:.5s;pointer-events:none}',
    '.ws-welcome *{box-sizing:border-box}',
    '.ws-w-neb{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;',
    'background:radial-gradient(ellipse 70% 50% at 50% 42%,rgba(245,245,245,.025),rgba(245,245,245,0) 70%)}',
    '.ws-w-canvas{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none}',
    '.ws-w-stage{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none}',
    '.ws-w-slide{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'padding:0 max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left));text-align:center;color:#f5f5f5;',
    'font-family:var(--font-sans,"Pretendard Variable",Pretendard,system-ui,sans-serif);',
    'font-size:clamp(20px,6.2vw,30px);line-height:1.38;font-weight:700;letter-spacing:-.03em;word-break:keep-all;overflow-wrap:normal;',
    'text-shadow:0 0 18px rgba(10,10,10,.85),0 0 2px rgba(10,10,10,.6);',
    'opacity:0;filter:blur(8px);transform:translateY(8px);',
    'transition:opacity .7s cubic-bezier(.2,.8,.2,1),filter .7s cubic-bezier(.2,.8,.2,1),transform .7s cubic-bezier(.2,.8,.2,1)}',
    '.ws-w-slide.ws-w-in{opacity:1;filter:blur(0);transform:translateY(0)}',
    '.ws-w-slide.ws-w-out{opacity:0;filter:blur(0);transform:translateY(0);transition:opacity .24s cubic-bezier(.2,.8,.2,1)}',
    '.ws-w-line{display:block;max-width:100%}',
    '.ws-w-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 32px);text-align:center;',
    'font-size:.8125rem;line-height:1.4;font-weight:700;letter-spacing:-.01em;color:#8f8f8f;opacity:0;pointer-events:none;',
    'transition:opacity 1s cubic-bezier(.2,.8,.2,1) 1.2s}',
    '.ws-w-hint.ws-w-show{opacity:1}',
    '.ws-w-hint.ws-w-dim{opacity:.45;transition-delay:0s}',
    '.ws-w-dots{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 64px);height:6px;',
    'display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:none}',
    '.ws-w-dot{flex:none;width:6px;height:6px;border-radius:999px;background:rgba(245,245,245,.24);',
    'transition:width .22s cubic-bezier(.2,.8,.2,1),background-color .22s cubic-bezier(.2,.8,.2,1)}',
    '.ws-w-dot.ws-w-active{width:18px;background:#f5f5f5}',
    '.ws-w-skip{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:max(4px,env(safe-area-inset-right));',
    'min-height:48px;min-width:48px;padding:0 16px;border:0;border-radius:999px;',
    'background:transparent;color:rgba(245,245,245,.62);font:inherit;font-size:.9375rem;line-height:1.3;font-weight:700;letter-spacing:-.01em;',
    'cursor:pointer;-webkit-appearance:none;appearance:none;touch-action:manipulation;',
    'transition:color .12s cubic-bezier(.2,.8,.2,1),background-color .12s cubic-bezier(.2,.8,.2,1)}',
    '@media (hover:hover){.ws-w-skip:hover{color:#f5f5f5;background:rgba(245,245,245,.08)}}',
    '.ws-w-skip:active{color:#f5f5f5;background:rgba(245,245,245,.08)}',
    '.ws-w-skip:focus-visible{outline:3px solid #7d97ff;outline-offset:2px}',
    '.ws-w-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (prefers-reduced-motion:reduce){',
    '.ws-welcome,.ws-welcome.ws-w-off{transition-duration:.35s}',
    '.ws-w-slide{filter:none;transform:none;transition:opacity .6s linear}',
    '.ws-w-slide.ws-w-in{filter:none;transform:none}',
    '.ws-w-slide.ws-w-out{filter:none;transform:none;transition:opacity .3s linear}',
    '.ws-w-hint{transition-duration:.6s}',
    '.ws-w-dot{transition:none}',
    '.ws-w-skip{transition:none}',
    '}'
  ].join('');

  var TINTS = [[245, 245, 245]];
  var LAYERS = [
    { rMin: 0.4, rMax: 0.85, aMin: 0.25, aMax: 0.45, speed: 4, push: 60, glow: 0 },
    { rMin: 0.8, rMax: 1.3, aMin: 0.45, aMax: 0.7, speed: 10, push: 170, glow: 0 },
    { rMin: 1.2, rMax: 2.0, aMin: 0.7, aMax: 1, speed: 22, push: 380, glow: 1 }
  ];
  var BURST_TINTS = [[245, 245, 245]];

  function storedValue(storage) {
    try { return storage.getItem(KEY) === VERSION; } catch (_) { return false; }
  }

  function seen() {
    var ok = false;
    try { ok = storedValue(window.localStorage); } catch (_) {}
    if (ok) return true;
    try { return storedValue(window.sessionStorage); } catch (_) { return false; }
  }

  function remember() {
    try {
      window.localStorage.setItem(KEY, VERSION);
      return;
    } catch (_) {}
    try { window.sessionStorage.setItem(KEY, VERSION); } catch (_) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  }

  function makeSprite(tint) {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    var g = c.getContext('2d');
    if (!g) return c;
    var rgb = tint[0] + ',' + tint[1] + ',' + tint[2];
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.14, 'rgba(' + rgb + ',.34)');
    grad.addColorStop(0.4, 'rgba(' + rgb + ',.05)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  function open() {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.body) return;

    if (!document.getElementById(STYLE_ID)) {
      var style = el('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    var reduced = reducedMotion();
    var canAnimate = !reduced && typeof window.requestAnimationFrame === 'function';
    var slides = TEXT.slides;
    var lastIndex = slides.length - 1;

    var root = el('div', 'ws-welcome');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', TEXT.label);
    root.tabIndex = -1;

    var neb = el('div', 'ws-w-neb');
    neb.setAttribute('aria-hidden', 'true');
    var canvas = el('canvas', 'ws-w-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    var stage = el('div', 'ws-w-stage');
    var dotsBox = el('div', 'ws-w-dots');
    dotsBox.setAttribute('aria-hidden', 'true');
    var dots = [];
    for (var d = 0; d < slides.length; d++) {
      var dot = el('span', 'ws-w-dot');
      dots.push(dot);
      dotsBox.appendChild(dot);
    }
    var hint = el('div', 'ws-w-hint', TEXT.hint);
    var skip = el('button', 'ws-w-skip', TEXT.skip);
    skip.type = 'button';
    var live = el('div', 'ws-w-sr');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    root.appendChild(neb);
    root.appendChild(canvas);
    root.appendChild(stage);
    root.appendChild(dotsBox);
    root.appendChild(hint);
    root.appendChild(skip);
    root.appendChild(live);

    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }

    var state = {
      index: 0,
      lockUntil: 0,
      closing: false,
      closed: false,
      current: null,
      raf: 0,
      last: 0,
      time: 0,
      w: 0,
      h: 0,
      dpr: 1,
      stars: [],
      particles: [],
      rings: [],
      shoots: [],
      nextShoot: rand(2.5, 5),
      warp: 0,
      resizeTimer: 0
    };
    var timers = [];
    var inerted = [];
    var prevOverflow = '';
    var prevGutter = '';
    var themeMetas = [];
    var sprites = [];
    var tintCols = [];
    var burstSprites = [];
    var i;

    if (ctx) {
      for (i = 0; i < TINTS.length; i++) {
        sprites.push(makeSprite(TINTS[i]));
        tintCols.push('rgb(' + TINTS[i][0] + ',' + TINTS[i][1] + ',' + TINTS[i][2] + ')');
      }
      for (i = 0; i < BURST_TINTS.length; i++) burstSprites.push(makeSprite(BURST_TINTS[i]));
    }

    function later(fn, ms) {
      var id = setTimeout(function () {
        for (var k = 0; k < timers.length; k++) {
          if (timers[k] === id) { timers.splice(k, 1); break; }
        }
        fn();
      }, ms);
      timers.push(id);
      return id;
    }

    function targetCount() {
      var n = Math.round(state.w * state.h / 2200);
      return Math.max(150, Math.min(300, n));
    }

    function newStar(x, y) {
      var roll = Math.random();
      var li = roll < 0.58 ? 0 : (roll < 0.88 ? 1 : 2);
      var L = LAYERS[li];
      var r = rand(L.rMin, L.rMax);
      var glowSize = 0;
      if (L.glow >= 1) glowSize = r * 5;
      return {
        x: x, y: y, layer: li, r: r,
        a: rand(L.aMin, L.aMax),
        phase: rand(0, TAU),
        tw: rand(0.6, 1.9),
        tint: 0,
        glow: glowSize
      };
    }

    function layout() {
      var w = root.clientWidth || window.innerWidth || 360;
      var h = root.clientHeight || window.innerHeight || 640;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var oldW = state.w;
      var oldH = state.h;
      state.w = w;
      state.h = h;
      state.dpr = dpr;
      if (!ctx) return;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var stars = state.stars;
      var k;
      if (oldW > 0 && oldH > 0) {
        for (k = 0; k < stars.length; k++) {
          stars[k].x = stars[k].x / oldW * w;
          stars[k].y = stars[k].y / oldH * h;
        }
      }
      var want = targetCount();
      while (stars.length < want) stars.push(newStar(Math.random() * w, Math.random() * h));
      if (stars.length > want) stars.length = want;
      if (!state.raf) draw();
    }

    function addBurst(x, y) {
      if (!ctx || !canAnimate) return;
      state.rings.push({ x: x, y: y, t: 0, life: 1.2, max: Math.min(320, Math.min(state.w, state.h) * 0.45) });
      var n = 26;
      for (var k = 0; k < n; k++) {
        if (state.particles.length >= 160) break;
        var ang = rand(0, TAU);
        var sp = rand(50, 200);
        state.particles.push({
          x: x, y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          size: rand(0.8, 2.0),
          t: 0,
          life: rand(0.8, 1.6),
          tint: Math.floor(Math.random() * burstSprites.length)
        });
      }
    }

    function spawnShoot() {
      var dir = Math.random() < 0.5 ? 1 : -1;
      var ang = rand(18, 38) * Math.PI / 180;
      var speed = rand(650, 1000);
      state.shoots.push({
        x: rand(state.w * 0.2, state.w * 1.0),
        y: rand(0, state.h * 0.4),
        vx: Math.cos(ang) * speed * dir,
        vy: Math.sin(ang) * speed,
        t: 0,
        life: rand(0.7, 1.2)
      });
    }

    function update(dt) {
      var w = state.w;
      var h = state.h;
      var cx = w / 2;
      var cy = h / 2;
      var m = 24;
      var warp = state.warp;
      var stars = state.stars;
      var k;
      state.time += dt;
      for (k = 0; k < stars.length; k++) {
        var s = stars[k];
        var L = LAYERS[s.layer];
        var vx = -0.92 * L.speed;
        var vy = 0.38 * L.speed;
        if (warp > 0.02) {
          var dx = s.x - cx;
          var dy = s.y - cy;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          vx += dx / d * L.push * warp;
          vy += dy / d * L.push * warp;
        }
        s.vx = vx;
        s.vy = vy;
        s.x += vx * dt;
        s.y += vy * dt;
        if (s.x < -m) s.x = w + m;
        else if (s.x > w + m) s.x = -m;
        if (s.y < -m) s.y = h + m;
        else if (s.y > h + m) s.y = -m;
      }
      state.warp = warp > 0.01 ? warp * Math.exp(-dt * 2.6) : 0;

      for (k = state.particles.length - 1; k >= 0; k--) {
        var p = state.particles[k];
        p.t += dt;
        if (p.t >= p.life) { state.particles.splice(k, 1); continue; }
        var drag = Math.exp(-dt * 2.2);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (k = state.rings.length - 1; k >= 0; k--) {
        state.rings[k].t += dt;
        if (state.rings[k].t >= state.rings[k].life) state.rings.splice(k, 1);
      }
      for (k = state.shoots.length - 1; k >= 0; k--) {
        var sh = state.shoots[k];
        sh.t += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.t >= sh.life) state.shoots.splice(k, 1);
      }
      state.nextShoot -= dt;
      if (state.nextShoot <= 0) {
        spawnShoot();
        state.nextShoot = rand(4, 8);
      }
    }

    function draw() {
      if (!ctx) return;
      var stars = state.stars;
      var k;
      var animated = canAnimate;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, state.w, state.h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      var warp = state.warp;
      for (k = 0; k < stars.length; k++) {
        var s = stars[k];
        var tw = animated ? 0.65 + 0.35 * Math.sin(state.time * s.tw + s.phase) : 0.85;
        var alpha = s.a * tw;
        if (s.glow > 0) {
          ctx.globalAlpha = alpha * 0.55;
          ctx.drawImage(sprites[s.tint], s.x - s.glow, s.y - s.glow, s.glow * 2, s.glow * 2);
        }
        ctx.globalAlpha = alpha;
        if (animated && warp > 0.08) {
          var kk = 0.045 * Math.min(1, warp * 2);
          var tx = s.vx * kk;
          var ty = s.vy * kk;
          if (tx * tx + ty * ty > 1.5) {
            ctx.strokeStyle = tintCols[s.tint];
            ctx.lineWidth = s.r * 1.3;
            ctx.beginPath();
            ctx.moveTo(s.x - tx, s.y - ty);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
            continue;
          }
        }
        ctx.fillStyle = tintCols[s.tint];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }

      if (!animated) { ctx.globalAlpha = 1; return; }

      for (k = 0; k < state.shoots.length; k++) {
        var sh = state.shoots[k];
        var life = Math.sin(Math.PI * Math.min(1, sh.t / sh.life));
        var hx = sh.x;
        var hy = sh.y;
        var gx = hx - sh.vx * 0.16;
        var gy = hy - sh.vy * 0.16;
        var grad = ctx.createLinearGradient(gx, gy, hx, hy);
        grad.addColorStop(0, 'rgba(245,245,245,0)');
        grad.addColorStop(1, 'rgba(245,245,245,1)');
        ctx.globalAlpha = life * 0.9;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.globalAlpha = life * 0.7;
        ctx.drawImage(sprites[0], hx - 6, hy - 6, 12, 12);
      }

      for (k = 0; k < state.rings.length; k++) {
        var rg = state.rings[k];
        var pr = rg.t / rg.life;
        var ease = 1 - Math.pow(1 - pr, 3);
        ctx.globalAlpha = Math.pow(1 - pr, 1.6);
        ctx.strokeStyle = 'rgba(245,245,245,.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, Math.max(0.5, rg.max * ease), 0, TAU);
        ctx.stroke();
      }

      for (k = 0; k < state.particles.length; k++) {
        var p = state.particles[k];
        var fade = Math.pow(1 - p.t / p.life, 1.5);
        var gs = p.size * 4;
        ctx.globalAlpha = fade * 0.5;
        ctx.drawImage(burstSprites[p.tint], p.x - gs, p.y - gs, gs * 2, gs * 2);
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgb(245,245,245)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame(ts) {
      state.raf = 0;
      if (state.closed) return;
      if (!state.last) state.last = ts;
      var dt = Math.min(0.05, Math.max(0, (ts - state.last) / 1000));
      state.last = ts;
      update(dt);
      draw();
      state.raf = window.requestAnimationFrame(frame);
    }

    function startLoop() {
      if (!ctx || !canAnimate || state.raf || state.closed) return;
      state.last = 0;
      state.raf = window.requestAnimationFrame(frame);
    }

    function stopLoop() {
      if (state.raf) {
        try { window.cancelAnimationFrame(state.raf); } catch (_) {}
        state.raf = 0;
      }
    }

    function onVisibility() {
      if (document.hidden) stopLoop();
      else startLoop();
    }

    function showSlide(n) {
      var prev = state.current;
      if (prev) {
        prev.classList.remove('ws-w-in');
        prev.classList.add('ws-w-out');
        later(function () { if (prev.parentNode) prev.parentNode.removeChild(prev); }, SLIDE_OUT_MS);
      }
      var node = el('div', 'ws-w-slide');
      node.setAttribute('aria-hidden', 'true');
      for (var k = 0; k < slides[n].length; k++) node.appendChild(el('div', 'ws-w-line', slides[n][k]));
      stage.appendChild(node);
      void node.offsetWidth;
      node.classList.add('ws-w-in');
      state.current = node;
      state.index = n;
      for (var q = 0; q < dots.length; q++) {
        if (q === n) dots[q].classList.add('ws-w-active');
        else dots[q].classList.remove('ws-w-active');
      }
      state.lockUntil = Date.now() + LOCK_MS;
      var spoken = slides[n].join(' ');
      later(function () { live.textContent = spoken; }, n === 0 ? 200 : 0);
    }

    function advance(x, y) {
      if (state.closing || state.closed) return;
      if (Date.now() < state.lockUntil) return;
      if (x == null || y == null) { x = state.w / 2; y = state.h / 2; }
      addBurst(x, y);
      if (canAnimate) state.warp = 1;
      if (state.index >= lastIndex) {
        finish();
        return;
      }
      if (state.index === 0) {
        hint.classList.remove('ws-w-show');
        hint.classList.add('ws-w-dim');
      }
      showSlide(state.index + 1);
    }

    function cleanup() {
      if (state.closed) return;
      state.closed = true;
      stopLoop();
      for (var k = 0; k < timers.length; k++) clearTimeout(timers[k]);
      timers.length = 0;
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKeydown, true);
      for (k = 0; k < inerted.length; k++) {
        var it = inerted[k];
        try { it.node.inert = it.inert; } catch (_) {}
        if (!it.inertAttr) it.node.removeAttribute('inert');
        if (it.ariaHidden === null) it.node.removeAttribute('aria-hidden');
        else it.node.setAttribute('aria-hidden', it.ariaHidden);
      }
      inerted.length = 0;
      for (k = 0; k < themeMetas.length; k++) {
        try {
          if (themeMetas[k].content === null) themeMetas[k].node.removeAttribute('content');
          else themeMetas[k].node.setAttribute('content', themeMetas[k].content);
        } catch (_) {}
      }
      themeMetas.length = 0;
      try { document.body.style.overflow = prevOverflow; } catch (_) {}
      try { document.documentElement.style.scrollbarGutter = prevGutter; } catch (_) {}
      if (ctx) {
        try { ctx.clearRect(0, 0, state.w, state.h); } catch (_) {}
      }
      canvas.width = 0;
      canvas.height = 0;
      ctx = null;
      state.stars.length = 0;
      state.particles.length = 0;
      state.rings.length = 0;
      state.shoots.length = 0;
      sprites.length = 0;
      burstSprites.length = 0;
      if (root.parentNode) root.parentNode.removeChild(root);
      try {
        var app = document.getElementById('app');
        if (app && typeof app.focus === 'function') app.focus({ preventScroll: true });
      } catch (_) {}
      announce();
    }

    function finish() {
      if (state.closing || state.closed) return;
      state.closing = true;
      remember();
      root.classList.remove('ws-w-on');
      root.classList.add('ws-w-off');
      later(cleanup, reduced ? 400 : CLOSE_MS + 30);
    }

    function onPointerUp(event) {
      if (state.closing || state.closed) return;
      if (event.target && skip.contains(event.target)) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      advance(event.clientX, event.clientY);
    }

    function onKeydown(event) {
      if (state.closed) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      var key = event.key;
      if (key === 'Escape' || key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        finish();
        return;
      }
      if (key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        try { skip.focus({ preventScroll: true }); } catch (_) {}
        return;
      }
      var onSkip = event.target === skip;
      if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'ArrowRight' || key === 'Right') {
        if (onSkip && key !== 'ArrowRight' && key !== 'Right') return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        advance();
      }
    }

    function onResize() {
      if (state.closed) return;
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function () {
        state.resizeTimer = 0;
        if (!state.closed) layout();
      }, 100);
    }

    root.addEventListener('pointerup', onPointerUp);
    skip.addEventListener('click', function () { finish(); });
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    var targets = [document.getElementById('app'), document.querySelector('header')];
    for (i = 0; i < targets.length; i++) {
      var node = targets[i];
      if (!node) continue;
      var rec = {
        node: node,
        inert: !!node.inert,
        inertAttr: node.hasAttribute('inert'),
        ariaHidden: node.getAttribute('aria-hidden')
      };
      inerted.push(rec);
      try { node.inert = true; } catch (_) {}
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    }
    try {
      var tcs = document.querySelectorAll('meta[name="theme-color"]');
      for (i = 0; i < tcs.length; i++) {
        themeMetas.push({ node: tcs[i], content: tcs[i].getAttribute('content') });
        tcs[i].setAttribute('content', '#0a0a0a');
      }
    } catch (_) {}
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    try {
      prevGutter = document.documentElement.style.scrollbarGutter || '';
      document.documentElement.style.scrollbarGutter = 'auto';
    } catch (_) {}

    try {
      document.body.appendChild(root);
      layout();
      showSlide(0);
      hint.classList.add('ws-w-show');
      try { root.focus({ preventScroll: true }); } catch (_) {}
      if (canAnimate) {
        window.requestAnimationFrame(function () {
          if (!state.closing && !state.closed) root.classList.add('ws-w-on');
        });
      } else {
        root.classList.add('ws-w-on');
      }
      startLoop();
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  /* Tells consent.js that the intro is over (or was never shown). */
  function announce() {
    if (announced) return;
    announced = true;
    try { window.dispatchEvent(new CustomEvent(DONE_EVENT)); } catch (_) {}
  }

  /* First visit: the intro comes first, then the consent dialog. */
  function start() {
    try {
      if (seen()) { announce(); return; }
      open();
    } catch (_) {
      try {
        var stale = document.getElementById(ROOT_ID);
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
        document.body.style.overflow = '';
      } catch (_) {}
      announce();
    }
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
