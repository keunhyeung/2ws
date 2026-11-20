(function () {
  'use strict';

  var KEY = '2ws-consent';
  var VERSION = '2026-11-20';
  var STYLE_ID = 'ws-consent-style';

  var TEXT = {
    title: '2WS 이용 전 확인',
    intro: '시작하기 전에 아래 내용을 확인해 주세요.',
    items: [
      '2WS는 금융투자협회·CFA Institute 등과 무관한 무료·비영리 개인 학습용 비공식 자료입니다.',
      '문항 작성·해설·검토에 AI 도구를 활용해 오류가 있을 수 있고 정확성을 보장하지 않으니, 법령 원문과 공식 교재를 확인해 주세요.',
      '학습 목적의 정보 제공용이며 투자 권유나 투자자문이 아닙니다.',
      '문제·해설·용어 데이터의 재배포와 상업적 이용을 금지합니다.',
      '풀이 기록은 이 기기 안에만 저장되며 외부로 보내지 않습니다.'
    ],
    linkBefore: '출처·저작권 등 자세한 내용은 ',
    linkLabel: '안내',
    linkAfter: ' 화면에서 확인할 수 있습니다.',
    button: '확인하고 시작하기'
  };

  var CSS = [
    '.ws-consent{box-sizing:border-box;color:var(--color-ink,#0a0a0a);background:var(--color-surface,#fff);',
    'font-family:var(--font-sans,"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);',
    'width:calc(100% - 32px);max-width:460px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);',
    'margin:auto;padding:20px;border:0;border-radius:var(--radius-m,18px);overflow:auto;',
    'overscroll-behavior:contain;box-shadow:var(--shadow-float,0 12px 32px rgba(10,10,10,.14));line-height:1.6}',
    'dialog.ws-consent{position:fixed;inset:0}',
    'dialog.ws-consent:not([open]){display:none}',
    'dialog.ws-consent::backdrop{background:var(--color-scrim,rgba(10,10,10,.45))}',
    'div.ws-consent{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483000}',
    '.ws-consent-scrim{position:fixed;inset:0;z-index:2147482999;background:var(--color-scrim,rgba(10,10,10,.45))}',
    '.ws-consent *{box-sizing:border-box}',
    '.ws-consent h2{margin:0 0 8px;font-size:1.25rem;line-height:1.4;font-weight:700;letter-spacing:-.03em;outline:none}',
    '.ws-consent p{margin:0 0 12px;font-size:.9375rem}',
    '.ws-consent ul{margin:0 0 12px;padding:0 0 0 1.25em;font-size:.9375rem}',
    '.ws-consent li{margin:0 0 8px;padding-left:2px}',
    '.ws-consent li:last-child{margin-bottom:0}',
    '.ws-consent a{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px}',
    '.ws-consent .ws-consent-link{margin:0 0 20px;color:var(--color-ink-2,#4a4a4a)}',
    '.ws-consent .ws-consent-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;',
    'padding:8px 20px;border:0;border-radius:999px;font:inherit;font-size:1.0625rem;line-height:1.3;font-weight:700;',
    'cursor:pointer;background:var(--color-inverse,#0a0a0a);color:var(--color-on-inverse,#fff)}',
    '.ws-consent a:focus-visible,.ws-consent .ws-consent-btn:focus-visible{outline:3px solid var(--color-focus,#2251ff);outline-offset:2px}',
    '@media (prefers-color-scheme:dark){',
    ':root:not([data-theme="light"]) .ws-consent{color:var(--color-ink,#f5f5f5);background:var(--color-surface,#171717)}',
    ':root:not([data-theme="light"]) .ws-consent .ws-consent-btn{background:var(--color-inverse,#f5f5f5);color:var(--color-on-inverse,#0a0a0a)}',
    ':root:not([data-theme="light"]) .ws-consent .ws-consent-link{color:var(--color-ink-2,#c4c4c4)}',
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

  function build(tag) {
    var root = el(tag, 'ws-consent');
    var title = el('h2', '', TEXT.title);
    title.id = 'ws-consent-title';
    title.tabIndex = -1;
    root.setAttribute('aria-labelledby', title.id);

    var list = el('ul');
    for (var i = 0; i < TEXT.items.length; i++) list.appendChild(el('li', '', TEXT.items[i]));

    var link = el('a', '', TEXT.linkLabel);
    link.href = './about.html';
    var linkLine = el('p', 'ws-consent-link');
    linkLine.appendChild(document.createTextNode(TEXT.linkBefore));
    linkLine.appendChild(link);
    linkLine.appendChild(document.createTextNode(TEXT.linkAfter));

    var button = el('button', 'primary ws-consent-btn', TEXT.button);
    button.type = 'button';

    root.appendChild(title);
    root.appendChild(el('p', '', TEXT.intro));
    root.appendChild(list);
    root.appendChild(linkLine);
    root.appendChild(button);
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
