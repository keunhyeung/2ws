/* "앱 설치" card on the 안내 page.
 * Uses the vendored <pwa-install> component (vendor/pwa-install, MIT):
 * Chromium browsers get the browser's real install prompt, Apple devices get
 * the component's "홈 화면에 추가" guide. Already-installed (standalone) sessions
 * only show a short note. */
(function () {
  'use strict';
  var card = document.querySelector('[data-install-card]');
  if (!card) return;
  var button = card.querySelector('[data-install-button]');
  var done = card.querySelector('[data-install-done]');

  function standalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;
    } catch (_) { return false; }
  }
  function showDone() {
    if (button) button.hidden = true;
    if (done) done.hidden = false;
  }
  if (standalone()) { showDone(); return; }
  if (!button || !window.customElements || !window.customElements.get('pwa-install')) {
    if (button && button.parentNode) button.parentNode.hidden = true; // component failed to load: keep the card text only
    return;
  }

  var el = document.createElement('pwa-install');
  el.setAttribute('manual-apple', '');
  el.setAttribute('manual-chrome', '');
  el.setAttribute('disable-screenshots', '');
  el.setAttribute('manifest-url', './manifest.webmanifest');
  el.setAttribute('name', '2WS');
  el.setAttribute('description', '투자자산운용사 무료 학습 웹앱');
  el.setAttribute('icon', './icons/icon-192.png');
  document.body.appendChild(el);

  el.addEventListener('pwa-install-success-event', showDone);
  button.hidden = false;
  button.addEventListener('click', function () {
    try {
      if (el.isInstallAvailable && !el.isAppleMobilePlatform && !el.isAppleDesktopPlatform) {
        var r = el.install();
        if (r && typeof r.catch === 'function') r.catch(function () { el.showDialog(true); });
      } else {
        el.showDialog(true);
      }
    } catch (_) {
      try { el.showDialog(true); } catch (_) {}
    }
  });
})();
