(function () {
  'use strict';

  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var SHARE_TITLE = '2WS 풀이 기록';
  var INPUT_ATTR = 'data-backup-input';

  var MSG = {
    nothingToExport: '내보낼 풀이 기록이 아직 없습니다.',
    exportFailed: '기록을 내보내지 못했습니다. 다시 시도해 주세요.',
    notABackup: '풀이 기록 백업 파일이 아니어서 가져오지 못했습니다.',
    newerBackup: '더 새로운 버전에서 만든 백업 파일이에요. 페이지를 새로고침한 뒤 다시 가져와 주세요.',
    exported: '풀이 기록 파일을 저장했어요',
    nothingInFile: '백업 파일에 가져올 풀이 기록이 없습니다.',
    imported: '풀이 기록을 가져왔습니다.',
    importFailed: '기록을 가져오지 못했습니다. 다시 시도해 주세요.'
  };

  var BUTTONS =
    '<button class="text-btn" id="exportHistory" type="button">기록 내보내기</button>' +
    '<button class="text-btn" id="importHistory" type="button">기록 가져오기</button>';

  function adapter() {
    try { return window.TextbookProgressAdapter || null; } catch (_) { return null; }
  }

  function capable() {
    var a = adapter();
    return !!(a && a.persistent && typeof a.exportData === 'function' &&
      typeof a.importData === 'function' && typeof a.previewImport === 'function');
  }

  function usable() {
    return capable() && adapter().available !== false;
  }

  window.TextbookProgressBackup = {
    buttonsHtml: function () { return usable() ? BUTTONS : ''; }
  };



  var exporting = false;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fileName(now) {
    return '2WS-풀이기록-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
      '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
  }

  function download(file) {
    var url = URL.createObjectURL(file);
    var link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 10000);
    try {
      if (window.TextbookHost && typeof window.TextbookHost.toast === 'function') {
        window.TextbookHost.toast(MSG.exported);
      }
    } catch (_) {}
  }

  function wantsShare(file) {
    try {
      return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
    } catch (_) { return false; }
  }

  function deliver(file) {
    if (!wantsShare(file)) { download(file); return Promise.resolve(); }
    return navigator.share({ files: [file], title: SHARE_TITLE }).then(function () {}, function (err) {
      if (err && err.name === 'AbortError') return;
      download(file);
    });
  }

  function doExport() {
    if (exporting) return;
    exporting = true;
    var a = adapter();
    Promise.resolve().then(function () { return a.exportData(); }).then(function (data) {
      var answers = data && data.record && data.record.answers ? Object.keys(data.record.answers).length : 0;
      var attempts = data && Array.isArray(data.attempts) ? data.attempts.length : 0;
      if (answers === 0 && attempts === 0) { window.alert(MSG.nothingToExport); return; }
      var file = new File([JSON.stringify(data, null, 2)], fileName(new Date()), { type: 'application/json' });
      return deliver(file);
    }).catch(function () {
      window.alert(MSG.exportFailed);
    }).then(function () { exporting = false; });
  }


  var importing = false;

  function removeStrayInputs() {
    var stray = document.querySelectorAll('input[' + INPUT_ATTR + ']');
    for (var i = 0; i < stray.length; i++) {
      if (stray[i].parentNode) stray[i].parentNode.removeChild(stray[i]);
    }
  }

  function readText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsText(file);
    });
  }

  function notABackup() { window.alert(MSG.notABackup); }

  function rejection(err) {
    if (err && err.code === 'newer-version') return MSG.newerBackup;
    if (err && err.code === 'invalid-format') return MSG.notABackup;
    return null;
  }

  function handleFile(file) {
    if (importing) return;
    importing = true;
    var a = adapter();
    var work;
    if (file.size > MAX_FILE_BYTES) {
      notABackup();
      work = Promise.resolve();
    } else {
      work = readText(file).then(function (text) {
        var payload;
        try { payload = JSON.parse(text); } catch (_) { notABackup(); return; }
        var info;
        try { info = a.previewImport(payload); } catch (err) {
          var known = rejection(err);
          if (known) { window.alert(known); return; }
          throw err;
        }
        if (!info.answersInFile && !info.attemptsInFile) { window.alert(MSG.nothingInFile); return; }
        var question = '백업 파일의 풀이 기록 ' + info.answersInFile + '문항을 지금 기록과 합칠까요? ' +
          '같은 문제는 더 최근에 푼 답이 남습니다.';
        if (!window.confirm(question)) return;
        return a.importData(payload).then(function () {
          window.alert(MSG.imported);
          location.reload();
        });
      }).catch(function (err) {
        window.alert(rejection(err) || MSG.importFailed);
      });
    }
    work.then(function () { importing = false; });
  }

  function startImport() {
    removeStrayInputs();
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.setAttribute(INPUT_ATTR, '');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
    input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
    function dispose() { if (input.parentNode) input.parentNode.removeChild(input); }
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      dispose();
      if (file) handleFile(file);
    });
    input.addEventListener('cancel', dispose);
    document.body.appendChild(input);
    input.click();
  }


  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var button = target.closest('#exportHistory, #importHistory');
    if (!button || !capable()) return;
    event.preventDefault();
    try {
      if (button.id === 'exportHistory') doExport(); else startImport();
    } catch (_) {
      window.alert(button.id === 'exportHistory' ? MSG.exportFailed : MSG.importFailed);
    }
  });
})();
