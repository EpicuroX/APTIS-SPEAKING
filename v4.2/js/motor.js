/* =============================================================================
 * Aptis Speaking v4 · motor.js
 * - Renderiza plantillas con texto fijo en negrita + huecos como bocadillos.
 * - Modos: Estructura, Conectores, Aplicado, Tarjetas, Examen.
 * - Carga 4 partes + kits-globales.
 * ============================================================================= */
(function () {
  'use strict';

  const PARTS = ['parte-1', 'parte-2', 'parte-3', 'parte-4'];
  const PARTS_DASH = ['parte-1','parte-2','parte-3','parte-4','dashboard'];
  const PART_LABELS = {
    'parte-1': { num: '1', sub: 'Personal' },
    'parte-2': { num: '2', sub: 'Foto' },
    'parte-3': { num: '3', sub: 'Comparar' },
    'parte-4': { num: '4', sub: 'Tema 2 min' },
    'dashboard': { num: '📊', sub: 'Mi progreso' }
  };

  let data = {};
  let state = { part: 'parte-1', mode: 'estructura', tema: null };
  let tarjetasIdx = 0;

  async function loadAll() {
    try {
      const [k, p1, p2, p3, p4] = await Promise.all([
        fetch('js/contenidos/kits-globales.json').then(r => r.json()),
        fetch('js/contenidos/parte-1.json').then(r => r.json()),
        fetch('js/contenidos/parte-2.json').then(r => r.json()),
        fetch('js/contenidos/parte-3.json').then(r => r.json()),
        fetch('js/contenidos/parte-4.json').then(r => r.json())
      ]);
      data['kits-globales'] = k;
      data['parte-1'] = p1; data['parte-2'] = p2; data['parte-3'] = p3; data['parte-4'] = p4;
      window.data = data;
      init();
    } catch (err) {
      console.error('Error cargando JSON:', err);
      document.getElementById('app-main').innerHTML = '<p class="error">No se pudieron cargar los contenidos. Revisa que los JSON estén accesibles.</p>';
    }
  }

  function init() {
    if (window.SCORM) try { window.SCORM.init(); } catch(_) {}
    renderPartNav();
    bindModeFooter();
    bindPopoverDismiss();
    document.addEventListener('aptis-examen-guardar', (e) => {
      if (window.Examen) Examen.guardarIntento(e.detail);
    });
    document.addEventListener('aptis-examen-cambio-modo', (e) => switchMode(e.detail.mode));
    setPart('parte-1');
  }

  function renderPartNav() {
    const nav = document.getElementById('part-nav');
    nav.innerHTML = '';
    PARTS_DASH.forEach(p => {
      const lbl = PART_LABELS[p];
      const btn = document.createElement('button');
      btn.className = 'part-btn' + (p === state.part ? ' active' : '') + (p === 'dashboard' ? ' part-btn-aux' : '');
      btn.dataset.part = p;
      btn.setAttribute('role', 'tab');
      btn.innerHTML = `<span class="part-btn-label">${lbl.num}</span><span class="part-btn-sub">${lbl.sub}</span>`;
      btn.addEventListener('click', () => setPart(p));
      nav.appendChild(btn);
    });
  }

  function setPart(part) {
    state.part = part;
    document.querySelectorAll('.part-btn').forEach(b => b.classList.toggle('active', b.dataset.part === part));
    if (part === 'dashboard') {
      document.getElementById('mode-footer').hidden = true;
      renderDashboard();
    } else {
      document.getElementById('mode-footer').hidden = false;
      state.tema = data[part].temas[0].id;
      tarjetasIdx = 0;
      renderPart();
    }
  }

  function bindModeFooter() {
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });
  }
  function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    renderPart();
  }

  function renderPart() {
    const p = data[state.part];
    const main = document.getElementById('app-main');
    const head = `
      <div class="part-header">
        <h2 class="part-h2">${escapeHtml(p.label)} · ${escapeHtml(p.subtitle)}</h2>
        <div class="part-meta">
          <span class="meta-chip">⏱ ${escapeHtml(p.meta.tiempo_total)}</span>
          <span class="meta-chip">🧠 ${escapeHtml(p.meta.preparacion)} prep</span>
          <span class="meta-chip">📋 ${escapeHtml(p.meta.formato)}</span>
          <span class="meta-chip">🎯 ${escapeHtml(p.meta.nivel)}</span>
        </div>
        <p class="part-objective">${escapeHtml(p.objetivo)}</p>
      </div>
    `;
    let body = '';
    switch (state.mode) {
      case 'estructura': body = renderEstructura(p); break;
      case 'conectores': body = renderConectores(p); break;
      case 'aplicado':   body = renderAplicado(p); break;
      case 'tarjetas':   body = renderTarjetas(p); break;
      case 'examen':
        if (window.Examen) {
          main.innerHTML = head + '<div id="examen-host"></div>';
          window.Examen.mount(document.getElementById('examen-host'), state.part, p);
          return;
        }
        body = '<p class="error">Modo examen no disponible.</p>';
        break;
    }
    main.innerHTML = head + body;
    afterRender();
  }

  function afterRender() {
    document.querySelectorAll('.tpl-hueco').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openPopover(btn.dataset.part, parseInt(btn.dataset.paso, 10), btn.dataset.hueco, btn);
      });
    });
    document.querySelectorAll('.step-connector-more').forEach(btn => {
      btn.addEventListener('click', () => openConectorPopover(btn.dataset.part, parseInt(btn.dataset.paso, 10)));
    });
    document.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
    document.querySelectorAll('.card-tj').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('flipped'));
    });
    document.querySelectorAll('.conector-item').forEach(li => {
      li.addEventListener('click', () => speak(li.dataset.text || li.textContent.trim()));
    });
    document.querySelectorAll('.kit-item').forEach(li => {
      li.addEventListener('click', () => speak(li.textContent.trim()));
    });
    const sel = document.getElementById('tema-select');
    if (sel) sel.addEventListener('change', () => { state.tema = sel.value; tarjetasIdx = 0; renderPart(); });
    bindTarjetasNav();
    const r = document.getElementById('btn-reset-app');
    if (r) r.addEventListener('click', resetApp);
  }

  // ============== MODO ESTRUCTURA ==============
  function renderEstructura(p) {
    let html = '<p class="mode-hint">Memoriza la plantilla literal: <strong>lo en negrita NO cambia</strong>, los <em>bocadillos amarillos</em> son donde personalizas. Toca un bocadillo para ver opciones con su nivel CEFR.</p>';
    p.pasos.forEach(paso => { html += renderPaso(paso, p.id); });
    if (p.kits_universales && p.kits_universales.length) {
      html += `<details class="kits-block" open><summary>📦 Kits universales de la ${escapeHtml(p.label)}</summary>`;
      p.kits_universales.forEach(kit => {
        html += `<div class="kit-row"><h5 class="kit-label">${escapeHtml(kit.label)}</h5><ul class="kit-list">`;
        kit.items.forEach(item => {
          html += `<li class="kit-item" tabindex="0">${escapeHtml(item)}</li>`;
        });
        html += '</ul></div>';
      });
      html += '</details>';
    }
    return html;
  }

  function renderPaso(paso, partId) {
    const conectorChip = paso.conector_inicial && paso.conector_inicial.texto
      ? `
        <div class="step-connector">
          <span class="step-connector-icon">🔗</span>
          <div style="flex:1">
            <span class="step-connector-label">${escapeHtml(paso.conector_inicial.funcion || 'conector')}</span>
            <div class="step-connector-text">${escapeHtml(paso.conector_inicial.texto)}</div>
          </div>
          ${paso.conector_inicial.alternativas && paso.conector_inicial.alternativas.length
            ? `<button class="step-connector-more" data-part="${partId}" data-paso="${paso.n}">+ alt</button>`
            : ''}
        </div>
      `
      : (paso.conector_inicial && paso.conector_inicial.alternativas && paso.conector_inicial.alternativas.length
          ? `<div class="step-connector">
              <span class="step-connector-icon">🔗</span>
              <div style="flex:1">
                <span class="step-connector-label">${escapeHtml(paso.conector_inicial.funcion || 'apertura')}</span>
                <div class="step-connector-text"><em>Sin conector fijo · ver alternativas</em></div>
              </div>
              <button class="step-connector-more" data-part="${partId}" data-paso="${paso.n}">+ alt</button>
            </div>`
          : '');

    const plantillaHtml = paso.plantilla_segmentos
      ? renderSegmentos(paso.plantilla_segmentos, paso.huecos || {}, partId, paso.n)
      : '<em>(sin plantilla)</em>';

    const trick = paso.trick ? `<p class="step-tip step-trick">💡 ${escapeHtml(paso.trick)}</p>` : '';
    const warning = paso.warning ? `<p class="step-tip step-warning">⚠️ ${escapeHtml(paso.warning)}</p>` : '';
    const upgrades = paso.upgrades_c1 && paso.upgrades_c1.length
      ? `<div class="step-tip step-upgrade">
           <h5>🔥 Upgrade C1 (opcional)</h5>
           ${paso.upgrades_c1.map(u => `
             <p class="step-upgrade-item"><code>${escapeHtml(u.patron)}</code><br>↳ <strong>${escapeHtml(u.ejemplo)}</strong><br><small>${escapeHtml(u.uso)}</small></p>
           `).join('')}
         </div>`
      : '';

    const textoCompleto = paso.plantilla_segmentos
      ? paso.plantilla_segmentos.map(s => s.tipo === 'fijo' ? s.texto : `[${s.label}]`).join('')
      : '';

    return `
      <div class="step-card">
        <div class="step-head">
          <span class="step-num">${paso.n}</span>
          <div class="step-titles">
            <h3 class="step-title">${escapeHtml(paso.title)}</h3>
            <p class="step-time">${escapeHtml(paso.time || '')}${paso.grammar ? ' · ' + escapeHtml(paso.grammar) : ''}</p>
          </div>
        </div>
        ${conectorChip}
        <div class="template-box">${plantillaHtml}</div>
        <button class="btn btn-listen btn-listen-small" data-speak="${escapeAttr(textoCompleto)}">🔊 Escuchar paso</button>
        ${trick}${warning}${upgrades}
      </div>
    `;
  }

  function renderSegmentos(segmentos, huecos, partId, pasoN) {
    return segmentos.map(s => {
      if (s.tipo === 'fijo') return `<span class="tpl-fijo">${escapeHtml(s.texto)}</span>`;
      const h = huecos[s.id] || {};
      return `<button class="tpl-hueco" type="button" data-part="${partId}" data-paso="${pasoN}" data-hueco="${escapeAttr(s.id)}" aria-label="Hueco: ${escapeAttr(s.label)}">${escapeHtml(s.label)}</button>`;
    }).join('');
  }

  // ============== MODO CONECTORES ==============
  function renderConectores(p) {
    const k = data['kits-globales'];
    let html = '<p class="mode-hint">Conectores <strong>organizados por función</strong> con nivel CEFR y ejemplo. Toca cualquier item para escucharlo.</p>';
    k.conectores.forEach(grp => {
      html += `
        <div class="conector-grupo">
          <div class="conector-grupo-head">
            <span class="conector-grupo-icon">${escapeHtml(grp.icon)}</span>
            <h3 class="conector-grupo-label">${escapeHtml(grp.label)}</h3>
          </div>
          <p class="conector-cuando"><strong>¿Cuándo?</strong> ${escapeHtml(grp.cuando)}</p>
          <p class="conector-donde"><strong>¿Dónde?</strong> ${escapeHtml(grp.donde)}</p>
          <p class="conector-ejemplo">${renderBoldExample(grp.ejemplo_aplicado)}</p>
          <ul class="conector-lista">
            ${grp.items.map(it => `
              <li class="conector-item" data-text="${escapeAttr(it.texto)}">
                <span>${escapeHtml(it.texto)}</span>
                ${chipNivel(it.nivel)}
              </li>`).join('')}
          </ul>
        </div>
      `;
    });
    html += renderKitBlock(k.speculating);
    html += renderKitBlock(k.opinar);
    // Sinónimos
    html += `<div class="conector-grupo">
      <div class="conector-grupo-head"><span class="conector-grupo-icon">🔄</span><h3 class="conector-grupo-label">${escapeHtml(k.sinonimos.label)}</h3></div>
      ${k.sinonimos.grupos.map(g => `
        <p class="conector-cuando" style="display:flex;flex-wrap:wrap;align-items:center;gap:0.3rem"><strong>${escapeHtml(g.base)}</strong> → ${g.sinonimos.map(s => `<span class="kit-item" data-text="${escapeAttr(s)}" style="cursor:pointer">${escapeHtml(s)}</span>`).join('')}</p>
      `).join('')}
    </div>`;
    // Idioms
    html += `<div class="conector-grupo">
      <div class="conector-grupo-head"><span class="conector-grupo-icon">💎</span><h3 class="conector-grupo-label">${escapeHtml(k.idioms_c1.label)}</h3></div>
      <ul class="conector-lista">
        ${k.idioms_c1.items.map(it => `
          <li class="conector-item" data-text="${escapeAttr(it.texto)}">
            <span><strong>${escapeHtml(it.texto)}</strong> — <small style="color:var(--ink-muted)">${escapeHtml(it.uso)}</small></span>
          </li>`).join('')}
      </ul>
    </div>`;
    // Phrasal verbs
    html += `<div class="conector-grupo">
      <div class="conector-grupo-head"><span class="conector-grupo-icon">🔧</span><h3 class="conector-grupo-label">${escapeHtml(k.phrasal_verbs.label)}</h3></div>
      <ul class="conector-lista">
        ${k.phrasal_verbs.items.map(it => `
          <li class="conector-item" data-text="${escapeAttr(it.texto)}">
            <span><strong>${escapeHtml(it.texto)}</strong> — <small style="color:var(--ink-muted)">${escapeHtml(it.uso)}</small></span>
          </li>`).join('')}
      </ul>
    </div>`;
    // Inversiones C1
    html += `<div class="conector-grupo">
      <div class="conector-grupo-head"><span class="conector-grupo-icon">🔥</span><h3 class="conector-grupo-label">${escapeHtml(k.inversiones_c1.label)}</h3></div>
      <p class="conector-donde">⚠️ ${escapeHtml(k.inversiones_c1.warning)}</p>
      ${k.inversiones_c1.items.map(it => `
        <p class="conector-ejemplo"><strong>${escapeHtml(it.patron)}</strong><br>↳ ${escapeHtml(it.ejemplo)}<br><small style="color:var(--ink-muted)">${escapeHtml(it.uso)}</small></p>
      `).join('')}
    </div>`;
    return html;
  }

  function renderKitBlock(kit) {
    return `
      <div class="conector-grupo">
        <div class="conector-grupo-head"><h3 class="conector-grupo-label">${escapeHtml(kit.label)}</h3></div>
        <ul class="conector-lista">
          ${kit.items.map(it => `
            <li class="conector-item" data-text="${escapeAttr(it.texto)}">
              <span>${escapeHtml(it.texto)}</span>
              ${chipNivel(it.nivel)}
            </li>`).join('')}
        </ul>
      </div>
    `;
  }
  function renderBoldExample(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function chipNivel(nivel) {
    if (!nivel) return '';
    let cls = 'a';
    const n = String(nivel).toLowerCase();
    if (n.indexOf('c1') >= 0) cls = 'c1';
    else if (n.indexOf('b2 alto') >= 0) cls = 'b2alto';
    else if (n.indexOf('b2') >= 0) cls = 'b2';
    else if (n.indexOf('b1') >= 0) cls = 'b1';
    return `<span class="chip-nivel chip-nivel-${cls}">${escapeHtml(nivel)}</span>`;
  }

  // ============== MODO APLICADO ==============
  function renderAplicado(p) {
    if (!state.tema || !p.temas.find(t => t.id === state.tema)) state.tema = p.temas[0].id;
    const tema = p.temas.find(t => t.id === state.tema);
    const otros = p.temas.filter(t => t.id !== state.tema);
    const otro = otros[Math.floor(Math.random() * otros.length)] || tema;

    const selectorHtml = `
      <div class="aplicado-controls">
        <div class="aplicado-col">
          <label class="aplicado-label" for="tema-select">Tema</label>
          <select id="tema-select" class="tema-select">
            ${p.temas.map(t => `<option value="${t.id}" ${t.id === state.tema ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    const carta = (t, etiqueta) => {
      const preguntasMuestra = pickPreguntasMuestra(t);
      return `
      <div class="aplicado-card" style="--tema-color:${t.color || '#0f172a'}">
        <div class="aplicado-card-head">
          <span class="aplicado-etiqueta">${escapeHtml(etiqueta)}</span>
          <span class="aplicado-tema">${escapeHtml(t.label)}</span>
        </div>
        <div class="aplicado-preguntas">
          <p class="aplicado-preg-label">Ejemplo de preguntas (banco de ${contarPreguntas(t)})</p>
          ${preguntasMuestra.map((q, i) => `<p class="aplicado-preg">${i+1}. ${escapeHtml(q)}</p>`).join('')}
        </div>
        <button class="btn btn-listen btn-listen-small" data-speak="${escapeAttr(t.respuesta_modelo)}">🔊 Escuchar respuesta modelo</button>
        <p class="aplicado-respuesta" style="margin-top:0.6rem">${escapeHtml(t.respuesta_modelo)}</p>
      </div>`;
    };
    return selectorHtml + '<p class="mode-hint">Respuestas modelo con la plantilla aplicada. Compara dos temas y verás que <strong>la estructura es la misma</strong>; solo cambian los detalles.</p>' +
      '<div class="aplicado-grid">' + carta(tema, 'Tema actual') + carta(otro, 'Otro ejemplo') + '</div>';
  }

  function pickPreguntasMuestra(tema) {
    const bp = tema.banco_preguntas || {};
    const out = [];
    ['bloque_a', 'bloque_b', 'bloque_c'].forEach(b => {
      const arr = bp[b] || [];
      if (arr.length) out.push(arr[Math.floor(Math.random() * arr.length)]);
    });
    return out;
  }
  function contarPreguntas(tema) {
    const bp = tema.banco_preguntas || {};
    return (bp.bloque_a || []).length + (bp.bloque_b || []).length + (bp.bloque_c || []).length;
  }

  // ============== MODO TARJETAS ==============
  function renderTarjetas(p) {
    if (!state.tema || !p.temas.find(t => t.id === state.tema)) state.tema = p.temas[0].id;
    const tema = p.temas.find(t => t.id === state.tema);
    const tarjetas = construirTarjetas(p, tema);
    if (tarjetasIdx >= tarjetas.length) tarjetasIdx = 0;
    const t = tarjetas[tarjetasIdx];
    return `
      <div class="aplicado-controls">
        <div class="aplicado-col">
          <label class="aplicado-label" for="tema-select">Tema</label>
          <select id="tema-select" class="tema-select">
            ${p.temas.map(tt => `<option value="${tt.id}" ${tt.id === state.tema ? 'selected' : ''}>${escapeHtml(tt.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="mode-hint">Toca la tarjeta para girarla. Memoriza el frente y comprueba el reverso.</p>
      <div class="card-stage">
        <div class="card-tj">
          <div class="card-tj-face">
            <p class="card-tj-type">${escapeHtml(t.type)}</p>
            <h3 class="card-tj-title">${escapeHtml(t.front)}</h3>
            ${t.sub ? `<p class="card-tj-sub">${escapeHtml(t.sub)}</p>` : ''}
            <p class="card-tj-hint">Toca para girar 🔄</p>
          </div>
          <div class="card-tj-face card-tj-back">
            <p class="card-tj-type">${escapeHtml(t.type)} · Reverso</p>
            <p class="card-tj-content">${escapeHtml(t.back)}</p>
            ${t.truco ? `<p class="card-tj-truco">💡 ${escapeHtml(t.truco)}</p>` : ''}
            <p class="card-tj-hint">Toca para girar 🔄</p>
          </div>
        </div>
      </div>
      <p class="card-counter">Tarjeta ${tarjetasIdx + 1} de ${tarjetas.length}</p>
      <div class="card-tj-actions">
        <button class="btn" id="tj-prev" ${tarjetasIdx === 0 ? 'disabled' : ''}>← Anterior</button>
        <button class="btn btn-primary" id="tj-next" ${tarjetasIdx === tarjetas.length - 1 ? 'disabled' : ''}>Siguiente →</button>
      </div>
    `;
  }
  function bindTarjetasNav() {
    const prev = document.getElementById('tj-prev');
    const next = document.getElementById('tj-next');
    if (prev) prev.addEventListener('click', () => { tarjetasIdx = Math.max(0, tarjetasIdx - 1); renderPart(); });
    if (next) next.addEventListener('click', () => { tarjetasIdx++; renderPart(); });
  }
  function construirTarjetas(p, tema) {
    const out = [];
    p.pasos.forEach(paso => {
      const txt = paso.plantilla_segmentos
        ? paso.plantilla_segmentos.map(s => s.tipo === 'fijo' ? s.texto : `[${s.label}]`).join('')
        : '';
      out.push({
        type: `Paso ${paso.n}`,
        front: paso.title,
        sub: paso.time + (paso.grammar ? ' · ' + paso.grammar : ''),
        back: txt,
        truco: paso.trick || ''
      });
    });
    out.push({
      type: 'Respuesta modelo',
      front: `Tema: ${tema.label}`,
      sub: 'Ejemplo completo',
      back: tema.respuesta_modelo,
      truco: 'Lee en voz alta tres veces. Luego repítelo sin mirar.'
    });
    return out;
  }

  // ============== DASHBOARD ==============
  function renderDashboard() {
    const main = document.getElementById('app-main');
    const stats = window.Examen ? window.Examen.cargarEstadisticas() : null;
    let html = `
      <div class="part-header">
        <h2 class="part-h2">📊 Mi progreso</h2>
        <p class="part-objective">Aquí ves tus intentos del modo Examen, agrupados por parte.</p>
      </div>
    `;
    if (!stats || !stats.intentos || !stats.intentos.length) {
      html += '<p class="mode-hint">Aún no hay intentos guardados. Ve a una parte → modo 🎯 Examen y empieza a practicar.</p>';
    } else {
      html += '<h3 class="dash-section">Resumen por parte</h3><div class="dash-blocks">';
      PARTS.forEach(pid => {
        const arr = stats.intentos.filter(i => i.parte === pid);
        const pct = arr.length ? Math.round(arr.reduce((s, i) => s + (i.score || 0), 0) / arr.length) : 0;
        const label = data[pid] ? data[pid].label : pid;
        html += `
          <div class="dash-block">
            <div class="dash-block-head"><h3>${escapeHtml(label)}</h3><span class="dash-block-pct">${pct}%</span></div>
            <p class="dash-count">${arr.length} intento${arr.length !== 1 ? 's' : ''}</p>
          </div>`;
      });
      html += '</div>';
      html += '<details class="historial-details" open><summary><strong>Historial completo</strong></summary><div style="padding:0.6rem">';
      stats.intentos.slice().reverse().slice(0, 50).forEach(i => {
        html += `
          <details class="hist-item">
            <summary><strong>${escapeHtml(i.fecha || '')}</strong> · ${escapeHtml(i.parte)} · ${escapeHtml(i.tema || '')} · ${i.score || 0}%</summary>
            <p class="hist-resp">${escapeHtml(i.transcripcion || '(sin transcripción)')}</p>
          </details>`;
      });
      html += '</div></details>';
      html += '<div class="dash-actions"><button class="btn btn-reset" id="btn-reset-app">🗑 Borrar historial</button></div>';
    }
    main.innerHTML = html;
    const btn = document.getElementById('btn-reset-app');
    if (btn) btn.addEventListener('click', resetApp);
  }
  function resetApp() {
    if (!confirm('¿Borrar todo el historial?')) return;
    if (window.Examen) window.Examen.borrarTodo();
    renderDashboard();
  }

  // ============== POPOVER ==============
  function openPopover(partId, pasoN, huecoId, anchorBtn) {
    const p = data[partId];
    const paso = p.pasos.find(x => x.n === pasoN);
    if (!paso || !paso.huecos || !paso.huecos[huecoId]) return;
    const h = paso.huecos[huecoId];
    const pop = document.getElementById('popover');
    pop.innerHTML = `
      <div class="popover-head">
        <h4 class="popover-title">Hueco: <span class="popover-marker">${escapeHtml(anchorBtn.textContent)}</span></h4>
        <button class="popover-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="popover-body">
        <span class="popover-tipo">${escapeHtml(h.tipo_palabra || '')}</span>
        <p class="popover-help">💡 ${escapeHtml(h.ayuda || '')}</p>
        <ul class="popover-options">
          ${(h.opciones || []).map(op => `
            <li class="popover-option" data-text="${escapeAttr(op.texto)}" tabindex="0">
              <span class="popover-option-text">${escapeHtml(op.texto)}</span>
              ${chipNivel(op.nivel)}
            </li>`).join('')}
        </ul>
        <p class="popover-hint">Toca una opción para escucharla 🔊</p>
      </div>
    `;
    pop.hidden = false;
    addBackdrop();
    pop.querySelector('.popover-close').addEventListener('click', closePopover);
    pop.querySelectorAll('.popover-option').forEach(li => {
      li.addEventListener('click', () => speak(li.dataset.text));
    });
  }
  function openConectorPopover(partId, pasoN) {
    const p = data[partId];
    const paso = p.pasos.find(x => x.n === pasoN);
    if (!paso || !paso.conector_inicial) return;
    const c = paso.conector_inicial;
    const pop = document.getElementById('popover');
    pop.innerHTML = `
      <div class="popover-head">
        <h4 class="popover-title">Conector · <span class="popover-marker">${escapeHtml(c.funcion || '')}</span></h4>
        <button class="popover-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="popover-body">
        <span class="popover-tipo">Alternativas para empezar este paso</span>
        <ul class="popover-options">
          ${(c.alternativas || []).map(a => `
            <li class="popover-option" data-text="${escapeAttr(a.texto)}" tabindex="0">
              <span class="popover-option-text">${escapeHtml(a.texto)}</span>
              ${chipNivel(a.nivel)}
            </li>`).join('')}
        </ul>
        <p class="popover-hint">Toca para escuchar 🔊</p>
      </div>
    `;
    pop.hidden = false;
    addBackdrop();
    pop.querySelector('.popover-close').addEventListener('click', closePopover);
    pop.querySelectorAll('.popover-option').forEach(li => {
      li.addEventListener('click', () => speak(li.dataset.text));
    });
  }
  function addBackdrop() {
    const old = document.getElementById('popover-backdrop');
    if (old) old.remove();
    const bd = document.createElement('div');
    bd.id = 'popover-backdrop';
    bd.className = 'popover-backdrop';
    document.body.appendChild(bd);
    bd.addEventListener('click', closePopover);
  }
  function closePopover() {
    const pop = document.getElementById('popover');
    if (pop) pop.hidden = true;
    const bd = document.getElementById('popover-backdrop');
    if (bd) bd.remove();
  }
  function bindPopoverDismiss() {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
  }

  // ============== UTIL ==============
  function speak(text) {
    if (!text) return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(stripTags(text));
      u.lang = 'en-GB'; u.rate = 0.92; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }
  function escapeAttr(s) { return escapeHtml(s); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAll);
  else loadAll();
})();
