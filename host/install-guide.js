/* One-time "앱으로 설치해 보세요" screen, shown after the consent dialog
 * (welcome intro -> consent -> this guide -> 문제 풀이).
 * Android/Chromium: a "바로 설치" button opens the browser's real install prompt
 * (beforeinstallprompt). iPhone: step-by-step text, since Safari has no install API.
 * Skipped when the app already runs installed (standalone). Text via textContent only. */
(function () {
  'use strict';

  var KEY = '2ws-install-guide';
  var VERSION = 'v1';
  var ROOT_ID = 'ws-guide-root';
  var STYLE_ID = 'ws-guide-style';

  var TEXT = {
    title: '앱으로 설치해 보세요',
    lead: '홈 화면 아이콘으로 바로 열리고, 주소창 없는 전체 화면으로 깔끔하게 볼 수 있어요. 한 번 열어 두면 오프라인에서도 공부할 수 있어요.',
    android: {
      name: '갤럭시(안드로이드)',
      steps: [
        ['Chrome으로 열기', '지금 페이지를 Chrome 브라우저로 열어요'],
        ['오른쪽 위 ⋮ 메뉴 누르기', '"앱 설치" 또는 "홈 화면에 추가"를 선택해요'],
        ['"설치" 누르면 완료', '잠시 후 홈 화면에 2WS 아이콘이 생겨요']
      ],
      note: '삼성 인터넷은 메뉴 → "현재 페이지 추가" → "홈 화면"으로 추가해요.',
      button: '바로 설치'
    },
    ios: {
      name: '아이폰',
      steps: [
        ['꼭 Safari로 열기', 'Chrome이 아닌 Safari 브라우저로 열어요'],
        ['아래 공유 버튼 누르기', '최신 iOS는 ⋯ 버튼 → 공유를 눌러요'],
        ['목록에서 "홈 화면에 추가"', '이어서 "추가"를 누르면 홈 화면에 아이콘이 생겨요']
      ],
      note: '아이폰은 자동 설치가 지원되지 않아 이 방법으로만 설치할 수 있어요.'
    },
    start: '문제 풀이 시작하기',
    later: '지금 설치하지 않아도 문제·기록 화면 맨 아래 "안내"에서 언제든 다시 볼 수 있어요.'
  };

  var CSS = [
    '.ws-guide{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;background:var(--color-bg,#f0f0f0);color:var(--color-ink,#0a0a0a);',
    'font-family:inherit;opacity:0;transition:opacity .28s cubic-bezier(.2,.8,.2,1)}',
    '.ws-guide.ws-g-on{opacity:1}',
    '.ws-guide-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
    'padding:calc(var(--space-8,32px) + env(safe-area-inset-top,0px)) var(--space-5,20px) var(--space-6,24px)}',
    '.ws-guide-inner{max-width:760px;margin:0 auto}',
    '.ws-guide h2{margin:0 0 var(--space-2,8px);font-size:var(--text-title,26px);line-height:1.3;font-weight:var(--weight-heavy,800);letter-spacing:-.02em;word-break:keep-all}',
    '.ws-guide h2:focus{outline:none}',
    '.ws-guide-lead{margin:0 0 var(--space-6,24px);color:var(--color-ink-2,#4a4a4a);font-size:var(--text-label,15px);line-height:1.6;word-break:keep-all}',
    '.ws-guide-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-4,16px)}',
    '.ws-guide-card{display:flex;flex-direction:column;padding:var(--space-6,24px);border-radius:var(--radius-l,28px);background:var(--color-surface,#fff);box-shadow:inset 0 0 0 1px var(--color-line,#e4e4e4)}',
    '.ws-guide-head{display:flex;align-items:center;gap:var(--space-4,16px);margin-bottom:var(--space-5,20px)}',
    '.ws-guide-icon{display:grid;place-items:center;width:56px;height:56px;flex:none;border-radius:50%;background:var(--color-sunken,#f4f4f4);color:var(--color-ink,#0a0a0a)}',
    '.ws-guide-icon svg{width:26px;height:26px}',
    '.ws-guide-card h3{margin:0;font-size:var(--text-heading,21px);line-height:1.3;font-weight:var(--weight-heavy,800);letter-spacing:-.02em}',
    '.ws-guide-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--space-4,16px)}',
    '.ws-guide-steps li{display:flex;gap:var(--space-4,16px);align-items:flex-start}',
    '.ws-guide-num{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:50%;background:var(--color-inverse,#0a0a0a);color:var(--color-on-inverse,#fff);',
    'font-size:14px;font-weight:var(--weight-bold,700);font-variant-numeric:tabular-nums}',
    '.ws-guide-steps b{display:block;font-size:var(--text-body,16px);line-height:1.45;font-weight:var(--weight-bold,700);word-break:keep-all}',
    '.ws-guide-steps small{display:block;margin-top:2px;color:var(--color-ink-3,#6b6b6b);font-size:var(--text-caption,13px);line-height:1.5;word-break:keep-all}',
    '.ws-guide-install{margin-top:var(--space-5,20px);min-height:var(--size-button,52px);border:0;border-radius:var(--radius-pill,999px);',
    'background:var(--color-inverse,#0a0a0a);color:var(--color-on-inverse,#fff);font:inherit;font-size:var(--text-body,16px);font-weight:var(--weight-bold,700);cursor:pointer}',
    '.ws-guide-install:active{transform:scale(.98)}',
    '.ws-guide-note{margin:auto 0 0;padding-top:var(--space-5,20px);color:var(--color-ink-3,#6b6b6b);font-size:var(--text-caption,13px);line-height:1.5;font-style:italic;word-break:keep-all}',
    '.ws-guide-foot{padding:var(--space-4,16px) var(--space-5,20px) calc(var(--space-4,16px) + env(safe-area-inset-bottom,0px));',
    'background:var(--color-bg,#f0f0f0);box-shadow:0 -1px 0 var(--color-line,#e4e4e4)}',
    '.ws-guide-foot-inner{max-width:760px;margin:0 auto;text-align:center}',
    '.ws-guide-start{width:100%;min-height:var(--size-button,52px);border:0;border-radius:var(--radius-pill,999px);background:var(--color-inverse,#0a0a0a);',
    'color:var(--color-on-inverse,#fff);font:inherit;font-size:var(--text-body,16px);font-weight:var(--weight-bold,700);cursor:pointer}',
    '.ws-guide-start:active{transform:scale(.98)}',
    '.ws-guide-later{margin:var(--space-3,12px) 0 0;color:var(--color-ink-3,#6b6b6b);font-size:var(--text-caption,13px);line-height:1.5;word-break:keep-all}',
    '@media (prefers-reduced-motion:reduce){.ws-guide{transition:none}}'
  ].join('');

  var PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18h2"/></svg>';

  var deferredPrompt = null;
  var installButtons = [];

  function storedValue(storage) {
    try { return storage.getItem(KEY); } catch (_) { return null; }
  }
  function seen() {
    return storedValue(window.localStorage) === VERSION || storedValue(window.sessionStorage) === VERSION;
  }
  function remember() {
    try { window.localStorage.setItem(KEY, VERSION); return; } catch (_) {}
    try { window.sessionStorage.setItem(KEY, VERSION); } catch (_) {}
  }
  function standalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;
    } catch (_) { return false; }
  }
  function isApple() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function syncInstallButtons() {
    for (var i = 0; i < installButtons.length; i++) installButtons[i].hidden = !deferredPrompt;
  }

  function card(data, withInstall) {
    var box = el('section', 'ws-guide-card');
    var head = el('div', 'ws-guide-head');
    var icon = el('span', 'ws-guide-icon');
    icon.innerHTML = PHONE_SVG; // static markup, no user data
    head.appendChild(icon);
    head.appendChild(el('h3', null, data.name));
    box.appendChild(head);
    var list = el('ol', 'ws-guide-steps');
    for (var i = 0; i < data.steps.length; i++) {
      var li = el('li');
      li.appendChild(el('span', 'ws-guide-num', String(i + 1)));
      var body = el('div');
      body.appendChild(el('b', null, data.steps[i][0]));
      body.appendChild(el('small', null, data.steps[i][1]));
      li.appendChild(body);
      list.appendChild(li);
    }
    box.appendChild(list);
    if (withInstall) {
      var button = el('button', 'ws-guide-install', data.button);
      button.type = 'button';
      button.hidden = true;
      button.addEventListener('click', function () {
        var ev = deferredPrompt;
        if (!ev) return;
        deferredPrompt = null;
        syncInstallButtons();
        try {
          var shown = ev.prompt();
          if (shown && typeof shown.catch === 'function') shown.catch(function () {});
        } catch (_) {}
      });
      installButtons.push(button);
      box.appendChild(button);
    }
    box.appendChild(el('p', 'ws-guide-note', data.note));
    return box;
  }

  function open() {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.getElementById(STYLE_ID)) {
      var style = el('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    var root = el('div', 'ws-guide');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ws-guide-title');

    var scroll = el('div', 'ws-guide-scroll');
    var inner = el('div', 'ws-guide-inner');
    var title = el('h2', null, TEXT.title);
    title.id = 'ws-guide-title';
    title.tabIndex = -1;
    inner.appendChild(title);
    inner.appendChild(el('p', 'ws-guide-lead', TEXT.lead));
    var cards = el('div', 'ws-guide-cards');
    var androidCard = card(TEXT.android, true);
    var iosCard = card(TEXT.ios, false);
    if (isApple()) { cards.appendChild(iosCard); cards.appendChild(androidCard); }
    else { cards.appendChild(androidCard); cards.appendChild(iosCard); }
    inner.appendChild(cards);
    scroll.appendChild(inner);
    root.appendChild(scroll);

    var foot = el('div', 'ws-guide-foot');
    var footInner = el('div', 'ws-guide-foot-inner');
    var start = el('button', 'ws-guide-start', TEXT.start);
    start.type = 'button';
    footInner.appendChild(start);
    footInner.appendChild(el('p', 'ws-guide-later', TEXT.later));
    foot.appendChild(footInner);
    root.appendChild(foot);

    var inerted = [];
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
      inerted.push({ node: node, had: node.hasAttribute('inert'), aria: node.getAttribute('aria-hidden') });
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    }
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function close() {
      remember();
      root.classList.remove('ws-g-on');
      setTimeout(function () {
        for (var k = 0; k < inerted.length; k++) {
          var it = inerted[k];
          if (!it.had) it.node.removeAttribute('inert');
          if (it.aria === null) it.node.removeAttribute('aria-hidden');
          else it.node.setAttribute('aria-hidden', it.aria);
        }
        document.body.style.overflow = prevOverflow;
        if (root.parentNode) root.parentNode.removeChild(root);
        installButtons.length = 0;
        try {
          var app = document.getElementById('app');
          if (app) app.focus({ preventScroll: true });
        } catch (_) {}
      }, 300);
    }
    start.addEventListener('click', close);

    document.body.appendChild(root);
    syncInstallButtons();
    window.requestAnimationFrame(function () { root.classList.add('ws-g-on'); });
    try { title.focus({ preventScroll: true }); } catch (_) {}
  }

  if (standalone() || seen()) return;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); // keep it for the "바로 설치" button on the guide
    deferredPrompt = event;
    syncInstallButtons();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    syncInstallButtons();
  });
  window.addEventListener('ws-consent-accepted', function () {
    if (seen()) return;
    try { open(); } catch (_) {}
  });
})();
