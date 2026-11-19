(function () {
  'use strict';

  var DB_NAME = 'investment-exam-progress';
  var DB_VERSION = 1;
  var STATE_KEY = 'record';
  var SCHEMA_VERSION = 1;

  var idb = null;
  try { idb = window.indexedDB; } catch (_) { idb = null; }
  if (!idb) return;

  function readBuild() {
    try {
      var meta = document.querySelector('meta[name="site-build"]');
      if (meta && meta.content) return meta.content;
    } catch (_) {}
    try {
      var src = document.currentScript && document.currentScript.src;
      var m = src && /[?&]v=([^&#]+)/.exec(src);
      if (m) return m[1];
    } catch (_) {}
    return 'dev';
  }
  var build = readBuild();

  var dbPromise = null;
  var logged = Object.create(null);
  var persistRequested = false;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = idb.open(DB_NAME, DB_VERSION); } catch (err) { reject(err); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('attempts')) {
          var attempts = db.createObjectStore('attempts', { keyPath: 'id' });
          attempts.createIndex('questionId', 'questionId', { unique: false });
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { try { db.close(); } catch (_) {} dbPromise = null; };
        db.onclose = function () { dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error('indexedDB open failed')); };
      req.onblocked = function () { reject(new Error('indexedDB open blocked')); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function attemptId(questionId, at) { return questionId + '|' + at; }

  function remember(record) {
    var answers = record && record.answers;
    if (!answers || typeof answers !== 'object') return;
    Object.keys(answers).forEach(function (qid) {
      var a = answers[qid];
      if (a && typeof a.at === 'string') logged[attemptId(qid, a.at)] = true;
    });
  }

  function runTx(stores, mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(stores, mode);
        var out;
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error || new Error('indexedDB transaction failed')); };
        tx.onabort = function () { reject(tx.error || new Error('indexedDB transaction aborted')); };
        out = work(tx);
      });
    });
  }

  function requestPersistence() {
    if (persistRequested) return;
    persistRequested = true;
    try {
      var storage = navigator.storage;
      if (storage && typeof storage.persist === 'function') {
        var p = storage.persist();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    } catch (_) {}
  }


  var BACKUP_FORMAT = 'investment-exam-progress';
  var BACKUP_VERSION = 1;
  var MAX_ID_LENGTH = 200;
  var MAX_SELECTED_LENGTH = 8;
  var MAX_AT_LENGTH = 40;
  var MAX_BUILD_LENGTH = 40;

  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

  function invalidFormat(message) {
    var err = new Error(message || 'not a study-record backup');
    err.code = 'invalid-format';
    return err;
  }

  function newerVersion() {
    var err = new Error('backup written by a newer format version');
    err.code = 'newer-version';
    return err;
  }

  function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH &&
      value.indexOf('|') === -1 && value !== '__proto__' && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function validAt(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_AT_LENGTH) return false;
    var time = Date.parse(value);
    if (!isFinite(time)) return false;
    try { return new Date(time).toISOString() === value; } catch (_) { return false; }
  }

  function cleanBuild(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_BUILD_LENGTH &&
      !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
  }

  function cleanAnswer(raw) {
    if (!isObject(raw)) return null;
    var selected = raw.selected, correct = raw.correct, at = raw.at;
    var selectedOk = typeof selected === 'boolean' ||
      (typeof selected === 'string' && selected.length > 0 && selected.length <= MAX_SELECTED_LENGTH);
    if (!selectedOk || typeof correct !== 'boolean' || !validAt(at)) return null;
    return { selected: selected, correct: correct, at: at };
  }

  function timeOf(answer) {
    if (!isObject(answer) || typeof answer.at !== 'string') return NaN;
    return Date.parse(answer.at);
  }

  function parseBackup(payload) {
    if (!isObject(payload) || payload.format !== BACKUP_FORMAT) throw invalidFormat();
    var version = payload.formatVersion;
    if (typeof version !== 'number' || !isFinite(version) || Math.floor(version) !== version || version < 1) {
      throw invalidFormat('unsupported backup format version');
    }
    if (version > BACKUP_VERSION) throw newerVersion();
    if (!isObject(payload.record)) throw invalidFormat();

    var fileBuild = cleanBuild(payload.build) || 'import';
    var answers = Object.create(null);
    var read = Object.create(null);
    var attempts = Object.create(null);
    var answersInFile = 0;

    var rawAnswers = payload.record.answers;
    if (isObject(rawAnswers)) {
      Object.keys(rawAnswers).forEach(function (qid) {
        if (!validId(qid)) return;
        var answer = cleanAnswer(rawAnswers[qid]);
        if (!answer) return;
        answers[qid] = answer;
        answersInFile++;
      });
    }

    var rawRead = payload.record.read;
    if (isObject(rawRead)) {
      Object.keys(rawRead).forEach(function (key) {
        if (validId(key) && rawRead[key]) read[key] = true;
      });
    }

    if (Array.isArray(payload.attempts)) {
      payload.attempts.forEach(function (item) {
        if (!isObject(item) || !validId(item.questionId)) return;
        var answer = cleanAnswer(item);
        if (!answer) return;
        var id = attemptId(item.questionId, answer.at);
        if (attempts[id]) return;
        attempts[id] = {
          id: id, questionId: item.questionId, selected: answer.selected,
          correct: answer.correct, at: answer.at, build: cleanBuild(item.build) || fileBuild
        };
      });
    }
    Object.keys(answers).forEach(function (qid) {
      var answer = answers[qid];
      var id = attemptId(qid, answer.at);
      if (attempts[id]) return;
      attempts[id] = {
        id: id, questionId: qid, selected: answer.selected,
        correct: answer.correct, at: answer.at, build: fileBuild
      };
    });
    return {
      answers: answers, read: read, attempts: attempts,
      answersInFile: answersInFile, attemptsInFile: Object.keys(attempts).length
    };
  }

  function mergeBackup(existingRecord, existingIds, parsed) {
    var base = isObject(existingRecord) ? existingRecord : {};
    var record = {};
    Object.keys(base).forEach(function (key) {
      if (key !== 'answers' && key !== 'read' && key !== '__proto__') record[key] = base[key];
    });
    var answers = {};
    var read = {};
    var oldAnswers = isObject(base.answers) ? base.answers : {};
    var oldRead = isObject(base.read) ? base.read : {};
    Object.keys(oldAnswers).forEach(function (qid) { if (qid !== '__proto__') answers[qid] = oldAnswers[qid]; });
    Object.keys(oldRead).forEach(function (key) { if (key !== '__proto__') read[key] = oldRead[key]; });

    var changed = false;
    Object.keys(parsed.answers).forEach(function (qid) {
      var incoming = parsed.answers[qid];
      var current = hasOwn(answers, qid) ? answers[qid] : undefined;
      var currentTime = timeOf(current);
      if (current === undefined || !isFinite(currentTime) || Date.parse(incoming.at) > currentTime) {
        answers[qid] = { selected: incoming.selected, correct: incoming.correct, at: incoming.at };
        changed = true;
      }
    });
    Object.keys(parsed.read).forEach(function (key) {
      if (!read[key]) { read[key] = true; changed = true; }
    });

    var known = Object.create(null);
    (existingIds || []).forEach(function (id) { known[id] = true; });
    var newAttempts = [];
    Object.keys(parsed.attempts).forEach(function (id) {
      if (!known[id]) newAttempts.push(parsed.attempts[id]);
    });

    record.answers = answers;
    record.read = read;
    return {
      record: record,
      newAttempts: newAttempts,
      changed: changed || newAttempts.length > 0,
      answersInFile: parsed.answersInFile,
      answersTotal: Object.keys(answers).length,
      attemptsAdded: newAttempts.length
    };
  }


  function mergeSave(stored, snapshot, knownAt, clearedAt) {
    var base = isObject(stored) ? stored : {};
    var snap = isObject(snapshot) ? snapshot : {};
    var known = isObject(knownAt) ? knownAt : {};
    var cleared = isObject(clearedAt) ? clearedAt : {};
    var storedAnswers = isObject(base.answers) ? base.answers : {};
    var snapAnswers = isObject(snap.answers) ? snap.answers : {};
    var answers = {};
    var read = {};

    var record = {};
    Object.keys(base).forEach(function (key) {
      if (key !== 'answers' && key !== 'read' && key !== '__proto__') record[key] = base[key];
    });
    Object.keys(snap).forEach(function (key) {
      if (key !== 'answers' && key !== 'read' && key !== '__proto__') record[key] = snap[key];
    });

    Object.keys(storedAnswers).forEach(function (qid) {
      if (qid !== '__proto__') answers[qid] = storedAnswers[qid];
    });
    Object.keys(snapAnswers).forEach(function (qid) {
      if (qid === '__proto__') return;
      var mine = snapAnswers[qid];
      if (!isObject(mine)) return;
      if (hasOwn(cleared, qid) && cleared[qid] === mine.at) return;
      var theirs = hasOwn(answers, qid) ? answers[qid] : undefined;
      if (theirs === undefined) { answers[qid] = mine; return; }
      var theirTime = timeOf(theirs);
      var myTime = timeOf(mine);
      if (!isFinite(theirTime) || (isFinite(myTime) && myTime >= theirTime)) answers[qid] = mine;
    });
    Object.keys(known).forEach(function (qid) {
      if (qid === '__proto__' || hasOwn(snapAnswers, qid) || !hasOwn(answers, qid)) return;
      var current = answers[qid];
      if (isObject(current) && current.at === known[qid]) delete answers[qid];
    });

    var storedRead = isObject(base.read) ? base.read : {};
    var snapRead = isObject(snap.read) ? snap.read : {};
    Object.keys(storedRead).forEach(function (key) { if (key !== '__proto__') read[key] = storedRead[key]; });
    Object.keys(snapRead).forEach(function (key) { if (key !== '__proto__' && snapRead[key]) read[key] = snapRead[key]; });

    record.answers = answers;
    record.read = read;
    return { record: record };
  }

  function knownFrom(record) {
    var out = {};
    var answers = isObject(record) && isObject(record.answers) ? record.answers : {};
    Object.keys(answers).forEach(function (qid) {
      var a = answers[qid];
      if (qid !== '__proto__' && isObject(a) && typeof a.at === 'string') out[qid] = a.at;
    });
    return out;
  }


  var CHANNEL_NAME = 'investment-exam-progress';
  var tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  var channel = null;
  var clearedAt = Object.create(null);

  function fire(name) {
    try {
      if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent(name));
      }
    } catch (_) {}
  }

  function openChannel() {
    try {
      if (typeof window.BroadcastChannel !== 'function') return;
      channel = new window.BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = function (event) {
        var data = event && event.data;
        if (data && data.type === 'changed' && data.from !== tabId) {
          if (data.cleared) clearedAt = Object.assign(Object.create(null), clearedAt, known);
          fire('textbook-progress-remote');
        }
      };
    } catch (_) { channel = null; }
  }

  function announce(cleared) {
    try { if (channel) channel.postMessage({ type: 'changed', from: tabId, cleared: !!cleared }); } catch (_) {}
  }

  function setAvailable(value) {
    if (adapter.available === value) return;
    adapter.available = value;
    fire('textbook-storage-status');
  }


  var lastWrite = Promise.resolve();
  function track(promise) {
    lastWrite = promise.then(function () {}, function () {});
    return promise;
  }

  var known = Object.create(null);
  var loadDelays = [150, 400];

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function loadOnce() {
    return runTx(['state'], 'readonly', function (tx) {
      return tx.objectStore('state').get(STATE_KEY);
    }).then(function (request) {
      var row = request && request.result;
      return row && row.record && typeof row.record === 'object' ? row.record : null;
    });
  }

  var adapter = {
    persistent: true,
    available: true,

    load: function () {
      var attempt = 0;
      function go() {
        return loadOnce().catch(function (err) {
          if (attempt >= loadDelays.length) throw err;
          return delay(loadDelays[attempt++]).then(go);
        });
      }
      return go().then(function (record) {
        known = knownFrom(record);
        if (record) remember(record);
        setAvailable(true);
        return record;
      }, function () {
        setAvailable(false);
        return null;
      });
    },

    save: function (snapshot) {
      var record = isObject(snapshot) ? snapshot : { answers: {}, read: {} };
      var fresh = [];
      var answers = isObject(record.answers) ? record.answers : {};
      Object.keys(answers).forEach(function (qid) {
        var a = answers[qid];
        if (!a || typeof a.at !== 'string') return;
        var id = attemptId(qid, a.at);
        if (logged[id]) return;
        fresh.push({
          id: id,
          questionId: qid,
          selected: a.selected,
          correct: a.correct,
          at: a.at,
          build: build
        });
      });
      var done = false;
      var failure = null;
      return track(runTx(['state', 'attempts'], 'readwrite', function (tx) {
        var stateStore = tx.objectStore('state');
        var attempts = tx.objectStore('attempts');
        var request = stateStore.get(STATE_KEY);
        request.onsuccess = function () {
          try {
            var row = request.result;
            var merged = mergeSave(row && row.record, record, known, clearedAt);
            stateStore.put({
              schemaVersion: SCHEMA_VERSION,
              record: merged.record,
              savedAt: new Date().toISOString(),
              build: build
            }, STATE_KEY);
            fresh.forEach(function (entry) { attempts.put(entry); });
            done = true;
          } catch (err) {
            failure = err;
            try { tx.abort(); } catch (_) {}
          }
        };
      }).then(function () {
        if (!done) throw new Error('save was not applied');
        fresh.forEach(function (entry) { logged[entry.id] = true; });
        known = knownFrom(record);
        setAvailable(true);
        requestPersistence();
        announce();
      }).then(undefined, function (err) {
        setAvailable(false);
        throw failure || err;
      }));
    },

    clear: function () {
      return track(runTx(['state', 'attempts'], 'readwrite', function (tx) {
        tx.objectStore('state').clear();
        tx.objectStore('attempts').clear();
      }).then(function () {
        logged = Object.create(null);
        known = Object.create(null);
        clearedAt = Object.create(null);
        setAvailable(true);
        announce(true);
      }, function (err) {
        setAvailable(false);
        throw err;
      }));
    },

    exportData: function () {
      return lastWrite.then(function () {
        return runTx(['state', 'attempts'], 'readonly', function (tx) {
          return {
            row: tx.objectStore('state').get(STATE_KEY),
            attempts: tx.objectStore('attempts').getAll()
          };
        });
      }).then(function (requests) {
        var row = requests.row.result;
        var record = row && isObject(row.record) ? row.record : {};
        var attempts = (requests.attempts.result || []).slice().sort(function (a, b) {
          if (a.at !== b.at) return a.at < b.at ? -1 : 1;
          return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
        });
        return {
          format: BACKUP_FORMAT,
          formatVersion: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          build: build,
          record: {
            answers: isObject(record.answers) ? record.answers : {},
            read: isObject(record.read) ? record.read : {}
          },
          attempts: attempts
        };
      });
    },

    previewImport: function (payload) {
      var parsed = parseBackup(payload);
      return { answersInFile: parsed.answersInFile, attemptsInFile: parsed.attemptsInFile };
    },

    importData: function (payload) {
      var parsed;
      try { parsed = parseBackup(payload); } catch (err) { return Promise.reject(err); }
      var outcome = null;
      return track(lastWrite.then(function () {
        return runTx(['state', 'attempts'], 'readwrite', function (tx) {
          var stateStore = tx.objectStore('state');
          var attemptStore = tx.objectStore('attempts');
          var rowRequest = stateStore.get(STATE_KEY);
          var keysRequest = attemptStore.getAllKeys();
          var waiting = 2;
          function whenBothRead() {
            if (--waiting > 0) return;
            try {
              var row = rowRequest.result;
              var merged = mergeBackup(row && row.record, keysRequest.result, parsed);
              if (merged.changed) {
                stateStore.put({
                  schemaVersion: SCHEMA_VERSION,
                  record: merged.record,
                  savedAt: new Date().toISOString(),
                  build: build
                }, STATE_KEY);
                merged.newAttempts.forEach(function (entry) { attemptStore.put(entry); });
              }
              outcome = merged;
            } catch (err) {
              try { tx.abort(); } catch (_) {}
            }
          }
          rowRequest.onsuccess = whenBothRead;
          keysRequest.onsuccess = whenBothRead;
        });
      }).then(function () {
        if (!outcome) throw new Error('import was not applied');
        outcome.newAttempts.forEach(function (entry) { logged[entry.id] = true; });
        remember(outcome.record);
        requestPersistence();
        announce();
        return {
          answersInFile: outcome.answersInFile,
          answersTotal: outcome.answersTotal,
          attemptsAdded: outcome.attemptsAdded
        };
      }));
    }
  };

  Object.defineProperty(adapter, '_backup', {
    value: { parse: parseBackup, merge: mergeBackup, validId: validId, validAt: validAt, cleanAnswer: cleanAnswer },
    enumerable: false
  });
  Object.defineProperty(adapter, '_sync', {
    value: {
      mergeSave: mergeSave,
      knownFrom: knownFrom,
      setLoadDelays: function (list) { loadDelays = list.slice(); }
    },
    enumerable: false
  });

  openChannel();

  window.TextbookProgressAdapter = adapter;
})();
