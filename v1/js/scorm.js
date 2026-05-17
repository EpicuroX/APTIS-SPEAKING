/* =============================================================================
 * scorm.js — Wrapper SCORM 1.2 con fallback a localStorage
 * -----------------------------------------------------------------------------
 * SCORM 1.2 inyecta window.API en algun frame ancestro. Lo buscamos hacia
 * arriba y, si no aparece, escribimos en localStorage para que la app siga
 * funcionando fuera de Moodle (desarrollo, GitHub Pages, etc.).
 *
 * Expone un unico objeto global: window.SCORM
 *   - init()            Inicia la sesion. Devuelve true si SCORM esta vivo.
 *   - getSuspendData()  Devuelve la cadena guardada (o "" si no hay).
 *   - setSuspendData(s) Guarda cadena. <4096 chars (SCORM 1.2).
 *   - setScore(n)       Guarda nota 0..100.
 *   - setStatus(s)      "incomplete" | "completed" | "passed" | "failed"
 *   - logInteraction(id, response, correct)
 *   - commit()          Fuerza guardado.
 *   - finish()          Cierra la sesion (al unload).
 *   - isLMS()           true si SCORM real, false si fallback.
 * ============================================================================= */

(function () {
  'use strict';

  var API = null;
  var connected = false;
  var interactionCount = 0;
  var LS_KEY = 'aptis_speaking_v1';

  /* --------- Localizar la API SCORM 1.2 en frames ancestros --------- */
  function findAPI(win) {
    var tries = 0;
    while (win && !win.API && win.parent && win.parent !== win && tries < 50) {
      tries++;
      win = win.parent;
    }
    return win && win.API ? win.API : null;
  }

  function locateAPI() {
    try {
      var api = findAPI(window);
      if (!api && window.opener) api = findAPI(window.opener);
      return api;
    } catch (e) {
      return null;
    }
  }

  /* --------- Fallback: localStorage --------- */
  function lsRead() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function lsWrite(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch (e) { /* cuota llena u Safari privado: ignorar */ }
  }

  /* --------- API publica --------- */
  var SCORM = {

    init: function () {
      API = locateAPI();
      if (API && typeof API.LMSInitialize === 'function') {
        var ok = API.LMSInitialize('') === 'true';
        connected = ok;
        if (ok) {
          // Si no hay estado previo, marcamos incomplete
          var st = API.LMSGetValue('cmi.core.lesson_status');
          if (st === 'not attempted' || st === '' || st === null) {
            API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
          }
          API.LMSCommit('');
        }
        return ok;
      }
      connected = false;
      return false;
    },

    isLMS: function () { return connected; },

    getSuspendData: function () {
      if (connected) {
        var v = API.LMSGetValue('cmi.suspend_data');
        return v || '';
      }
      var s = lsRead();
      return s.suspend_data || '';
    },

    setSuspendData: function (str) {
      if (typeof str !== 'string') str = String(str);
      // SCORM 1.2: maximo 4096 caracteres
      if (str.length > 4000) {
        console.warn('[SCORM] suspend_data truncado a 4000 chars');
        str = str.substring(0, 4000);
      }
      if (connected) {
        API.LMSSetValue('cmi.suspend_data', str);
      } else {
        var s = lsRead();
        s.suspend_data = str;
        lsWrite(s);
      }
    },

    setScore: function (n) {
      n = Math.max(0, Math.min(100, Math.round(n)));
      if (connected) {
        API.LMSSetValue('cmi.core.score.raw', String(n));
        API.LMSSetValue('cmi.core.score.min', '0');
        API.LMSSetValue('cmi.core.score.max', '100');
      } else {
        var s = lsRead();
        s.score = n;
        lsWrite(s);
      }
    },

    setStatus: function (status) {
      var valid = ['incomplete', 'completed', 'passed', 'failed', 'browsed'];
      if (valid.indexOf(status) < 0) return;
      if (connected) {
        API.LMSSetValue('cmi.core.lesson_status', status);
      } else {
        var s = lsRead();
        s.status = status;
        lsWrite(s);
      }
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
      // En fallback no registramos interacciones individuales (no aporta nada
      // utilil fuera de Moodle y consume espacio).
    },

    commit: function () {
      if (connected && typeof API.LMSCommit === 'function') {
        API.LMSCommit('');
      }
    },

    finish: function () {
      if (connected && typeof API.LMSFinish === 'function') {
        API.LMSCommit('');
        API.LMSFinish('');
        connected = false;
      }
    }
  };

  window.SCORM = SCORM;
})();
