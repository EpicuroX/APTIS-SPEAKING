/* SCORM 1.2 wrapper con fallback localStorage. Clave: aptis_speaking_v4_2. */
(function () {
  'use strict';
  var API = null, connected = false, interactionCount = 0;
  var LS_KEY = 'aptis_speaking_v4_2';

  function findAPI(win) {
    var tries = 0;
    while (win && !win.API && win.parent && win.parent !== win && tries < 50) { tries++; win = win.parent; }
    return win && win.API ? win.API : null;
  }
  function locateAPI() {
    try {
      var api = findAPI(window);
      if (!api && window.opener) api = findAPI(window.opener);
      return api;
    } catch (e) { return null; }
  }
  function lsRead() { try { var r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
  function lsWrite(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }

  window.SCORM = {
    init: function () {
      API = locateAPI();
      if (API && typeof API.LMSInitialize === 'function') {
        var ok = API.LMSInitialize('') === 'true';
        connected = ok;
        if (ok) {
          var st = API.LMSGetValue('cmi.core.lesson_status');
          if (st === 'not attempted' || st === '' || st === null) API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
          API.LMSCommit('');
        }
        return ok;
      }
      connected = false; return false;
    },
    isLMS: function () { return connected; },
    getSuspendData: function () {
      if (connected) return API.LMSGetValue('cmi.suspend_data') || '';
      return lsRead().suspend_data || '';
    },
    setSuspendData: function (str) {
      if (typeof str !== 'string') str = String(str);
      if (str.length > 4000) { console.warn('[SCORM] truncado a 4000'); str = str.substring(0, 4000); }
      if (connected) API.LMSSetValue('cmi.suspend_data', str);
      else { var s = lsRead(); s.suspend_data = str; lsWrite(s); }
    },
    setScore: function (n) {
      n = Math.max(0, Math.min(100, Math.round(n)));
      if (connected) {
        API.LMSSetValue('cmi.core.score.raw', String(n));
        API.LMSSetValue('cmi.core.score.min', '0');
        API.LMSSetValue('cmi.core.score.max', '100');
      } else { var s = lsRead(); s.score = n; lsWrite(s); }
    },
    setStatus: function (status) {
      var v = ['incomplete','completed','passed','failed','browsed'];
      if (v.indexOf(status) < 0) return;
      if (connected) API.LMSSetValue('cmi.core.lesson_status', status);
      else { var s = lsRead(); s.status = status; lsWrite(s); }
    },
    logInteraction: function (id, response, correct) {
      if (connected) {
        var i = interactionCount;
        API.LMSSetValue('cmi.interactions.' + i + '.id', String(id));
        API.LMSSetValue('cmi.interactions.' + i + '.type', 'fill-in');
        API.LMSSetValue('cmi.interactions.' + i + '.student_response', String(response).substring(0, 250));
        API.LMSSetValue('cmi.interactions.' + i + '.result', correct ? 'correct' : 'wrong');
        interactionCount++;
      }
    },
    commit: function () { if (connected && typeof API.LMSCommit === 'function') API.LMSCommit(''); },
    finish: function () {
      if (connected && typeof API.LMSFinish === 'function') {
        API.LMSCommit(''); API.LMSFinish(''); connected = false;
      }
    },
    // Helpers extra para historial (localStorage directo, sin pasar por suspend_data)
    lsRead: lsRead,
    lsWrite: lsWrite
  };
})();
