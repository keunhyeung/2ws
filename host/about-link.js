/* Small grey "안내" link at the bottom of the 문제 and 기록 screens
 * (the 안내 page is no longer in the bottom navigation). */
(function () {
  'use strict';
  var CLASS = 'ws-about-link';
  function wanted() {
    var h = location.hash || '#choices';
    return h === '#choices' || h.indexOf('#choice/') === 0 || h === '#history';
  }
  function style() {
    if (document.getElementById(CLASS + '-style')) return;
    var s = document.createElement('style');
    s.id = CLASS + '-style';
    s.textContent =
      '.' + CLASS + '{margin:var(--space-6,24px) 0 0;text-align:center}' +
      '.' + CLASS + ' a{display:inline-block;padding:var(--space-2,8px) var(--space-3,12px);color:var(--color-ink-3,#6b6b6b);' +
      'font-size:var(--text-caption,13px);font-weight:var(--weight-medium,500);text-decoration:underline;' +
      'text-decoration-thickness:1px;text-underline-offset:3px}';
    document.head.appendChild(s);
  }
  function sync(app) {
    var link = app.querySelector(':scope > .' + CLASS);
    if (wanted()) {
      if (link && link === app.lastElementChild) return;
      if (!link) {
        link = document.createElement('p');
        link.className = CLASS;
        var a = document.createElement('a');
        a.href = './about.html';
        a.textContent = '안내';
        link.appendChild(a);
      }
      app.appendChild(link);
    } else if (link) {
      link.remove();
    }
  }
  function start() {
    var app = document.getElementById('app');
    if (!app) return;
    style();
    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(app); });
    }
    new MutationObserver(schedule).observe(app, { childList: true });
    window.addEventListener('hashchange', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
