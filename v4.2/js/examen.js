/* =============================================================================
 * Aptis Speaking v4.2 · examen.js
 *
 * NOVEDADES v4.2:
 * - Las 3 preguntas se hacen SEPARADAS, cada una con cronómetro propio.
 * - Modo Simulacro Completo: las 4 partes seguidas, 12 min reales.
 * - Generación de PDF descargable con todo (preguntas + respuestas + análisis).
 * - Compatible con plantillas múltiples (Parte 1 con A/B/C según tipo pregunta).
 * ============================================================================= */
window.Examen = (function () {
  'use strict';

  const HIST_KEY = 'aptis_examen_v4_2';
  const MAX_HIST = 50;

  const CONECTORES_B2 = [
    'moreover', 'furthermore', 'however', 'nevertheless', 'whereas', 'although',
    'even though', 'in spite of', 'despite', 'on top of that', 'on the other hand',
    'as a result', 'consequently', 'therefore', 'in addition', 'besides',
    "what's more", 'apart from that', 'in contrast', 'on the flip side',
    'last but not least', 'first of all', 'to begin with', 'in conclusion',
    'all in all', 'to sum up', 'on the grounds that', 'due to', 'owing to',
    'in a nutshell', 'all things considered', 'at the end of the day'
  ];
  const IDIOMS_B2 = [
    'a piece of cake', 'cost an arm and a leg', 'all that glitters is not gold',
    'break the language barrier', 'read between the lines', 'a double-edged sword',
    'here to stay', 'in a nutshell', 'all things considered', 'at the end of the day',
    'bear in mind', 'cut down on', 'be at stake', 'for better or for worse',
    'take a load off my mind', "it's a no-brainer", 'lean towards',
    'broaden my horizons', 'recharge my batteries', 'switch off', 'unwind',
    'find the right balance', 'make my day', 'make all the difference',
    'follow your gut', 'sense of belonging'
  ];
  const TIEMPOS = [
    { id: 'pres_simple',   label: 'Presente simple',   re: /\b(I|you|we|they)\s+(do|does|don't|doesn't|like|enjoy|prefer|think|feel|believe|want|need|have|has)\b/i },
    { id: 'pres_cont',     label: 'Presente continuo', re: /\b(am|is|are)\s+\w+ing\b/i },
    { id: 'pasado_simple', label: 'Pasado simple',     re: /\b(went|did|had|was|were|saw|made|took|came|got|enjoyed|visited|decided|tried|learnt|learned|cooked|travelled|moved|spent|told|caught|brought)\b/i },
    { id: 'pasado_cont',   label: 'Pasado continuo',   re: /\b(was|were)\s+\w+ing\b/i },
    { id: 'pres_perf',     label: 'Presente perfecto', re: /\b(have|has|i've|we've|they've|i´ve)\s+(been|gone|done|seen|made|taken|come|got|gotten|learnt|learned|discovered|met|shared|developed|noticed|broadened|lived|worked|cooked|started|finished)\b/i },
    { id: 'futuro',        label: 'Futuro',            re: /\b(will|won't|going to)\s+\w+/i },
    { id: 'cond2',         label: 'Condicional 2',     re: /\bif\s+\w+\s+(were|had|did|could)\b.*\bwould\b/i },
    { id: 'inversion',     label: 'Inversión C1',      re: /\b(were\s+I|not only\s+(does|do|did|can|could|will|would|am|is|are)|hardly had|little did|only by)\b/i }
  ];

  let state = null;
  let host = null;

  // ============================================================================
  // MOUNT — entrada principal desde motor.js
  // ============================================================================
  function mount(targetEl, parteId, parteData) {
    host = targetEl;
    state = {
      parteId,
      parteData,
      tema: parteData.temas[0],
      preguntasActuales: null,        // {a, b, c}
      respuestas: ['', '', ''],       // 3 transcripciones
      preguntaActiva: 0,              // 0, 1, 2
      fase: 'config',                  // config | preparacion | hablando | entre | analisis | simulacro_*
      tiempoRestante: 0,
      timer: null,
      recognition: null,
      modoInput: 'voz',
      // Simulacro completo
      esSimulacro: false,
      simulacroIdx: 0,                 // 0..3 (partes)
      simulacroDatos: null             // {partes: [{id, tema, preguntas, respuestas}]}
    };
    render();
  }

  function render() {
    switch (state.fase) {
      case 'config':              renderConfig(); break;
      case 'preparacion':         renderPreparacion(); break;
      case 'hablando':            renderHablando(); break;
      case 'entre':               renderEntre(); break;
      case 'analisis':            renderAnalisis(); break;
      case 'simulacro_inicio':    renderSimulacroInicio(); break;
      case 'simulacro_parte':     renderSimulacroParte(); break;
      case 'simulacro_final':     renderSimulacroFinal(); break;
    }
  }

  // ============================================================================
  // CONFIG — pantalla inicial
  // ============================================================================
  function renderConfig() {
    const p = state.parteData;
    const t = state.tema;
    if (!state.preguntasActuales) state.preguntasActuales = combinarPreguntas(t);
    const ps = state.preguntasActuales;

    const tiempoTotal = p.examen.subtareas * p.examen.respuesta_segundos;

    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card">
          <p class="examen-step">PRÁCTICA POR PARTE · ${escapeHtml(p.label)}</p>
          <h3 class="examen-tema-titulo">🎯 Configura tu intento</h3>

          <div class="aplicado-controls" style="margin-bottom:1rem">
            <div class="aplicado-col">
              <label class="aplicado-label" for="ex-tema-select">Tema</label>
              <select id="ex-tema-select" class="tema-select">
                ${p.temas.map(tt => `<option value="${tt.id}" ${tt.id === t.id ? 'selected' : ''}>${escapeHtml(tt.label)}</option>`).join('')}
              </select>
            </div>
            <div class="aplicado-col">
              <label class="aplicado-label">&nbsp;</label>
              <button class="btn" id="ex-shuffle">🎲 Otras preguntas</button>
            </div>
          </div>

          <div class="examen-preguntas">
            <p class="examen-step">Las 3 preguntas de este intento:</p>
            <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
            <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
            <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
          </div>

          <div class="examen-info">
            <p>⏱ <strong>${p.examen.subtareas} preguntas × ${p.examen.respuesta_segundos} seg</strong> = ${tiempoTotal} seg total.</p>
            <p>🎯 Cada pregunta tiene su cronómetro propio. Como en el examen real.</p>
            <p>📚 Banco de <strong>${contarBanco(t)} preguntas</strong> · combinaciones casi infinitas.</p>
          </div>

          <div class="examen-modo-tabs" role="tablist">
            <button class="examen-modo-tab ${state.modoInput === 'voz' ? 'active' : ''}" data-modo="voz">🎙️ Voz</button>
            <button class="examen-modo-tab ${state.modoInput === 'texto' ? 'active' : ''}" data-modo="texto">⌨️ Texto</button>
          </div>

          <div class="examen-actions">
            <button class="btn btn-primary" id="ex-start">▶ Empezar</button>
          </div>
        </div>
      </div>
    `;
    bindConfig();
  }

  function bindConfig() {
    const sel = document.getElementById('ex-tema-select');
    if (sel) sel.addEventListener('change', () => {
      state.tema = state.parteData.temas.find(t => t.id === sel.value);
      state.preguntasActuales = combinarPreguntas(state.tema);
      render();
    });
    const sh = document.getElementById('ex-shuffle');
    if (sh) sh.addEventListener('click', () => {
      state.preguntasActuales = combinarPreguntas(state.tema);
      render();
    });
    document.querySelectorAll('.examen-modo-tab').forEach(b => {
      b.addEventListener('click', () => {
        state.modoInput = b.dataset.modo;
        render();
      });
    });
    document.getElementById('ex-start').addEventListener('click', empezar);
  }

  function combinarPreguntas(tema) {
    const bp = tema.banco_preguntas || {};
    const pick = arr => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '';
    return { a: pick(bp.bloque_a), b: pick(bp.bloque_b), c: pick(bp.bloque_c) };
  }
  function contarBanco(tema) {
    const bp = tema.banco_preguntas || {};
    return (bp.bloque_a || []).length + (bp.bloque_b || []).length + (bp.bloque_c || []).length;
  }

  // ============================================================================
  // EMPEZAR — flujo de las 3 preguntas separadas
  // ============================================================================
  function empezar() {
    const p = state.parteData;
    state.respuestas = ['', '', ''];
    state.preguntaActiva = 0;
    if (p.examen.preparacion_segundos > 0) {
      state.fase = 'preparacion';
      state.tiempoRestante = p.examen.preparacion_segundos;
      render();
      startTimer(() => iniciarPreguntaActiva());
    } else {
      iniciarPreguntaActiva();
    }
  }

  function renderPreparacion() {
    const p = state.parteData;
    const ps = state.preguntasActuales;
    const t = state.tema;
    const esP4 = state.parteId === 'parte-4';
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-prep">
          <p class="examen-step">PREPARACIÓN</p>
          <h3 class="examen-tema-titulo">📝 ${escapeHtml(t.label)}</h3>
          ${esP4 ? `
            <div class="examen-preguntas">
              <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
              <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
              <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
            </div>
          ` : ''}
          ${renderKitTema(t)}
          <div class="examen-cronometro" id="ex-crono">${state.tiempoRestante}</div>
          <p class="examen-instruccion">⏱ Tiempo de preparación</p>
          <div class="examen-actions">
            <button class="btn" id="ex-skip">⏭ Saltar al habla</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('ex-skip').addEventListener('click', () => {
      stopTimer();
      iniciarPreguntaActiva();
    });
  }
  function renderKitTema(t) {
    const k = t.kit_sugerido;
    if (!k) return '';
    return `
      <div class="examen-kit">
        <p class="examen-kit-title">💡 Kit sugerido para "${escapeHtml(t.label)}"</p>
        <ul>
          <li>Tema EN: <strong>${escapeHtml(k.tema_en)}</strong></li>
          <li>Verbo paso 2: <strong>${escapeHtml(k.verbo)}</strong></li>
          <li>Ayuda (helps us): <strong>${escapeHtml(k.ayuda)}</strong></li>
          ${k.drawbacks ? `<li>Drawbacks: <strong>${escapeHtml(k.drawbacks.join(' / '))}</strong></li>` : ''}
        </ul>
      </div>
    `;
  }

  function iniciarPreguntaActiva() {
    const p = state.parteData;
    // Si es Parte 4 (monólogo único), tratamos las 3 preguntas como un solo bloque de 2 min
    if (state.parteId === 'parte-4') {
      state.fase = 'hablando';
      state.tiempoRestante = p.examen.respuesta_segundos;
      state.preguntaActiva = 0; // bloque único
      render();
      if (state.modoInput === 'voz') startRecognition();
      startTimer(() => finalizarP4());
      return;
    }
    // Partes 1, 2, 3: pregunta separada con su cronómetro
    state.fase = 'hablando';
    state.tiempoRestante = p.examen.respuesta_segundos;
    render();
    if (state.modoInput === 'voz') startRecognition();
    startTimer(() => terminarPreguntaActiva());
  }

  // ============================================================================
  // HABLANDO — pantalla con cronómetro y entrada (voz/texto)
  // ============================================================================
  function renderHablando() {
    const ps = state.preguntasActuales;
    const t = state.tema;
    const p = state.parteData;
    const idx = state.preguntaActiva;
    const preguntaActual = state.parteId === 'parte-4'
      ? `<div class="examen-preguntas">
          <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
          <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
          <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
        </div>`
      : `<div class="examen-preguntas">
          <p class="examen-pregunta-line examen-pregunta-actual"><span class="q-num">${idx + 1}</span>${escapeHtml([ps.a, ps.b, ps.c][idx])}</p>
          <p class="examen-instruccion-extra">Pregunta ${idx + 1} de 3 · ${p.examen.respuesta_segundos} seg</p>
        </div>`;
    const inputHtml = state.modoInput === 'voz'
      ? `
        <button class="examen-mic-btn" id="ex-mic">🎙️ Activar micrófono</button>
        <div class="examen-transcripcion" id="ex-transcripcion"><span class="placeholder">Tu transcripción aparecerá aquí…</span></div>
      `
      : `
        <textarea class="examen-textarea" id="ex-textarea" placeholder="Escribe tu respuesta…">${escapeHtml(state.respuestas[idx])}</textarea>
        <p class="examen-instruccion">Modo texto.</p>
      `;
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-speak">
          <p class="examen-step">${state.parteId === 'parte-4' ? 'MONÓLOGO 2 MIN' : 'PREGUNTA ' + (idx + 1) + ' DE 3'} · ${escapeHtml(t.label)}</p>
          ${preguntaActual}
          <div class="examen-cronometro" id="ex-crono">${formatoTiempo(state.tiempoRestante)}</div>
          ${inputHtml}
          <div class="examen-actions" style="margin-top:1rem">
            <button class="btn btn-primary" id="ex-end">⏹ ${state.parteId === 'parte-4' || idx === 2 ? 'Terminar' : 'Siguiente pregunta'}</button>
          </div>
        </div>
      </div>
    `;
    bindHablando();
  }
  function bindHablando() {
    const end = document.getElementById('ex-end');
    if (end) end.addEventListener('click', () => {
      stopTimer();
      if (state.parteId === 'parte-4') finalizarP4();
      else terminarPreguntaActiva();
    });
    const mic = document.getElementById('ex-mic');
    if (mic) mic.addEventListener('click', () => {
      if (state.recognition && state.recognition._active) stopRecognition();
      else startRecognition();
    });
    const ta = document.getElementById('ex-textarea');
    if (ta) ta.addEventListener('input', () => {
      state.respuestas[state.preguntaActiva] = ta.value;
    });
  }

  function startRecognition() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      const tr = document.getElementById('ex-transcripcion');
      if (tr) tr.innerHTML = '<span class="placeholder">⚠️ Tu navegador no soporta voz. Usa Texto.</span>';
      return;
    }
    try {
      const r = new Rec();
      r.lang = 'en-GB'; r.continuous = true; r.interimResults = true;
      r._active = true;
      state.recognition = r;
      const baseTexto = state.respuestas[state.preguntaActiva] || '';
      r.onresult = (e) => {
        let interim = '';
        let nuevoFinal = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) nuevoFinal += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        if (nuevoFinal) state.respuestas[state.preguntaActiva] += nuevoFinal;
        const tr = document.getElementById('ex-transcripcion');
        if (tr) {
          tr.innerHTML = escapeHtml(state.respuestas[state.preguntaActiva]) +
            (interim ? `<span class="interim">${escapeHtml(interim)}</span>` : '');
        }
      };
      r.onerror = (ev) => {
        console.warn('Recognition error', ev.error);
        const tr = document.getElementById('ex-transcripcion');
        if (tr && !state.respuestas[state.preguntaActiva]) tr.innerHTML = '<span class="placeholder">⚠️ Permiso denegado. Usa Texto.</span>';
      };
      r.onend = () => { r._active = false; };
      r.start();
      const mic = document.getElementById('ex-mic');
      if (mic) { mic.textContent = '🛑 Detener'; mic.classList.add('mic-active'); }
    } catch (err) { console.error('No se pudo iniciar reconocimiento', err); }
  }
  function stopRecognition() {
    if (state.recognition) {
      try { state.recognition.stop(); } catch(_) {}
      state.recognition._active = false;
    }
    const mic = document.getElementById('ex-mic');
    if (mic) { mic.textContent = '🎙️ Activar micrófono'; mic.classList.remove('mic-active'); }
  }

  // ============================================================================
  // FIN DE PREGUNTA — pasar a la siguiente o cerrar
  // ============================================================================
  function terminarPreguntaActiva() {
    stopRecognition();
    stopTimer();
    if (state.preguntaActiva < 2) {
      state.fase = 'entre';
      state.tiempoRestante = 3; // breve transición
      render();
      startTimer(() => {
        state.preguntaActiva++;
        iniciarPreguntaActiva();
      });
    } else {
      // Última pregunta terminada
      if (state.esSimulacro) {
        guardarSimulacroParte();
        avanzarSimulacro();
      } else {
        state.fase = 'analisis';
        render();
      }
    }
  }

  function renderEntre() {
    const idx = state.preguntaActiva;
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-prep">
          <p class="examen-step">CAMBIO DE PREGUNTA</p>
          <h3 class="examen-tema-titulo">🔔 Pregunta ${idx + 1} terminada</h3>
          <p class="examen-instruccion">Preparándote para la pregunta ${idx + 2} de 3…</p>
          <div class="examen-cronometro" id="ex-crono">${state.tiempoRestante}</div>
        </div>
      </div>
    `;
  }

  function finalizarP4() {
    stopRecognition();
    stopTimer();
    if (state.esSimulacro) {
      guardarSimulacroParte();
      avanzarSimulacro();
    } else {
      state.fase = 'analisis';
      render();
    }
  }

  // ============================================================================
  // ANÁLISIS — pantalla de resultado (modo PRÁCTICA SUELTA)
  // ============================================================================
  function renderAnalisis() {
    const t = state.tema;
    const ps = state.preguntasActuales;
    // Combinar las 3 respuestas para análisis global
    const texto = state.respuestas.join(' \n ').trim();
    const a = analizarTexto(texto, state.parteData.examen.subtareas * state.parteData.examen.respuesta_segundos);

    const intento = {
      fecha: new Date().toLocaleString('es-ES'),
      parte: state.parteId,
      tema: t.label,
      preguntas: ps,
      respuestas: state.respuestas.slice(),
      score: a.score,
      longitud: a.longitud,
      conectores: a.conectoresEnc.length,
      idioms: a.idiomsEnc.length,
      tiempos: a.tiemposEnc.length,
      transcripcion: texto
    };
    guardarIntento(intento);

    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-result">
          <p class="examen-step">RESULTADO</p>
          <h3 class="examen-tema-titulo">📊 Análisis · ${escapeHtml(t.label)}</h3>

          ${renderAnalisisCard(a)}

          <div class="analisis-detalle">
            <h4>📝 Tus 3 respuestas</h4>
            ${[ps.a, ps.b, ps.c].map((q, i) => `
              <details ${i === 0 ? 'open' : ''} style="margin:0.5rem 0">
                <summary><strong>Q${i+1}:</strong> ${escapeHtml(q)}</summary>
                <p class="hist-resp">${escapeHtml(state.respuestas[i] || '(sin respuesta)')}</p>
              </details>
            `).join('')}
          </div>

          <div class="analisis-detalle analisis-comparar">
            <h4>🆚 Respuesta modelo</h4>
            <p class="comparar-texto">${escapeHtml(t.respuesta_modelo_a || t.respuesta_modelo || '(sin modelo)')}</p>
          </div>

          <div class="examen-info" style="text-align:center">
            <p style="font-size:1.4rem;font-weight:800;color:var(--accent)">📈 Puntuación estimada: ${a.score}%</p>
            <p style="font-size:0.8rem;color:var(--ink-muted)">${interpretarScore(a.score)}</p>
          </div>

          <div class="examen-actions examen-actions-result">
            <button class="btn btn-primary" id="ex-pdf">📄 Descargar PDF</button>
            <button class="btn" id="ex-claude">📋 Copiar prompt para Claude</button>
            <button class="btn" id="ex-retry">🔁 Otro intento</button>
          </div>
        </div>
      </div>
    `;
    bindAnalisis(intento);
  }

  function renderAnalisisCard(a) {
    const objL = a.longitudObjetivo;
    return `
      <div class="analisis-grid">
        <div class="ana-card ${a.longitud >= objL ? 'ana-ok' : (a.longitud >= objL*0.7 ? 'ana-warn' : 'ana-bad')}">
          <span class="ana-val">${a.longitud}</span><span class="ana-lbl">Palabras</span>
        </div>
        <div class="ana-card ${a.conectoresEnc.length >= 3 ? 'ana-ok' : (a.conectoresEnc.length >= 1 ? 'ana-warn' : 'ana-bad')}">
          <span class="ana-val">${a.conectoresEnc.length}</span><span class="ana-lbl">Conectores</span>
        </div>
        <div class="ana-card ${a.idiomsEnc.length >= 1 ? 'ana-ok' : 'ana-warn'}">
          <span class="ana-val">${a.idiomsEnc.length}</span><span class="ana-lbl">Idioms</span>
        </div>
        <div class="ana-card ${a.tiemposEnc.length >= 4 ? 'ana-ok' : (a.tiemposEnc.length >= 2 ? 'ana-warn' : 'ana-bad')}">
          <span class="ana-val">${a.tiemposEnc.length}</span><span class="ana-lbl">Tiempos</span>
        </div>
      </div>
      <div class="analisis-detalle">
        <h4>Tiempos verbales detectados</h4>
        ${a.tiemposEnc.length
          ? `<ul>${a.tiemposEnc.map(t => `<li>✅ ${escapeHtml(t.label)}</li>`).join('')}</ul>`
          : '<p class="analisis-vacio">Ninguno. Mezcla presente + pasado + futuro.</p>'}
      </div>
      <div class="analisis-detalle">
        <h4>Conectores e idioms</h4>
        <div class="chip-row">
          ${a.conectoresEnc.map(c => `<span class="chip chip-ok">${escapeHtml(c)}</span>`).join('')}
          ${a.idiomsEnc.map(i => `<span class="chip chip-idiom">${escapeHtml(i)}</span>`).join('')}
        </div>
        ${(!a.conectoresEnc.length && !a.idiomsEnc.length) ? '<p class="analisis-vacio">Nada detectado.</p>' : ''}
      </div>
    `;
  }

  function bindAnalisis(intento) {
    document.getElementById('ex-pdf').addEventListener('click', () => generarPDF([intento], false));
    document.getElementById('ex-claude').addEventListener('click', () => copiarPromptClaude(intento));
    document.getElementById('ex-retry').addEventListener('click', () => {
      state.fase = 'config';
      state.preguntasActuales = combinarPreguntas(state.tema);
      state.respuestas = ['', '', ''];
      render();
    });
  }

  function analizarTexto(texto, segundosTotal) {
    const lower = texto.toLowerCase();
    const palabras = texto ? texto.split(/\s+/).filter(Boolean) : [];
    const longitud = palabras.length;
    const conectoresEnc = CONECTORES_B2.filter(c => lower.indexOf(c) >= 0);
    const idiomsEnc = IDIOMS_B2.filter(i => lower.indexOf(i) >= 0);
    const tiemposEnc = TIEMPOS.filter(t => t.re.test(texto));
    // Objetivo: ~2.2 palabras/segundo en B2 alto
    let longitudObjetivo = 80;
    if (segundosTotal <= 30)       longitudObjetivo = 70;
    else if (segundosTotal <= 90)  longitudObjetivo = 200;
    else if (segundosTotal <= 135) longitudObjetivo = 280;
    else                            longitudObjetivo = 250;
    // Score
    let s = 0;
    s += Math.min(40, Math.round(40 * longitud / longitudObjetivo));
    s += Math.min(25, conectoresEnc.length * 6);
    s += Math.min(15, idiomsEnc.length * 8);
    s += Math.min(20, tiemposEnc.length * 4);
    const score = Math.max(0, Math.min(100, s));
    return { longitud, longitudObjetivo, conectoresEnc, idiomsEnc, tiemposEnc, score };
  }
  function interpretarScore(s) {
    if (s >= 80) return '🔥 Nivel B2 alto / C1.';
    if (s >= 65) return '👍 Zona B2 sólida.';
    if (s >= 50) return '📈 B1-B2. Suma conectores e idioms.';
    if (s >= 30) return '🌱 B1. Habla más, mete conectores.';
    return '🚧 Practica con la plantilla.';
  }

  // ============================================================================
  // PROMPT PARA CLAUDE
  // ============================================================================
  function copiarPromptClaude(intento) {
    const partNum = intento.parte.split('-')[1];
    const prompt =
`Soy un estudiante preparando el Aptis ESOL General Speaking (apunto a C1).
Acabo de hacer la Parte ${partNum} (tema: ${intento.tema}).

PREGUNTAS Y RESPUESTAS:

Q1: ${intento.preguntas.a}
RESPUESTA: ${intento.respuestas[0] || '(vacía)'}

Q2: ${intento.preguntas.b}
RESPUESTA: ${intento.respuestas[1] || '(vacía)'}

Q3: ${intento.preguntas.c}
RESPUESTA: ${intento.respuestas[2] || '(vacía)'}

Evalúame como examinador Aptis:
1. Nivel CEFR aproximado por respuesta + global.
2. 3 errores gramaticales más graves con corrección.
3. 3 sugerencias concretas para subir a C1.
4. Versión mejorada de mis respuestas.`;
    try {
      navigator.clipboard.writeText(prompt);
      alert('✅ Prompt copiado. Pégalo en una conversación con Claude.');
    } catch (_) {
      window.prompt('Copia el prompt manualmente:', prompt);
    }
  }

  // ============================================================================
  // SIMULACRO COMPLETO — 4 partes seguidas
  // ============================================================================
  function iniciarSimulacro() {
    state.esSimulacro = true;
    state.simulacroIdx = 0;
    state.simulacroDatos = { partes: [], inicio: new Date() };
    state.fase = 'simulacro_inicio';
    render();
  }

  function renderSimulacroInicio() {
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-result" style="border-top-color:var(--bad)">
          <p class="examen-step">🔥 SIMULACRO COMPLETO</p>
          <h3 class="examen-tema-titulo">Aptis Speaking · 12 minutos</h3>
          <div class="examen-info">
            <p>📋 <strong>4 partes seguidas:</strong></p>
            <p>• Parte 1 · 3×30 seg = 90 seg</p>
            <p>• Parte 2 · 3×45 seg = 135 seg</p>
            <p>• Parte 3 · 3×45 seg = 135 seg</p>
            <p>• Parte 4 · 60 seg prep + 2 min = 180 seg</p>
            <p style="margin-top:0.7rem"><strong>Total: ~12 min sin pausas reales</strong></p>
          </div>
          <div class="examen-info" style="background:#fef2f2;border-left:3px solid var(--bad)">
            <p><strong>⚠️ Esto es un simulacro REAL.</strong></p>
            <p>• Una sola toma, sin parar.</p>
            <p>• Al final descargas un PDF con todas tus respuestas.</p>
            <p>• Lo subes al chat evaluador externo y recibes feedback global.</p>
          </div>
          <div class="examen-actions">
            <button class="btn btn-primary" id="ex-simu-start">▶ Empezar simulacro</button>
            <button class="btn btn-secondary" id="ex-simu-cancel">Cancelar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('ex-simu-start').addEventListener('click', () => {
      // Cargar parte 1
      cargarSimulacroParte(0);
    });
    document.getElementById('ex-simu-cancel').addEventListener('click', () => {
      state.esSimulacro = false;
      state.simulacroDatos = null;
      state.fase = 'config';
      render();
    });
  }

  async function cargarSimulacroParte(idx) {
    state.simulacroIdx = idx;
    const partes = ['parte-1','parte-2','parte-3','parte-4'];
    const id = partes[idx];
    // Si ya tenemos los datos en window.data, reutilizamos
    let parteData;
    if (window.data && window.data[id]) {
      parteData = window.data[id];
    } else {
      parteData = await fetch(`js/contenidos/${id}.json`).then(r => r.json());
    }
    state.parteId = id;
    state.parteData = parteData;
    state.tema = parteData.temas[Math.floor(Math.random() * parteData.temas.length)];
    state.preguntasActuales = combinarPreguntas(state.tema);
    state.respuestas = ['', '', ''];
    state.preguntaActiva = 0;
    state.fase = 'simulacro_parte';
    render();
  }

  function renderSimulacroParte() {
    const p = state.parteData;
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-prep">
          <p class="examen-step">SIMULACRO · ${state.simulacroIdx + 1} / 4</p>
          <h3 class="examen-tema-titulo">${escapeHtml(p.label)} · ${escapeHtml(state.tema.label)}</h3>
          <div class="examen-info">
            <p>⏱ <strong>${p.examen.subtareas} pregunta${p.examen.subtareas > 1 ? 's' : ''} × ${p.examen.respuesta_segundos} seg</strong></p>
            ${p.examen.preparacion_segundos > 0 ? `<p>🧠 Tendrás ${p.examen.preparacion_segundos} seg de preparación primero.</p>` : ''}
            <p style="margin-top:0.5rem">Cuando estés listo, pulsa ▶.</p>
          </div>
          <div class="examen-actions">
            <button class="btn btn-primary" id="ex-simu-go">▶ Empezar ${p.label}</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('ex-simu-go').addEventListener('click', empezar);
  }

  function guardarSimulacroParte() {
    state.simulacroDatos.partes.push({
      parteId: state.parteId,
      parteLabel: state.parteData.label,
      tema: state.tema.label,
      preguntas: state.preguntasActuales,
      respuestas: state.respuestas.slice(),
      respuestaModelo: state.tema.respuesta_modelo_a || state.tema.respuesta_modelo || ''
    });
  }

  function avanzarSimulacro() {
    if (state.simulacroIdx < 3) {
      cargarSimulacroParte(state.simulacroIdx + 1);
    } else {
      state.simulacroDatos.fin = new Date();
      state.fase = 'simulacro_final';
      render();
    }
  }

  function renderSimulacroFinal() {
    const sd = state.simulacroDatos;
    // Análisis global
    const textoTotal = sd.partes.map(p => p.respuestas.join(' ')).join(' \n ');
    const a = analizarTexto(textoTotal, 12 * 60); // 12 min
    const duracionReal = Math.round((sd.fin - sd.inicio) / 1000);

    // Guardar como intento agregado
    const intentoGlobal = {
      fecha: new Date().toLocaleString('es-ES'),
      parte: 'simulacro',
      tema: 'Simulacro completo',
      simulacro: sd,
      score: a.score,
      longitud: a.longitud,
      transcripcion: textoTotal
    };
    guardarIntento(intentoGlobal);

    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-result" style="border-top-color:var(--bad)">
          <p class="examen-step">🔥 SIMULACRO COMPLETO TERMINADO</p>
          <h3 class="examen-tema-titulo">🎉 ¡Lo has hecho!</h3>
          <div class="examen-info">
            <p>⏱ Duración: <strong>${Math.floor(duracionReal/60)}:${(duracionReal%60).toString().padStart(2,'0')}</strong></p>
            <p>📝 Palabras totales: <strong>${a.longitud}</strong></p>
            <p>📈 Puntuación global: <strong>${a.score}%</strong></p>
            <p>${interpretarScore(a.score)}</p>
          </div>

          ${renderAnalisisCard(a)}

          <div class="analisis-detalle">
            <h4>📋 Resumen por parte</h4>
            ${sd.partes.map((part, i) => `
              <details style="margin:0.5rem 0">
                <summary><strong>${escapeHtml(part.parteLabel)}</strong> · ${escapeHtml(part.tema)}</summary>
                ${part.respuestas.map((r, j) => `
                  <p class="hist-line"><strong>Q${j+1}:</strong> ${escapeHtml([part.preguntas.a, part.preguntas.b, part.preguntas.c][j])}</p>
                  <p class="hist-resp">${escapeHtml(r || '(sin respuesta)')}</p>
                `).join('')}
              </details>
            `).join('')}
          </div>

          <div class="examen-info" style="background:#fffbeb;border-left:3px solid var(--accent);margin-top:1rem">
            <p><strong>📄 Siguiente paso:</strong></p>
            <p>1. Descarga el PDF con todo el simulacro.</p>
            <p>2. Súbelo al chat evaluador externo.</p>
            <p>3. Recibe corrección global por escrito.</p>
          </div>

          <div class="examen-actions examen-actions-result">
            <button class="btn btn-primary" id="ex-pdf-simu" style="background:var(--bad);border-color:var(--bad)">📄 Descargar PDF completo</button>
            <button class="btn" id="ex-claude-simu">📋 Copiar prompt para Claude</button>
            <button class="btn btn-secondary" id="ex-simu-end">🏠 Volver</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('ex-pdf-simu').addEventListener('click', () => generarPDFSimulacro(sd, a, duracionReal));
    document.getElementById('ex-claude-simu').addEventListener('click', () => copiarPromptSimulacro(sd, a));
    document.getElementById('ex-simu-end').addEventListener('click', () => {
      state.esSimulacro = false;
      state.simulacroDatos = null;
      state.fase = 'config';
      // Recargar parte 1 datos
      state.parteId = 'parte-1';
      state.parteData = window.data['parte-1'];
      state.tema = state.parteData.temas[0];
      render();
    });
  }

  function copiarPromptSimulacro(sd, a) {
    let prompt = `Soy un estudiante preparando el Aptis ESOL General Speaking (apunto a C1).
Acabo de completar un SIMULACRO COMPLETO de las 4 partes.

ANÁLISIS AUTOMÁTICO LOCAL:
- Palabras totales: ${a.longitud}
- Conectores B2 detectados: ${a.conectoresEnc.length}
- Idioms C1 detectados: ${a.idiomsEnc.length}
- Tiempos verbales: ${a.tiemposEnc.map(t => t.label).join(', ') || 'ninguno'}
- Puntuación local: ${a.score}%

`;
    sd.partes.forEach((part, i) => {
      prompt += `\n═══ ${part.parteLabel.toUpperCase()} · ${part.tema} ═══\n`;
      [part.preguntas.a, part.preguntas.b, part.preguntas.c].forEach((q, j) => {
        prompt += `\nQ${j+1}: ${q}\nRESPUESTA: ${part.respuestas[j] || '(vacía)'}\n`;
      });
    });
    prompt += `\n\nEvalúame como examinador Aptis:
1. Nivel CEFR global aproximado.
2. Nivel por parte (Parte 1, 2, 3, 4).
3. 5 errores gramaticales más graves con corrección.
4. 5 sugerencias concretas para subir a C1.
5. Versión mejorada de la Parte 4 (la que más nota da).
6. Plan de mejora para la próxima semana.`;
    try {
      navigator.clipboard.writeText(prompt);
      alert('✅ Prompt completo copiado. Pégalo en el chat evaluador.');
    } catch (_) {
      window.prompt('Copia manualmente:', prompt);
    }
  }

  // ============================================================================
  // PDF · generación con jsPDF (cargado por CDN bajo demanda)
  // ============================================================================
  async function cargarJsPDF() {
    if (window.jspdf) return window.jspdf.jsPDF;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => resolve(window.jspdf.jsPDF);
      s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
      document.head.appendChild(s);
    });
  }

  async function generarPDF(intentos, esSimulacro) {
    try {
      const jsPDF = await cargarJsPDF();
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 15;
      let y = 20;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Aptis Speaking · Práctica', marginX, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(new Date().toLocaleString('es-ES'), marginX, y);
      y += 10;
      doc.setTextColor(0);

      intentos.forEach(intento => {
        y = pintarSeccionIntento(doc, intento, y, marginX, pageW);
      });

      const nombre = `aptis-practica-${ymd()}.pdf`;
      doc.save(nombre);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar el PDF. Comprueba tu conexión (se carga jsPDF online).');
    }
  }

  async function generarPDFSimulacro(sd, analisis, duracionReal) {
    try {
      const jsPDF = await cargarJsPDF();
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 15;
      let y = 20;

      // Cabecera
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      doc.text('APTIS SPEAKING', marginX, y);
      y += 7;
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38);
      doc.text('SIMULACRO COMPLETO', marginX, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, marginX, y);
      y += 5;
      doc.text(`Duración: ${Math.floor(duracionReal/60)}:${(duracionReal%60).toString().padStart(2,'0')} min`, marginX, y);
      y += 10;

      // Análisis global
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ANÁLISIS AUTOMÁTICO', marginX, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`• Palabras totales: ${analisis.longitud}`, marginX, y); y += 5;
      doc.text(`• Conectores B2 detectados: ${analisis.conectoresEnc.length}  (${analisis.conectoresEnc.slice(0,8).join(', ') || '—'})`, marginX, y); y += 5;
      doc.text(`• Idioms C1 detectados: ${analisis.idiomsEnc.length}  (${analisis.idiomsEnc.slice(0,5).join(', ') || '—'})`, marginX, y); y += 5;
      doc.text(`• Tiempos verbales: ${analisis.tiemposEnc.map(t=>t.label).join(', ') || '—'}`, marginX, y); y += 5;
      doc.text(`• Puntuación estimada: ${analisis.score}% — ${interpretarScore(analisis.score).replace(/[^\w\s.áéíóú]/g,'')}`, marginX, y);
      y += 10;

      // Cada parte
      sd.partes.forEach((part, i) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(220, 38, 38);
        doc.text(`PARTE ${i+1} · ${part.parteLabel}`, marginX, y);
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Tema: ${part.tema}`, marginX, y);
        y += 7;
        doc.setTextColor(0);
        [part.preguntas.a, part.preguntas.b, part.preguntas.c].forEach((q, j) => {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          const ql = doc.splitTextToSize(`Q${j+1}: ${q}`, pageW - marginX*2);
          doc.text(ql, marginX, y);
          y += ql.length * 4.5;
          doc.setFont('helvetica', 'normal');
          const resp = part.respuestas[j] || '(sin respuesta)';
          const rl = doc.splitTextToSize(resp, pageW - marginX*2 - 5);
          if (y + rl.length * 4.5 > 280) { doc.addPage(); y = 20; }
          doc.text(rl, marginX + 5, y);
          y += rl.length * 4.5 + 3;
        });
        y += 4;
      });

      // Página final con prompt para evaluador
      doc.addPage();
      y = 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('PROMPT PARA EVALUADOR EXTERNO', marginX, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60);
      const prompt = `Soy un estudiante preparando Aptis ESOL General Speaking (apunto a C1).
Este PDF contiene un simulacro completo de las 4 partes.

Por favor evalúame:
1. Nivel CEFR global y por parte.
2. 5 errores gramaticales graves con corrección.
3. 5 sugerencias para subir a C1.
4. Versión mejorada de la Parte 4.
5. Plan de mejora semanal.`;
      const pl = doc.splitTextToSize(prompt, pageW - marginX*2);
      doc.text(pl, marginX, y);

      const nombre = `aptis-simulacro-${ymd()}.pdf`;
      doc.save(nombre);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar el PDF. Comprueba tu conexión.');
    }
  }

  function pintarSeccionIntento(doc, intento, y, marginX, pageW) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`${intento.parte.toUpperCase()} · ${intento.tema}`, marginX, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Puntuación: ${intento.score}%  ·  ${intento.longitud} palabras  ·  ${intento.conectores} conectores  ·  ${intento.idioms} idioms`, marginX, y);
    y += 7;
    doc.setTextColor(0);
    const ps = intento.preguntas;
    [ps.a, ps.b, ps.c].forEach((q, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const ql = doc.splitTextToSize(`Q${i+1}: ${q}`, pageW - marginX*2);
      doc.text(ql, marginX, y); y += ql.length * 4.5;
      doc.setFont('helvetica', 'normal');
      const r = intento.respuestas ? intento.respuestas[i] : '';
      const rl = doc.splitTextToSize(r || '(sin respuesta)', pageW - marginX*2 - 5);
      if (y + rl.length * 4.5 > 280) { doc.addPage(); y = 20; }
      doc.text(rl, marginX + 5, y); y += rl.length * 4.5 + 3;
    });
    return y + 5;
  }

  function ymd() {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  // ============================================================================
  // TIMER
  // ============================================================================
  function startTimer(onEnd) {
    stopTimer();
    state.timer = setInterval(() => {
      state.tiempoRestante--;
      const el = document.getElementById('ex-crono');
      if (el) {
        if (state.fase === 'preparacion' || state.fase === 'entre') el.textContent = state.tiempoRestante;
        else el.textContent = formatoTiempo(state.tiempoRestante);
        el.classList.remove('crono-warn', 'crono-final');
        if (state.tiempoRestante <= 5) el.classList.add('crono-final');
        else if (state.tiempoRestante <= 15) el.classList.add('crono-warn');
      }
      if (state.tiempoRestante <= 0) {
        stopTimer();
        if (typeof onEnd === 'function') onEnd();
      }
    }, 1000);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
  function formatoTiempo(s) {
    if (s < 0) s = 0;
    if (s < 60) return s + 's';
    const m = Math.floor(s/60), r = s%60;
    return m + ':' + (r < 10 ? '0' + r : r);
  }

  // ============================================================================
  // PERSISTENCIA
  // ============================================================================
  function guardarIntento(intento) {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      const data = raw ? JSON.parse(raw) : { intentos: [] };
      data.intentos = data.intentos || [];
      data.intentos.push(intento);
      if (data.intentos.length > MAX_HIST) data.intentos = data.intentos.slice(-MAX_HIST);
      localStorage.setItem(HIST_KEY, JSON.stringify(data));
    } catch (e) { console.warn('No se pudo guardar', e); }
  }
  function cargarEstadisticas() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      return raw ? JSON.parse(raw) : { intentos: [] };
    } catch (_) { return { intentos: [] }; }
  }
  function borrarTodo() { localStorage.removeItem(HIST_KEY); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  return { mount, guardarIntento, cargarEstadisticas, borrarTodo, iniciarSimulacro };
})();
