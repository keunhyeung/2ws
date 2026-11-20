(function () {
  'use strict';

  var KEY = '2ws-consent';
  var VERSION = '2026-11-20';
  var STYLE_ID = 'ws-consent-style';

  var TEXT = {
    title: '2WS 이용 전 확인',
    intro: '시작하기 전에 아래 내용을 확인해 주세요.',
    // Each item is a list of segments: a plain string, or [text, flags] where
    // flags 'b' = bold (strong) and 'n' = keep together (no line break inside).
    items: [
      ['2WS는 ', ['금융투자협회·CFA', 'n'], ' Institute 등과 ', ['무관한', 'b'], ' ', ['무료·비영리', 'n'], ' 개인 학습용 ', ['비공식 자료', 'bn'], '입니다.'],
      ['문항 작성·해설·검토에 ', ['AI 도구를 활용해', 'b'], ' 오류가 있을 수 있고 ', ['정확성을 보장하지 않으니,', 'b'], ' ', ['법령 원문과 공식 교재를', 'n'], ' ', ['확인해 주세요.', 'n']],
      ['학습 목적의 정보 제공용이며 ', ['투자 권유나 ', 'b'], ['투자자문이 아닙니다.', 'bn']],
      ['문제·해설·용어 데이터의 ', ['재배포와 상업적 ', 'b'], ['이용을 금지', 'bn'], '합니다.'],
      ['풀이 기록은 ', ['이 기기 안에만 저장', 'b'], '되며 외부로 ', ['보내지 않습니다.', 'n']]
    ],
    linkBefore: '출처·저작권 등 자세한 내용은 ',
    linkLabel: '안내',
    linkAfter: ' 화면에서 확인할 수 있습니다.',
    button: '확인하고 시작하기'
  };

  var CSS = [
    '.ws-consent{box-sizing:border-box;color:var(--color-ink,#0a0a0a);background:var(--color-surface,#fff);',
    'font-family:var(--font-sans,"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);',
    'width:min(440px,calc(100vw - 40px));max-width:none;',
    'max-height:calc(100vh - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));',
    'max-height:calc(100dvh - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));',
    'margin:auto;padding:0;border:0;border-radius:var(--radius-l,28px);overflow:hidden;',
    'box-shadow:var(--shadow-float,0 12px 32px rgba(10,10,10,.14));line-height:1.6;',
    'letter-spacing:var(--tracking-normal,-.01em);word-break:keep-all;overflow-wrap:break-word;',
    'animation:ws-consent-in var(--motion-base,220ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)) both}',
    'dialog.ws-consent{position:fixed;inset:0}',
    'dialog.ws-consent:not([open]){display:none}',
    'dialog.ws-consent[open]{display:flex;flex-direction:column}',
    'dialog.ws-consent::backdrop{background:var(--color-scrim,rgba(10,10,10,.45));',
    '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);',
    'animation:ws-consent-fade var(--motion-base,220ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)) both}',
    'div.ws-consent{position:fixed;inset:0;margin:auto;height:fit-content;display:flex;flex-direction:column;z-index:2147483000}',
    '.ws-consent-scrim{position:fixed;inset:0;z-index:2147482999;background:var(--color-scrim,rgba(10,10,10,.45));',
    '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);',
    'animation:ws-consent-fade var(--motion-base,220ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)) both}',
    '.ws-consent *{box-sizing:border-box}',
    '.ws-consent-head{flex:none;padding:24px 24px 0}',
    '.ws-consent h2{margin:0;font-size:var(--text-title,1.5rem);line-height:var(--leading-title,1.38);',
    'font-weight:var(--weight-heavy,800);letter-spacing:var(--tracking-tight,-.03em);outline:none;text-wrap:balance}',
    '.ws-consent-intro{margin:8px 0 0;font-size:var(--text-label,.9375rem);line-height:1.5;color:var(--color-ink-2,#4a4a4a);word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}',
    '.ws-consent-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;',
    '-webkit-overflow-scrolling:touch;padding:16px 24px 4px}',
    '.ws-consent ul{list-style:none;margin:0;padding:0;border-radius:var(--radius-m,18px);',
    'background:var(--color-sunken,#f4f4f4);overflow:hidden}',
    '.ws-consent li{display:flex;align-items:flex-start;gap:12px;margin:0;padding:12px 16px;font-size:var(--text-label,.9375rem);line-height:1.6;color:var(--color-ink,#0a0a0a)}',
    '.ws-consent li+li{box-shadow:inset 0 1px 0 var(--color-line,#e4e4e4)}',
    '.ws-consent-text{flex:1 1 auto;min-width:0;word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}',
    '.ws-consent-text strong{font-weight:var(--weight-bold,700);color:inherit}',
    '.ws-consent-text .ws-nb{white-space:nowrap}',
    '.ws-consent-check{position:relative;display:block;flex:none;width:18px;height:18px;margin-top:3px;border-radius:50%;',
    'background:var(--color-correct,var(--color-ink,#0a0a0a))}',
    '.ws-consent-check::after{content:"";position:absolute;left:50%;top:45%;width:4.14px;height:8.28px;',
    'border:solid var(--color-on-signal,#fff);border-width:0 2px 2px 0;transform:translate(-50%,-50%) rotate(45deg)}',
    '.ws-consent .ws-consent-link{margin:12px 8px 0;font-size:var(--text-caption,.8125rem);line-height:1.5;color:var(--color-ink-3,#6b6b6b);',
    'word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}',
    '.ws-consent .ws-consent-link a{color:var(--color-ink,#0a0a0a);font-weight:var(--weight-bold,700);text-decoration:underline;',
    'text-decoration-thickness:1px;text-underline-offset:3px;text-decoration-color:var(--color-ink-3,#6b6b6b)}',
    '.ws-consent-foot{flex:none;padding:16px 24px calc(24px + 0px)}',
    '.ws-consent .ws-consent-btn{display:flex;align-items:center;justify-content:center;width:100%;',
    'min-height:var(--size-button,56px);padding:8px 20px;border:0;border-radius:999px;font:inherit;',
    'font-size:var(--text-body,1.0625rem);line-height:1.3;font-weight:700;letter-spacing:inherit;cursor:pointer;',
    'background:var(--color-inverse,#0a0a0a);color:var(--color-on-inverse,#fff);touch-action:manipulation;',
    'transition:transform var(--motion-base,220ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}',
    '.ws-consent .ws-consent-btn:active{transform:scale(.98)}',
    '.ws-consent a:focus-visible,.ws-consent .ws-consent-btn:focus-visible{outline:3px solid var(--color-focus,#2251ff);outline-offset:2px}',
    '@keyframes ws-consent-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}',
    '@keyframes ws-consent-fade{from{opacity:0}to{opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.ws-consent,dialog.ws-consent::backdrop,.ws-consent-scrim{animation:none}',
    '.ws-consent .ws-consent-btn{transition:none}}',
    '@media (prefers-color-scheme:dark){',
    ':root:not([data-theme="light"]) .ws-consent{color:var(--color-ink,#f5f5f5);background:var(--color-surface,#171717)}',
    ':root:not([data-theme="light"]) .ws-consent-intro{color:var(--color-ink-2,#b8b8b8)}',
    ':root:not([data-theme="light"]) .ws-consent ul{background:var(--color-sunken,#222)}',
    ':root:not([data-theme="light"]) .ws-consent li{color:var(--color-ink,#f5f5f5)}',
    ':root:not([data-theme="light"]) .ws-consent li+li{box-shadow:inset 0 1px 0 var(--color-line,#2c2c2c)}',
    ':root:not([data-theme="light"]) .ws-consent-check{background:var(--color-correct,var(--color-ink,#f5f5f5))}',
    ':root:not([data-theme="light"]) .ws-consent-check::after{border-color:var(--color-on-signal,#0a0a0a)}',
    ':root:not([data-theme="light"]) .ws-consent .ws-consent-link{color:var(--color-ink-3,#8f8f8f)}',
    ':root:not([data-theme="light"]) .ws-consent .ws-consent-link a{color:var(--color-ink,#f5f5f5);text-decoration-color:var(--color-ink-3,#8f8f8f)}',
    ':root:not([data-theme="light"]) .ws-consent .ws-consent-btn{background:var(--color-inverse,#f5f5f5);color:var(--color-on-inverse,#0a0a0a)}',
    '}'
  ].join('');

  function stored(storage) {
    try { return storage.getItem(KEY) === VERSION; } catch (_) { return false; }
  }

  function accepted() {
    var ok = false;
    try { ok = stored(window.localStorage); } catch (_) {}
    if (ok) return true;
    try { return stored(window.sessionStorage); } catch (_) { return false; }
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

  function textNode(segments) {
    var box = el('span', 'ws-consent-text');
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (typeof seg === 'string') {
        box.appendChild(document.createTextNode(seg));
        continue;
      }
      var flags = seg[1] || '';
      var node = el(flags.indexOf('b') >= 0 ? 'strong' : 'span', flags.indexOf('n') >= 0 ? 'ws-nb' : '', seg[0]);
      box.appendChild(node);
    }
    return box;
  }

  function build(tag) {
    var root = el(tag, 'ws-consent');
    var title = el('h2', '', TEXT.title);
    title.id = 'ws-consent-title';
    title.tabIndex = -1;
    root.setAttribute('aria-labelledby', title.id);

    var list = el('ul');
    for (var i = 0; i < TEXT.items.length; i++) {
      var row = el('li');
      var mark = el('span', 'ws-consent-check');
      mark.setAttribute('aria-hidden', 'true');
      row.appendChild(mark);
      row.appendChild(textNode(TEXT.items[i]));
      list.appendChild(row);
    }

    var link = el('a', '', TEXT.linkLabel);
    link.href = './about.html';
    var linkLine = el('p', 'ws-consent-link');
    linkLine.appendChild(document.createTextNode(TEXT.linkBefore));
    linkLine.appendChild(link);
    linkLine.appendChild(document.createTextNode(TEXT.linkAfter));

    var button = el('button', 'primary ws-consent-btn', TEXT.button);
    button.type = 'button';

    var head = el('div', 'ws-consent-head');
    head.appendChild(title);
    head.appendChild(el('p', 'ws-consent-intro', TEXT.intro));
    var body = el('div', 'ws-consent-body');
    body.appendChild(list);
    body.appendChild(linkLine);
    var foot = el('div', 'ws-consent-foot');
    foot.appendChild(button);

    root.appendChild(head);
    root.appendChild(body);
    root.appendChild(foot);
    return { root: root, title: title, button: button };
  }

  function restoreFocus() {
    try {
      var app = document.getElementById('app');
      if (app && typeof app.focus === 'function') app.focus({ preventScroll: true });
    } catch (_) {}
  }

  function open() {
    if (document.getElementById('ws-consent-root')) return;

    if (!document.getElementById(STYLE_ID)) {
      var style = el('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    var native = typeof window.HTMLDialogElement === 'function' &&
      typeof window.HTMLDialogElement.prototype.showModal === 'function';
    var parts = build(native ? 'dialog' : 'div');
    var root = parts.root;
    root.id = 'ws-consent-root';
    var done = false;
    var scrim = null;
    var inerted = [];
    var prevOverflow = '';

    function finish() {
      if (done) return;
      done = true;
      remember();
      if (native) {
        try { root.close(); } catch (_) {}
      } else {
        for (var i = 0; i < inerted.length; i++) {
          try { inerted[i].inert = false; inerted[i].removeAttribute('inert'); inerted[i].removeAttribute('aria-hidden'); } catch (_) {}
        }
        try { document.body.style.overflow = prevOverflow; } catch (_) {}
        document.removeEventListener('keydown', onKeydown, true);
        if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim);
      }
      if (root.parentNode) root.parentNode.removeChild(root);
      restoreFocus();
      try { window.dispatchEvent(new CustomEvent('ws-consent-accepted')); } catch (_) {}
    }

    function onKeydown(event) {
      if (done) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        return;
      }
      if (!native && event.key === 'Tab') {
        var link = root.querySelector('a');
        var first = link || parts.button;
        var last = parts.button;
        var active = document.activeElement;
        if (!root.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && (active === first || active === parts.title)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    parts.button.addEventListener('click', finish);
    root.addEventListener('keydown', onKeydown, true);

    if (native) {
      root.addEventListener('cancel', function (event) { event.preventDefault(); });
      // Some browsers close a modal dialog on a second Escape even if cancel was prevented.
      root.addEventListener('close', function () {
        if (done) return;
        setTimeout(function () {
          if (done || !root.isConnected) return;
          try { if (!root.open) root.showModal(); } catch (_) {}
        }, 0);
      });
      document.body.appendChild(root);
      try {
        root.showModal();
      } catch (_) {
        root.setAttribute('open', '');
      }
    } else {
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      scrim = el('div', 'ws-consent-scrim');
      var targets = [document.getElementById('app'), document.querySelector('header')];
      for (var i = 0; i < targets.length; i++) {
        if (!targets[i]) continue;
        try { targets[i].inert = true; } catch (_) {}
        targets[i].setAttribute('inert', '');
        targets[i].setAttribute('aria-hidden', 'true');
        inerted.push(targets[i]);
      }
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
      document.body.appendChild(scrim);
      document.body.appendChild(root);
    }

    try { parts.title.focus({ preventScroll: true }); } catch (_) {}
  }

  function start() {
    try { open(); } catch (_) {}
  }

  try {
    if (accepted()) return;
  } catch (_) {}

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
