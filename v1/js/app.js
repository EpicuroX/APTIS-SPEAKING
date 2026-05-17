/* =============================================================================
 * app.js — Logica de la app Aptis Speaking v1
 * -----------------------------------------------------------------------------
 * Tres vistas: tarjetas, ejercicios de huecos, dashboard.
 * Estado persistente via window.SCORM (suspend_data o localStorage).
 * ============================================================================= */

(function () {
  'use strict';

  // ---------- Estado global ----------
  var DATA = null;            // content.json parseado
  var STATE = null;           // estado persistente por frase
  var view = 'cards';

  // Tarjetas
  var cardList = [];          // frases filtradas
  var cardIndex = 0;
  var cardFlipped = false;
  var cardFilterBlock = 'ALL';
  var cardFilterLevel = 'ALL';

  // Huecos
  var practiceList = [];
  var practiceIndex = 0;
  var practiceFilterBlock = 'ALL';
  var practiceChecked = false;

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
        bindUI();
        renderAll();
      })
      .catch(function (err) {
        document.querySelector('.app-main').innerHTML =
          '<p style="padding:1rem;color:#dc2626">Error cargando content.json: ' +
          err.message + '</p>';
      });

    // Guardado al salir
    window.addEventListener('beforeunload', function () {
      saveState();
      SCORM.finish();
    });
  });

  /* =============================================================================
   * 2. ESTADO PERSISTENTE
   * -----------------------------------------------------------------------------
   * Formato compacto para caber en 4096 chars de suspend_data.
   * Por cada id: { k:1|0, t:intentos, a:aciertos }
   *   k = known (1 si "la se", 0 si "no la se", undefined si sin tocar)
   *   t = total intentos en huecos
   *   a = aciertos en huecos
   * ============================================================================= */
  function loadState() {
    var raw = SCORM.getSuspendData();
    if (!raw) { STATE = {}; return; }
    try {
      STATE = JSON.parse(raw);
    } catch (e) {
      console.warn('suspend_data corrupto, reiniciando');
      STATE = {};
    }
  }

  function saveState() {
    var json = JSON.stringify(STATE);
    SCORM.setSuspendData(json);

    // Calcular score global de huecos para SCORM
    var totalT = 0, totalA = 0;
    Object.keys(STATE).forEach(function (id) {
      var s = STATE[id];
      totalT += s.t || 0;
      totalA += s.a || 0;
    });
    var pct = totalT > 0 ? Math.round((totalA / totalT) * 100) : 0;
    SCORM.setScore(pct);

    // Status: completed si >=70% de frases marcadas "la se"
    var known = 0;
    DATA.phrases.forEach(function (p) {
      if (STATE[p.id] && STATE[p.id].k === 1) known++;
    });
    var knownPct = (known / DATA.phrases.length) * 100;
    SCORM.setStatus(knownPct >= 70 ? 'completed' : 'incomplete');

    SCORM.commit();
  }

  function getPhraseState(id) {
    if (!STATE[id]) STATE[id] = {};
    return STATE[id];
  }

  /* =============================================================================
   * 3. BINDINGS DE UI
   * ============================================================================= */
  function bindUI() {
    // Tabs
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchView(btn.dataset.view);
      });
    });

    // Filtros tarjetas
    document.querySelectorAll('#block-filter .block-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#block-filter .block-btn').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        cardFilterBlock = b.dataset.block;
        rebuildCardList();
        renderCard();
      });
    });
    document.querySelectorAll('#level-filter .level-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#level-filter .level-btn').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        cardFilterLevel = b.dataset.level;
        rebuildCardList();
        renderCard();
      });
    });

    // Filtros huecos
    document.querySelectorAll('#block-filter-practice .block-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#block-filter-practice .block-btn').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        practiceFilterBlock = b.dataset.block;
        rebuildPracticeList();
        renderPractice();
      });
    });

    // Acciones tarjetas
    document.getElementById('card').addEventListener('click', flipCard);
    document.getElementById('btn-flip').addEventListener('click', flipCard);
    document.getElementById('btn-yes').addEventListener('click', function () { markCard(1); });
    document.getElementById('btn-no').addEventListener('click',  function () { markCard(0); });
    document.getElementById('btn-listen').addEventListener('click', function (e) {
      e.stopPropagation();
      speakCurrent();
    });

    // Acciones huecos
    document.getElementById('btn-check').addEventListener('click', checkPractice);
    document.getElementById('btn-next').addEventListener('click', nextPractice);

    // Dashboard
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (confirm('¿Seguro que quieres reiniciar todo el progreso? Esto borra "La sé", "No la sé" y los aciertos de huecos.')) {
        STATE = {};
        saveState();
        renderAll();
      }
    });
  }

  function switchView(name) {
    view = name;
    document.querySelectorAll('.tab').forEach(function (t) {
      var active = t.dataset.view === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('view-active');
    });
    document.getElementById('view-' + name).classList.add('view-active');
    if (name === 'cards')     { rebuildCardList(); renderCard(); }
    if (name === 'practice')  { rebuildPracticeList(); renderPractice(); }
    if (name === 'dashboard') { renderDashboard(); }
  }

  function renderAll() {
    rebuildCardList();
    renderCard();
    rebuildPracticeList();
    renderPractice();
    renderDashboard();
  }

  /* =============================================================================
   * 4. VISTA TARJETAS
   * ============================================================================= */
  function rebuildCardList() {
    cardList = DATA.phrases.filter(function (p) {
      if (cardFilterBlock !== 'ALL' && p.block !== cardFilterBlock) return false;
      if (cardFilterLevel !== 'ALL' && p.level !== cardFilterLevel) return false;
      return true;
    });
    cardIndex = 0;
    cardFlipped = false;
  }

  function renderCard() {
    var stage = document.querySelector('.card-stage');
    if (cardList.length === 0) {
      stage.innerHTML = '<p class="empty">No hay frases con esos filtros.</p>';
      document.getElementById('card-counter').textContent = '0 / 0';
      return;
    }
    // Si la stage habia quedado vacia tras un filtro previo, restaurar la tarjeta
    if (!document.getElementById('card')) {
      stage.innerHTML = buildCardHTML();
      rebindCardListeners();
    }

    var p = cardList[cardIndex];
    var blockColor = DATA.blocks[p.block].color;
    var card = document.getElementById('card');
    card.style.setProperty('--block-color', blockColor);
    card.classList.toggle('flipped', cardFlipped);

    document.getElementById('card-block').textContent     = p.block;
    document.getElementById('card-block-b').textContent   = p.block;
    document.getElementById('card-id').textContent        = p.id;
    document.getElementById('card-id-b').textContent      = p.id;
    document.getElementById('card-level').textContent     = p.level === 'b2-high' ? 'B2 alto' : 'B2';
    document.getElementById('card-function').textContent  = p.function;
    document.getElementById('card-trick').textContent     = p.trick;
    document.getElementById('card-template').textContent  = p.template;

    // Estado de "la se"
    var st = STATE[p.id];
    document.getElementById('btn-yes').classList.toggle('selected', st && st.k === 1);
    document.getElementById('btn-no').classList.toggle('selected',  st && st.k === 0);

    document.getElementById('card-counter').textContent = (cardIndex + 1) + ' / ' + cardList.length;
  }

  // Si la stage se ha vaciado (caso filtro sin resultados → con resultados),
  // necesitamos reconstruir y volver a bindear los listeners de la tarjeta.
  function buildCardHTML() {
    return ''
      + '<div class="card" id="card" tabindex="0">'
      +   '<div class="card-face card-front">'
      +     '<div class="card-badges">'
      +       '<span class="badge badge-block" id="card-block">A</span>'
      +       '<span class="badge badge-level" id="card-level">B2</span>'
      +       '<span class="badge badge-id" id="card-id">01</span>'
      +     '</div>'
      +     '<div class="card-body">'
      +       '<p class="card-function" id="card-function"></p>'
      +       '<p class="card-trick" id="card-trick"></p>'
      +       '<p class="card-hint">Toca la tarjeta para ver la frase</p>'
      +     '</div>'
      +   '</div>'
      +   '<div class="card-face card-back">'
      +     '<div class="card-badges">'
      +       '<span class="badge badge-block" id="card-block-b">A</span>'
      +       '<span class="badge badge-id" id="card-id-b">01</span>'
      +     '</div>'
      +     '<p class="card-template" id="card-template"></p>'
      +     '<button class="btn-listen" id="btn-listen" type="button">🔊 Escuchar</button>'
      +   '</div>'
      + '</div>';
  }
  function rebindCardListeners() {
    document.getElementById('card').addEventListener('click', flipCard);
    document.getElementById('btn-listen').addEventListener('click', function (e) {
      e.stopPropagation();
      speakCurrent();
    });
  }

  function flipCard() {
    if (cardList.length === 0) return;
    cardFlipped = !cardFlipped;
    document.getElementById('card').classList.toggle('flipped', cardFlipped);
  }

  function markCard(known) {
    if (cardList.length === 0) return;
    var p = cardList[cardIndex];
    var s = getPhraseState(p.id);
    s.k = known;
    saveState();

    // Avanzar a la siguiente
    cardIndex = (cardIndex + 1) % cardList.length;
    cardFlipped = false;
    renderCard();
  }

  /* --------- Web Speech API --------- */
  function speakCurrent() {
    if (cardList.length === 0) return;
    var p = cardList[cardIndex];
    // Limpiamos huecos [X], [verbo]... antes de leer en voz alta
    var text = p.template.replace(/\[[^\]]+\]/g, 'something');

    if (!('speechSynthesis' in window)) {
      alert('Tu navegador no soporta síntesis de voz.');
      return;
    }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.95;
    // Best effort: si hay una voz en-GB disponible, usarla
    var voices = window.speechSynthesis.getVoices();
    var gb = voices.find(function (v) { return v.lang === 'en-GB'; });
    if (gb) u.voice = gb;
    window.speechSynthesis.speak(u);
  }

  /* =============================================================================
   * 5. VISTA HUECOS
   * ============================================================================= */
  function rebuildPracticeList() {
    practiceList = DATA.phrases.filter(function (p) {
      if (practiceFilterBlock !== 'ALL' && p.block !== practiceFilterBlock) return false;
      return true;
    });
    practiceIndex = 0;
    practiceChecked = false;
  }

  function renderPractice() {
    var stage = document.querySelector('.practice-stage');
    if (practiceList.length === 0) {
      document.getElementById('practice-sentence').textContent = '';
      document.getElementById('practice-function').textContent = 'No hay frases con ese filtro.';
      document.getElementById('practice-feedback').textContent = '';
      document.getElementById('practice-counter').textContent = '0 / 0';
      return;
    }
    var p = practiceList[practiceIndex];
    var blockColor = DATA.blocks[p.block].color;
    stage.style.setProperty('--block-color', blockColor);

    document.getElementById('practice-block').textContent    = p.block;
    document.getElementById('practice-id').textContent       = p.id;
    document.getElementById('practice-function').textContent = p.function;
    document.getElementById('practice-feedback').textContent = '';
    document.getElementById('practice-feedback').className   = 'practice-feedback';

    document.getElementById('practice-sentence').innerHTML = buildSentenceWithInputs(p);

    practiceChecked = false;
    document.getElementById('btn-check').disabled = false;
    document.getElementById('btn-next').disabled = true;

    document.getElementById('practice-counter').textContent = (practiceIndex + 1) + ' / ' + practiceList.length;

    // Foco al primer input
    var first = document.querySelector('.gap-input');
    if (first) {
      // En movil esto puede abrir el teclado; lo dejamos al usuario.
      // first.focus();
    }
  }

  /* Reemplaza en el template las palabras de p.gaps[i].answer (en orden de
   * aparicion) por inputs vacios. Mantiene puntuacion y huecos [X] tal cual.
   */
  function buildSentenceWithInputs(p) {
    var html = '';
    var tpl = p.template;
    // Marcar las palabras a ocultar: una ocurrencia por gap (en orden)
    var gapsRemaining = p.gaps.map(function (g, i) {
      return { answer: g.answer, hint: g.hint, idx: i, done: false };
    });

    // Tokenizar manteniendo separadores
    // Un "token" es una palabra (letras/apostrofes) o un trozo que no lo es
    var tokenRegex = /([A-Za-z']+|\[[^\]]+\]|[^A-Za-z'[]+)/g;
    var m, lastEnd = 0;
    while ((m = tokenRegex.exec(tpl)) !== null) {
      var tok = m[0];
      // ¿Es palabra alfa pura (no [hueco] del alumno)?
      if (/^[A-Za-z']+$/.test(tok)) {
        // ¿Coincide con algun gap aun no marcado?
        var match = gapsRemaining.find(function (g) {
          return !g.done && g.answer.toLowerCase() === tok.toLowerCase();
        });
        if (match) {
          match.done = true;
          var width = Math.max(tok.length, 4);
          html += '<input class="gap-input" type="text" '
                + 'autocapitalize="off" autocorrect="off" autocomplete="off" '
                + 'spellcheck="false" '
                + 'data-answer="' + escapeAttr(match.answer) + '" '
                + 'data-hint="' + escapeAttr(match.hint || '') + '" '
                + 'data-gap-idx="' + match.idx + '" '
                + 'size="' + width + '" '
                + 'aria-label="Hueco ' + (match.idx + 1) + '" />';
        } else {
          html += escapeHtml(tok);
        }
      } else {
        html += escapeHtml(tok);
      }
    }
    return html;
  }

  function normalize(s) {
    return String(s).toLowerCase().replace(/[^a-z']/g, '').trim();
  }

  function checkPractice() {
    if (practiceList.length === 0 || practiceChecked) return;
    var p = practiceList[practiceIndex];
    var inputs = document.querySelectorAll('.gap-input');
    var allCorrect = true;
    var allBlank = true;

    inputs.forEach(function (inp) {
      var user = normalize(inp.value);
      var ans = normalize(inp.dataset.answer);
      if (user.length > 0) allBlank = false;
      var ok = user === ans;
      inp.classList.remove('gap-ok', 'gap-bad');
      inp.classList.add(ok ? 'gap-ok' : 'gap-bad');
      inp.disabled = true;
      if (!ok) {
        allCorrect = false;
        // Mostrar respuesta correcta + hint si la habia
        inp.value = inp.dataset.answer;
        var hint = inp.dataset.hint;
        if (hint) {
          inp.title = 'Pista: ' + hint;
        }
      }
      // Log SCORM por hueco
      SCORM.logInteraction(
        p.id + '-' + inp.dataset.gapIdx,
        inp.value.substring(0, 250),
        ok
      );
    });

    if (allBlank) {
      // No contamos el intento si esta todo en blanco
      document.querySelectorAll('.gap-input').forEach(function (inp) {
        inp.disabled = false;
        inp.classList.remove('gap-ok', 'gap-bad');
      });
      var fb = document.getElementById('practice-feedback');
      fb.textContent = 'Escribe algo antes de comprobar.';
      fb.className = 'practice-feedback feedback-neutral';
      return;
    }

    // Actualizar estado: contamos UN intento por frase, con aciertos = nº de huecos correctos
    var s = getPhraseState(p.id);
    s.t = (s.t || 0) + 1;
    s.a = (s.a || 0) + (allCorrect ? 1 : 0);
    saveState();

    var fb = document.getElementById('practice-feedback');
    if (allCorrect) {
      fb.textContent = '✓ ¡Perfecto!';
      fb.className = 'practice-feedback feedback-ok';
    } else {
      fb.textContent = '⚠ Revisa las palabras en rojo. Se muestran las correctas.';
      fb.className = 'practice-feedback feedback-bad';
    }

    practiceChecked = true;
    document.getElementById('btn-check').disabled = true;
    document.getElementById('btn-next').disabled = false;
  }

  function nextPractice() {
    if (practiceList.length === 0) return;
    practiceIndex = (practiceIndex + 1) % practiceList.length;
    renderPractice();
  }

  /* =============================================================================
   * 6. DASHBOARD
   * ============================================================================= */
  function renderDashboard() {
    var total = DATA.phrases.length;
    var known = 0;
    var totalT = 0, totalA = 0;

    // Estadisticas por bloque
    var byBlock = {};
    Object.keys(DATA.blocks).forEach(function (b) {
      byBlock[b] = { total: 0, known: 0, t: 0, a: 0, color: DATA.blocks[b].color, name: DATA.blocks[b].name };
    });

    DATA.phrases.forEach(function (p) {
      byBlock[p.block].total++;
      var s = STATE[p.id];
      if (!s) return;
      if (s.k === 1) {
        known++;
        byBlock[p.block].known++;
      }
      if (s.t) {
        totalT += s.t;
        byBlock[p.block].t += s.t;
        totalA += (s.a || 0);
        byBlock[p.block].a += (s.a || 0);
      }
    });

    document.getElementById('dash-known').textContent = known + ' / ' + total;
    document.getElementById('dash-accuracy').textContent =
      totalT > 0 ? Math.round((totalA / totalT) * 100) + ' %' : '— %';
    document.getElementById('dash-status').textContent = SCORM.isLMS() ? 'SCORM conectado' : 'Local (navegador)';

    // Render barras por bloque
    var html = '';
    Object.keys(byBlock).forEach(function (b) {
      var bb = byBlock[b];
      var knownPct = bb.total > 0 ? Math.round((bb.known / bb.total) * 100) : 0;
      var accPct   = bb.t > 0 ? Math.round((bb.a / bb.t) * 100) : null;
      html += ''
        + '<div class="dash-block">'
        +   '<div class="dash-block-head">'
        +     '<span class="badge badge-block" style="background:' + bb.color + '">' + b + '</span>'
        +     '<span class="dash-block-name">' + bb.name + '</span>'
        +     '<span class="dash-block-count">' + bb.known + '/' + bb.total + ' "la sé"</span>'
        +   '</div>'
        +   '<div class="dash-bar" aria-label="Frases la sé por bloque">'
        +     '<div class="dash-bar-fill" style="width:' + knownPct + '%;background:' + bb.color + '"></div>'
        +   '</div>'
        +   '<div class="dash-block-acc">Aciertos huecos: '
        +     (accPct === null ? '—' : accPct + ' %')
        +   '</div>'
        + '</div>';
    });
    document.getElementById('dash-blocks').innerHTML = html;
  }

  /* =============================================================================
   * 7. UTILIDADES
   * ============================================================================= */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

})();
