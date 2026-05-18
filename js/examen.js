/* =============================================================================
 * Aptis Speaking v4 · examen.js
 * Bancos combinados (A+B+C aleatorios) + voz + análisis + historial.
 * ============================================================================= */
window.Examen = (function () {
  'use strict';

  const HIST_KEY = 'aptis_examen_v4';
  const MAX_HIST = 50;

  const CONECTORES_B2 = [
    'moreover', 'furthermore', 'however', 'nevertheless', 'whereas', 'although',
    'even though', 'in spite of', 'despite', 'on top of that', 'on the other hand',
    'as a result', 'consequently', 'therefore', 'in addition', 'besides',
    "what's more", 'apart from that', 'in contrast', 'on the flip side',
    'last but not least', 'first of all', 'to begin with', 'in conclusion',
    'all in all', 'to sum up', 'on the grounds that', 'due to', 'owing to'
  ];
  const IDIOMS_B2 = [
    'a piece of cake', 'cost an arm and a leg', 'all that glitters is not gold',
    'break the language barrier', 'read between the lines', 'a double-edged sword',
    'here to stay', 'in a nutshell', 'all things considered', 'at the end of the day',
    'bear in mind', 'cut down on', 'be at stake', 'for better or for worse',
    'take a load off my mind', "it's a no-brainer", 'lean towards',
    'broaden my horizons', 'recharge my batteries', 'switch off', 'unwind',
    'find the right balance'
  ];
  const TIEMPOS = [
    { id: 'pres_simple',  label: 'Presente simple',   re: /\b(I|you|we|they)\s+(?:do|does|don't|doesn't|like|enjoy|prefer|think|feel|believe|want|need|have|has)\b/i },
    { id: 'pres_cont',    label: 'Presente continuo', re: /\b(am|is|are)\s+\w+ing\b/i },
    { id: 'pasado_simple', label: 'Pasado simple',    re: /\b(went|did|had|was|were|saw|made|took|came|got|enjoyed|visited|decided|tried|learnt|learned|cooked|travelled|moved|spent|told)\b/i },
    { id: 'pasado_cont',  label: 'Pasado continuo',   re: /\b(was|were)\s+\w+ing\b/i },
    { id: 'pres_perf',    label: 'Presente perfecto', re: /\b(have|has|i've|we've|they've)\s+(been|gone|done|seen|made|taken|come|got|gotten|learnt|learned|discovered|met|shared|developed|noticed|broadened)\b/i },
    { id: 'futuro',       label: 'Futuro',            re: /\b(will|won't|going to)\s+\w+/i },
    { id: 'cond2',        label: 'Condicional 2',     re: /\bif\s+\w+\s+(were|had|did|could)\b.*\bwould\b/i },
    { id: 'inversion',    label: 'Inversión C1',      re: /\b(were\s+I|not only\s+(does|do|did|can|could|will|would|am|is|are)|hardly had|little did|only by)\b/i }
  ];

  let state = null;
  let host = null;

  function mount(targetEl, parteId, parteData) {
    host = targetEl;
    state = {
      parteId, parteData,
      tema: parteData.temas[0],
      preguntasActuales: null,
      fase: 'config',
      transcripcion: '',
      transcripcionFinal: '',
      tiempoRestante: 0,
      timer: null,
      recognition: null,
      modoInput: 'voz'
    };
    render();
  }

  function render() {
    switch (state.fase) {
      case 'config':       renderConfig(); break;
      case 'preparacion':  renderPreparacion(); break;
      case 'hablando':     renderHablando(); break;
      case 'analisis':     renderAnalisis(); break;
    }
  }

  function renderConfig() {
    const p = state.parteData;
    const t = state.tema;
    if (!state.preguntasActuales) state.preguntasActuales = combinarPreguntas(t);
    const ps = state.preguntasActuales;
    const prepTxt = p.examen.preparacion_segundos > 0
      ? `<p>🧠 Tendrás <strong>${p.examen.preparacion_segundos} seg</strong> para preparar.</p>`
      : `<p>🧠 No hay tiempo de preparación.</p>`;
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card">
          <p class="examen-step">CONFIGURACIÓN</p>
          <h3 class="examen-tema-titulo">🎯 Modo examen · ${escapeHtml(p.label)}</h3>

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
            <p class="examen-step">Preguntas de este intento (combinación única):</p>
            <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
            <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
            <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
          </div>

          <div class="examen-info">
            ${prepTxt}
            <p>🎙️ Luego tendrás <strong>${p.examen.respuesta_segundos} seg</strong> para responder.</p>
            <p>🎯 Banco de <strong>${contarBanco(t)} preguntas</strong> en este tema — combinaciones casi infinitas.</p>
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

  function empezar() {
    const p = state.parteData;
    if (p.examen.preparacion_segundos > 0) {
      state.fase = 'preparacion';
      state.tiempoRestante = p.examen.preparacion_segundos;
      render();
      startTimer(() => iniciarHabla());
    } else {
      iniciarHabla();
    }
  }
  function renderPreparacion() {
    const ps = state.preguntasActuales;
    const t = state.tema;
    const kitHtml = renderKitTema(t);
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-prep">
          <p class="examen-step">PREPARACIÓN</p>
          <h3 class="examen-tema-titulo">📝 Prepara tu respuesta · ${escapeHtml(t.label)}</h3>
          <div class="examen-preguntas">
            <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
            <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
            <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
          </div>
          ${kitHtml}
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
      iniciarHabla();
    });
  }
  function renderKitTema(t) {
    const k = t.kit_sugerido;
    if (!k) return '';
    return `
      <div class="examen-kit">
        <p class="examen-kit-title">💡 Kit sugerido para "${escapeHtml(t.label)}"</p>
        <ul>
          <li>Tema en EN: <strong>${escapeHtml(k.tema_en)}</strong></li>
          <li>Verbo (paso 2): <strong>${escapeHtml(k.verbo)}</strong></li>
          <li>Ayuda (helps us…): <strong>${escapeHtml(k.ayuda)}</strong></li>
          ${k.drawbacks ? `<li>Drawbacks: <strong>${escapeHtml(k.drawbacks.join(' / '))}</strong></li>` : ''}
          ${k.historia ? `<li>Historia recomendada: <strong>${escapeHtml(k.historia)}</strong></li>` : ''}
        </ul>
      </div>
    `;
  }

  function iniciarHabla() {
    const p = state.parteData;
    state.fase = 'hablando';
    state.tiempoRestante = p.examen.respuesta_segundos;
    state.transcripcion = '';
    state.transcripcionFinal = '';
    render();
    if (state.modoInput === 'voz') startRecognition();
    startTimer(() => finalizar());
  }
  function renderHablando() {
    const ps = state.preguntasActuales;
    const t = state.tema;
    const inputHtml = state.modoInput === 'voz'
      ? `
        <button class="examen-mic-btn" id="ex-mic">🎙️ Activar micrófono</button>
        <div class="examen-transcripcion" id="ex-transcripcion"><span class="placeholder">Tu transcripción aparecerá aquí…</span></div>
        <p class="examen-instruccion">Si se corta, dale otra vez al micrófono.</p>
      `
      : `
        <textarea class="examen-textarea" id="ex-textarea" placeholder="Escribe tu respuesta aquí mientras hablas…"></textarea>
        <p class="examen-instruccion">Modo texto. Útil si la transcripción de voz no va bien.</p>
      `;
    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-speak">
          <p class="examen-step">RESPONDIENDO · ${escapeHtml(t.label)}</p>
          <div class="examen-preguntas">
            <p class="examen-pregunta-line"><span class="q-num">1</span>${escapeHtml(ps.a)}</p>
            <p class="examen-pregunta-line"><span class="q-num">2</span>${escapeHtml(ps.b)}</p>
            <p class="examen-pregunta-line"><span class="q-num">3</span>${escapeHtml(ps.c)}</p>
          </div>
          <div class="examen-cronometro" id="ex-crono">${formatoTiempo(state.tiempoRestante)}</div>
          ${inputHtml}
          <div class="examen-actions" style="margin-top:1rem">
            <button class="btn btn-primary" id="ex-end">⏹ Terminar ya</button>
          </div>
        </div>
      </div>
    `;
    bindHablando();
  }
  function bindHablando() {
    const end = document.getElementById('ex-end');
    if (end) end.addEventListener('click', () => { stopTimer(); finalizar(); });
    const mic = document.getElementById('ex-mic');
    if (mic) mic.addEventListener('click', () => {
      if (state.recognition && state.recognition._active) stopRecognition();
      else startRecognition();
    });
    const ta = document.getElementById('ex-textarea');
    if (ta) ta.addEventListener('input', () => { state.transcripcionFinal = ta.value; });
  }

  function startRecognition() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      const tr = document.getElementById('ex-transcripcion');
      if (tr) tr.innerHTML = '<span class="placeholder">⚠️ Tu navegador no soporta reconocimiento de voz. Usa el modo Texto.</span>';
      return;
    }
    try {
      const r = new Rec();
      r.lang = 'en-GB'; r.continuous = true; r.interimResults = true;
      r._active = true;
      state.recognition = r;
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) state.transcripcionFinal += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        const tr = document.getElementById('ex-transcripcion');
        if (tr) {
          tr.innerHTML = escapeHtml(state.transcripcionFinal) +
            (interim ? `<span class="interim">${escapeHtml(interim)}</span>` : '');
        }
      };
      r.onerror = (ev) => {
        console.warn('Recognition error', ev.error);
        const tr = document.getElementById('ex-transcripcion');
        if (tr && !state.transcripcionFinal) tr.innerHTML = '<span class="placeholder">⚠️ Permiso denegado. Usa el modo Texto.</span>';
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

  function finalizar() {
    stopRecognition();
    stopTimer();
    state.fase = 'analisis';
    render();
  }
  function renderAnalisis() {
    const texto = (state.transcripcionFinal || '').trim();
    const lower = texto.toLowerCase();
    const palabras = texto ? texto.split(/\s+/).filter(Boolean) : [];
    const longitud = palabras.length;

    const conectoresEnc = CONECTORES_B2.filter(c => lower.indexOf(c) >= 0);
    const idiomsEnc = IDIOMS_B2.filter(i => lower.indexOf(i) >= 0);
    const tiemposEnc = TIEMPOS.filter(t => t.re.test(texto));

    const score = calcularScore({ longitud, conectoresEnc, idiomsEnc, tiemposEnc });
    const t = state.tema;
    const ps = state.preguntasActuales;

    const intento = {
      fecha: new Date().toLocaleString('es-ES'),
      parte: state.parteId,
      tema: t.label,
      preguntas: ps,
      transcripcion: texto,
      longitud, score,
      conectores: conectoresEnc.length,
      idioms: idiomsEnc.length,
      tiempos: tiemposEnc.length
    };
    guardarIntento(intento);

    host.innerHTML = `
      <div class="examen-pantalla">
        <div class="examen-card examen-card-result">
          <p class="examen-step">RESULTADO</p>
          <h3 class="examen-tema-titulo">📊 Análisis · ${escapeHtml(t.label)}</h3>

          <div class="analisis-grid">
            <div class="ana-card ${longitud >= longitudObjetivo() ? 'ana-ok' : (longitud >= longitudObjetivo()*0.7 ? 'ana-warn' : 'ana-bad')}">
              <span class="ana-val">${longitud}</span><span class="ana-lbl">Palabras</span>
            </div>
            <div class="ana-card ${conectoresEnc.length >= 3 ? 'ana-ok' : (conectoresEnc.length >= 1 ? 'ana-warn' : 'ana-bad')}">
              <span class="ana-val">${conectoresEnc.length}</span><span class="ana-lbl">Conectores</span>
            </div>
            <div class="ana-card ${idiomsEnc.length >= 1 ? 'ana-ok' : 'ana-warn'}">
              <span class="ana-val">${idiomsEnc.length}</span><span class="ana-lbl">Idioms</span>
            </div>
            <div class="ana-card ${tiemposEnc.length >= 4 ? 'ana-ok' : (tiemposEnc.length >= 2 ? 'ana-warn' : 'ana-bad')}">
              <span class="ana-val">${tiemposEnc.length}</span><span class="ana-lbl">Tiempos verbales</span>
            </div>
          </div>

          <div class="analisis-detalle">
            <h4>Tiempos verbales detectados</h4>
            ${tiemposEnc.length
              ? `<ul>${tiemposEnc.map(t => `<li>✅ ${escapeHtml(t.label)}</li>`).join('')}</ul>`
              : '<p class="analisis-vacio">Ningún tiempo detectado. Mezcla presente + pasado + futuro.</p>'}
          </div>

          <div class="analisis-detalle">
            <h4>Conectores e idioms usados</h4>
            <div class="chip-row">
              ${conectoresEnc.map(c => `<span class="chip chip-ok">${escapeHtml(c)}</span>`).join('')}
              ${idiomsEnc.map(i => `<span class="chip chip-idiom">${escapeHtml(i)}</span>`).join('')}
            </div>
            ${(!conectoresEnc.length && !idiomsEnc.length) ? '<p class="analisis-vacio">Nada detectado. Mete moreover, however, in a nutshell, double-edged sword…</p>' : ''}
          </div>

          <div class="analisis-detalle analisis-comparar">
            <h4>🆚 Compara con la respuesta modelo</h4>
            <div class="comparar-grid">
              <div class="comparar-col">
                <h5>Tu respuesta</h5>
                <p class="comparar-texto">${escapeHtml(texto || '(sin transcripción)')}</p>
              </div>
              <div class="comparar-col comparar-modelo">
                <h5>Modelo B2/C1</h5>
                <p class="comparar-texto">${escapeHtml(t.respuesta_modelo)}</p>
              </div>
            </div>
          </div>

          <div class="examen-info" style="text-align:center">
            <p style="font-size:1.4rem;font-weight:800;color:var(--accent)">📈 Puntuación estimada: ${score}%</p>
            <p style="font-size:0.8rem;color:var(--ink-muted)">${interpretarScore(score)}</p>
          </div>

          <div class="examen-actions examen-actions-result">
            <button class="btn btn-primary" id="ex-claude">📋 Copiar prompt para Claude</button>
            <button class="btn" id="ex-retry">🔁 Otro intento</button>
            <button class="btn btn-secondary" id="ex-dashboard">📊 Ver historial</button>
          </div>
        </div>
      </div>
    `;
    bindAnalisis(texto);
  }

  function bindAnalisis(texto) {
    document.getElementById('ex-claude').addEventListener('click', () => {
      const ps = state.preguntasActuales;
      const prompt =
`Soy un estudiante preparando el Aptis ESOL Speaking (apunto a C1).
Acabo de responder a estas 3 preguntas seguidas (Parte ${state.parteId.split('-')[1]}, tema: ${state.tema.label}):

1. ${ps.a}
2. ${ps.b}
3. ${ps.c}

Mi respuesta transcrita ha sido:

"""
${texto || '(sin transcripción)'}
"""

Por favor, evalúame como examinador de Aptis ESOL:
1. Nivel CEFR aproximado (A2/B1/B2/C1) y justificación breve.
2. 3 errores gramaticales más importantes con corrección.
3. 3 sugerencias concretas para subir un nivel (idiom, conector o estructura específica).
4. Una versión mejorada de mi respuesta (mismo contenido, mejor inglés).

Sé directo y útil. Gracias.`;
      try { navigator.clipboard.writeText(prompt); alert('✅ Prompt copiado. Pégalo en una nueva conversación de Claude.'); }
      catch (_) { window.prompt('Copia este prompt manualmente:', prompt); }
    });
    document.getElementById('ex-retry').addEventListener('click', () => {
      state.fase = 'config';
      state.preguntasActuales = combinarPreguntas(state.tema);
      render();
    });
    document.getElementById('ex-dashboard').addEventListener('click', () => {
      document.querySelectorAll('.part-btn').forEach(b => {
        if (b.dataset.part === 'dashboard') b.click();
      });
    });
  }

  function longitudObjetivo() {
    const seg = state.parteData.examen.respuesta_segundos;
    if (seg <= 30) return 70;
    if (seg <= 45) return 100;
    if (seg <= 120) return 250;
    return 80;
  }
  function calcularScore({ longitud, conectoresEnc, idiomsEnc, tiemposEnc }) {
    let s = 0;
    const objL = longitudObjetivo();
    s += Math.min(40, Math.round(40 * longitud / objL));
    s += Math.min(25, conectoresEnc.length * 6);
    s += Math.min(15, idiomsEnc.length * 8);
    s += Math.min(20, tiemposEnc.length * 4);
    return Math.max(0, Math.min(100, s));
  }
  function interpretarScore(s) {
    if (s >= 80) return '🔥 ¡Excelente! Nivel B2 alto / C1.';
    if (s >= 65) return '👍 Bien. Zona B2 sólida.';
    if (s >= 50) return '📈 B1-B2. Suma conectores e idioms.';
    if (s >= 30) return '🌱 B1. Habla más, mete conectores.';
    return '🚧 Practica con la plantilla.';
  }

  function startTimer(onEnd) {
    stopTimer();
    state.timer = setInterval(() => {
      state.tiempoRestante--;
      const el = document.getElementById('ex-crono');
      if (el) {
        if (state.fase === 'preparacion') el.textContent = state.tiempoRestante;
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

  return { mount, guardarIntento, cargarEstadisticas, borrarTodo };
})();
