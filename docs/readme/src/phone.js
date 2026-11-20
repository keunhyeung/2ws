/* Builds a phone from a shot name. phone('quiz', 'light', 0.54, true) */
function phone(name, theme, k, shadow) {
  var intro = name === 'welcome';
  var dark = theme === 'dark' || intro;
  var wrap = document.createElement('div');
  wrap.className = 'phone-wrap' + (shadow ? ' shadow' : '');
  wrap.style.setProperty('--k', k);
  wrap.innerHTML =
    '<div class="phone"><div class="screen ' + (intro ? 'is-intro' : dark ? 'is-dark' : '') + '">' +
    '<img class="shot" alt="" src="shots/' + name + '-' + (intro ? 'dark' : theme) + '.png">' +
    '<div class="status"><span>9:41</span><span class="right"><span class="signal"><i></i><i></i><i></i><i></i></span><span class="battery"></span></span></div>' +
    '<div class="island"></div></div></div>';
  return wrap;
}
function themeFromQuery() {
  var q = new URLSearchParams(location.search);
  var theme = q.get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  return { theme: theme, q: q };
}
function whenReady() {
  var imgs = Array.prototype.slice.call(document.images);
  return Promise.all(imgs.map(function (i) { return i.decode ? i.decode().catch(function () {}) : Promise.resolve(); }))
    .then(function () { return document.fonts.ready; })
    .then(function () { document.documentElement.setAttribute('data-ready', '1'); });
}
