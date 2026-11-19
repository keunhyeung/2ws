(function () {
  'use strict';
  try {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

    var CHECK_MS = 30 * 60 * 1000;
    var RELOAD_FALLBACK_MS = 5000;
    var TOAST_ID = 'host-update';
    var MSG = { ready: '새 버전이 준비됐어요', reload: '새로고침' };

    var container = navigator.serviceWorker;
    var hadController = !!container.controller;
    var registration = null;
    var requested = false;
    var reloading = false;

    var current = null;

    function toast(onAction) {
      try {
        if (window.TextbookHost && typeof window.TextbookHost.toast === 'function') {
          if (current) current.close();
          current = window.TextbookHost.toast(MSG.ready, { id: TOAST_ID, sticky: true, actionLabel: MSG.reload, onAction: onAction });
        }
      } catch (_) {}
    }

    function reloadOnce() {
      if (reloading) return;
      reloading = true;
      try { location.reload(); } catch (_) {}
    }

    function offerUpdate(worker) {
      toast(function () {
        requested = true;
        try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (_) { reloadOnce(); return; }
        setTimeout(reloadOnce, RELOAD_FALLBACK_MS);
      });
    }

    function watch(reg) {
      function consider(worker) {
        if (!worker || !container.controller) return;
        if (worker.state === 'installed') { offerUpdate(worker); return; }
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && container.controller) offerUpdate(worker);
        });
      }
      if (reg.waiting) consider(reg.waiting);
      if (reg.installing) consider(reg.installing);
      reg.addEventListener('updatefound', function () { consider(reg.installing); });
    }

    container.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (requested) reloadOnce();
      else toast(reloadOnce);
    });

    function check() {
      try {
        if (registration) registration.update().catch(function () {});
      } catch (_) {}
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(function () {
      if (document.visibilityState === 'visible') check();
    }, CHECK_MS);

    var OLD_SCOPE = /\/investment-exam\/$/;

    function dropEarlierSite() {
      try {
        if (typeof container.getRegistrations !== 'function') return;
        var own = new URL('./', document.baseURI || location.href).pathname;
        container.getRegistrations().then(function (list) {
          (list || []).forEach(function (reg) {
            try {
              var path = new URL(reg.scope).pathname;
              if (path !== own && OLD_SCOPE.test(path)) reg.unregister().catch(function () {});
            } catch (_) {}
          });
        }).catch(function () {});
      } catch (_) {}
    }

    function register() {
      container.register('./sw.js').then(function (reg) {
        registration = reg;
        watch(reg);
        check();
      }).catch(function () {});
    }
    dropEarlierSite();
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  } catch (_) {}
})();
