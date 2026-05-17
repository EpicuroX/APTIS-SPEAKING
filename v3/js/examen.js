/* =============================================================================
 * examen.js · Modo Examen del simulador Aptis Speaking
 * -----------------------------------------------------------------------------
 * - Cronómetros de preparación y respuesta según parte (de parte.examen)
 * - Web Speech API (Android Chrome) para transcribir
 * - Modo escribir como alternativa
 * - Análisis automático: tiempos verbales, conectores, idioms, palabras
 * - Botón "Copiar prompt para Claude"
 * - Historial de intentos en localStorage
 * Expone: window.Examen
 * ============================================================================= */
(function () {
  'use strict';

  // ---------- Vocabulario para análisis automático ----------
  // Listas pensadas para Aptis B2: si aparecen, sube el nivel detectado
  var CONECTORES_B2 = [
    'however', 'whereas', 'although', 'despite', 'consequently', 'as a result',
    'therefore', 'moreover', 'furthermore', "what's more", 'on the one hand',
    'on the other hand', 'in contrast', 'nevertheless', 'on top of that',
    'that\'s why', 'this means that', 'in addition'
  ];
  var IDIOMS_B2 = [
    'in a nutshell', 'double-edged sword', 'here to stay', 'all things considered',
    'lean towards', 'have their merits', 'bear in mind', "it's worth mentioning",
    'for better or for worse', 'use it wisely', 'plays a key role',
    'when it comes to', 'tends to be', 'end up feeling', 'broaden our horizons',
    'recharge my batteries', 'switch off', 'clear my mind', 'takes a load off',
    'no-brainer', 'open your mind', 'make a point of', 'catch up with',
    'far more', 'more and more', 'as long as', "there's no denying"
  ];
  // Patrones gramaticales clave (regex)
  var PATRONES = {
    presente_simple:    /\b(I|you|we|they|he|she|it)\s+(?:usually|often|always|sometimes|never|tend to|like to|prefer to|enjoy|find)\b/i,
    presente_continuo:  /\b(am|are|is|'re|'s|'m)\s+\w+ing\b/i,
    pasado_simple:      /\b(was|were|went|came|made|did|saw|had|took|gave|found|got|told|thought|felt|learnt|learned|started|decided|moved|travelled|cooked|finished|tried|spent)\b/i,
    pasado_continuo:    /\b(was|were)\s+\w+ing\b/i,
    presente_perfecto:  /\b(have|has|'ve|'s)\s+(been|become|transformed|reshaped|changed|made|done|seen)\b/i,
    futuro_will:        /\b(will|won't|'ll)\s+\w+/i,
    condicional_2:      /\bif\s+(I|you|we|they|he|she|it)\s+(were|had|knew|could|did)\b.*\b(would|wouldn't|'d)\b/i,
    pasiva_impersonal:  /\bit's\s+(widely|generally|often|sometimes)\s+(recognised|known|said|believed|accepted)\b/i
  };

  // Estado interno
  var rec = null;             // SpeechRecognition activo
  var recAvailable = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  var prepTimer = null, ansTimer = null;
  var ansSecondsLeft = 0;
  var transcripcionAcumulada = '';
  var transcripcionInterim = '';
  var faseActual = 'idle';    // idle | preparando | hablando | terminado
  var parteActual = null;
  var temaActual = null;
  var subtareaIndex = 0;      // para preguntas con varias subrespuestas (Parte 1, 2, 3)
  var transcripcionesPorSubtarea = []; // array de strings, una por subtarea

  /* =============================================================================
   * INICIAR EXAMEN
   * partExam: objeto parte completo (con .examen, .temas, .label, etc.)
   * containerId: id del div donde montar todo el UI del examen
   * ============================================================================= */
  function iniciar(partExam, containerId, onFinishCallback) {
    parteActual = partExam;
    // Elegir tema aleatorio
    temaActual = partExam.temas[Math.floor(Math.random() * partExam.temas.length)];
    subtareaIndex = 0;
    transcripcionesPorSubtarea = [];
    transcripcionAcumulada = '';
    transcripcionInterim = '';
    faseActual = 'idle';

    var cont = document.getElementById(containerId);
    if (!cont) return;
    renderEstado(cont, onFinishCallback);
  }

  function renderEstado(cont, onFinish) {
    if (faseActual === 'idle') {
      renderInicio(cont, onFinish);
    } else if (faseActual === 'preparando') {
      renderPreparando(cont, onFinish);
    } else if (faseActual === 'hablando') {
      renderHablando(cont, onFinish);
    } else if (faseActual === 'terminado') {
      renderResultado(cont, onFinish);
    }
  }

  /* ----------- Pantalla 1: INICIO ----------- */
  function renderInicio(cont, onFinish) {
    var meta = parteActual.examen;
    var h = '<div class="examen-pantalla">';
    h += '<div class="examen-card">';
    h += '<p class="examen-step">PASO 1 · Empezar</p>';
    h += '<h3 class="examen-tema-titulo">🎲 Tema aleatorio: <strong>' + esc(temaActual.label) + '</strong></h3>';
    h += '<div class="examen-preguntas">';
    temaActual.preguntas.forEach(function (q, i) {
      h += '<p class="examen-pregunta-line"><span class="q-num">' + (i + 1) + '</span> ' + esc(q) + '</p>';
    });
    h += '</div>';

    h += '<div class="examen-info">';
    h += '<p>⏱ Preparación: <strong>' + meta.preparacion_segundos + ' seg</strong></p>';
    h += '<p>🎤 Respuesta: <strong>' + meta.respuesta_segundos + ' seg</strong>' + (meta.subtareas > 1 ? ' × ' + meta.subtareas + ' subtareas' : '') + '</p>';
    h += '<p>📱 Reconocimiento de voz: <strong>' + (recAvailable ? '✓ disponible' : '✗ no disponible · solo modo escribir') + '</strong></p>';
    h += '</div>';

    h += '<div class="examen-actions">';
    if (meta.preparacion_segundos > 0) {
      h += '<button class="btn btn-primary" id="btn-start-prep">▶ Empezar preparación (' + meta.preparacion_segundos + ' seg)</button>';
    } else {
      h += '<button class="btn btn-primary" id="btn-start-direct">▶ Empezar respuesta</button>';
    }
    h += '<button class="btn btn-secondary" id="btn-cambiar-tema">🔁 Otro tema</button>';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    cont.innerHTML = h;

    var btnPrep = document.getElementById('btn-start-prep');
    if (btnPrep) btnPrep.addEventListener('click', function () {
      faseActual = 'preparando';
      renderEstado(cont, onFinish);
    });
    var btnDirect = document.getElementById('btn-start-direct');
    if (btnDirect) btnDirect.addEventListener('click', function () {
      faseActual = 'hablando';
      renderEstado(cont, onFinish);
    });
    var btnCambiar = document.getElementById('btn-cambiar-tema');
    if (btnCambiar) btnCambiar.addEventListener('click', function () {
      iniciar(parteActual, cont.id, onFinish);
    });
  }

  /* ----------- Pantalla 2: PREPARACIÓN ----------- */
  function renderPreparando(cont, onFinish) {
    var meta = parteActual.examen;
    var segundos = meta.preparacion_segundos;

    var h = '<div class="examen-pantalla">';
    h += '<div class="examen-card examen-card-prep">';
    h += '<p class="examen-step">PASO 2 · Preparación</p>';
    h += '<div class="examen-cronometro" id="crono-prep">' + segundos + '</div>';
    h += '<p class="examen-instruccion">Lee las preguntas, decide tu kit (verbo, ayuda, drawbacks, historia). Cuando suene, empiezas a hablar.</p>';

    h += '<div class="examen-preguntas">';
    temaActual.preguntas.forEach(function (q, i) {
      h += '<p class="examen-pregunta-line"><span class="q-num">' + (i + 1) + '</span> ' + esc(q) + '</p>';
    });
    h += '</div>';

    // Chuleta del kit sugerido si existe
    if (temaActual.kit_sugerido) {
      var k = temaActual.kit_sugerido;
      h += '<div class="examen-kit">';
      h += '<p class="examen-kit-title">💡 Kit sugerido para este tema</p>';
      h += '<ul>';
      Object.keys(k).forEach(function (key) {
        var val = Array.isArray(k[key]) ? k[key].join(', ') : k[key];
        h += '<li><strong>' + esc(key.replace(/_/g, ' ')) + ':</strong> ' + esc(val) + '</li>';
      });
      h += '</ul>';
      h += '</div>';
    }

    h += '<button class="btn btn-secondary" id="btn-skip-prep">⏭ Saltar preparación</button>';
    h += '</div>';
    h += '</div>';
    cont.innerHTML = h;

    var crono = document.getElementById('crono-prep');
    var s = segundos;
    function tick() {
      s--;
      if (s < 0) {
        clearInterval(prepTimer);
        beep();
        faseActual = 'hablando';
        renderEstado(cont, onFinish);
        return;
      }
      crono.textContent = s;
      if (s <= 10) crono.classList.add('crono-warn');
      if (s <= 3) crono.classList.add('crono-final');
    }
    prepTimer = setInterval(tick, 1000);

    document.getElementById('btn-skip-prep').addEventListener('click', function () {
      clearInterval(prepTimer);
      faseActual = 'hablando';
      renderEstado(cont, onFinish);
    });
  }

  /* ----------- Pantalla 3: HABLANDO ----------- */
  function renderHablando(cont, onFinish) {
    var meta = parteActual.examen;
    ansSecondsLeft = meta.respuesta_segundos;

    var h = '<div class="examen-pantalla">';
    h += '<div class="examen-card examen-card-speak">';
    h += '<p class="examen-step">PASO 3 · Respuesta ' + (meta.subtareas > 1 ? '(' + (subtareaIndex + 1) + ' de ' + meta.subtareas + ')' : '') + '</p>';
    h += '<div class="examen-cronometro" id="crono-ans">' + ansSecondsLeft + '</div>';

    // Mostrar SOLO la pregunta actual si hay subtareas, o todas si solo es 1
    if (meta.subtareas > 1 && temaActual.preguntas[subtareaIndex]) {
      h += '<p class="examen-pregunta-grande">' + esc(temaActual.preguntas[subtareaIndex]) + '</p>';
    } else {
      h += '<div class="examen-preguntas">';
      temaActual.preguntas.forEach(function (q, i) {
        h += '<p class="examen-pregunta-line"><span class="q-num">' + (i + 1) + '</span> ' + esc(q) + '</p>';
      });
      h += '</div>';
    }

    // Selector de modo
    h += '<div class="examen-modo-tabs">';
    if (recAvailable) {
      h += '<button class="examen-modo-tab active" data-modo="voz">🎤 Hablar (voz)</button>';
    }
    h += '<button class="examen-modo-tab' + (recAvailable ? '' : ' active') + '" data-modo="texto">⌨ Escribir</button>';
    h += '</div>';

    // Área de transcripción / texto
    h += '<div class="examen-input-wrapper">';
    h += '<div class="examen-voz" id="examen-voz"' + (recAvailable ? '' : ' hidden') + '>';
    h += '<button class="examen-mic-btn" id="btn-mic">🎤 Pulsa para empezar a hablar</button>';
    h += '<div class="examen-transcripcion" id="examen-transcripcion" aria-live="polite"><em class="placeholder">Tu respuesta aparecerá aquí mientras hablas…</em></div>';
    h += '</div>';
    h += '<div class="examen-texto" id="examen-texto"' + (recAvailable ? ' hidden' : '') + '>';
    h += '<textarea class="examen-textarea" id="examen-textarea" placeholder="Escribe tu respuesta aquí…" rows="6"></textarea>';
    h += '</div>';
    h += '</div>';

    h += '<div class="examen-actions">';
    h += '<button class="btn btn-primary" id="btn-finalizar">⏹ Finalizar respuesta</button>';
    h += '</div>';

    h += '</div>';
    h += '</div>';
    cont.innerHTML = h;

    // Listeners
    document.querySelectorAll('.examen-modo-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.examen-modo-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var modo = b.dataset.modo;
        document.getElementById('examen-voz').hidden = (modo !== 'voz');
        document.getElementById('examen-texto').hidden = (modo !== 'texto');
        if (modo === 'voz' && rec) { /* ya iniciado */ }
        else { stopRecognition(); }
      });
    });

    var btnMic = document.getElementById('btn-mic');
    if (btnMic) btnMic.addEventListener('click', function () {
      if (rec) { stopRecognition(); btnMic.textContent = '🎤 Pulsa para empezar a hablar'; }
      else { startRecognition(); btnMic.textContent = '⏸ Pausar (estoy escuchándote)'; btnMic.classList.add('mic-active'); }
    });

    document.getElementById('btn-finalizar').addEventListener('click', function () {
      finalizarSubtarea(cont, onFinish);
    });

    // Cronómetro de respuesta
    var crono = document.getElementById('crono-ans');
    ansTimer = setInterval(function () {
      ansSecondsLeft--;
      if (ansSecondsLeft <= 0) {
        clearInterval(ansTimer);
        beep();
        finalizarSubtarea(cont, onFinish);
        return;
      }
      crono.textContent = ansSecondsLeft;
      if (ansSecondsLeft <= 15) crono.classList.add('crono-warn');
      if (ansSecondsLeft <= 5) crono.classList.add('crono-final');
    }, 1000);
  }

  function finalizarSubtarea(cont, onFinish) {
    clearInterval(ansTimer);
    stopRecognition();

    // Recoger la respuesta de la subtarea actual
    var respuesta = '';
    var ta = document.getElementById('examen-textarea');
    var modoActivo = document.querySelector('.examen-modo-tab.active');
    var modo = modoActivo ? modoActivo.dataset.modo : 'voz';
    if (modo === 'texto' && ta) {
      respuesta = ta.value.trim();
    } else {
      respuesta = transcripcionAcumulada.trim();
    }
    transcripcionesPorSubtarea.push(respuesta);
    transcripcionAcumulada = '';
    transcripcionInterim = '';

    var meta = parteActual.examen;
    if (meta.subtareas > 1 && subtareaIndex < meta.subtareas - 1) {
      // Siguiente subtarea
      subtareaIndex++;
      renderEstado(cont, onFinish);
    } else {
      // Terminado
      faseActual = 'terminado';
      renderEstado(cont, onFinish);
    }
  }

  /* ----------- Pantalla 4: RESULTADO ----------- */
  function renderResultado(cont, onFinish) {
    var totalTexto = transcripcionesPorSubtarea.join('\n\n').trim();
    var analisis = analizar(totalTexto);
    var ahora = new Date().toISOString();

    // Guardar en historial
    guardarHistorial({
      timestamp: ahora,
      parte_id: parteActual.id,
      tema_id: temaActual.id,
      tema_label: temaActual.label,
      respuesta: totalTexto,
      analisis: analisis
    });

    var h = '<div class="examen-pantalla">';
    h += '<div class="examen-card examen-card-result">';
    h += '<p class="examen-step">PASO 4 · Resultado</p>';
    h += '<h3 class="examen-tema-titulo">📊 Análisis automático</h3>';

    // Tarjetas de análisis
    h += '<div class="analisis-grid">';
    h += analisisCard('Palabras', analisis.palabras, analisis.palabras > 150 ? 'ok' : analisis.palabras > 80 ? 'warn' : 'bad');
    h += analisisCard('Conectores B2', analisis.conectores.length, analisis.conectores.length >= 3 ? 'ok' : analisis.conectores.length >= 1 ? 'warn' : 'bad');
    h += analisisCard('Idioms detectados', analisis.idioms.length, analisis.idioms.length >= 2 ? 'ok' : analisis.idioms.length >= 1 ? 'warn' : 'bad');
    h += analisisCard('Tiempos verbales', analisis.tiempos.length, analisis.tiempos.length >= 4 ? 'ok' : analisis.tiempos.length >= 2 ? 'warn' : 'bad');
    h += '</div>';

    // Detalle de tiempos verbales detectados
    h += '<div class="analisis-detalle">';
    h += '<h4>🔍 Tiempos verbales detectados</h4>';
    if (analisis.tiempos.length === 0) {
      h += '<p class="analisis-vacio">Ninguno detectado. Asegúrate de mezclar presente, pasado, condicional y futuro.</p>';
    } else {
      h += '<ul>';
      analisis.tiempos.forEach(function (t) { h += '<li>✓ ' + esc(t) + '</li>'; });
      h += '</ul>';
    }
    h += '</div>';

    h += '<div class="analisis-detalle">';
    h += '<h4>🔗 Conectores B2 usados</h4>';
    if (analisis.conectores.length === 0) {
      h += '<p class="analisis-vacio">Ninguno. Meter <em>however, whereas, although...</em> sube nota.</p>';
    } else {
      h += '<p class="chip-row">';
      analisis.conectores.forEach(function (c) { h += '<span class="chip chip-ok">' + esc(c) + '</span>'; });
      h += '</p>';
    }
    h += '</div>';

    h += '<div class="analisis-detalle">';
    h += '<h4>💎 Idioms B2/C1 usados</h4>';
    if (analisis.idioms.length === 0) {
      h += '<p class="analisis-vacio">Ninguno. Recuerda: <em>in a nutshell, double-edged sword, here to stay, lean towards...</em></p>';
    } else {
      h += '<p class="chip-row">';
      analisis.idioms.forEach(function (i) { h += '<span class="chip chip-idiom">' + esc(i) + '</span>'; });
      h += '</p>';
    }
    h += '</div>';

    // Comparación
    h += '<div class="analisis-detalle analisis-comparar">';
    h += '<h4>📝 Tu respuesta vs Modelo</h4>';
    h += '<div class="comparar-grid">';
    h += '<div class="comparar-col"><h5>Lo que dijiste</h5><p class="comparar-texto">' + esc(totalTexto || '(vacío)') + '</p></div>';
    h += '<div class="comparar-col comparar-modelo"><h5>Respuesta modelo</h5><p class="comparar-texto">' + esc(temaActual.respuesta_modelo) + '</p></div>';
    h += '</div>';
    h += '</div>';

    // Botones de acción
    h += '<div class="examen-actions examen-actions-result">';
    h += '<button class="btn btn-primary" id="btn-copiar-claude">📋 Copiar prompt para Claude</button>';
    h += '<button class="btn btn-secondary" id="btn-historial">📚 Ver historial</button>';
    h += '<button class="btn btn-primary" id="btn-otro-examen">🔁 Otro examen</button>';
    h += '</div>';

    h += '<details class="historial-details" id="historial-panel" hidden></details>';

    h += '</div>';
    h += '</div>';
    cont.innerHTML = h;

    document.getElementById('btn-copiar-claude').addEventListener('click', function () {
      var prompt = construirPromptClaude(totalTexto, analisis);
      copiarPortapapeles(prompt);
      this.textContent = '✓ Copiado · pégalo en Claude';
      var btn = this;
      setTimeout(function () { btn.textContent = '📋 Copiar prompt para Claude'; }, 3000);
    });

    document.getElementById('btn-otro-examen').addEventListener('click', function () {
      iniciar(parteActual, cont.id, onFinish);
    });

    document.getElementById('btn-historial').addEventListener('click', function () {
      mostrarHistorial();
    });
  }

  /* =============================================================================
   * RECONOCIMIENTO DE VOZ
   * ============================================================================= */
  function startRecognition() {
    if (!recAvailable) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new SR();
    rec.lang = 'en-GB';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = function (event) {
      var finalText = '';
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript + ' ';
        else interim += transcript;
      }
      if (finalText) transcripcionAcumulada += finalText;
      transcripcionInterim = interim;
      var div = document.getElementById('examen-transcripcion');
      if (div) {
        div.innerHTML = esc(transcripcionAcumulada) +
          (transcripcionInterim ? '<span class="interim">' + esc(transcripcionInterim) + '</span>' : '');
      }
    };
    rec.onerror = function (e) {
      console.warn('Speech error:', e.error);
      var div = document.getElementById('examen-transcripcion');
      if (div && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
        div.innerHTML = '<em style="color:#dc2626">Permiso de micrófono denegado. Permite el micrófono o usa el modo Escribir.</em>';
      }
    };
    rec.onend = function () {
      // Auto-reiniciar si seguimos en fase hablando
      if (faseActual === 'hablando' && rec) {
        try { rec.start(); } catch (e) { /* a veces choca, ignorar */ }
      }
    };
    try { rec.start(); } catch (e) { console.warn(e); }
  }

  function stopRecognition() {
    if (rec) {
      try { rec.onend = null; rec.stop(); } catch (e) {}
      rec = null;
    }
  }

  function beep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.1;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, 400);
    } catch (e) {}
  }

  /* =============================================================================
   * ANÁLISIS AUTOMÁTICO
   * ============================================================================= */
  function analizar(texto) {
    var lower = (texto || '').toLowerCase();
    var palabras = lower.trim().split(/\s+/).filter(Boolean).length;

    var conectores = [];
    CONECTORES_B2.forEach(function (c) {
      var regex = new RegExp('\\b' + c.replace(/'/g, "'?") + '\\b', 'i');
      if (regex.test(lower)) conectores.push(c);
    });

    var idioms = [];
    IDIOMS_B2.forEach(function (i) {
      if (lower.indexOf(i.toLowerCase()) >= 0) idioms.push(i);
    });

    var tiempos = [];
    Object.keys(PATRONES).forEach(function (k) {
      if (PATRONES[k].test(texto)) tiempos.push(k.replace(/_/g, ' '));
    });

    return { palabras: palabras, conectores: conectores, idioms: idioms, tiempos: tiempos };
  }

  function analisisCard(label, valor, estado) {
    var cls = 'ana-card ana-' + estado;
    return '<div class="' + cls + '"><span class="ana-val">' + valor + '</span><span class="ana-lbl">' + esc(label) + '</span></div>';
  }

  /* =============================================================================
   * EXPORT A CLAUDE
   * ============================================================================= */
  function construirPromptClaude(texto, analisis) {
    var p = 'Soy estudiante de Aptis ESOL nivel B2. He hecho un simulacro de ' + parteActual.label + ' (' + parteActual.subtitle + ').\n\n';
    p += 'TEMA: ' + temaActual.label + '\n\n';
    p += 'PREGUNTAS:\n';
    temaActual.preguntas.forEach(function (q, i) {
      p += (i + 1) + '. ' + q + '\n';
    });
    p += '\nMI RESPUESTA (transcrita, puede tener errores de reconocimiento):\n"' + texto + '"\n\n';
    p += 'RESPUESTA MODELO DE REFERENCIA:\n"' + temaActual.respuesta_modelo + '"\n\n';
    p += 'ANÁLISIS AUTOMÁTICO QUE HA HECHO LA APP:\n';
    p += '- Palabras totales: ' + analisis.palabras + '\n';
    p += '- Conectores B2 usados: ' + (analisis.conectores.join(', ') || 'ninguno') + '\n';
    p += '- Idioms detectados: ' + (analisis.idioms.join(', ') || 'ninguno') + '\n';
    p += '- Tiempos verbales detectados: ' + (analisis.tiempos.join(', ') || 'ninguno') + '\n\n';
    p += 'Por favor, evalúame:\n';
    p += '1. ¿Qué nivel CEFR estimas (B1, B2, C1)?\n';
    p += '2. ¿Qué tiempos verbales he usado bien? ¿Cuáles me faltan o he usado mal?\n';
    p += '3. ¿Qué conectores B2 he usado? ¿Cuáles podría meter para subir nivel?\n';
    p += '4. ¿Qué idioms / phrasal verbs me faltan?\n';
    p += '5. Errores gramaticales concretos que detectas.\n';
    p += '6. 3 cosas concretas que mejorar para sonar más B2/C1 en el examen real.\n';
    return p;
  }

  function copiarPortapapeles(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(function () { fallbackCopiar(texto); });
    } else {
      fallbackCopiar(texto);
    }
  }
  function fallbackCopiar(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* =============================================================================
   * HISTORIAL
   * ============================================================================= */
  function guardarHistorial(intento) {
    var s = SCORM.lsRead();
    if (!s.historial) s.historial = [];
    s.historial.unshift(intento);
    // Limitar a 50 entradas
    if (s.historial.length > 50) s.historial = s.historial.slice(0, 50);
    SCORM.lsWrite(s);
  }

  function leerHistorial() {
    var s = SCORM.lsRead();
    return s.historial || [];
  }

  function mostrarHistorial() {
    var hist = leerHistorial();
    var panel = document.getElementById('historial-panel');
    if (!panel) return;
    var h = '<summary>📚 Historial · ' + hist.length + ' intentos</summary>';
    if (hist.length === 0) {
      h += '<p class="analisis-vacio">Aún no hay intentos guardados.</p>';
    } else {
      hist.forEach(function (it, idx) {
        var d = new Date(it.timestamp);
        h += '<div class="hist-item">';
        h += '<p class="hist-line"><strong>' + d.toLocaleString() + '</strong> · ' + esc(it.parte_id) + ' · ' + esc(it.tema_label);
        h += ' · ' + it.analisis.palabras + ' palabras · ' + it.analisis.idioms.length + ' idioms</p>';
        h += '<details><summary>Ver respuesta</summary><p class="hist-resp">' + esc(it.respuesta || '(vacía)') + '</p></details>';
        h += '</div>';
      });
    }
    panel.innerHTML = h;
    panel.hidden = false;
    panel.open = true;
  }

  /* =============================================================================
   * UTILS
   * ============================================================================= */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.Examen = { iniciar: iniciar };
})();
