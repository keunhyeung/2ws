(function () {
  'use strict';

  var SLOW_MS = 20000;
  var TOAST_MS = 3500;
  var AUTO_RELOAD_KEY = 'host-online-reload';
  var AUTO_RELOAD_GAP_MS = 30000;
  var DISMISS_KEY = 'host-storage-banner-dismissed';

  var MSG = {
    slow: '오래 걸리고 있어요. 연결이 느리면 조금 더 기다려 주세요.',
    loadFailed: '문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
    retry: '다시 시도',
    storage: '이 브라우저에서는 풀이 기록이 저장되지 않아요. 사생활 보호 모드이거나 저장 공간이 막혀 있을 수 있어요.',
    dismiss: '닫기',
    remote: '다른 창에서 기록이 바뀌었어요',
    reload: '새로고침'
  };

  var doc = document;

  function whenBody(fn) {
    if (doc.body) { fn(); return; }
    doc.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, onClick) {
    var b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function reload() { try { location.reload(); } catch (_) {} }


  var toastBox = null;

  function measureBar() {
    try {
      var bar = doc.querySelector('.v2-primary-nav') || doc.querySelector('.v2-top');
      if (!bar) return;
      var rect = bar.getBoundingClientRect();
      if (rect.height > 0) {
        var gap = Math.max(0, Math.round(window.innerHeight - rect.top));
        doc.documentElement.style.setProperty('--host-bottom', gap + 'px');
      }
    } catch (_) {}
  }

  function toastContainer() {
    if (!toastBox || !toastBox.parentNode) {
      toastBox = el('div', 'host-toasts');
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      doc.body.appendChild(toastBox);
    }
    return toastBox;
  }

  function toast(text, options) {
    var opts = options || {};
    var handle = { close: function () {} };
    whenBody(function () {
      measureBar();
      var box = toastContainer();
      if (opts.id) {
        var same = box.querySelector('[data-toast-id="' + opts.id + '"]');
        if (same) { handle.close = same.__close || handle.close; return; }
      }
      var node = el('div', 'host-toast');
      if (opts.id) node.setAttribute('data-toast-id', opts.id);
      node.appendChild(el('span', '', text));
      var timer = null;
      function close() {
        if (timer) clearTimeout(timer);
        if (node.parentNode) node.parentNode.removeChild(node);
      }
      node.__close = close;
      handle.close = close;
      if (opts.actionLabel) {
        node.appendChild(button(opts.actionLabel, 'host-btn', function () {
          if (typeof opts.onAction === 'function') opts.onAction(close);
        }));
      }
      box.appendChild(node);
      if (!opts.sticky) timer = setTimeout(close, opts.ms || TOAST_MS);
    });
    return handle;
  }

  window.addEventListener('resize', measureBar);
  window.addEventListener('orientationchange', measureBar);

  window.TextbookHost = { toast: toast };


  function appRoot() { return doc.getElementById('app'); }

  function startupPending() {
    var app = appRoot();
    if (!app) return false;
    for (var i = 0; i < app.children.length; i++) {
      if (!app.children[i].hasAttribute('data-host')) return false;
    }
    return true;
  }

  function hasPlaceholder() {
    var app = appRoot();
    return !!(app && app.querySelector('.host-loading'));
  }

  var autoReloadArmed = false;

  function armAutoReload() {
    if (autoReloadArmed) return;
    autoReloadArmed = true;
    window.addEventListener('online', function onOnline() {
      window.removeEventListener('online', onOnline);
      autoReloadArmed = false;
      if (!startupPending()) return;
      try {
        var last = Number(sessionStorage.getItem(AUTO_RELOAD_KEY) || 0);
        if (last && Date.now() - last < AUTO_RELOAD_GAP_MS) return;
        sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
      } catch (_) {}
      reload();
    });
  }

  function showLoadError() {
    if (!startupPending()) return;
    var app = appRoot();
    var box = el('div', 'host-error');
    box.setAttribute('data-host', '');
    box.setAttribute('role', 'alert');
    box.appendChild(el('p', '', MSG.loadFailed));
    box.appendChild(button(MSG.retry, 'host-btn', reload));
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(box);
    armAutoReload();
  }

  function looksLikeLoadError(reason) {
    if (!reason) return false;
    if (typeof TypeError === 'function' && reason instanceof TypeError) return true;
    if (typeof SyntaxError === 'function' && reason instanceof SyntaxError) return true;
    var text = String(reason.message || reason);
    return /fetch|network|json|load failed|failed to load/i.test(text);
  }

  window.addEventListener('unhandledrejection', function (event) {
    if (startupPending() && looksLikeLoadError(event && event.reason)) showLoadError();
  });

  function isStartupData(input) {
    try {
      var raw = typeof input === 'string' ? input : (input && input.url) || String(input);
      var url = new URL(raw, location.href);
      return url.origin === location.origin && /\/data\/[^/]+\.json$/.test(url.pathname);
    } catch (_) { return false; }
  }

  try {
    var nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') {
      window.fetch = function (input) {
        var promise = nativeFetch.apply(this, arguments);
        try {
          if (startupPending() && isStartupData(input)) {
            promise.then(function (response) {
              if (!response || !response.ok) showLoadError();
            }, function () { showLoadError(); });
          }
        } catch (_) {}
        return promise;
      };
    }
  } catch (_) {}

  window.addEventListener('error', function (event) {
    if (!startupPending()) return;
    var target = event && event.target;
    if (target && target !== window && target.tagName === 'SCRIPT') {
      if (/\/assets\/app\.js(\?|$)/.test(target.src || '')) showLoadError();
    } else if (event && event.error && /\/assets\/app\.js(\?|$)/.test(event.filename || '')) {
      showLoadError();
    }
  }, true);

  setTimeout(function () {
    if (!hasPlaceholder() || doc.querySelector('.host-slow')) return;
    var holder = doc.querySelector('.host-loading');
    if (holder) holder.appendChild(el('p', 'host-slow', MSG.slow));
  }, SLOW_MS);


  var noticeBox = null;

  function notices() {
    if (!noticeBox || !noticeBox.parentNode) {
      noticeBox = el('div', 'host-notices');
      noticeBox.id = 'host-notices';
      doc.body.insertBefore(noticeBox, doc.body.firstChild);
    }
    return noticeBox;
  }

  function storageBad() {
    var adapter = window.TextbookProgressAdapter;
    return !adapter || adapter.available === false;
  }

  var bannerDismissed = false;
  try { bannerDismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (_) {}

  function syncStorageBanner() {
    whenBody(function () {
      var present = doc.getElementById('host-storage-banner');
      var want = storageBad() && !bannerDismissed;
      if (want && !present) {
        var banner = el('div', 'host-banner');
        banner.id = 'host-storage-banner';
        banner.setAttribute('role', 'status');
        banner.appendChild(el('p', '', MSG.storage));
        banner.appendChild(button(MSG.dismiss, 'host-btn host-btn-quiet', function () {
          bannerDismissed = true;
          try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
          syncStorageBanner();
        }));
        notices().appendChild(banner);
      } else if (!want && present) {
        present.parentNode.removeChild(present);
      }
    });
  }

  var remoteChanged = false;

  function syncRemoteNotice() {
    whenBody(function () {
      var present = doc.getElementById('host-remote-notice');
      var want = remoteChanged && /^#history(?:[/?]|$)/.test(location.hash);
      if (want && !present) {
        var notice = el('div', 'host-notice');
        notice.id = 'host-remote-notice';
        notice.setAttribute('role', 'status');
        notice.appendChild(el('p', '', MSG.remote));
        notice.appendChild(button(MSG.reload, 'host-btn', reload));
        notices().appendChild(notice);
      } else if (!want && present) {
        present.parentNode.removeChild(present);
      }
    });
  }

  window.addEventListener('textbook-storage-status', syncStorageBanner);
  window.addEventListener('textbook-progress-remote', function () { remoteChanged = true; syncRemoteNotice(); });
  window.addEventListener('hashchange', syncRemoteNotice);
  whenBody(syncStorageBanner);
})();
