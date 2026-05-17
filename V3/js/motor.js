/* =============================================================================
 * motor.js · Motor universal del simulador Aptis Speaking
 * -----------------------------------------------------------------------------
 * Carga los 4 JSON de partes desde js/contenidos/parte-N.json
 * Para cada parte ofrece 4 modos: estructura, aplicado, tarjetas, examen
 * Más: progreso global
 * ============================================================================= */
(function () {
  'use strict';

  var PARTES = [];              // [{id, label, subtitle, ...}, ...]
  var STATE = null;
  var currentSection = null;    // id de parte o 'progreso'
  var currentMode = 'estructura';

  // Estado del modo Aplicado por parte
  var aplicadoTemaA = {};       // { 'parte-1': temaId, ... }
  var aplicadoTemaB = {};

  // Estado del modo Tarjetas por parte
  var tarjetasIndex = {};       // { 'parte-1': 0, ... }
  var tarjetasFlipped = false;

  /* ============== ARRANQUE ============== */
  document.addEventListener('DOMContentLoaded', function () {
    SCORM.init();
    loadState();
    cargarPartes()
      .then(function () { buildNav(); routeInicial(); })
      .catch(function (e) {
        document.getElementById('app-main').innerHTML =
          '<p class="error">Error cargando contenidos: ' + e.message + '</p>';
      });

    window.addEventListener('beforeunload', function () {
      saveState();
      SCORM.finish();
    });

    // Mode tabs listeners (delegados al cargar)
    document.querySelectorAll('.mode-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        currentMode = t.dataset.mode;
        renderCurrent();
      });
    });
  });

  function cargarPartes() {
    var ids = ['parte-1', 'parte-2', 'parte-3', 'parte-4'];
    var promesas = ids.map(function (id) {
      return fetch('js/contenidos/' + id + '.json').then(function (r) { return r.json(); });
    });
    return Promise.all(promesas).then(function (datos) {
      PARTES = datos;
      // inicializar selección de temas por parte
      PARTES.forEach(function (p) {
        if (p.temas.length > 0) {
          aplicadoTemaA[p.id] = p.temas[0].id;
          aplicadoTemaB[p.id] = p.temas[1] ? p.temas[1].id : p.temas[0].id;
          tarjetasIndex[p.id] = 0;
        }
      });
    });
  }

  /* ============== ESTADO ============== */
  function loadState() {
    var raw = SCORM.getSuspendData();
    if (!raw) { STATE = { v: 3, p: {} }; return; }
    try { STATE = JSON.parse(raw); if (!STATE.p) STATE.p = {}; }
    catch (e) { STATE = { v: 3, p: {} }; }
  }

  function saveState() {
    SCORM.setSuspendData(JSON.stringify(STATE));
    SCORM.commit();
  }

  function bump(parteId, modo) {
    if (!STATE.p[parteId]) STATE.p[parteId] = {};
    STATE.p[parteId][modo] = (STATE.p[parteId][modo] || 0) + 1;
    saveState();
  }

  /* ============== NAVEGACIÓN ============== */
  function buildNav() {
    var nav = document.getElementById('part-nav');
    var h = '';
    PARTES.forEach(function (p) {
      h += '<button class="part-btn" data-section="' + p.id + '">'
         + '<span class="part-btn-label">' + esc(p.label) + '</span>'
         + '<span class="part-btn-sub">' + esc(p.subtitle.split('·')[0].trim()) + '</span>'
         + '</button>';
    });
    h += '<button class="part-btn part-btn-aux" data-section="progreso">'
       + '<span class="part-btn-label">📊 Progreso</span>'
       + '<span class="part-btn-sub">Historial</span>'
       + '</button>';
    nav.innerHTML = h;
    nav.querySelectorAll('.part-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        currentSection = b.dataset.section;
        currentMode = 'estructura';
        renderCurrent();
      });
    });
  }

  function routeInicial() {
    currentSection = PARTES[0].id;
    currentMode = 'estructura';
    renderCurrent();
  }

  function renderCurrent() {
    document.querySelectorAll('.part-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === currentSection);
    });
    document.querySelectorAll('.mode-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.mode === currentMode);
    });

    var main = document.getElementById('app-main');
    var footer = document.getElementById('mode-footer');

    if (currentSection === 'progreso') {
      footer.hidden = true;
      main.innerHTML = renderProgreso();
      attachProgresoListeners();
      window.scrollTo({ top: 0 });
      return;
    }

    var parte = PARTES.find(function (p) { return p.id === currentSection; });
    if (!parte) { main.innerHTML = '<p class="error">Parte no encontrada</p>'; return; }
    footer.hidden = false;

    if (currentMode === 'estructura') {
      main.innerHTML = renderEstructura(parte);
      attachEstructuraListeners(parte);
      bump(parte.id, 'estructura');
    } else if (currentMode === 'aplicado') {
      main.innerHTML = renderAplicado(parte);
      attachAplicadoListeners(parte);
      bump(parte.id, 'aplicado');
    } else if (currentMode === 'tarjetas') {
      main.innerHTML = renderTarjetas(parte);
      attachTarjetasListeners(parte);
      bump(parte.id, 'tarjetas');
    } else if (currentMode === 'examen') {
      main.innerHTML = '<div id="examen-container"></div>';
      Examen.iniciar(parte, 'examen-container', function () {});
      bump(parte.id, 'examen');
    }

    window.scrollTo({ top: 0 });
  }

  /* ============== MODO 1: ESTRUCTURA ============== */
  function renderEstructura(parte) {
    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">' + esc(parte.label) + ' · ' + esc(parte.subtitle) + '</h2>';
    h += '<div class="part-meta">';
    h += '<span class="meta-chip">⏱ ' + esc(parte.meta.tiempo_total) + '</span>';
    h += '<span class="meta-chip">📋 ' + esc(parte.meta.formato) + '</span>';
    h += '<span class="meta-chip">🎯 ' + esc(parte.meta.nivel) + '</span>';
    h += '</div>';
    h += '<p class="part-objective"><strong>Objetivo:</strong> ' + esc(parte.objetivo) + '</p>';
    h += '</header>';
    h += '<p class="mode-hint">Toca cada <span class="hint-gap">[hueco]</span> para ver opciones de vocabulario.</p>';

    parte.pasos.forEach(function (paso) {
      h += renderPasoEstructura(paso, parte.id);
    });

    // Kits universales (siempre visibles abajo, plegables)
    if (parte.kits_universales && parte.kits_universales.length > 0) {
      h += '<details class="kits-block">';
      h += '<summary>🎒 Kits universales · listas mágicas para improvisar</summary>';
      parte.kits_universales.forEach(function (k) {
        h += '<div class="kit-row"><p class="kit-label">' + esc(k.label) + '</p><ul class="kit-list">';
        k.items.forEach(function (it) {
          h += '<li class="kit-item" data-text="' + escAttr(it) + '">' + esc(it) + '</li>';
        });
        h += '</ul></div>';
      });
      h += '</details>';
    }

    h += '</section>';
    return h;
  }

  function renderPasoEstructura(paso, parteId) {
    var h = '<article class="step-card">';
    h += '<header class="step-head">';
    h += '<span class="step-num">' + paso.n + '</span>';
    h += '<div class="step-titles">';
    h += '<h3 class="step-title">' + esc(paso.title) + '</h3>';
    h += '<p class="step-time">⏱ ' + esc(paso.time) + ' · ' + esc(paso.grammar) + '</p>';
    h += '</div>';
    h += '</header>';
    h += '<button class="btn-listen" type="button" data-text="' + escAttr(paso.template) + '">🔊 Escuchar</button>';
    h += '<p class="step-template">' + renderTemplateWithGaps(paso.template, paso.huecos, parteId + '-' + paso.n) + '</p>';
    h += '<div class="gap-panels" id="gap-panels-' + parteId + '-' + paso.n + '"></div>';
    if (paso.trick) h += '<div class="step-tip step-trick"><strong>💡 Truco:</strong> ' + esc(paso.trick) + '</div>';
    if (paso.warning) h += '<div class="step-tip step-warning"><strong>⚠️ Cuidado:</strong> ' + esc(paso.warning) + '</div>';
    h += '</article>';
    return h;
  }

  function renderTemplateWithGaps(template, huecos, stepKey) {
    var out = esc(template);
    huecos.forEach(function (hu, i) {
      var escMarker = hu.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var btn = '<button class="gap-btn" data-step="' + stepKey + '" data-gap-idx="' + i + '" type="button">' + esc(hu.marker) + '</button>';
      out = out.replace(new RegExp(escMarker), btn);
    });
    return out;
  }

  function attachEstructuraListeners(parte) {
    document.querySelectorAll('.btn-listen').forEach(function (b) {
      b.addEventListener('click', function () { speak(b.dataset.text); });
    });
    document.querySelectorAll('.kit-item').forEach(function (li) {
      li.addEventListener('click', function () {
        var t = li.dataset.text.replace(/\s*·.*$/, '').replace(/\s*\(.*?\)/, '');
        speak(t);
      });
    });
    document.querySelectorAll('.gap-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stepKey = btn.dataset.step;
        var idx = parseInt(btn.dataset.gapIdx, 10);
        var pasoN = parseInt(stepKey.split('-').pop(), 10);
        var paso = parte.pasos.find(function (x) { return x.n === pasoN; });
        if (!paso) return;
        toggleGapPanel(paso, idx, stepKey);
      });
    });
  }

  function toggleGapPanel(paso, idx, stepKey) {
    var container = document.getElementById('gap-panels-' + stepKey);
    var hueco = paso.huecos[idx];
    var panelId = 'panel-' + stepKey + '-' + idx;
    var existing = document.getElementById(panelId);
    if (existing) { existing.remove(); return; }
    var h = '<div class="gap-panel" id="' + panelId + '">';
    h += '<button class="gap-panel-close" aria-label="Cerrar">✕</button>';
    h += '<p class="gap-panel-marker">' + esc(hueco.marker) + '</p>';
    h += '<p class="gap-panel-type">' + esc(hueco.tipo) + '</p>';
    h += '<ul class="gap-panel-options">';
    hueco.opciones.forEach(function (op) {
      h += '<li class="gap-option" data-text="' + escAttr(op) + '">' + esc(op) + '</li>';
    });
    h += '</ul>';
    h += '<p class="gap-panel-hint">Toca una opción para escucharla.</p>';
    h += '</div>';
    container.insertAdjacentHTML('beforeend', h);
    var panel = document.getElementById(panelId);
    panel.querySelector('.gap-panel-close').addEventListener('click', function () { panel.remove(); });
    panel.querySelectorAll('.gap-option').forEach(function (li) {
      li.addEventListener('click', function () { speak(li.dataset.text); });
    });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ============== MODO 2: APLICADO ============== */
  function renderAplicado(parte) {
    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">' + esc(parte.label) + ' · Ver aplicado</h2>';
    h += '<p class="mode-hint">La misma estructura aplicada a 2 temas a la vez. Mira qué cambia y qué se mantiene.</p>';
    h += '</header>';

    h += '<div class="aplicado-controls">';
    h += '<div class="aplicado-col"><label class="aplicado-label">Tema A</label>' + renderTemaSelect(parte, 'aplicado-tema-a-' + parte.id, aplicadoTemaA[parte.id]) + '</div>';
    h += '<div class="aplicado-col"><label class="aplicado-label">Tema B</label>' + renderTemaSelect(parte, 'aplicado-tema-b-' + parte.id, aplicadoTemaB[parte.id]) + '</div>';
    h += '</div>';

    h += '<div class="aplicado-grid">';
    h += renderAplicadoCard(parte, aplicadoTemaA[parte.id], 'A');
    h += renderAplicadoCard(parte, aplicadoTemaB[parte.id], 'B');
    h += '</div>';

    h += '</section>';
    return h;
  }

  function renderTemaSelect(parte, selectId, current) {
    var h = '<select class="tema-select" id="' + selectId + '">';
    parte.temas.forEach(function (t) {
      var sel = t.id === current ? ' selected' : '';
      h += '<option value="' + t.id + '"' + sel + '>' + esc(t.label) + '</option>';
    });
    h += '</select>';
    return h;
  }

  function renderAplicadoCard(parte, temaId, etiqueta) {
    var tema = parte.temas.find(function (t) { return t.id === temaId; });
    if (!tema) return '<div class="aplicado-card"><p>No hay tema.</p></div>';
    var h = '<div class="aplicado-card" style="--tema-color:' + (tema.color || '#1e293b') + '">';
    h += '<div class="aplicado-card-head">';
    h += '<span class="aplicado-etiqueta">' + esc(etiqueta) + '</span>';
    h += '<span class="aplicado-tema">' + esc(tema.label) + '</span>';
    h += '</div>';
    if (tema.preguntas && tema.preguntas.length > 0) {
      h += '<div class="aplicado-preguntas">';
      h += '<p class="aplicado-preg-label">Preguntas:</p>';
      tema.preguntas.forEach(function (q, i) {
        h += '<p class="aplicado-preg">' + (i + 1) + '. ' + esc(q) + '</p>';
      });
      h += '</div>';
    }
    if (tema.descripcion_foto) {
      h += '<p class="aplicado-foto-desc">📷 ' + esc(tema.descripcion_foto) + '</p>';
    }
    if (tema.descripcion_fotos) {
      h += '<p class="aplicado-foto-desc">📷📷 ' + esc(tema.descripcion_fotos) + '</p>';
    }
    h += '<p class="aplicado-respuesta">' + esc(tema.respuesta_modelo) + '</p>';
    h += '<button class="btn-listen btn-listen-small" type="button" data-text="' + escAttr(tema.respuesta_modelo) + '">🔊 Escuchar</button>';
    h += '</div>';
    return h;
  }

  function attachAplicadoListeners(parte) {
    var sA = document.getElementById('aplicado-tema-a-' + parte.id);
    var sB = document.getElementById('aplicado-tema-b-' + parte.id);
    if (sA) sA.addEventListener('change', function () { aplicadoTemaA[parte.id] = sA.value; renderCurrent(); });
    if (sB) sB.addEventListener('change', function () { aplicadoTemaB[parte.id] = sB.value; renderCurrent(); });
    document.querySelectorAll('.btn-listen').forEach(function (b) {
      b.addEventListener('click', function () { speak(b.dataset.text); });
    });
  }

  /* ============== MODO 3: TARJETAS ============== */
  function renderTarjetas(parte) {
    var idx = tarjetasIndex[parte.id] || 0;
    // Construir lista de tarjetas: pasos + kits
    var tarjetas = [];
    parte.pasos.forEach(function (p) {
      tarjetas.push({
        tipo: 'paso',
        anverso: 'Paso ' + p.n + ' · ' + p.title,
        anverso_sub: p.time + ' · ' + p.grammar,
        reverso: p.template,
        truco: p.trick
      });
    });
    if (parte.kits_universales) {
      parte.kits_universales.forEach(function (k) {
        tarjetas.push({
          tipo: 'kit',
          anverso: 'Kit · ' + k.label,
          anverso_sub: 'Lista mágica para improvisar',
          reverso: k.items.join(' · '),
          truco: 'Memoriza esta lista. Funciona para casi cualquier tema.'
        });
      });
    }

    if (idx >= tarjetas.length) idx = 0;
    var card = tarjetas[idx];

    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">' + esc(parte.label) + ' · Tarjetas</h2>';
    h += '<p class="mode-hint">Anverso: la función / Reverso: la frase. Toca la tarjeta para girarla.</p>';
    h += '</header>';

    h += '<div class="card-stage">';
    h += '<div class="card-tj' + (tarjetasFlipped ? ' flipped' : '') + '" id="card-tj" tabindex="0">';
    h += '<div class="card-tj-face card-tj-front">';
    h += '<span class="card-tj-type">' + esc(card.tipo === 'paso' ? '🔵 Paso de la plantilla' : '🟡 Kit universal') + '</span>';
    h += '<p class="card-tj-title">' + esc(card.anverso) + '</p>';
    h += '<p class="card-tj-sub">' + esc(card.anverso_sub) + '</p>';
    h += '<p class="card-tj-hint">Toca para girar</p>';
    h += '</div>';
    h += '<div class="card-tj-face card-tj-back">';
    h += '<p class="card-tj-content">' + esc(card.reverso) + '</p>';
    if (card.truco) h += '<p class="card-tj-truco">💡 ' + esc(card.truco) + '</p>';
    h += '<button class="btn-listen btn-listen-small" type="button" data-text="' + escAttr(card.reverso) + '">🔊 Escuchar</button>';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    h += '<div class="card-tj-actions">';
    h += '<button class="btn btn-secondary" id="btn-prev-tj">← Anterior</button>';
    h += '<button class="btn btn-secondary" id="btn-flip-tj">↻ Girar</button>';
    h += '<button class="btn btn-secondary" id="btn-next-tj">Siguiente →</button>';
    h += '</div>';
    h += '<p class="card-counter">' + (idx + 1) + ' / ' + tarjetas.length + '</p>';

    h += '</section>';
    return h;
  }

  function attachTarjetasListeners(parte) {
    var tarjetas_n = parte.pasos.length + (parte.kits_universales ? parte.kits_universales.length : 0);
    var card = document.getElementById('card-tj');
    if (card) card.addEventListener('click', function () {
      tarjetasFlipped = !tarjetasFlipped;
      card.classList.toggle('flipped', tarjetasFlipped);
    });
    document.getElementById('btn-flip-tj').addEventListener('click', function (e) {
      e.stopPropagation();
      tarjetasFlipped = !tarjetasFlipped;
      card.classList.toggle('flipped', tarjetasFlipped);
    });
    document.getElementById('btn-prev-tj').addEventListener('click', function () {
      tarjetasIndex[parte.id] = ((tarjetasIndex[parte.id] || 0) - 1 + tarjetas_n) % tarjetas_n;
      tarjetasFlipped = false;
      renderCurrent();
    });
    document.getElementById('btn-next-tj').addEventListener('click', function () {
      tarjetasIndex[parte.id] = ((tarjetasIndex[parte.id] || 0) + 1) % tarjetas_n;
      tarjetasFlipped = false;
      renderCurrent();
    });
    document.querySelectorAll('.btn-listen').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        speak(b.dataset.text);
      });
    });
  }

  /* ============== PROGRESO ============== */
  function renderProgreso() {
    var hist = (SCORM.lsRead().historial) || [];
    var modos = ['estructura', 'aplicado', 'tarjetas', 'examen'];

    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">📊 Progreso</h2>';
    h += '<p class="mode-hint">Visitas por parte y modo + historial completo de exámenes.</p>';
    h += '</header>';

    h += '<div class="dash-blocks">';
    PARTES.forEach(function (p) {
      var s = STATE.p[p.id] || {};
      var done = 0;
      modos.forEach(function (m) { if (s[m] > 0) done++; });
      h += '<article class="dash-block">';
      h += '<header class="dash-block-head"><h3>' + esc(p.label) + '</h3><span class="dash-block-pct">' + done + ' / 4 modos</span></header>';
      h += '<ul class="dash-modes">';
      modos.forEach(function (m) {
        var n = s[m] || 0;
        var icon = m === 'estructura' ? '📚' : m === 'aplicado' ? '🔄' : m === 'tarjetas' ? '🃏' : '🎯';
        h += '<li>' + (n > 0 ? '✓' : '○') + ' ' + icon + ' ' + esc(m) + ' <span class="dash-count">(' + n + ')</span></li>';
      });
      h += '</ul>';
      h += '</article>';
    });
    h += '</div>';

    h += '<h3 class="dash-section">📚 Historial de exámenes (' + hist.length + ')</h3>';
    if (hist.length === 0) {
      h += '<p class="analisis-vacio">Aún no has hecho ningún simulacro de examen.</p>';
    } else {
      h += '<div class="hist-block">';
      hist.forEach(function (it) {
        var d = new Date(it.timestamp);
        h += '<details class="hist-item">';
        h += '<summary><strong>' + d.toLocaleString() + '</strong> · ' + esc(it.parte_id) + ' · ' + esc(it.tema_label);
        h += ' · ' + it.analisis.palabras + ' pal · ' + it.analisis.idioms.length + ' idioms · ' + it.analisis.tiempos.length + ' tiempos</summary>';
        h += '<p class="hist-resp">' + esc(it.respuesta || '(vacío)') + '</p>';
        h += '</details>';
      });
      h += '</div>';
    }

    h += '<div class="dash-actions">';
    h += '<button class="btn btn-reset" id="btn-reset-todo">Reiniciar TODO el progreso</button>';
    h += '</div>';
    h += '</section>';
    return h;
  }

  function attachProgresoListeners() {
    var b = document.getElementById('btn-reset-todo');
    if (b) b.addEventListener('click', function () {
      if (confirm('¿Borrar TODO el progreso, historial y datos? No se puede deshacer.')) {
        STATE = { v: 3, p: {} };
        var s = SCORM.lsRead();
        s.historial = [];
        SCORM.lsWrite(s);
        saveState();
        renderCurrent();
      }
    });
  }

  /* ============== UTILS ============== */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    var clean = String(text).replace(/\[[^\]]+\]/g, 'something').replace(/\s+/g, ' ').trim();
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-GB'; u.rate = 0.95;
    var voices = window.speechSynthesis.getVoices();
    var gb = voices.find(function (v) { return v.lang === 'en-GB'; });
    if (gb) u.voice = gb;
    window.speechSynthesis.speak(u);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
})();
