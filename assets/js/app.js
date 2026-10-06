/* =====================================================================
   Informe Semanal - aplicacion (demo)
   La demo guarda los datos en el navegador (localStorage). La version
   final usa servidor Node.js + PostgreSQL con la misma estructura.
   ===================================================================== */
(function () {
  'use strict';
  const I = window.ISD;
  const { weekInfo, fmtDay, currentWeekId, shiftWeek, ratios, RATIO_DEFS, change, diagnose, val, contactos, viables, cumulative, strength, strengthSeries, MOTIVOS, FB_TIPOS, VALORACION, FONTS } = I;

  const STORE = 'isd_demo_v2';
  const AUTH = 'isd_auth';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
  const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
  const pct = (x, d = 1) => (x == null ? '–' : `${(x * 100).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
  const num = (x) => (x == null ? '–' : nf.format(x));
  const SERIES = ['#1F78A8', '#B03A7E'];                  // series secundarias (validadas con el color de marca)
  const ZC = { good: '#1F7A4D', warn: '#C98A1B', bad: '#B3402A' };

  /* ---------- Estado ---------- */
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const s = JSON.parse(raw); if (s && s.version === 2) return s; }
    } catch (e) { /* almacenamiento no disponible: se usa la semilla */ }
    return I.buildSeed();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); }
    catch (e) { toast('No se ha podido guardar en este navegador (espacio lleno o modo privado).', 'bad'); }
  }

  const company = () => S.companies.find((c) => c.id === S.ui.company) || S.companies[0];
  const props = () => S.properties.filter((p) => p.company === company().id);
  const prop = () => S.properties.find((p) => p.id === S.ui.property) || props()[0];
  const weeks = (pid) => (S.weeks[pid] || []).slice().sort((a, b) => a.week.localeCompare(b.week));
  const fields = () => S.fields.filter((f) => f.active);
  const repFields = () => fields().filter((f) => !S.report.hidden[f.key]);

  let focusWeek = null;   // semana seleccionada en Evolucion / Informe
  let editWeek = null;    // semana del formulario
  const charts = {};

  /* ---------- Color y tipografia ---------- */
  function hexToRgb(h) { const m = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(m.substr(i, 2), 16)); }
  function mix(h, w, t) { const a = hexToRgb(h), b = hexToRgb(w); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }
  function lum(h) { const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  const inkOn = (h) => (lum(h) > 0.33 ? '#111318' : '#FFFFFF');
  const fontStack = (f) => `"${f || 'Fraunces'}", Georgia, serif`;

  function applyTheme() {
    const c = company();
    const root = $('#app').style;
    root.setProperty('--brand', c.c1);
    root.setProperty('--brand-ink', inkOn(c.c1));
    root.setProperty('--accent', c.c2);
    root.setProperty('--accent-ink', inkOn(c.c2));
    root.setProperty('--accent-soft', mix(c.c2, '#FFFFFF', 0.88));
    root.setProperty('--accent-line', mix(c.c2, '#FFFFFF', 0.6));
    root.setProperty('--hfont', fontStack(c.font));
  }

  function logoHTML(c, cls = '') {
    if (c.logo) return `<span class="logo ${cls} has-img" style="background:${c.c1}"><img src="${esc(c.logo)}" alt=""></span>`;
    return `<span class="logo ${cls}" style="background:${c.c2};color:${inkOn(c.c2)};font-family:${esc(fontStack(c.font))}">${esc(c.short)}</span>`;
  }

  /* ---------- Toasts ---------- */
  function toast(msg, type = 'good', action) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="t-dot"></span><p>${msg}</p>${action ? `<button>${action.label}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 4200);
  }

  /* ---------- Login ---------- */
  function initLogin() {
    $('#pwToggle').onclick = () => { const i = $('#lgPass'); i.type = i.type === 'password' ? 'text' : 'password'; };
    $('#loginForm').onsubmit = (e) => {
      e.preventDefault();
      if ($('#lgUser').value.trim().toLowerCase() === 'asesor' && $('#lgPass').value === 'demo2026') {
        try { sessionStorage.setItem(AUTH, '1'); } catch (err) { /* sin sesion persistente */ }
        enterApp();
      } else {
        $('#lgError').hidden = false;
        $('.login-card').classList.remove('shake'); void $('.login-card').offsetWidth; $('.login-card').classList.add('shake');
      }
    };
  }
  function isAuthed() { try { return sessionStorage.getItem(AUTH) === '1'; } catch (e) { return false; } }

  function enterApp() {
    $('#login').classList.add('out');
    setTimeout(() => { $('#login').hidden = true; }, 500);
    $('#app').hidden = false;
    requestAnimationFrame(() => $('#app').classList.add('in'));
    const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
    if (v && ['semana', 'evolucion', 'informe', 'ajustes'].includes(v)) S.ui.view = v;
    renderAll();
  }

  /* ---------- Cabecera ---------- */
  function renderTop() {
    const c = company();
    $('#companyBtn').innerHTML = `${logoHTML(c, 'lg-sm')}<span class="cb-txt"><b>${esc(c.name)}</b><i>${props().length} inmuebles</i></span><svg class="ico chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;
    $('#companyMenu').innerHTML = `<div class="cm-label">Empresa</div>${S.companies.map((x) => `
      <button role="option" data-id="${x.id}" class="${x.id === c.id ? 'on' : ''}">${logoHTML(x, 'lg-sm')}<span><b>${esc(x.name)}</b><i>${S.properties.filter((p) => p.company === x.id).length} inmuebles</i></span>${x.id === c.id ? '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>' : ''}</button>`).join('')}
      <div class="cm-sep"></div><button class="cm-manage" data-manage><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Gestionar empresas</button>`;
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === S.ui.view));
  }

  function bindTop() {
    const menu = $('#companyMenu');
    $('#companyBtn').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#userMenu').hidden = true; };
    menu.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.manage !== undefined) setView('ajustes'); else if (b.dataset.id) switchCompany(b.dataset.id);
      menu.hidden = true;
    };
    $('#userBtn').onclick = (e) => { e.stopPropagation(); $('#userMenu').hidden = !$('#userMenu').hidden; menu.hidden = true; };
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#company')) menu.hidden = true;
      if (!e.target.closest('#user')) $('#userMenu').hidden = true;
    });
    $('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); };
    $('#resetDemo').onclick = () => { try { localStorage.removeItem(STORE); } catch (e) { /* nada */ } S = I.buildSeed(); focusWeek = editWeek = null; renderAll(); toast('Datos de prueba restablecidos.'); $('#userMenu').hidden = true; };
    $('#logout').onclick = () => { try { sessionStorage.removeItem(AUTH); } catch (e) { /* nada */ } location.href = 'app.html'; };
  }

  function switchCompany(id) {
    S.ui.company = id;
    const first = props()[0];
    S.ui.property = first ? first.id : null;
    focusWeek = editWeek = null;
    save();
    $('#app').classList.add('swap');
    setTimeout(() => $('#app').classList.remove('swap'), 450);
    renderAll();
    toast(`Empresa: <b>${esc(company().name)}</b>. Logo, colores y tipografía aplicados.`);
  }

  function setView(v) {
    S.ui.view = v; save();
    history.replaceState(null, '', `#/${v}`);
    renderTop(); renderView();
    $('#main').scrollTo({ top: 0 });
  }

  /* ---------- Lateral ---------- */
  function lastStrength(pid) { const l = weeks(pid); return l.length ? strength(l, l.length - 1) : null; }

  function renderSide() {
    const list = props();
    $('#side').innerHTML = `
      <div class="side-head"><b>Inmuebles</b><span>${list.length}</span></div>
      <div class="side-list">${list.map((p) => {
        const st = lastStrength(p.id), n = weeks(p.id).length;
        return `<button class="pitem ${p.id === S.ui.property ? 'on' : ''}" data-id="${p.id}">
          <img src="${esc(p.photo)}" alt="">
          <span class="pi-txt"><b>${esc(p.short || p.title)}</b><i>${esc(p.ref)} · ${money.format(p.price)}</i>
          <em>${n ? `Semana ${n} en el mercado` : 'Sin datos todavía'}${st ? ` · <span class="st ${st.zone.key}">${st.value} ${st.zone.label}</span>` : ''}</em></span>
        </button>`;
      }).join('') || '<p class="side-empty">Esta empresa aún no tiene inmuebles.</p>'}</div>
      <button class="side-add" data-add><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Nuevo inmueble</button>`;
    $('#side').onclick = (e) => {
      const b = e.target.closest('.pitem');
      if (b) { S.ui.property = b.dataset.id; focusWeek = editWeek = null; save(); renderSide(); renderView(); return; }
      if (e.target.closest('[data-add]')) { setView('ajustes'); setTimeout(() => { const el = $('#newProp'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('input', el).focus(); } }, 50); }
    };
  }

  function propHead(p, extra = '') {
    const st = lastStrength(p.id);
    return `<div class="phead">
      <img src="${esc(p.photo)}" alt="">
      <div class="ph-txt">
        <div class="ph-top"><h1 class="serif">${esc(p.short || p.title)}</h1>${st ? `<span class="pill ${st.zone.key}">Fuerza ${st.value} · ${st.zone.label}</span>` : ''}</div>
        <p>${esc(p.address)}</p>
        <div class="ph-meta"><span>${esc(p.type)}</span><span>${esc(p.ref)}</span><span>${money.format(p.price)}</span><span>Propietario: ${esc(p.owner)}</span><span>Publicado el ${fmtDay(p.published)}</span></div>
      </div>
      ${extra}
    </div>`;
  }

  function deltaHTML(cur, prev) {
    if (cur == null || prev == null) return '<em class="delta na">–</em>';
    if (cur === prev) return `<em class="delta flat">= ${prev < 5 ? '0' : '0 %'}</em>`;
    const up = cur > prev;
    const txt = prev < 5 ? `${up ? '+' : '−'}${Math.abs(cur - prev)}` : pct(Math.abs(change(cur, prev)), 0);
    return `<em class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${txt}</em>`;
  }
  function ptsHTML(cur, prev) {
    if (cur == null || prev == null) return '<em class="delta na">–</em>';
    const d = (cur - prev) * 100;
    if (Math.abs(d) < 0.05) return '<em class="delta flat">= 0 pt</em>';
    return `<em class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('es-ES', { maximumFractionDigits: 1 })} pt</em>`;
  }

  /* ---------- Indicador de aguja (canvas: se ve igual en pantalla y en el PDF) ---------- */
  function drawGauge(cv, value, w = 300, h = 172) {
    const dpr = 3;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const cx = w / 2, cy = h - 18, th = Math.round(w * 0.075), r = Math.min(w / 2 - th / 2 - 22, h - 34);
    const ang = (v) => Math.PI + (v / 100) * Math.PI;
    [[0, 40, ZC.bad], [40, 65, ZC.warn], [65, 100, ZC.good]].forEach(([a, b, c]) => {
      g.beginPath(); g.arc(cx, cy, r, ang(a) + 0.015, ang(b) - 0.015);
      g.strokeStyle = c; g.lineWidth = th; g.lineCap = 'butt'; g.stroke();
    });
    // marcas menores
    g.strokeStyle = 'rgba(17,19,24,.18)'; g.lineWidth = 1;
    for (let v = 0; v <= 100; v += 10) {
      const a = ang(v), r1 = r - th / 2 - 5, r2 = r - th / 2 - (v % 50 === 0 ? 12 : 9);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }
    g.fillStyle = '#6B7280'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [0, 40, 65, 100].forEach((v) => { const a = ang(v), rr = r + th / 2 + 12; g.fillText(String(v), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); });
    // aguja
    const a = ang(Math.max(0, Math.min(100, value)));
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.beginPath(); g.moveTo(0, -5); g.lineTo(r - 4, -1); g.lineTo(r - 4, 1); g.lineTo(0, 5); g.closePath();
    g.fillStyle = '#111318'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 4; g.fill();
    g.restore();
    g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fillStyle = '#111318'; g.fill();
    g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fillStyle = '#FFFFFF'; g.fill();
  }

  const zoneLines = {
    id: 'zoneLines',
    afterDatasetsDraw(ch) {
      const { ctx, chartArea: { left, right }, scales: { y } } = ch;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 1;
      [40, 65].forEach((v) => { const yy = y.getPixelForValue(v); ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke(); });
      ctx.restore();
      // valor de la primera y la ultima barra (en el PDF no hay tooltip)
      const meta = ch.getDatasetMeta(0), data = ch.data.datasets[0].data;
      ctx.save(); ctx.fillStyle = '#111318'; ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center';
      [0, data.length - 1].forEach((i) => { const bar = meta.data[i]; if (bar) ctx.fillText(String(data[i]), bar.x, bar.y - 6); });
      ctx.restore();
    },
  };
  function historyChart(id, series, labels, opts = {}) {
    killChart(id);
    const o = chartBase(opts.static ? { animation: false, responsive: false, devicePixelRatio: 3 } : {});
    o.scales.y.max = 100; o.scales.y.ticks.stepSize = 20;
    o.plugins.tooltip.callbacks = { label: (c) => ` Fuerza comercial: ${c.parsed.y} (${I.zoneOf(c.parsed.y).label})` };
    if (opts.static) o.plugins.tooltip = { enabled: false };
    o.layout = { padding: { top: 16 } };
    charts[id] = new Chart($(`#${id}`), {
      type: 'bar',
      data: { labels, datasets: [{ data: series, backgroundColor: series.map((v) => ZC[I.zoneOf(v).key]), borderRadius: 4, maxBarThickness: 34 }] },
      options: o, plugins: [zoneLines],
    });
  }

  /* ================= VISTA: SEMANA ================= */
  function defaultEditWeek(pid) {
    const list = weeks(pid), cur = currentWeekId();
    if (!list.length) return cur;
    const next = shiftWeek(list[list.length - 1].week, 1);
    return next > cur ? list[list.length - 1].week : next;
  }

  let fbDraft = [];
  function fbRow(f, i) {
    return `<div class="fbi" data-i="${i}">
      <div class="fbi-top">
        <select data-f="tipo" aria-label="Tipo">${Object.entries(FB_TIPOS).map(([k, l]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="date" data-f="fecha" value="${esc(f.fecha)}" aria-label="Fecha">
        <input data-f="nombre" value="${esc(f.nombre)}" placeholder="Nombre o cliente" aria-label="Nombre">
        <select data-f="valoracion" aria-label="Valoración" ${f.tipo === 'noViable' ? 'style="visibility:hidden"' : ''}>${Object.entries(VALORACION).map(([k, l]) => `<option value="${k}" ${f.valoracion === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="icon-btn" data-del title="Quitar"><svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="chips" ${f.tipo === 'noViable' ? 'hidden' : ''}>${MOTIVOS.map((m) => `<button type="button" class="chip ${(f.motivos || []).includes(m) ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <input class="fbi-com" data-f="comentario" value="${esc(f.comentario)}" placeholder="${f.tipo === 'noViable' ? 'Motivo del departamento hipotecario...' : 'Qué ha dicho: qué le gusta y qué no...'}">
    </div>`;
  }

  function viewSemana(el) {
    const p = prop();
    if (!p) { el.innerHTML = emptyState(); return; }
    if (!editWeek) editWeek = defaultEditWeek(p.id);
    const list = weeks(p.id);
    const wi = weekInfo(editWeek);
    const saved = list.find((w) => w.week === editWeek);
    const prevW = list.filter((w) => w.week < editWeek).pop();
    const first = list.length ? list[0].week : editWeek;
    const canPrev = editWeek > first, canNext = editWeek < currentWeekId();
    const weekNo = list.filter((w) => w.week < editWeek).length + 1;
    fbDraft = saved ? JSON.parse(JSON.stringify(saved.feedback || [])) : [];

    el.innerHTML = `
      ${propHead(p)}
      <div class="g-semana">
        <div class="card form-card">
          <div class="card-head">
            <div><h2>Datos de la semana</h2><p>Rellena los indicadores y el feedback, y pulsa <b>Guardar semana</b>. Usa Tab o Enter para pasar de un campo a otro.</p></div>
            <div class="week-pick">
              <button class="wp-btn" data-wk="-1" ${canPrev ? '' : 'disabled'} aria-label="Semana anterior"><svg class="ico" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
              <div class="wp-txt"><b>${wi.label}</b><span>${wi.range} · semana ${weekNo} en el mercado</span></div>
              <button class="wp-btn" data-wk="1" ${canNext ? '' : 'disabled'} aria-label="Semana siguiente"><svg class="ico" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
              <span class="badge ${saved ? 'saved' : 'new'}">${saved ? 'Guardada' : 'Nueva'}</span>
            </div>
          </div>

          <div class="inputs">${fields().map((f, i) => `
            <label class="inp ${f.key === 'noViables' ? 'inp-nv' : ''}">
              <span class="inp-label">${esc(f.label)}<i title="${esc(f.hint || '')}">${esc(f.hint || '')}</i></span>
              <input type="number" min="0" step="1" inputmode="numeric" data-k="${f.key}" data-i="${i}" value="${saved && val(saved, f.key) != null ? val(saved, f.key) : ''}" placeholder="">
              <span class="inp-foot"><i>Anterior: <b>${prevW ? num(val(prevW, f.key)) : '–'}</b></i><span class="live-delta" data-d="${f.key}"></span></span>
            </label>`).join('')}
          </div>

          <div class="fb-head"><div><h3>Feedback de la semana</h3><p>Una línea por visita, cliente del bufete o cliente no viable. Marca los motivos para que el informe los acumule.</p></div>
            <button class="btn btn-line btn-sm" id="fbAdd"><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Añadir feedback</button></div>
          <div class="fb-list" id="fbList"></div>

          <div class="warns" id="warns"></div>

          <div class="form-actions">
            <button class="btn btn-line" id="copyPrev" ${prevW ? '' : 'disabled'}><svg class="ico" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>Copiar semana anterior</button>
            <span class="spacer"></span>
            <button class="btn btn-accent" id="saveWeek"><svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>${saved ? 'Actualizar semana' : 'Guardar semana'}</button>
          </div>
        </div>

        <div class="card live-card">
          <div class="lc-head"><h3>Cálculo en vivo</h3><span class="eyebrow">${wi.short}</span></div>
          <div class="lc-gauge"><canvas id="liveGauge"></canvas><div id="liveGaugeTxt"></div></div>
          <div id="liveRatios"></div>
          <div class="lc-diag" id="liveDiag"></div>
        </div>
      </div>

      <div class="card hist-card">
        <div class="card-head"><div><h2>Histórico</h2><p>Cada semana guardada es una foto fija del inmueble. Pulsa una fila para editarla.</p></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Semana</th>${fields().map((f) => `<th class="n">${esc(f.short || f.label)}</th>`).join('')}<th class="n">Feedback</th><th class="n">Fuerza</th><th></th></tr></thead>
          <tbody>${list.map((w, i) => ({ w, i })).reverse().map(({ w, i }) => {
            const info = weekInfo(w.week), st = strength(list, i);
            return `<tr data-week="${w.week}" class="${w.week === editWeek ? 'on' : ''}">
              <td><b>${info.label}</b><span>${info.range}</span></td>
              ${fields().map((f) => `<td class="n">${num(val(w, f.key))}</td>`).join('')}
              <td class="n">${(w.feedback || []).length}</td>
              <td class="n"><span class="st ${st.zone.key}">${st.value}</span></td>
              <td class="n"><button class="icon-btn del" data-del="${w.week}" title="Borrar semana"><svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="${fields().length + 4}" class="empty">Todavía no hay semanas guardadas.</td></tr>`}</tbody>
        </table></div>
      </div>`;

    const inputs = $$('.inputs input', el);
    const readForm = () => {
      const values = {};
      fields().forEach((f) => { const v = $(`input[data-k="${f.key}"]`, el).value; values[f.key] = v === '' ? null : Math.max(0, Math.round(Number(v))); });
      const feedback = fbDraft.filter((f) => (f.nombre || '').trim() || (f.comentario || '').trim() || (f.motivos || []).length);
      return { week: editWeek, values, feedback };
    };
    const renderFb = () => {
      $('#fbList').innerHTML = fbDraft.length ? fbDraft.map(fbRow).join('') : '<p class="fb-empty">Sin feedback esta semana. Pulsa <b>Añadir feedback</b> para registrar una visita.</p>';
    };
    const refreshLive = () => {
      const draft = readForm();
      fields().forEach((f) => { $(`[data-d="${f.key}"]`, el).innerHTML = draft.values[f.key] == null ? '' : deltaHTML(draft.values[f.key], prevW ? val(prevW, f.key) : null); });
      const r = ratios(draft), rp = prevW ? ratios(prevW) : {};
      $('#liveRatios').innerHTML = RATIO_DEFS.map((d) => `
        <div class="lr"><span>${d.label}<i>${d.formula}</i></span><b>${pct(r[d.key], d.digits)}</b>${ptsHTML(r[d.key], rp[d.key])}</div>`).join('');
      const complete = fields().every((f) => draft.values[f.key] != null);
      if (complete) {
        const tmp = weeks(p.id).filter((w) => w.week !== editWeek).concat([draft]).sort((a, b) => a.week.localeCompare(b.week));
        const idx = tmp.findIndex((w) => w.week === editWeek);
        const st = strength(tmp, idx), d = diagnose(tmp, idx);
        drawGauge($('#liveGauge'), st.value, 240, 140);
        $('#liveGaugeTxt').innerHTML = `<b>${st.value}</b><span class="pill ${st.zone.key}">${st.zone.label}</span>`;
        $('#liveDiag').innerHTML = `<b>${esc(d.headline)}</b><p>${esc(d.rec)}</p>`;
      } else {
        drawGauge($('#liveGauge'), 0, 240, 140);
        $('#liveGaugeTxt').innerHTML = '<span class="muted small">Completa los datos para ver la fuerza comercial</span>';
        $('#liveDiag').innerHTML = '<p class="muted">El diagnóstico aparece al completar los datos.</p>';
      }
      $('#warns').innerHTML = warnings(draft.values, prevW).map((w) => `<div class="alert-row"><svg class="ico" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>${w}</div>`).join('');
    };

    renderFb();
    $('#fbAdd').onclick = () => {
      const n = new Date(), today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      const end = shiftWeek(editWeek, 1);
      fbDraft.push({ tipo: 'visita', fecha: today >= editWeek && today < end ? today : editWeek, nombre: '', valoracion: 'dudas', motivos: [], comentario: '' });
      renderFb(); const rows = $$('.fbi', el); $('input[data-f="nombre"]', rows[rows.length - 1]).focus();
    };
    $('#fbList').addEventListener('input', (e) => {
      const row = e.target.closest('.fbi'); if (!row) return;
      const f = fbDraft[Number(row.dataset.i)], key = e.target.dataset.f;
      if (key) f[key] = e.target.value;
      if (key === 'tipo') { renderFb(); }
    });
    $('#fbList').addEventListener('change', (e) => { if (e.target.dataset.f === 'tipo') { fbDraft[Number(e.target.closest('.fbi').dataset.i)].tipo = e.target.value; renderFb(); } });
    $('#fbList').addEventListener('click', (e) => {
      const row = e.target.closest('.fbi'); if (!row) return;
      const i = Number(row.dataset.i);
      const chip = e.target.closest('.chip');
      if (chip) { const m = chip.dataset.m, arr = fbDraft[i].motivos || (fbDraft[i].motivos = []); const k = arr.indexOf(m); if (k >= 0) arr.splice(k, 1); else arr.push(m); chip.classList.toggle('on'); }
      if (e.target.closest('[data-del]')) { fbDraft.splice(i, 1); renderFb(); }
    });

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', refreshLive);
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); else $('#fbAdd').focus(); });
    });
    $$('.wp-btn', el).forEach((b) => { b.onclick = () => { editWeek = shiftWeek(editWeek, Number(b.dataset.wk)); viewSemana(el); }; });
    $('#copyPrev').onclick = () => {
      if (!prevW) return;
      fields().forEach((f) => { $(`input[data-k="${f.key}"]`, el).value = val(prevW, f.key) ?? ''; });
      refreshLive(); inputs[0].focus(); inputs[0].select();
      toast('Datos de la semana anterior copiados. Cambia solo lo que se ha movido.');
    };
    $('#saveWeek').onclick = () => {
      const draft = readForm();
      const missing = fields().filter((f) => draft.values[f.key] == null);
      if (missing.length) {
        missing.forEach((f) => $(`input[data-k="${f.key}"]`, el).closest('.inp').classList.add('err'));
        toast(`Falta rellenar: ${missing.map((f) => f.label.toLowerCase()).join(', ')}.`, 'bad');
        return;
      }
      const arr = S.weeks[p.id] || (S.weeks[p.id] = []);
      const i = arr.findIndex((w) => w.week === editWeek);
      const rec = { ...draft, savedAt: Date.now() };
      if (i >= 0) arr[i] = rec; else arr.push(rec);
      save();
      const info = weekInfo(editWeek);
      focusWeek = editWeek; editWeek = null;
      renderSide(); viewSemana(el);
      toast(`<b>${info.label}</b> guardada. Fuerza comercial, acumulados y diagnóstico recalculados.`, 'good', { label: 'Ver evolución', fn: () => setView('evolucion') });
    };
    $$('tbody tr[data-week]', el).forEach((tr) => {
      tr.onclick = (e) => {
        const del = e.target.closest('[data-del]');
        if (del) {
          e.stopPropagation();
          if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.title = 'Pulsa otra vez para borrar'; setTimeout(() => del.classList.remove('confirm'), 2500); return; }
          S.weeks[p.id] = (S.weeks[p.id] || []).filter((w) => w.week !== del.dataset.del);
          save(); editWeek = focusWeek = null; renderSide(); viewSemana(el);
          toast('Semana borrada del histórico.', 'warn');
          return;
        }
        editWeek = tr.dataset.week; viewSemana(el);
        $('.form-card', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
    $$('.inp input', el).forEach((i) => i.addEventListener('input', () => i.closest('.inp').classList.remove('err')));
    refreshLive();
  }

  function warnings(v, prevW) {
    const out = [], has = (k) => v[k] != null;
    const cont = (v.solicitudes || 0) + (v.ofrecidos || 0);
    if (has('favoritos') && has('visualizaciones') && v.favoritos > v.visualizaciones) out.push('Hay más favoritos que visualizaciones. Revisa los datos.');
    if (has('solicitudes') && has('visualizaciones') && v.solicitudes > v.visualizaciones) out.push('Hay más solicitudes que visualizaciones del anuncio.');
    if (has('noViables') && v.noViables > cont) out.push('Hay más clientes no viables que contactos (solicitudes + clientes ofrecidos).');
    if (has('presenciales') && v.presenciales > cont) out.push('Hay más visitas presenciales que contactos esta semana. Si vienen de semanas anteriores es correcto.');
    if (has('ofertas') && has('presenciales') && v.ofertas > v.presenciales) out.push('Hay más ofertas que visitas presenciales esta semana.');
    if (prevW) {
      fields().forEach((f) => {
        const a = v[f.key], b = val(prevW, f.key);
        if (a != null && b != null && b >= 20 && Math.abs(a - b) / b > 0.6) out.push(`${f.label}: cambio del ${pct(Math.abs(a - b) / b, 0)} respecto a la semana anterior. ¿Es correcto?`);
      });
    }
    return out;
  }

  /* ================= VISTA: EVOLUCION ================= */
  function weekSelect(list) {
    return `<label class="wsel"><span>Semana</span><select id="wsel">${list.slice().reverse().map((w) => {
      const i = weekInfo(w.week); return `<option value="${w.week}" ${w.week === focusWeek ? 'selected' : ''}>${i.label} · ${i.range}</option>`;
    }).join('')}</select></label>`;
  }

  function partsHTML(st) {
    const P = [['visibilidad', 'Visibilidad', '20 %'], ['interes', 'Interés (contactos viables)', '30 %'], ['visita', 'Paso a visita', '30 %'], ['ofertas', 'Ofertas', '20 %']];
    return `<div class="parts">${P.map(([k, l, w]) => `<div class="part"><span>${l}<i>${w}</i></span><div class="pbar"><i style="width:${st.parts[k]}%;background:${ZC[I.zoneOf(st.parts[k]).key]}"></i></div><b>${st.parts[k]}</b></div>`).join('')}</div>`;
  }

  function feedbackItems(list, idx, limit) {
    const all = [];
    list.slice(0, idx + 1).forEach((w) => (w.feedback || []).forEach((f) => all.push(f)));
    all.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { items: limit ? all.slice(0, limit) : all, total: all.length };
  }
  function fbHTML(f) {
    const cls = f.tipo === 'noViable' ? 'nv' : f.valoracion;
    return `<div class="fbx ${cls}">
      <div class="fbx-top"><b>${esc((f.nombre || '').trim() || FB_TIPOS[f.tipo] || 'Cliente')}</b><span>${fmtDay(f.fecha)}</span><em>${f.tipo === 'noViable' ? 'No viable · financiación' : `${FB_TIPOS[f.tipo]} · ${VALORACION[f.valoracion] || ''}`}</em></div>
      <p>${esc(f.comentario)}</p>
      ${(f.motivos || []).length ? `<div class="mtags">${f.motivos.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
    </div>`;
  }
  function motivosHTML(acc) {
    if (!acc.topMotivos.length) return '<p class="muted small">Aún no hay motivos marcados en el feedback.</p>';
    const max = acc.topMotivos[0][1];
    return `<div class="mot">${acc.topMotivos.slice(0, 6).map(([m, n]) => `<div class="mot-row"><span>${esc(m)}</span><div class="mot-bar"><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>
      <p class="muted small">Sobre ${acc.feedback} comentarios de visitas y clientes desde la publicación.</p>`;
  }
  function cumulativeHTML(acc) {
    const items = [['Semanas en el mercado', acc.semanas], ['Visualizaciones', acc.visualizaciones], ['Contactos', acc.contactos], ['No viables', acc.noViables], ['Visitas presenciales', acc.presenciales], ['Ofertas', acc.ofertas]];
    return `<div class="acc">${items.map(([l, v]) => `<div><b>${num(v)}</b><span>${l}</span></div>`).join('')}</div>`;
  }

  function viewEvolucion(el) {
    const p = prop();
    if (!p) { el.innerHTML = emptyState(); return; }
    const list = weeks(p.id);
    if (!list.length) { el.innerHTML = propHead(p) + noWeeks(); bindNoWeeks(el); return; }
    if (!focusWeek || !list.find((w) => w.week === focusWeek)) focusWeek = list[list.length - 1].week;
    const idx = list.findIndex((w) => w.week === focusWeek);
    const cur = list[idx], prev = list[idx - 1];
    const upto = list.slice(0, idx + 1);
    const d = diagnose(list, idx), st = d.strength;
    const acc = cumulative(list, idx);
    const r = ratios(cur), rp = prev ? ratios(prev) : {};
    const fb = feedbackItems(list, idx, 6);

    el.innerHTML = `
      ${propHead(p, weekSelect(list))}
      <div class="g-top">
        <div class="card gauge-card">
          <div class="cc-head"><h3>Fuerza comercial</h3><span>Semana ${idx + 1} en el mercado</span></div>
          <div class="gc-body">
            <div class="gc-dial"><canvas id="gBig"></canvas><div class="gc-val"><b>${st.value}</b><span class="pill ${st.zone.key}">${st.zone.label}</span></div></div>
            ${partsHTML(st)}
          </div>
        </div>
        <div class="card chart-card">
          <div class="cc-head"><h3>Evolución de la fuerza comercial</h3><span>Desde la publicación · zonas 40 y 65</span></div>
          <div class="cc-body"><canvas id="chH"></canvas></div>
        </div>
      </div>

      <div class="kpis">${fields().map((f) => {
        const series = upto.slice(-8).map((w) => val(w, f.key));
        return `<div class="kpi card"><span>${esc(f.label)}</span><b>${num(val(cur, f.key))}</b>${deltaHTML(val(cur, f.key), prev ? val(prev, f.key) : null)}${spark(series)}</div>`;
      }).join('')}</div>

      <div class="card acc-card"><div class="cc-head"><h3>Acumulado desde la publicación</h3><span>Publicado el ${fmtDay(p.published)}</span></div>${cumulativeHTML(acc)}</div>

      <div class="g-evo">
        <div class="card chart-card">
          <div class="cc-head"><h3>Visualizaciones del anuncio</h3><span>Por semana</span></div>
          <div class="cc-body"><canvas id="ch1"></canvas></div>
        </div>
        <div class="card diag-card ${d.status.key}">
          <div class="dc-top"><span class="eyebrow">Diagnóstico comercial</span><span class="pill ${d.status.key}">${d.status.label}</span></div>
          <h3 class="serif">${esc(d.headline)}</h3>
          <ul>${d.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <p class="rec"><b>${esc(d.rec)}</b></p>
          <button class="btn btn-line btn-sm" id="toReport">Llevar al informe <svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>

        <div class="card chart-card">
          <div class="cc-head"><h3>Contactos y visitas presenciales</h3><span>Por semana</span></div>
          <div class="cc-body"><canvas id="ch2"></canvas></div>
        </div>
        <div class="card mot-card">
          <div class="cc-head"><h3>Motivos más repetidos</h3><span>Feedback acumulado</span></div>
          ${motivosHTML(acc)}
        </div>

        <div class="card ratio-card">
          <div class="cc-head"><h3>Ratios de conversión</h3><span>Frente a la semana anterior</span></div>
          <table class="tbl rt">
            <thead><tr><th>Ratio</th><th>Cálculo</th><th class="n">Esta semana</th><th class="n">Anterior</th><th class="n">Cambio</th></tr></thead>
            <tbody>${RATIO_DEFS.map((x) => `<tr><td><b>${x.label}</b></td><td class="f">${x.formula}</td><td class="n">${pct(r[x.key], x.digits)}</td><td class="n">${pct(rp[x.key], x.digits)}</td><td class="n">${ptsHTML(r[x.key], rp[x.key])}</td></tr>`).join('')}</tbody>
          </table>
          <p class="note">Los clientes no viables por financiación no cuentan como contacto útil: así no penalizan al inmueble.</p>
        </div>
        <div class="card fb-card">
          <div class="cc-head"><h3>Feedback reciente</h3><span>${fb.total} comentarios en total</span></div>
          <div class="fbx-list">${fb.items.map(fbHTML).join('') || '<p class="muted small">Sin feedback registrado.</p>'}</div>
        </div>
      </div>`;

    $('#wsel').onchange = (e) => { focusWeek = e.target.value; viewEvolucion(el); };
    $('#toReport').onclick = () => setView('informe');
    drawGauge($('#gBig'), st.value, 300, 172);
    historyChart('chH', strengthSeries(list, idx), upto.map((w, i) => `S${i + 1}`));
    drawEvoCharts(upto);
  }

  function spark(series) {
    const vals = series.filter((x) => x != null);
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
    const pts = series.map((v, i) => (v == null ? null : `${(i / (series.length - 1)) * 100},${28 - ((v - min) / rng) * 24}`)).filter(Boolean).join(' ');
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function chartBase(extra = {}) {
    return {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#111318', padding: 10, cornerRadius: 8, titleFont: { family: 'Inter', weight: '600' }, bodyFont: { family: 'Inter' }, boxPadding: 4, usePointStyle: true },
      },
      scales: {
        x: { grid: { display: false }, border: { color: '#E7E3DB' }, ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#EFEBE4' }, border: { display: false }, ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 }, precision: 0, callback: (v) => nf.format(v) } },
      },
      ...extra,
    };
  }
  const line = (label, data, color, fill) => ({
    label, data, borderColor: color, backgroundColor: fill ? mix(color, '#FFFFFF', 0.85) : color, fill: !!fill,
    borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2,
  });
  const legendOn = (o) => { o.plugins.legend = { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 18, color: '#3A3F48', font: { family: 'Inter', size: 12 } } }; return o; };
  function killChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  function drawEvoCharts(list) {
    const c = company();
    const labels = list.map((w, i) => `S${i + 1}`);
    ['ch1', 'ch2'].forEach(killChart);
    charts.ch1 = new Chart($('#ch1'), { type: 'line', data: { labels, datasets: [line('Visualizaciones', list.map((w) => val(w, 'visualizaciones')), c.c2, true)] }, options: chartBase() });
    charts.ch2 = new Chart($('#ch2'), {
      type: 'line',
      data: { labels, datasets: [line('Contactos viables', list.map((w) => viables(w)), c.c2), line('Visitas presenciales', list.map((w) => val(w, 'presenciales')), SERIES[0]), line('Ofertas', list.map((w) => val(w, 'ofertas')), SERIES[1])] },
      options: legendOn(chartBase()),
    });
  }

  /* ================= VISTA: INFORME (hasta 2 paginas) ================= */
  function repColors() {
    const c = company(), o = S.report.colors[c.id] || {};
    return { c1: o.c1 || c.c1, c2: o.c2 || c.c2 };
  }

  function viewInforme(el) {
    const p = prop();
    if (!p) { el.innerHTML = emptyState(); return; }
    const list = weeks(p.id);
    if (!list.length) { el.innerHTML = propHead(p) + noWeeks(); bindNoWeeks(el); return; }
    if (!focusWeek || !list.find((w) => w.week === focusWeek)) focusWeek = list[list.length - 1].week;
    const c = company(), col = repColors(), sec = S.report.sections;
    const dKey = `${p.id}|${focusWeek}`;
    const idx = list.findIndex((w) => w.week === focusWeek);
    const auto = diagnose(list, idx);
    const diagText = S.report.diag[dKey] ?? auto.text;
    const toggle = (key, label, on, attr) => `<label class="tg"><input type="checkbox" ${attr}="${key}" ${on ? 'checked' : ''}><span class="tg-ui"></span><span>${label}</span></label>`;

    el.innerHTML = `
      <div class="rep">
        <div class="rep-ctrl">
          <div class="card rc">
            <h3>Informe</h3>
            ${weekSelect(list)}
            <p class="muted small">Para: <b>${esc(p.owner)}</b></p>
          </div>
          <div class="card rc">
            <h3>Campos</h3>
            <div class="tg-list">${fields().map((f) => toggle(f.key, f.label, !S.report.hidden[f.key], 'data-field')).join('')}</div>
            <h4>Página 1</h4>
            <div class="tg-list">
              ${toggle('features', 'Características del inmueble', sec.features, 'data-sec')}
              ${toggle('gauge', 'Indicador de fuerza comercial', sec.gauge, 'data-sec')}
              ${toggle('kpis', 'Datos de la semana', sec.kpis, 'data-sec')}
              ${toggle('cumulative', 'Acumulado desde la publicación', sec.cumulative, 'data-sec')}
            </div>
            <h4>Página 2</h4>
            <div class="tg-list">
              ${toggle('charts', 'Impacto estadístico (gráficos)', sec.charts, 'data-sec')}
              ${toggle('ratios', 'Ratios y motivos', sec.ratios, 'data-sec')}
              ${toggle('feedback', 'Feedback de clientes', sec.feedback, 'data-sec')}
              ${toggle('diagnosis', 'Conclusión', sec.diagnosis, 'data-sec')}
            </div>
          </div>
          <div class="card rc">
            <h3>Colores y logotipo</h3>
            <div class="colors">
              <label class="color"><input type="color" id="col1" value="${col.c1}"><span>Principal</span><code>${col.c1.toUpperCase()}</code></label>
              <label class="color"><input type="color" id="col2" value="${col.c2}"><span>Acento</span><code>${col.c2.toUpperCase()}</code></label>
            </div>
            <div class="uploads">
              <label class="upl"><input type="file" accept="image/*" id="upLogo"><svg class="ico" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>Subir logotipo</label>
              <label class="upl"><input type="file" accept="image/*" id="upPhoto"><svg class="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8 8"/></svg>Cambiar imagen</label>
            </div>
            <button class="link" id="resetBrand">Volver a la marca de ${esc(c.name)}</button>
          </div>
          <div class="card rc">
            <h3>Conclusión</h3>
            <textarea id="diagTxt" rows="7">${esc(diagText)}</textarea>
            <div class="rc-foot"><span class="muted small">${S.report.diag[dKey] != null ? 'Texto editado a mano' : 'Generado a partir de los datos'}</span><button class="link" id="diagReset" ${S.report.diag[dKey] != null ? '' : 'hidden'}>Restablecer</button></div>
          </div>
        </div>

        <div class="rep-view">
          <div class="rv-bar">
            <div><b>Vista previa</b><span>A4 · hasta dos páginas · lo que ves es exactamente lo que se descarga</span></div>
            <button class="btn btn-accent" id="genPdf"><svg class="ico" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>Generar informe</button>
          </div>
          <div class="pages" id="pages"></div>
        </div>
      </div>`;

    renderPaper(); fitPaper();

    $('#wsel').onchange = (e) => { focusWeek = e.target.value; viewInforme(el); };
    $$('[data-field]', el).forEach((i) => { i.onchange = () => { S.report.hidden[i.dataset.field] = !i.checked; save(); renderPaper(); fitPaper(); }; });
    $$('[data-sec]', el).forEach((i) => { i.onchange = () => { S.report.sections[i.dataset.sec] = i.checked; save(); renderPaper(); fitPaper(); }; });
    const setCol = () => {
      S.report.colors[c.id] = { c1: $('#col1').value, c2: $('#col2').value };
      $$('.color code', el).forEach((cd, i) => { cd.textContent = [$('#col1').value, $('#col2').value][i].toUpperCase(); });
      save(); renderPaper(); fitPaper();
    };
    $('#col1').oninput = setCol; $('#col2').oninput = setCol;
    $('#upLogo').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; S.report.logos[c.id] = await readImage(f, 520, 'image/png'); save(); renderPaper(); fitPaper(); toast('Logotipo aplicado al informe.'); };
    $('#upPhoto').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; S.report.photos[p.id] = await readImage(f, 1100, 'image/jpeg'); save(); renderPaper(); fitPaper(); toast('Imagen del inmueble actualizada.'); };
    $('#resetBrand').onclick = () => { delete S.report.colors[c.id]; delete S.report.logos[c.id]; delete S.report.photos[p.id]; save(); viewInforme(el); toast('Marca de la empresa restablecida.'); };
    let t;
    $('#diagTxt').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.report.diag[dKey] = e.target.value; save(); renderPaper(); fitPaper(); $('#diagReset').hidden = false; }, 250); };
    $('#diagReset').onclick = () => { delete S.report.diag[dKey]; save(); viewInforme(el); };
    $('#genPdf').onclick = generatePDF;
  }

  function renderPaper() {
    const wrap = $('#pages'); if (!wrap) return;
    const p = prop(), c = company(), col = repColors(), sec = S.report.sections;
    const list = weeks(p.id);
    const idx = list.findIndex((w) => w.week === focusWeek);
    const cur = list[idx], prev = list[idx - 1];
    const info = weekInfo(cur.week);
    const d = diagnose(list, idx), st = d.strength;
    const acc = cumulative(list, idx);
    const dText = S.report.diag[`${p.id}|${cur.week}`] ?? d.text;
    const logo = S.report.logos[c.id] || c.logoFull || c.logo;
    const photo = S.report.photos[p.id] || p.photo;
    const fs = repFields();
    const r = ratios(cur), rp = prev ? ratios(prev) : {};
    const fb = feedbackItems(list, idx, 4);
    const today = new Date();
    const gen = `${today.getDate()} de ${today.toLocaleDateString('es-ES', { month: 'long' })} de ${today.getFullYear()}`;
    const page2 = sec.charts || sec.ratios || sec.feedback || sec.diagnosis;
    let secN = 0; const H = (t) => `${++secN}. ${t}`;   // secciones numeradas, como en vuestro informe actual
    const total = page2 ? 2 : 1;

    const head = (small) => `
      <header class="pp-head ${small ? 'small' : ''}">
        <div class="pp-brand">${logo ? `<img class="pp-logoimg" src="${esc(logo)}" alt="">` : `<span class="pp-logo">${esc(c.short)}</span><div><b>${esc(c.name)}</b><span>${esc(c.tagline || '')}</span></div>`}</div>
        <div class="pp-title"><span>Informe analítico estadístico</span><b>${info.label} · ${info.range} ${info.year}</b>${small ? '' : `<i>Semana ${idx + 1} desde la publicación</i>`}</div>
      </header>`;
    const foot = (n) => `<footer class="pp-foot"><span>${esc(c.address || c.name)}</span><span>Generado el ${gen}</span><span>Página ${n} de ${total}</span></footer>`;

    const p1 = `
      <div class="paper" data-page="1">
        ${head(false)}
        <section class="pp-prop">
          <div class="pp-photo"><img src="${esc(photo)}" alt=""></div>
          <div class="pp-info">
            <span class="pp-eyebrow">${H('Datos del inmueble')}</span>
            <h2>${esc(p.title)}</h2>
            <dl>
              <div><dt>Referencia</dt><dd>${esc(p.ref)}</dd></div>
              <div><dt>Precio</dt><dd>${money.format(p.price)}</dd></div>
              <div><dt>Propietario</dt><dd>${esc(p.owner)}</dd></div>
              <div><dt>Publicado</dt><dd>${fmtDay(p.published)}</dd></div>
            </dl>
            ${sec.features && (p.features || []).length ? `<div class="pp-feat">${p.features.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
          </div>
        </section>

        ${sec.gauge ? `<section class="pp-gauge">
          <div class="pg-dial"><h3>${H('Fuerza comercial')}</h3><canvas id="pg1"></canvas><div class="pg-val"><b>${st.value}</b><span class="pp-status ${st.zone.key}">${st.zone.label}</span></div></div>
          <div class="pg-hist"><h3>Evolución semana a semana</h3><canvas id="pg2" width="400" height="190"></canvas>
            <div class="pg-legend"><span><i style="background:${ZC.good}"></i>Favorable 65-100</span><span><i style="background:${ZC.warn}"></i>Atención 40-64</span><span><i style="background:${ZC.bad}"></i>Revisión 0-39</span></div></div>
        </section>` : ''}

        ${sec.kpis && fs.length ? `<section class="pp-block"><h3>${H('Datos de la semana')}</h3><div class="pp-kpis" style="grid-template-columns:repeat(${Math.min(fs.length, 7)},1fr)">${fs.map((f) => `
          <div><span>${esc(f.short || f.label)}</span><b>${num(val(cur, f.key))}</b>${deltaHTML(val(cur, f.key), prev ? val(prev, f.key) : null)}</div>`).join('')}</div></section>` : ''}

        ${sec.cumulative ? `<section class="pp-block"><h3>${H('Acumulado desde la publicación')}</h3>${cumulativeHTML(acc)}</section>` : ''}
        ${foot(1)}
      </div>`;

    const p2 = page2 ? `
      <div class="paper" data-page="2">
        ${head(true)}
        ${sec.charts ? `<section class="pp-block"><h3>${H('Impacto estadístico')}</h3><div class="pp-charts">
          <figure><figcaption>Visualizaciones del anuncio</figcaption><canvas id="pc1" width="330" height="132"></canvas></figure>
          <figure><figcaption>Contactos viables y visitas presenciales</figcaption><canvas id="pc2" width="330" height="132"></canvas>
            <div class="pp-legend"><span><i style="background:${col.c2}"></i>Contactos viables</span><span><i style="background:${SERIES[0]}"></i>Visitas presenciales</span></div></figure>
        </div><p class="pp-impact">${esc(impactText(acc, c))}</p></section>` : ''}

        ${sec.ratios ? `<section class="pp-row">
          <div class="pp-ratios"><h3>${H('Ratios de conversión')}</h3><table>
            <thead><tr><th></th><th>Semana</th><th>Anterior</th></tr></thead>
            <tbody>${RATIO_DEFS.map((x) => `<tr><td>${x.label}<i>${x.formula}</i></td><td>${pct(r[x.key], x.digits)}</td><td>${pct(rp[x.key], x.digits)}</td></tr>`).join('')}</tbody></table>
            ${acc.noViables ? `<p class="pp-note">${acc.noViables} ${acc.noViables === 1 ? 'cliente no viable' : 'clientes no viables'} por financiación desde la publicación, excluidos de los ratios.</p>` : ''}</div>
          <div class="pp-mot"><h3>${H('Motivos más repetidos')}</h3>${motivosHTML(acc)}</div>
        </section>` : ''}

        ${sec.feedback && fb.items.length ? `<section class="pp-block"><h3>${H('Feedback')}</h3><div class="pp-fb">${fb.items.map(fbHTML).join('')}</div>
          ${fb.total > fb.items.length ? `<p class="pp-note">Se muestran los ${fb.items.length} comentarios más recientes de ${fb.total}.</p>` : ''}</section>` : ''}

        ${sec.diagnosis ? `<section class="pp-diag"><h3>${H('Conclusión')}</h3><p>${esc(dText)}</p></section>` : ''}
        ${foot(2)}
      </div>` : '';

    wrap.innerHTML = p1 + p2;
    $$('.paper', wrap).forEach((pp) => {
      pp.style.setProperty('--p1', col.c1);
      pp.style.setProperty('--p1-ink', inkOn(col.c1));
      pp.style.setProperty('--p2', col.c2);
      pp.style.setProperty('--p2-soft', mix(col.c2, '#FFFFFF', 0.9));
      pp.style.setProperty('--p2-ink', inkOn(col.c2));
      pp.style.setProperty('--pfont', fontStack(c.font));
    });
    if (sec.gauge) {
      drawGauge($('#pg1'), st.value, 280, 160);
      historyChart('pg2', strengthSeries(list, idx), list.slice(0, idx + 1).map((w, i) => `S${i + 1}`), { static: true });
    }
    if (page2 && sec.charts) drawPaperCharts(list.slice(0, idx + 1), col);
  }

  // Parrafo de impacto estadistico, con la misma redaccion que vuestros informes actuales
  function impactText(acc, c) {
    const s1 = acc.solicitudes === 1 ? '1 solicitud de información' : `${num(acc.solicitudes)} solicitudes de información`;
    const s2 = acc.ofrecidos === 1 ? '1 cliente' : `${num(acc.ofrecidos)} clientes`;
    const s3 = acc.presenciales === 1 ? '1 visita presencial' : `${num(acc.presenciales)} visitas presenciales`;
    return `Durante las ${acc.semanas} ${acc.semanas === 1 ? 'semana' : 'semanas'} desde la publicación, el anuncio ha obtenido ${num(acc.visualizaciones)} visualizaciones y se han recibido un total de ${s1} a través de portales inmobiliarios. Además, la vivienda ha sido ofrecida directamente a ${s2} de la base de datos ${c.dbLabel || 'de la empresa'}, generándose ${s3} en total.`;
  }

  function drawPaperCharts(list, col) {
    ['pc1', 'pc2'].forEach(killChart);
    const labels = list.map((w, i) => `S${i + 1}`);
    const opts = () => { const o = chartBase({ animation: false, responsive: false, devicePixelRatio: 3 }); o.plugins.tooltip = { enabled: false }; o.scales.x.ticks.font.size = 10; o.scales.y.ticks.font.size = 10; return o; };
    const pl = (l, d, color, fill) => ({ ...line(l, d, color, fill), pointRadius: 2.5, pointBorderWidth: 0 });
    charts.pc1 = new Chart($('#pc1'), { type: 'line', data: { labels, datasets: [pl('Visualizaciones', list.map((w) => val(w, 'visualizaciones')), col.c2, true)] }, options: opts() });
    charts.pc2 = new Chart($('#pc2'), { type: 'line', data: { labels, datasets: [pl('Contactos viables', list.map((w) => viables(w)), col.c2), pl('Visitas presenciales', list.map((w) => val(w, 'presenciales')), SERIES[0])] }, options: opts() });
  }

  function fitPaper() {
    const wrap = $('#pages'); if (!wrap) return;
    const scale = Math.min(1, (wrap.clientWidth - 2) / 794);
    $$('.paper', wrap).forEach((pp) => { pp.style.transform = `scale(${scale})`; pp.parentElement; });
    $$('.paper', wrap).forEach((pp) => { pp.style.marginBottom = `${-1123 * (1 - scale) + 24}px`; });
  }
  window.addEventListener('resize', () => { if (S.ui.view === 'informe') fitPaper(); });

  async function generatePDF() {
    const p = prop(), info = weekInfo(focusWeek);
    $('#gen').hidden = false;
    requestAnimationFrame(() => $('#gen').classList.add('in'));
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const pages = $$('#pages .paper');
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2, useCORS: true, backgroundColor: '#FFFFFF', width: 794, height: 1123, windowWidth: 1400,
          onclone: (doc) => {
            // la copia se captura sin escala ni animaciones: identica a la vista previa a tamano real
            const st = doc.createElement('style');
            st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
            doc.head.appendChild(st);
            doc.querySelectorAll('.paper').forEach((pp) => { pp.style.transform = 'none'; pp.style.marginBottom = '0'; pp.style.opacity = '1'; });
          },
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
      }
      pdf.setProperties({ title: `Informe ${p.title} ${info.label}`, author: company().name });
      const name = `Informe_${p.ref.replace(/[^A-Za-z0-9-]/g, '')}_${info.short}_${info.year}.pdf`;
      pdf.save(name);
      toast(`PDF descargado (${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}): <b>${name}</b>`);
    } catch (err) {
      console.error(err);
      toast('No se ha podido generar el PDF en este navegador.', 'bad');
    } finally {
      $('#gen').classList.remove('in');
      setTimeout(() => { $('#gen').hidden = true; }, 350);
    }
  }

  function readImage(file, max, type) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          const ctx = cv.getContext('2d');
          if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL(type, 0.86));
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* ================= VISTA: AJUSTES ================= */
  function viewAjustes(el) {
    const R = I.REF;
    el.innerHTML = `
      <div class="aj-head"><h1 class="serif">Ajustes</h1><p>Empresas, campos, inmuebles, usuarios e indicador de fuerza. Solo para administradores.</p></div>
      <div class="g-aj">
        <div class="card">
          <div class="card-head"><div><h2>Empresas</h2><p>Logo, colores y tipografía se aplican a la aplicación y al informe.</p></div></div>
          <div class="co-list">${S.companies.map((c) => `
            <div class="co" data-id="${c.id}">
              ${logoHTML(c, 'lg-md')}
              <div class="co-txt">
                <input class="co-name" value="${esc(c.name)}" aria-label="Nombre">
                <input class="co-addr" value="${esc(c.address || '')}" placeholder="Dirección para el pie del informe" aria-label="Dirección">
                <select class="co-font" aria-label="Tipografía">${FONTS.map((f) => `<option ${c.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
              </div>
              <label class="sw-in" title="Color principal"><input type="color" data-c="c1" value="${c.c1}"></label>
              <label class="sw-in" title="Color de acento"><input type="color" data-c="c2" value="${c.c2}"></label>
              <label class="icon-btn" title="Subir logo"><input type="file" accept="image/*" data-logo hidden><svg class="ico" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg></label>
            </div>`).join('')}
          </div>
          <form class="inline-form" id="newCo">
            <input name="name" placeholder="Nombre de la nueva empresa" required>
            <input type="color" name="c1" value="#22303C" title="Principal"><input type="color" name="c2" value="#2A9D8F" title="Acento">
            <button class="btn btn-dark btn-sm">Añadir</button>
          </form>
        </div>

        <div class="card">
          <div class="card-head"><div><h2>Campos</h2><p>Activa, desactiva o añade indicadores. El cambio llega al formulario, a la evolución y al PDF.</p></div></div>
          <div class="fl-list">${S.fields.map((f) => `
            <div class="fl">
              <label class="tg"><input type="checkbox" data-active="${f.key}" ${f.active ? 'checked' : ''}><span class="tg-ui"></span></label>
              <div><b>${esc(f.label)}</b><code>${esc(f.key)}</code>${f.custom ? '<span class="tag">Nuevo</span>' : ''}</div>
              ${f.custom ? `<button class="icon-btn" data-delfield="${f.key}" title="Quitar campo"><svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>` : '<span></span>'}
            </div>`).join('')}
          </div>
          <form class="inline-form" id="newField">
            <input name="label" placeholder="Nuevo campo, p. ej. Llamadas recibidas" required>
            <button class="btn btn-dark btn-sm">Añadir campo</button>
          </form>
          <p class="note">En el código, los campos viven en un solo archivo de configuración. La guía explica cómo añadir o quitar uno en tres pasos.</p>
        </div>

        <div class="card">
          <div class="card-head"><div><h2>Indicador de fuerza comercial</h2><p>Cómo se calcula la aguja. Los pesos y las zonas se ajustan con vosotros.</p></div></div>
          <div class="ref-grid">
            <div><b>20 %</b><span>Visibilidad</span><i>Visualizaciones frente a lo esperable para su semana en el mercado</i></div>
            <div><b>30 %</b><span>Interés</span><i>Contactos viables por cada 1.000 visualizaciones (referencia ${String(R.contactosPorMil).replace('.', ',')})</i></div>
            <div><b>30 %</b><span>Paso a visita</span><i>Visitas presenciales frente a contactos viables (referencia ${R.pasoVisita * 100} %)</i></div>
            <div><b>20 %</b><span>Ofertas</span><i>Ofertas recientes; muchas visitas acumuladas sin oferta restan</i></div>
          </div>
          <div class="zones"><span class="pill good">Favorable 65-100</span><span class="pill warn">Atención 40-64</span><span class="pill bad">Revisión 0-39</span></div>
        </div>

        <div class="card">
          <div class="card-head"><div><h2>Usuarios</h2><p>Seis accesos, uno por asesor. Cada usuario entra con su contraseña.</p></div></div>
          <div class="users">
            <div><span class="avatar dark">DG</span><div><b>David</b><i>Administrador · todas las empresas</i></div></div>
            ${['Laura Gómez', 'Pablo Ortega', 'Marta Soler', 'Javier Ruiz', 'Elena Mora'].map((n) => `<div><span class="avatar">${n.split(' ').map((x) => x[0]).join('')}</span><div><b>${n}</b><i>Asesor · García-Toledano y AS</i></div></div>`).join('')}
          </div>
          <p class="note">En la versión final: contraseñas cifradas, sesiones seguras y conexión HTTPS.</p>
        </div>

        <div class="card full" id="newProp">
          <div class="card-head"><div><h2>Nuevo inmueble</h2><p>Se añade a la empresa seleccionada: <b>${esc(company().name)}</b>.</p></div></div>
          <form class="grid-form three" id="propForm">
            <label class="span2"><span>Título del anuncio</span><input name="title" placeholder="Piso en venta en C/ Mayor, 20 – San Vicente del Raspeig" required></label>
            <label><span>Nombre corto</span><input name="short" placeholder="Piso C/ Mayor, 20"></label>
            <label class="span2"><span>Dirección</span><input name="address" placeholder="C/ Mayor, 20, 2º A · San Vicente del Raspeig" required></label>
            <label><span>Tipo</span><input name="type" placeholder="Piso"></label>
            <label><span>Referencia</span><input name="ref" placeholder="GT-0450"></label>
            <label><span>Precio (€)</span><input name="price" type="number" min="0" placeholder="220000"></label>
            <label><span>Propietario</span><input name="owner" placeholder="D. Nombre Apellido"></label>
            <label class="full"><span>Características (una por línea)</span><textarea name="features" rows="3" placeholder="156 m² construidos&#10;3 dormitorios&#10;2 baños"></textarea></label>
            <label class="span2"><span>Foto</span><input name="photo" type="file" accept="image/*"></label>
            <div class="right"><button class="btn btn-accent">Crear inmueble</button></div>
          </form>
        </div>
      </div>`;

    $$('.co', el).forEach((row) => {
      const c = S.companies.find((x) => x.id === row.dataset.id);
      $('.co-name', row).onchange = (e) => { c.name = e.target.value.trim() || c.name; c.short = initials(c.name); save(); renderTop(); renderSide(); };
      $('.co-addr', row).onchange = (e) => { c.address = e.target.value.trim(); save(); };
      $('.co-font', row).onchange = (e) => { c.font = e.target.value; save(); if (c.id === company().id) applyTheme(); viewAjustes(el); renderTop(); toast(`Tipografía de ${esc(c.name)}: ${esc(c.font)}.`); };
      $$('input[type=color]', row).forEach((i) => { i.oninput = () => { c[i.dataset.c] = i.value; save(); if (c.id === company().id) applyTheme(); renderTop(); }; i.onchange = () => viewAjustes(el); });
      $('[data-logo]', row).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; c.logo = await readImage(f, 520, 'image/png'); save(); renderTop(); viewAjustes(el); toast(`Logo de ${esc(c.name)} actualizado.`); };
    });
    $('#newCo').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), name = fd.get('name').trim(), id = `c${Date.now().toString(36)}`;
      S.companies.push({ id, name, short: initials(name), c1: fd.get('c1'), c2: fd.get('c2'), font: 'Inter', logo: null, tagline: 'Inmobiliaria', address: '' });
      save(); viewAjustes(el); renderTop();
      toast(`Empresa <b>${esc(name)}</b> creada.`, 'good', { label: 'Cambiar a ella', fn: () => switchCompany(id) });
    };
    $$('[data-active]', el).forEach((i) => {
      i.onchange = () => {
        const f = S.fields.find((x) => x.key === i.dataset.active);
        if (!i.checked && S.fields.filter((x) => x.active).length === 1) { i.checked = true; toast('Debe quedar al menos un campo activo.', 'warn'); return; }
        f.active = i.checked; save();
        toast(`${esc(f.label)} ${f.active ? 'activado' : 'desactivado'} en formulario, evolución e informe.`);
      };
    });
    $$('[data-delfield]', el).forEach((b) => { b.onclick = () => { S.fields = S.fields.filter((f) => f.key !== b.dataset.delfield); save(); viewAjustes(el); toast('Campo quitado.', 'warn'); }; });
    $('#newField').onsubmit = (e) => {
      e.preventDefault();
      const label = new FormData(e.target).get('label').trim();
      let key = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo';
      while (S.fields.some((f) => f.key === key)) key += '_2';
      S.fields.push({ key, label, short: label.length > 14 ? `${label.slice(0, 13)}.` : label, hint: 'Campo añadido por el administrador', active: true, custom: true });
      save(); viewAjustes(el);
      toast(`Campo <b>${esc(label)}</b> añadido. Ya aparece en la pestaña Semana y en el informe.`, 'good', { label: 'Probarlo', fn: () => setView('semana') });
    };
    $('#propForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), file = fd.get('photo');
      const photo = file && file.size ? await readImage(file, 1100, 'image/jpeg') : 'assets/media/p4.jpg';
      const id = `p${Date.now().toString(36)}`;
      const title = fd.get('title').trim();
      S.properties.push({
        id, company: company().id, title, short: fd.get('short').trim() || title, address: fd.get('address').trim(),
        type: fd.get('type').trim() || 'Vivienda', ref: fd.get('ref').trim() || `${company().short}-${String(S.properties.length + 1).padStart(4, '0')}`,
        price: Number(fd.get('price')) || 0, owner: fd.get('owner').trim() || 'Sin asignar', photo,
        features: String(fd.get('features') || '').split('\n').map((x) => x.trim()).filter(Boolean), published: currentWeekId(),
      });
      S.weeks[id] = [];
      S.ui.property = id; focusWeek = editWeek = null;
      save(); renderTop(); renderSide(); setView('semana');
      toast('Inmueble creado. Introduce su primera semana.');
    };
  }
  const initials = (name) => name.replace(/&/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'E';

  /* ---------- Estados vacios ---------- */
  function emptyState() {
    return '<div class="empty-card card"><h2 class="serif">Sin inmuebles</h2><p>Esta empresa todavía no tiene inmuebles.</p><button class="btn btn-accent" onclick="document.querySelector(\'[data-add]\').click()">Crear el primero</button></div>';
  }
  function noWeeks() {
    return '<div class="empty-card card"><h2 class="serif">Aún no hay semanas</h2><p>Guarda la primera semana de este inmueble para ver la fuerza comercial, la evolución y el informe.</p><button class="btn btn-accent" data-go="semana">Introducir datos</button></div>';
  }
  function bindNoWeeks(el) { const b = $('[data-go]', el); if (b) b.onclick = () => setView('semana'); }

  /* ---------- Render ---------- */
  function renderView() {
    Object.keys(charts).forEach(killChart);
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === `view-${S.ui.view}`));
    const el = $(`#view-${S.ui.view}`);
    ({ semana: viewSemana, evolucion: viewEvolucion, informe: viewInforme, ajustes: viewAjustes })[S.ui.view](el);
  }
  function renderAll() {
    if (!S.properties.find((p) => p.id === S.ui.property && p.company === S.ui.company)) { const f = props()[0]; S.ui.property = f ? f.id : null; }
    applyTheme(); renderTop(); renderSide(); renderView();
  }

  /* ---------- Arranque ---------- */
  if (window.Chart) { Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.color = '#6B7280'; }
  initLogin();
  bindTop();
  if (isAuthed()) { $('#login').hidden = true; enterApp(); }
})();
