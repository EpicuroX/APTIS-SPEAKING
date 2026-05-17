/* =============================================================================
 * app.js — Aptis Speaking · Plantillas B2 (v2)
 * -----------------------------------------------------------------------------
 * Tres modos por parte del examen:
 *   APRENDER   → estructura desnuda con huecos clicables
 *   APLICADO   → misma estructura, distintos temas (la pieza clave)
 *   PRACTICAR  → tú rellenas mentalmente, luego ves la respuesta modelo
 *
 * Más:
 *   VOCABULARIO  → conectores, adjetivos, phrasals, idioms
 *   ESTRATEGIA   → consejos del día del examen
 *   PROGRESO     → seguimiento de uso
 *
 * Estado persistente vía SCORM o localStorage.
 * ============================================================================= */

(function () {
  'use strict';

  // ---------- Estado global ----------
  var DATA = null;
  var STATE = null;
  var currentSection = 'parte-1';      // id de la parte/sección activa
  var currentMode = 'aprender';        // sólo aplica a partes 1-4
  var aplicadoTema = null;             // tema seleccionado en modo Aplicado
  var aplicadoTema2 = null;            // segundo tema para vista comparada
  var practicarTema = null;            // tema seleccionado en modo Practicar
  var practicarRevealed = false;       // si ya se ha mostrado la respuesta modelo

  /* =============================================================================
   * 1. ARRANQUE
   * ============================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    SCORM.init();
    fetch('js/content.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        DATA = json;
        loadState();
        if (DATA.temas.length > 0) {
          aplicadoTema = DATA.temas[0].id;
          aplicadoTema2 = DATA.temas.length > 1 ? DATA.temas[1].id : DATA.temas[0].id;
          practicarTema = DATA.temas[0].id;
        }
        buildNav();
        renderCurrent();
      })
      .catch(function (err) {
        document.getElementById('app-main').innerHTML =
          '<p class="error">Error cargando contenido: ' + err.message + '</p>';
      });

    window.addEventListener('beforeunload', function () {
      saveState();
      SCORM.finish();
    });
  });

  /* =============================================================================
   * 2. ESTADO PERSISTENTE (compacto para SCORM 1.2)
   * Formato:
   *   { v:2, p:{ "parte-1":{a:nVistasAprender, l:nVistasAplicado, r:nVistasPracticar}, ... } }
   * ============================================================================= */
  function loadState() {
    var raw = SCORM.getSuspendData();
    if (!raw) { STATE = { v: 2, p: {} }; return; }
    try {
      STATE = JSON.parse(raw);
      if (!STATE.p) STATE.p = {};
    } catch (e) { STATE = { v: 2, p: {} }; }
  }

  function saveState() {
    SCORM.setSuspendData(JSON.stringify(STATE));

    // Score: % de partes "visitadas" en los 3 modos
    var totalSlots = DATA.partes.length * 3;
    var done = 0;
    DATA.partes.forEach(function (p) {
      var s = STATE.p[p.id] || {};
      if (s.a > 0) done++;
      if (s.l > 0) done++;
      if (s.r > 0) done++;
    });
    var pct = totalSlots > 0 ? Math.round((done / totalSlots) * 100) : 0;
    SCORM.setScore(pct);
    SCORM.setStatus(pct >= 70 ? 'completed' : 'incomplete');
    SCORM.commit();
  }

  function bumpCounter(parteId, modo) {
    if (!STATE.p[parteId]) STATE.p[parteId] = { a: 0, l: 0, r: 0 };
    var key = modo === 'aprender' ? 'a' : modo === 'aplicado' ? 'l' : 'r';
    STATE.p[parteId][key] = (STATE.p[parteId][key] || 0) + 1;
    saveState();
  }

  /* =============================================================================
   * 3. NAVEGACIÓN
   * ============================================================================= */
  function buildNav() {
    var nav = document.getElementById('part-nav');
    var html = '';
    DATA.partes.forEach(function (p) {
      html += '<button class="part-btn" data-section="' + p.id + '">'
            + '<span class="part-btn-label">' + esc(p.label) + '</span>'
            + '<span class="part-btn-sub">' + esc(p.subtitle) + '</span>'
            + '</button>';
    });
    html += '<button class="part-btn part-btn-aux" data-section="vocabulario">'
          + '<span class="part-btn-label">📖 Vocabulario</span>'
          + '<span class="part-btn-sub">Base universal</span>'
          + '</button>';
    html += '<button class="part-btn part-btn-aux" data-section="estrategia">'
          + '<span class="part-btn-label">🎯 Estrategia</span>'
          + '<span class="part-btn-sub">Día del examen</span>'
          + '</button>';
    html += '<button class="part-btn part-btn-aux" data-section="progreso">'
          + '<span class="part-btn-label">📊 Progreso</span>'
          + '<span class="part-btn-sub">Tu avance</span>'
          + '</button>';
    nav.innerHTML = html;

    nav.querySelectorAll('.part-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentSection = btn.dataset.section;
        currentMode = 'aprender';
        practicarRevealed = false;
        renderCurrent();
      });
    });

    // Footer con tabs de modo
    document.querySelectorAll('.mode-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentMode = tab.dataset.mode;
        practicarRevealed = false;
        renderCurrent();
      });
    });
  }

  function renderCurrent() {
    // Activar botón actual en navegación
    document.querySelectorAll('.part-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === currentSection);
    });

    var main = document.getElementById('app-main');
    var footer = document.getElementById('mode-footer');

    if (currentSection === 'vocabulario') {
      footer.hidden = true;
      main.innerHTML = renderVocabulario();
      attachVocabListeners();
    } else if (currentSection === 'estrategia') {
      footer.hidden = true;
      main.innerHTML = renderEstrategia();
    } else if (currentSection === 'progreso') {
      footer.hidden = true;
      main.innerHTML = renderProgreso();
    } else {
      // Es una parte (parte-1 a parte-4)
      footer.hidden = false;
      // Activar pestaña de modo
      document.querySelectorAll('.mode-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.mode === currentMode);
      });

      var parte = DATA.partes.find(function (x) { return x.id === currentSection; });
      if (!parte) { main.innerHTML = '<p class="error">Parte no encontrada.</p>'; return; }

      if (currentMode === 'aprender') {
        main.innerHTML = renderAprender(parte);
        attachAprenderListeners(parte);
        bumpCounter(parte.id, 'aprender');
      } else if (currentMode === 'aplicado') {
        main.innerHTML = renderAplicado(parte);
        attachAplicadoListeners(parte);
        bumpCounter(parte.id, 'aplicado');
      } else {
        main.innerHTML = renderPracticar(parte);
        attachPracticarListeners(parte);
        bumpCounter(parte.id, 'practicar');
      }
    }

    // Scroll arriba al cambiar
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* =============================================================================
   * 4. MODO 1 · APRENDER
   * Muestra la estructura desnuda. Cada hueco es un botón clicable que despliega
   * tipo + opciones de vocabulario.
   * ============================================================================= */
  function renderAprender(parte) {
    var h = '';
    h += '<section class="part-section">';
    h += '<header class="part-header">';
    h +=   '<h2 class="part-h2">' + esc(parte.label) + ' · ' + esc(parte.subtitle) + '</h2>';
    h +=   '<div class="part-meta">';
    h +=     '<span class="meta-chip">⏱ ' + esc(parte.meta.tiempo) + '</span>';
    h +=     '<span class="meta-chip">📋 ' + esc(parte.meta.formato) + '</span>';
    h +=     '<span class="meta-chip">🎯 Nivel: ' + esc(parte.meta.nivel) + '</span>';
    h +=   '</div>';
    h +=   '<p class="part-objective"><strong>Objetivo:</strong> ' + esc(parte.objetivo) + '</p>';
    h += '</header>';

    h += '<p class="mode-hint">Toca cada <span class="hint-gap">[hueco]</span> para ver opciones de vocabulario.</p>';

    parte.pasos.forEach(function (paso) {
      h += renderPasoAprender(paso, parte.id);
    });

    h += '</section>';
    return h;
  }

  function renderPasoAprender(paso, parteId) {
    var h = '<article class="step-card">';
    h += '<header class="step-head">';
    h +=   '<span class="step-num">' + paso.n + '</span>';
    h +=   '<div class="step-titles">';
    h +=     '<h3 class="step-title">' + esc(paso.title) + '</h3>';
    h +=     '<p class="step-time">⏱ ' + esc(paso.time) + ' · ' + esc(paso.grammar) + '</p>';
    h +=   '</div>';
    h += '</header>';

    h += '<button class="btn-listen" type="button" data-template="' + escAttr(paso.template) + '" aria-label="Escuchar la frase">🔊 Escuchar</button>';

    h += '<p class="step-template">' + renderTemplateWithGaps(paso.template, paso.huecos, parteId + '-' + paso.n) + '</p>';

    // Contenedores para los desplegables de huecos
    h += '<div class="gap-panels" id="gap-panels-' + parteId + '-' + paso.n + '"></div>';

    h += '<div class="step-extras">';
    if (paso.trick) {
      h += '<div class="step-tip step-trick"><strong>💡 Truco:</strong> ' + esc(paso.trick) + '</div>';
    }
    if (paso.warning) {
      h += '<div class="step-tip step-warning"><strong>⚠️ Cuidado:</strong> ' + esc(paso.warning) + '</div>';
    }
    h += '</div>';

    h += '</article>';
    return h;
  }

  /**
   * Sustituye en la frase-molde cada marker (ej. "[X]", "[verbo + complemento]")
   * por un botón clicable con índice. El click muestra un panel con tipo + opciones.
   */
  function renderTemplateWithGaps(template, huecos, stepKey) {
    var out = esc(template);
    huecos.forEach(function (h, i) {
      var marker = h.marker;
      // Escapamos para regexp
      var escMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var btn = '<button class="gap-btn" '
              + 'data-step="' + stepKey + '" '
              + 'data-gap-idx="' + i + '" '
              + 'type="button">'
              + esc(marker) + '</button>';
      // Sustituimos primera ocurrencia
      out = out.replace(new RegExp(escMarker), btn);
    });
    return out;
  }

  function attachAprenderListeners(parte) {
    document.querySelectorAll('.btn-listen').forEach(function (btn) {
      btn.addEventListener('click', function () {
        speak(btn.dataset.template);
      });
    });

    document.querySelectorAll('.gap-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stepKey = btn.dataset.step;
        var idx = parseInt(btn.dataset.gapIdx, 10);
        var paso = findPasoByKey(parte, stepKey);
        if (!paso) return;
        toggleGapPanel(paso, idx, stepKey);
      });
    });
  }

  function findPasoByKey(parte, stepKey) {
    var pasoN = parseInt(stepKey.split('-').pop(), 10);
    return parte.pasos.find(function (p) { return p.n === pasoN; });
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
      h += '<li class="gap-option" tabindex="0" data-text="' + escAttr(op) + '">' + esc(op) + '</li>';
    });
    h += '</ul>';
    h += '<p class="gap-panel-hint">Toca una opción para escucharla.</p>';
    h += '</div>';

    container.insertAdjacentHTML('beforeend', h);

    var newPanel = document.getElementById(panelId);
    newPanel.querySelector('.gap-panel-close').addEventListener('click', function () {
      newPanel.remove();
    });
    newPanel.querySelectorAll('.gap-option').forEach(function (li) {
      li.addEventListener('click', function () {
        speak(li.dataset.text);
      });
    });

    // Scroll suave al panel para que se vea
    newPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* =============================================================================
   * 5. MODO 2 · VER APLICADO (la pieza clave)
   * Misma estructura, distintos temas. Vista comparada opcional.
   * ============================================================================= */
  function renderAplicado(parte) {
    var h = '';
    h += '<section class="part-section">';
    h += '<header class="part-header">';
    h +=   '<h2 class="part-h2">' + esc(parte.label) + ' · ' + esc(parte.subtitle) + '</h2>';
    h +=   '<p class="mode-hint">La misma estructura aplicada a distintos temas. Mira cómo cambia el contenido y se mantiene el esqueleto.</p>';
    h += '</header>';

    h += '<div class="aplicado-controls">';
    h += '<div class="aplicado-col">';
    h += '<label class="aplicado-label">Tema A</label>';
    h += renderTemaSelect('aplicado-tema-1', aplicadoTema);
    h += '</div>';
    h += '<div class="aplicado-col">';
    h += '<label class="aplicado-label">Tema B (comparar)</label>';
    h += renderTemaSelect('aplicado-tema-2', aplicadoTema2);
    h += '</div>';
    h += '</div>';

    h += '<div class="aplicado-grid">';
    h += renderAplicadoColumn(parte, aplicadoTema, 'A');
    h += renderAplicadoColumn(parte, aplicadoTema2, 'B');
    h += '</div>';

    h += '</section>';
    return h;
  }

  function renderTemaSelect(id, current) {
    var h = '<select class="tema-select" id="' + id + '">';
    DATA.temas.forEach(function (t) {
      var sel = t.id === current ? ' selected' : '';
      h += '<option value="' + t.id + '"' + sel + '>' + esc(t.label) + '</option>';
    });
    h += '</select>';
    return h;
  }

  function renderAplicadoColumn(parte, temaId, etiqueta) {
    var tema = DATA.temas.find(function (t) { return t.id === temaId; });
    var ej = parte.ejemplos_por_tema[temaId];
    if (!tema || !ej) return '<div class="aplicado-card"><p>No hay ejemplo para este tema.</p></div>';

    var h = '<div class="aplicado-card" style="--tema-color:' + tema.color + '">';
    h += '<div class="aplicado-card-head">';
    h +=   '<span class="aplicado-etiqueta">' + esc(etiqueta) + '</span>';
    h +=   '<span class="aplicado-tema">' + esc(tema.label) + '</span>';
    h += '</div>';
    h += '<p class="aplicado-pregunta"><strong>Pregunta:</strong> ' + esc(ej.pregunta) + '</p>';
    h += '<p class="aplicado-respuesta">' + esc(ej.respuesta) + '</p>';
    h += '<button class="btn-listen btn-listen-small" type="button" data-text="' + escAttr(ej.respuesta) + '">🔊 Escuchar respuesta</button>';
    h += '</div>';
    return h;
  }

  function attachAplicadoListeners(parte) {
    var s1 = document.getElementById('aplicado-tema-1');
    var s2 = document.getElementById('aplicado-tema-2');
    if (s1) s1.addEventListener('change', function () {
      aplicadoTema = s1.value;
      renderCurrent();
    });
    if (s2) s2.addEventListener('change', function () {
      aplicadoTema2 = s2.value;
      renderCurrent();
    });
    document.querySelectorAll('.btn-listen').forEach(function (btn) {
      btn.addEventListener('click', function () {
        speak(btn.dataset.text);
      });
    });
  }

  /* =============================================================================
   * 6. MODO 3 · PRACTICAR
   * Te dan pregunta con tema. Tú piensas en voz alta. Luego pulsas "Ver modelo".
   * ============================================================================= */
  function renderPracticar(parte) {
    var tema = DATA.temas.find(function (t) { return t.id === practicarTema; });
    var ej = parte.ejemplos_por_tema[practicarTema];

    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h +=   '<h2 class="part-h2">' + esc(parte.label) + ' · ' + esc(parte.subtitle) + '</h2>';
    h +=   '<p class="mode-hint">Lee la pregunta. Piensa tu respuesta <strong>en voz alta</strong> usando la plantilla. Cuando termines, pulsa "Ver respuesta modelo".</p>';
    h += '</header>';

    h += '<div class="practicar-controls">';
    h += '<label class="aplicado-label">Tema</label>';
    h += renderTemaSelect('practicar-tema', practicarTema);
    h += '</div>';

    h += '<div class="practicar-card" style="--tema-color:' + (tema ? tema.color : '#1e293b') + '">';
    h += '<div class="practicar-card-head">';
    h +=   '<span class="aplicado-etiqueta">' + esc(parte.meta.tiempo) + '</span>';
    h +=   '<span class="aplicado-tema">' + (tema ? esc(tema.label) : '') + '</span>';
    h += '</div>';
    h += '<p class="practicar-pregunta">' + (ej ? esc(ej.pregunta) : '—') + '</p>';
    h += '</div>';

    h += '<div class="practicar-actions">';
    h += '<button class="btn btn-secondary" id="btn-recordar-estructura" type="button">📋 Recordar estructura</button>';
    if (!practicarRevealed) {
      h += '<button class="btn btn-primary" id="btn-ver-modelo" type="button">👁 Ver respuesta modelo</button>';
    } else {
      h += '<button class="btn btn-yes" id="btn-marcar-bien" type="button">✓ Lo tenía</button>';
      h += '<button class="btn btn-no"  id="btn-marcar-mal"  type="button">✗ Lo improviso peor</button>';
    }
    h += '</div>';

    if (practicarRevealed && ej) {
      h += '<div class="practicar-modelo">';
      h += '<h3 class="practicar-modelo-title">Respuesta modelo</h3>';
      h += '<p class="practicar-modelo-text">' + esc(ej.respuesta) + '</p>';
      h += '<button class="btn-listen btn-listen-small" type="button" data-text="' + escAttr(ej.respuesta) + '">🔊 Escuchar respuesta</button>';
      h += '</div>';
    }

    // Estructura como recordatorio plegable
    h += '<details class="practicar-estructura" id="estructura-details">';
    h += '<summary>📋 Ver estructura paso a paso</summary>';
    parte.pasos.forEach(function (paso) {
      h += '<div class="practicar-paso">';
      h += '<p class="practicar-paso-title"><span class="step-num-small">' + paso.n + '</span> ' + esc(paso.title) + ' <span class="practicar-paso-time">(' + esc(paso.time) + ')</span></p>';
      h += '<p class="practicar-paso-template">' + esc(paso.template) + '</p>';
      h += '</div>';
    });
    h += '</details>';

    h += '</section>';
    return h;
  }

  function attachPracticarListeners(parte) {
    var sel = document.getElementById('practicar-tema');
    if (sel) sel.addEventListener('change', function () {
      practicarTema = sel.value;
      practicarRevealed = false;
      renderCurrent();
    });

    var btnVer = document.getElementById('btn-ver-modelo');
    if (btnVer) btnVer.addEventListener('click', function () {
      practicarRevealed = true;
      renderCurrent();
    });

    var btnBien = document.getElementById('btn-marcar-bien');
    if (btnBien) btnBien.addEventListener('click', function () {
      // En esta v2 no llevamos contador detallado por intento. Solo bump.
      bumpCounter(parte.id, 'practicar');
      // Avanzar al siguiente tema
      var idx = DATA.temas.findIndex(function (t) { return t.id === practicarTema; });
      practicarTema = DATA.temas[(idx + 1) % DATA.temas.length].id;
      practicarRevealed = false;
      renderCurrent();
    });

    var btnMal = document.getElementById('btn-marcar-mal');
    if (btnMal) btnMal.addEventListener('click', function () {
      bumpCounter(parte.id, 'practicar');
      practicarRevealed = false;
      renderCurrent();
    });

    var btnEst = document.getElementById('btn-recordar-estructura');
    if (btnEst) btnEst.addEventListener('click', function () {
      var d = document.getElementById('estructura-details');
      if (d) d.open = !d.open;
    });

    document.querySelectorAll('.btn-listen').forEach(function (btn) {
      btn.addEventListener('click', function () { speak(btn.dataset.text); });
    });
  }

  /* =============================================================================
   * 7. VOCABULARIO BASE
   * ============================================================================= */
  function renderVocabulario() {
    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">📖 Vocabulario base</h2>';
    h += '<p class="mode-hint">Conectores, adjetivos, phrasal verbs e idioms que funcionan en cualquier respuesta del speaking. Toca cualquier expresión para escucharla.</p>';
    h += '</header>';

    DATA.vocabulario_base.forEach(function (cat) {
      h += '<article class="vocab-category">';
      h += '<h3 class="vocab-cat-title">' + esc(cat.categoria) + '</h3>';
      cat.subcategorias.forEach(function (sub) {
        h += '<div class="vocab-subcat">';
        h += '<p class="vocab-subcat-label">' + esc(sub.label) + '</p>';
        h += '<ul class="vocab-list">';
        sub.items.forEach(function (it) {
          h += '<li class="vocab-item" data-text="' + escAttr(it) + '">' + esc(it) + '</li>';
        });
        h += '</ul>';
        h += '</div>';
      });
      h += '</article>';
    });

    h += '</section>';
    return h;
  }

  function attachVocabListeners() {
    document.querySelectorAll('.vocab-item').forEach(function (li) {
      li.addEventListener('click', function () {
        // Limpia la parte entre paréntesis para que la lectura sea natural
        var t = li.dataset.text.replace(/\s*\(=.*?\)/, '');
        speak(t);
      });
    });
  }

  /* =============================================================================
   * 8. ESTRATEGIA
   * ============================================================================= */
  function renderEstrategia() {
    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">🎯 Estrategia del día del examen</h2>';
    h += '<p class="mode-hint">No improvises. Sigue el guión. La máquina valora estructura, no creatividad.</p>';
    h += '</header>';

    h += '<div class="strategy-grid">';
    DATA.estrategia.forEach(function (c, i) {
      h += '<article class="strategy-card">';
      h += '<span class="strategy-num">' + (i + 1) + '</span>';
      h += '<h3 class="strategy-title">' + esc(c.title) + '</h3>';
      h += '<p class="strategy-body">' + esc(c.body) + '</p>';
      h += '</article>';
    });
    h += '</div>';

    h += '</section>';
    return h;
  }

  /* =============================================================================
   * 9. PROGRESO
   * ============================================================================= */
  function renderProgreso() {
    var totalSlots = DATA.partes.length * 3;
    var done = 0;
    var byPart = [];
    DATA.partes.forEach(function (p) {
      var s = STATE.p[p.id] || { a: 0, l: 0, r: 0 };
      var dPart = (s.a > 0 ? 1 : 0) + (s.l > 0 ? 1 : 0) + (s.r > 0 ? 1 : 0);
      done += dPart;
      byPart.push({ parte: p, s: s, done: dPart });
    });
    var pct = totalSlots > 0 ? Math.round((done / totalSlots) * 100) : 0;

    var h = '<section class="part-section">';
    h += '<header class="part-header">';
    h += '<h2 class="part-h2">📊 Tu progreso</h2>';
    h += '<p class="mode-hint">Visitas registradas por parte y modo. Tu progreso vive en este dispositivo si estudias fuera de Moodle.</p>';
    h += '</header>';

    h += '<div class="dash-summary">';
    h += '<div class="dash-card"><span class="dash-label">Cobertura global</span><span class="dash-value">' + pct + ' %</span></div>';
    h += '<div class="dash-card"><span class="dash-label">Modos completados</span><span class="dash-value">' + done + ' / ' + totalSlots + '</span></div>';
    h += '<div class="dash-card"><span class="dash-label">Estado SCORM</span><span class="dash-value">' + (SCORM.isLMS() ? 'SCORM' : 'Local') + '</span></div>';
    h += '</div>';

    h += '<div class="dash-blocks">';
    byPart.forEach(function (row) {
      h += '<article class="dash-block">';
      h += '<header class="dash-block-head"><h3>' + esc(row.parte.label) + '</h3><span class="dash-block-pct">' + row.done + ' / 3</span></header>';
      h += '<ul class="dash-modes">';
      h += '<li>' + (row.s.a > 0 ? '✓' : '○') + ' Aprender <span class="dash-count">(' + (row.s.a || 0) + ')</span></li>';
      h += '<li>' + (row.s.l > 0 ? '✓' : '○') + ' Ver aplicado <span class="dash-count">(' + (row.s.l || 0) + ')</span></li>';
      h += '<li>' + (row.s.r > 0 ? '✓' : '○') + ' Practicar <span class="dash-count">(' + (row.s.r || 0) + ')</span></li>';
      h += '</ul>';
      h += '</article>';
    });
    h += '</div>';

    h += '<div class="dash-actions">';
    h += '<button class="btn btn-reset" id="btn-reset" type="button">Reiniciar progreso</button>';
    h += '</div>';

    h += '</section>';

    setTimeout(function () {
      var btn = document.getElementById('btn-reset');
      if (btn) btn.addEventListener('click', function () {
        if (confirm('¿Seguro que quieres reiniciar tu progreso?')) {
          STATE = { v: 2, p: {} };
          saveState();
          renderCurrent();
        }
      });
    }, 0);

    return h;
  }

  /* =============================================================================
   * 10. UTILIDADES
   * ============================================================================= */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    var clean = String(text).replace(/\[[^\]]+\]/g, 'something').replace(/\s+/g, ' ').trim();
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-GB';
    u.rate = 0.95;
    var voices = window.speechSynthesis.getVoices();
    var gb = voices.find(function (v) { return v.lang === 'en-GB'; });
    if (gb) u.voice = gb;
    window.speechSynthesis.speak(u);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

})();
