/* =====================================================================
   Informe Semanal - aplicacion (demo)
   La demo guarda los datos en el navegador (localStorage). La version
   final usa servidor Node.js + PostgreSQL con la misma estructura.
   ===================================================================== */
(function () {
  'use strict';
  const { buildSeed, weekInfo, currentWeekId, shiftWeek, ratios, RATIO_DEFS, change, diagnose, val } = window.ISD;

  const STORE = 'isd_demo_v1';
  const AUTH = 'isd_auth';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('es-ES');
  const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const pct = (x, d = 1) => (x == null ? '–' : `${(x * 100).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
  const num = (x) => (x == null ? '–' : nf.format(x));
  const SERIES = ['#1F78A8', '#B03A7E']; // colores fijos de series secundarias (validados con el color de marca)

  /* ---------- Estado ---------- */
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) return s; }
    } catch (e) { /* almacenamiento no disponible: se usa la semilla */ }
    return buildSeed();
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

  // Semana seleccionada para Evolucion / Informe (por defecto, la ultima guardada)
  let focusWeek = null;
  // Semana que se esta editando en el formulario
  let editWeek = null;
  const charts = {};

  /* ---------- Color ---------- */
  function hexToRgb(h) { const m = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(m.substr(i, 2), 16)); }
  function mix(h, w, t) { const a = hexToRgb(h), b = hexToRgb(w); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }
  function lum(h) { const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  const inkOn = (h) => (lum(h) > 0.45 ? '#111318' : '#FFFFFF');

  function applyTheme() {
    const c = company();
    const root = $('#app').style;
    root.setProperty('--brand', c.c1);
    root.setProperty('--brand-ink', inkOn(c.c1));
    root.setProperty('--brand-2', mix(c.c1, inkOn(c.c1) === '#FFFFFF' ? '#FFFFFF' : '#000000', 0.1));
    root.setProperty('--accent', c.c2);
    root.setProperty('--accent-ink', inkOn(c.c2));
    root.setProperty('--accent-soft', mix(c.c2, '#FFFFFF', 0.88));
    root.setProperty('--accent-line', mix(c.c2, '#FFFFFF', 0.6));
  }

  function logoHTML(c, cls = '', override) {
    const src = override || c.logo;
    if (src) return `<span class="logo ${cls} has-img"><img src="${src}" alt=""></span>`;
    return `<span class="logo ${cls}" style="background:${c.c2};color:${inkOn(c.c2)}">${esc(c.short)}</span>`;
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

  /* ---------- Cabecera: empresa, pestanas, usuario ---------- */
  function renderTop() {
    const c = company();
    $('#companyBtn').innerHTML = `${logoHTML(c, 'lg-sm')}<span class="cb-txt"><b>${esc(c.name)}</b><i>${props().length} inmuebles</i></span><svg class="ico chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;
    $('#companyMenu').innerHTML = `<div class="cm-label">Empresa</div>${S.companies.map((x) => `
      <button role="option" data-id="${x.id}" class="${x.id === c.id ? 'on' : ''}">${logoHTML(x, 'lg-sm')}<span><b>${esc(x.name)}</b><i>${S.properties.filter((p) => p.company === x.id).length} inmuebles</i></span>${x.id === c.id ? '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>' : ''}</button>`).join('')}
      <div class="cm-sep"></div><button class="cm-manage" data-manage>
      <svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Gestionar empresas</button>`;
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === S.ui.view));
  }

  function bindTop() {
    const menu = $('#companyMenu');
    $('#companyBtn').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#userMenu').hidden = true; };
    menu.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.manage !== undefined) { setView('ajustes'); }
      else if (b.dataset.id) { switchCompany(b.dataset.id); }
      menu.hidden = true;
    };
    $('#userBtn').onclick = (e) => { e.stopPropagation(); $('#userMenu').hidden = !$('#userMenu').hidden; menu.hidden = true; };
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#company')) menu.hidden = true;
      if (!e.target.closest('#user')) $('#userMenu').hidden = true;
    });
    $('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); };
    $('#resetDemo').onclick = () => { try { localStorage.removeItem(STORE); } catch (e) { /* nada */ } S = buildSeed(); focusWeek = editWeek = null; renderAll(); toast('Datos de prueba restablecidos.'); $('#userMenu').hidden = true; };
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
    toast(`Empresa: <b>${esc(company().name)}</b>. Logo y colores aplicados.`);
  }

  function setView(v) {
    S.ui.view = v; save();
    history.replaceState(null, '', `#/${v}`);
    renderTop(); renderView();
    $('#main').scrollTo({ top: 0 });
  }

  /* ---------- Lateral: inmuebles ---------- */
  function statusOf(pid) {
    const list = weeks(pid);
    return list.length ? diagnose(list, list.length - 1) : null;
  }

  function renderSide() {
    const list = props();
    $('#side').innerHTML = `
      <div class="side-head"><b>Inmuebles</b><span>${list.length}</span></div>
      <div class="side-list">${list.map((p) => {
        const st = statusOf(p.id);
        const w = weeks(p.id);
        return `<button class="pitem ${p.id === S.ui.property ? 'on' : ''}" data-id="${p.id}">
          <img src="${esc(p.photo)}" alt="">
          <span class="pi-txt"><b>${esc(p.title)}</b><i>${esc(p.ref)} · ${money.format(p.price)}</i>
          <em>${w.length} semanas${st ? ` · <span class="st ${st.status.key}">${st.status.label}</span>` : ''}</em></span>
        </button>`;
      }).join('') || '<p class="side-empty">Esta empresa aún no tiene inmuebles.</p>'}</div>
      <button class="side-add" data-add><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Nuevo inmueble</button>`;
    $('#side').onclick = (e) => {
      const b = e.target.closest('.pitem');
      if (b) { S.ui.property = b.dataset.id; focusWeek = editWeek = null; save(); renderSide(); renderView(); if (window.innerWidth < 1100) $('#main').scrollIntoView({ behavior: 'smooth' }); return; }
      if (e.target.closest('[data-add]')) { setView('ajustes'); setTimeout(() => { const el = $('#newProp'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('input', el).focus(); } }, 50); }
    };
  }

  /* ---------- Cabecera del inmueble ---------- */
  function propHead(p, extra = '') {
    const st = statusOf(p.id);
    return `<div class="phead">
      <img src="${esc(p.photo)}" alt="">
      <div class="ph-txt">
        <div class="ph-top"><h1 class="serif">${esc(p.title)}</h1>${st ? `<span class="pill ${st.status.key}">${st.status.label}</span>` : ''}</div>
        <p>${esc(p.address)}</p>
        <div class="ph-meta"><span>${esc(p.type)}</span><span>${esc(p.ref)}</span><span>${money.format(p.price)}</span><span>Propietario: ${esc(p.owner)}</span></div>
      </div>
      ${extra}
    </div>`;
  }

  function deltaHTML(cur, prev) {
    if (cur == null || prev == null) return '<em class="delta na">–</em>';
    if (cur === prev) return `<em class="delta flat">= ${prev < 5 ? '0' : '0 %'}</em>`;
    const up = cur > prev;
    const txt = prev < 5 ? `${up ? '+' : '−'}${Math.abs(cur - prev)}` : pct(Math.abs(change(cur, prev)));
    return `<em class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${txt}</em>`;
  }
  function ptsHTML(cur, prev) {
    if (cur == null || prev == null) return '<em class="delta na">–</em>';
    const d = (cur - prev) * 100;
    if (Math.abs(d) < 0.05) return '<em class="delta flat">= 0 pt</em>';
    return `<em class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('es-ES', { maximumFractionDigits: 1 })} pt</em>`;
  }

  /* ================= VISTA: SEMANA ================= */
  function defaultEditWeek(pid) {
    const list = weeks(pid);
    const cur = currentWeekId();
    if (!list.length) return cur;
    const next = shiftWeek(list[list.length - 1].week, 1);
    return next > cur ? list[list.length - 1].week : next;
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
    const canPrev = editWeek > first;
    const canNext = editWeek < currentWeekId();

    el.innerHTML = `
      ${propHead(p)}
      <div class="g-semana">
        <div class="card form-card">
          <div class="card-head">
            <div><h2>Datos de la semana</h2><p>Rellena los indicadores y pulsa <b>Guardar semana</b>. Usa Tab o Enter para pasar de un campo a otro.</p></div>
            <div class="week-pick">
              <button class="wp-btn" data-wk="-1" ${canPrev ? '' : 'disabled'} aria-label="Semana anterior"><svg class="ico" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
              <div class="wp-txt"><b>${wi.label}</b><span>${wi.range} ${wi.year}</span></div>
              <button class="wp-btn" data-wk="1" ${canNext ? '' : 'disabled'} aria-label="Semana siguiente"><svg class="ico" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
              <span class="badge ${saved ? 'saved' : 'new'}">${saved ? 'Guardada' : 'Nueva'}</span>
            </div>
          </div>

          <div class="inputs">${fields().map((f, i) => `
            <label class="inp">
              <span class="inp-label">${esc(f.label)}<i title="${esc(f.hint || '')}">${esc(f.hint || '')}</i></span>
              <input type="number" min="0" step="1" inputmode="numeric" data-k="${f.key}" data-i="${i}" value="${saved && val(saved, f.key) != null ? val(saved, f.key) : ''}" placeholder="">
              <span class="inp-foot"><i>Anterior: <b>${prevW ? num(val(prevW, f.key)) : '–'}</b></i><span class="live-delta" data-d="${f.key}"></span></span>
            </label>`).join('')}
          </div>

          <label class="fb"><span>Feedback de las visitas</span>
            <textarea data-k="feedback" rows="3" placeholder="Qué dicen los interesados, qué gusta y qué no...">${esc(saved ? saved.feedback : '')}</textarea></label>

          <div class="warns" id="warns"></div>

          <div class="form-actions">
            <button class="btn btn-line" id="copyPrev" ${prevW ? '' : 'disabled'}><svg class="ico" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>Copiar semana anterior</button>
            <span class="spacer"></span>
            <button class="btn btn-accent" id="saveWeek"><svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>${saved ? 'Actualizar semana' : 'Guardar semana'}</button>
          </div>
        </div>

        <div class="card live-card">
          <div class="lc-head"><h3>Cálculo en vivo</h3><span class="eyebrow">${wi.short}</span></div>
          <div id="liveRatios"></div>
          <div class="lc-diag" id="liveDiag"></div>
        </div>
      </div>

      <div class="card hist-card">
        <div class="card-head"><div><h2>Histórico</h2><p>Cada semana guardada es una foto fija del inmueble. Pulsa una fila para editarla.</p></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Semana</th>${fields().map((f) => `<th class="n">${esc(f.short || f.label)}</th>`).join('')}<th class="n">Tasa contacto</th><th class="n">Paso a visita</th><th></th></tr></thead>
          <tbody>${list.slice().reverse().map((w) => {
            const r = ratios(w), info = weekInfo(w.week);
            return `<tr data-week="${w.week}" class="${w.week === editWeek ? 'on' : ''}">
              <td><b>${info.label}</b><span>${info.range}</span></td>
              ${fields().map((f) => `<td class="n">${num(val(w, f.key))}</td>`).join('')}
              <td class="n">${pct(r.contacto)}</td><td class="n">${pct(r.visita, 0)}</td>
              <td class="n"><button class="icon-btn del" data-del="${w.week}" title="Borrar semana"><svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="${fields().length + 4}" class="empty">Todavía no hay semanas guardadas.</td></tr>`}</tbody>
        </table></div>
      </div>`;

    const inputs = $$('.inputs input', el);
    const readForm = () => {
      const values = {};
      fields().forEach((f) => { const v = $(`input[data-k="${f.key}"]`, el).value; values[f.key] = v === '' ? null : Math.max(0, Math.round(Number(v))); });
      return { week: editWeek, values, feedback: $('textarea[data-k="feedback"]', el).value.trim() };
    };
    const refreshLive = () => {
      const draft = readForm();
      fields().forEach((f) => { $(`[data-d="${f.key}"]`, el).innerHTML = draft.values[f.key] == null ? '' : deltaHTML(draft.values[f.key], prevW ? val(prevW, f.key) : null); });
      // Ratios en vivo
      const r = ratios(draft), rp = prevW ? ratios(prevW) : {};
      $('#liveRatios').innerHTML = RATIO_DEFS.map((d) => `
        <div class="lr"><span>${d.label}<i>${d.formula}</i></span><b>${pct(r[d.key])}</b>${ptsHTML(r[d.key], rp[d.key])}</div>`).join('');
      // Diagnostico en vivo (con la semana como si estuviera guardada)
      const complete = fields().every((f) => draft.values[f.key] != null);
      if (complete) {
        const tmp = weeks(p.id).filter((w) => w.week !== editWeek).concat([draft]).sort((a, b) => a.week.localeCompare(b.week));
        const d = diagnose(tmp, tmp.findIndex((w) => w.week === editWeek));
        $('#liveDiag').innerHTML = `<span class="pill ${d.status.key}">${d.status.label}</span><p>${esc(d.text)}</p>`;
      } else {
        $('#liveDiag').innerHTML = '<p class="muted">El diagnóstico aparece al completar los datos.</p>';
      }
      // Avisos de datos raros
      $('#warns').innerHTML = warnings(draft.values, prevW).map((w) => `<div class="alert-row"><svg class="ico" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>${w}</div>`).join('');
    };

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', refreshLive);
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (inputs[i + 1]) inputs[i + 1].focus(); else $('#saveWeek').focus();
      });
    });
    $('textarea', el).addEventListener('input', refreshLive);

    $$('.wp-btn', el).forEach((b) => b.onclick = () => { editWeek = shiftWeek(editWeek, Number(b.dataset.wk)); viewSemana(el); });
    $('#copyPrev').onclick = () => {
      if (!prevW) return;
      fields().forEach((f) => { $(`input[data-k="${f.key}"]`, el).value = val(prevW, f.key) ?? ''; });
      refreshLive();
      inputs[0].focus(); inputs[0].select();
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
      focusWeek = editWeek;
      editWeek = null;
      renderSide(); viewSemana(el);
      toast(`<b>${info.label}</b> guardada. Variaciones, ratios y diagnóstico recalculados.`, 'good', { label: 'Ver evolución', fn: () => setView('evolucion') });
    };
    $$('tbody tr[data-week]', el).forEach((tr) => tr.onclick = (e) => {
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
    });
    $$('.inp input', el).forEach((i) => i.addEventListener('input', () => i.closest('.inp').classList.remove('err')));
    refreshLive();
  }

  function warnings(v, prevW) {
    const out = [];
    const has = (k) => v[k] != null;
    if (has('favoritos') && has('visitas') && v.favoritos > v.visitas) out.push('Hay más favoritos que visitas. Revisa los datos.');
    if (has('contactos') && has('visitas') && v.contactos > v.visitas) out.push('Hay más contactos que visitas al anuncio.');
    if (has('presenciales') && has('contactos') && v.presenciales > v.contactos) out.push('Hay más visitas presenciales que contactos.');
    if (has('ofertas') && has('presenciales') && v.ofertas > v.presenciales) out.push('Hay más ofertas que visitas presenciales.');
    if (prevW) {
      fields().forEach((f) => {
        const a = v[f.key], b = val(prevW, f.key);
        if (a != null && b != null && b >= 20 && Math.abs(a - b) / b > 0.6) out.push(`${f.label}: cambio del ${pct(Math.abs(a - b) / b, 0)} respecto a la semana anterior. ¿Es correcto?`);
      });
    }
    return out;
  }

  /* ================= VISTA: EVOLUCION ================= */
  function weekSelect(list, id) {
    return `<label class="wsel"><span>Semana</span><select id="wsel">${list.slice().reverse().map((w) => {
      const i = weekInfo(w.week); return `<option value="${w.week}" ${w.week === focusWeek ? 'selected' : ''}>${i.label} · ${i.range}</option>`;
    }).join('')}</select></label>`;
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
    const d = diagnose(list, idx);
    const r = ratios(cur), rp = prev ? ratios(prev) : {};

    el.innerHTML = `
      ${propHead(p, weekSelect(list))}
      <div class="kpis">${fields().map((f) => {
        const series = upto.slice(-8).map((w) => val(w, f.key));
        return `<div class="kpi card"><span>${esc(f.label)}</span><b>${num(val(cur, f.key))}</b>${deltaHTML(val(cur, f.key), prev ? val(prev, f.key) : null)}${spark(series)}</div>`;
      }).join('')}</div>

      <div class="g-evo">
        <div class="card chart-card">
          <div class="cc-head"><h3>Visitas al anuncio</h3><span>Últimas ${Math.min(upto.length, 12)} semanas</span></div>
          <div class="cc-body"><canvas id="ch1"></canvas></div>
        </div>
        <div class="card diag-card ${d.status.key}">
          <div class="dc-top"><span class="eyebrow">Diagnóstico comercial</span><span class="pill ${d.status.key}">${d.status.label}</span></div>
          <h3 class="serif">${esc(d.headline)}</h3>
          <ul>${d.items.map((t) => {
            // el titular ya resume la primera frase: aqui se muestra solo el detalle
            const body = t.startsWith(`${d.headline}:`) ? t.slice(d.headline.length + 1).trim() : t;
            return `<li>${esc(body.charAt(0).toUpperCase() + body.slice(1))}</li>`;
          }).join('')}</ul>
          <p class="rec"><b>${esc(d.rec)}</b></p>
          <button class="btn btn-line btn-sm" id="toReport">Llevar al informe <svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>

        <div class="card chart-card">
          <div class="cc-head"><h3>Contactos, visitas presenciales y ofertas</h3><span>Por semana</span></div>
          <div class="cc-body"><canvas id="ch2"></canvas></div>
        </div>
        <div class="card funnel-card">
          <div class="cc-head"><h3>Embudo de la semana</h3><span>${weekInfo(cur.week).label}</span></div>
          ${funnel(cur)}
        </div>

        <div class="card ratio-card">
          <div class="cc-head"><h3>Ratios de conversión</h3><span>Frente a la semana anterior</span></div>
          <table class="tbl rt">
            <thead><tr><th>Ratio</th><th>Cálculo</th><th class="n">Esta semana</th><th class="n">Anterior</th><th class="n">Cambio</th></tr></thead>
            <tbody>${RATIO_DEFS.map((x) => `<tr><td><b>${x.label}</b></td><td class="f">${x.formula}</td><td class="n">${pct(r[x.key])}</td><td class="n">${pct(rp[x.key])}</td><td class="n">${ptsHTML(r[x.key], rp[x.key])}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="card chart-card">
          <div class="cc-head"><h3>Tasa de contacto</h3><span>Contactos ÷ visitas</span></div>
          <div class="cc-body"><canvas id="ch3"></canvas></div>
        </div>
      </div>`;

    $('#wsel').onchange = (e) => { focusWeek = e.target.value; viewEvolucion(el); };
    $('#toReport').onclick = () => setView('informe');
    drawEvoCharts(upto.slice(-12));
  }

  function spark(series) {
    const vals = series.filter((x) => x != null);
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
    const pts = series.map((v, i) => v == null ? null : `${(i / (series.length - 1)) * 100},${28 - ((v - min) / rng) * 24}`).filter(Boolean).join(' ');
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function funnel(w) {
    const steps = [['visitas', 'Visitas'], ['favoritos', 'Favoritos'], ['contactos', 'Contactos'], ['presenciales', 'Presenciales'], ['ofertas', 'Ofertas']]
      .filter(([k]) => S.fields.find((f) => f.key === k && f.active));
    const top = Math.max(1, val(w, steps[0] ? steps[0][0] : 'visitas') || 1);
    return `<div class="funnel">${steps.map(([k, label], i) => {
      const v = val(w, k) || 0;
      const width = Math.max(4, Math.sqrt(v / top) * 100);
      const prevStep = i > 0 ? val(w, steps[i - 1][0]) : null;
      const conv = prevStep ? pct(v / prevStep, 0) : '';
      return `<div class="fn-row"><span class="fn-l">${label}</span><div class="fn-bar"><i style="width:${width}%"></i></div><b>${num(v)}</b><em>${conv}</em></div>`;
    }).join('')}</div><p class="fn-note">La barra usa escala de raíz para que se vean todas las etapas. El % es la conversión desde la etapa anterior.</p>`;
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
        y: { beginAtZero: true, grid: { color: '#EFEBE4' }, border: { display: false }, ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 }, precision: 0 } },
      },
      ...extra,
    };
  }
  const line = (label, data, color, fill) => ({
    label, data, borderColor: color, backgroundColor: fill ? mix(color, '#FFFFFF', 0.85) : color, fill: !!fill,
    borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2,
  });

  function killChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  function drawEvoCharts(list) {
    const c = company();
    const labels = list.map((w) => weekInfo(w.week).short);
    ['ch1', 'ch2', 'ch3'].forEach(killChart);
    charts.ch1 = new Chart($('#ch1'), { type: 'line', data: { labels, datasets: [line('Visitas', list.map((w) => val(w, 'visitas')), c.c2, true)] }, options: chartBase() });
    const ds2 = [['contactos', 'Contactos', c.c2], ['presenciales', 'Presenciales', SERIES[0]], ['ofertas', 'Ofertas', SERIES[1]]]
      .filter(([k]) => S.fields.find((f) => f.key === k && f.active))
      .map(([k, l, col]) => line(l, list.map((w) => val(w, k)), col));
    charts.ch2 = new Chart($('#ch2'), { type: 'line', data: { labels, datasets: ds2 }, options: chartBase({ plugins: { ...chartBase().plugins, legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 18, color: '#3A3F48', font: { family: 'Inter', size: 12 } } } } }) });
    const o3 = chartBase();
    o3.scales.y.ticks.callback = (v) => `${v.toLocaleString('es-ES')} %`;
    o3.scales.y.ticks.precision = 1;
    o3.plugins.tooltip.callbacks = { label: (ctx) => ` Tasa de contacto: ${ctx.parsed.y.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` };
    charts.ch3 = new Chart($('#ch3'), { type: 'line', data: { labels, datasets: [line('Tasa de contacto', list.map((w) => { const r = ratios(w).contacto; return r == null ? null : +(r * 100).toFixed(2); }), c.c2)] }, options: o3 });
  }

  /* ================= VISTA: INFORME ================= */
  function repColors() {
    const c = company();
    const o = S.report.colors[c.id] || {};
    return { c1: o.c1 || c.c1, c2: o.c2 || c.c2 };
  }

  function viewInforme(el) {
    const p = prop();
    if (!p) { el.innerHTML = emptyState(); return; }
    const list = weeks(p.id);
    if (!list.length) { el.innerHTML = propHead(p) + noWeeks(); bindNoWeeks(el); return; }
    if (!focusWeek || !list.find((w) => w.week === focusWeek)) focusWeek = list[list.length - 1].week;
    const c = company();
    const col = repColors();
    const sec = S.report.sections;
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
            <h4>Bloques</h4>
            <div class="tg-list">
              ${toggle('photo', 'Foto del inmueble', sec.photo, 'data-sec')}
              ${toggle('kpis', 'Indicadores', sec.kpis, 'data-sec')}
              ${toggle('charts', 'Gráficos de evolución', sec.charts, 'data-sec')}
              ${toggle('ratios', 'Ratios de conversión', sec.ratios, 'data-sec')}
              ${toggle('diagnosis', 'Diagnóstico', sec.diagnosis, 'data-sec')}
              ${toggle('feedback', 'Feedback de visitas', sec.feedback, 'data-sec')}
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
            <button class="link" id="resetBrand">Volver a los colores y logo de ${esc(c.name)}</button>
          </div>

          <div class="card rc">
            <h3>Diagnóstico</h3>
            <textarea id="diagTxt" rows="6">${esc(diagText)}</textarea>
            <div class="rc-foot"><span class="muted small">${S.report.diag[dKey] != null ? 'Texto editado a mano' : 'Generado automáticamente'}</span><button class="link" id="diagReset" ${S.report.diag[dKey] != null ? '' : 'hidden'}>Restablecer</button></div>
          </div>
        </div>

        <div class="rep-view">
          <div class="rv-bar">
            <div><b>Vista previa</b><span>A4 · lo que ves es exactamente lo que se descarga</span></div>
            <button class="btn btn-accent" id="genPdf"><svg class="ico" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>Generar informe</button>
          </div>
          <div class="paper-wrap" id="paperWrap"><div class="paper" id="paper"></div></div>
        </div>
      </div>`;

    renderPaper();
    fitPaper();

    $('#wsel').onchange = (e) => { focusWeek = e.target.value; viewInforme(el); };
    $$('[data-field]', el).forEach((i) => i.onchange = () => { S.report.hidden[i.dataset.field] = !i.checked; save(); renderPaper(); });
    $$('[data-sec]', el).forEach((i) => i.onchange = () => { S.report.sections[i.dataset.sec] = i.checked; save(); renderPaper(); });
    const setCol = () => {
      S.report.colors[c.id] = { c1: $('#col1').value, c2: $('#col2').value };
      $$('.color code', el).forEach((cd, i) => cd.textContent = [$('#col1').value, $('#col2').value][i].toUpperCase());
      save(); renderPaper();
    };
    $('#col1').oninput = setCol; $('#col2').oninput = setCol;
    $('#upLogo').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; S.report.logos[c.id] = await readImage(f, 360, 'image/png'); save(); renderPaper(); toast('Logotipo aplicado al informe.'); };
    $('#upPhoto').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; S.report.photos[p.id] = await readImage(f, 1100, 'image/jpeg'); save(); renderPaper(); toast('Imagen del inmueble actualizada.'); };
    $('#resetBrand').onclick = () => { delete S.report.colors[c.id]; delete S.report.logos[c.id]; delete S.report.photos[p.id]; save(); viewInforme(el); toast('Marca de la empresa restablecida.'); };
    let t;
    $('#diagTxt').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.report.diag[dKey] = e.target.value; save(); renderPaper(); $('#diagReset').hidden = false; }, 250); };
    $('#diagReset').onclick = () => { delete S.report.diag[dKey]; save(); viewInforme(el); };
    $('#genPdf').onclick = generatePDF;
  }

  function renderPaper() {
    const paper = $('#paper'); if (!paper) return;
    const p = prop(), c = company(), col = repColors(), sec = S.report.sections;
    const list = weeks(p.id);
    const idx = list.findIndex((w) => w.week === focusWeek);
    const cur = list[idx], prev = list[idx - 1];
    const info = weekInfo(cur.week);
    const auto = diagnose(list, idx);
    const dText = S.report.diag[`${p.id}|${cur.week}`] ?? auto.text;
    const logo = S.report.logos[c.id] || c.logo;
    const photo = S.report.photos[p.id] || p.photo;
    const fs = repFields();
    const r = ratios(cur), rp = prev ? ratios(prev) : {};
    const today = new Date();
    const showRatios = sec.ratios, showDiag = sec.diagnosis;

    paper.style.setProperty('--p1', col.c1);
    paper.style.setProperty('--p1-ink', inkOn(col.c1));
    paper.style.setProperty('--p2', col.c2);
    paper.style.setProperty('--p2-soft', mix(col.c2, '#FFFFFF', 0.9));
    paper.style.setProperty('--p2-ink', inkOn(col.c2));

    paper.innerHTML = `
      <header class="pp-head">
        <div class="pp-brand">
          ${logo ? `<span class="pp-logo img"><img src="${logo}" alt=""></span>` : `<span class="pp-logo">${esc(c.short)}</span>`}
          <div><b>${esc(c.name)}</b><span>${esc(c.tagline || 'Informe para el propietario')}</span></div>
        </div>
        <div class="pp-title"><span>Informe semanal de comercialización</span><b>${info.label} · ${info.range} ${info.year}</b></div>
      </header>

      <section class="pp-prop ${sec.photo ? '' : 'nophoto'}">
        ${sec.photo ? `<div class="pp-photo"><img src="${photo}" alt=""></div>` : ''}
        <div class="pp-info">
          <span class="pp-eyebrow">Inmueble</span>
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.address)}</p>
          <dl>
            <div><dt>Tipo</dt><dd>${esc(p.type)}</dd></div>
            <div><dt>Referencia</dt><dd>${esc(p.ref)}</dd></div>
            <div><dt>Precio</dt><dd>${money.format(p.price)}</dd></div>
            <div><dt>Propietario</dt><dd>${esc(p.owner)}</dd></div>
          </dl>
          ${showDiag ? `<span class="pp-status ${auto.status.key}">${auto.status.label}</span>` : ''}
        </div>
      </section>

      ${sec.kpis && fs.length ? `<section class="pp-kpis" style="grid-template-columns:repeat(${Math.min(fs.length, 6)},1fr)">${fs.map((f) => `
        <div><span>${esc(f.label)}</span><b>${num(val(cur, f.key))}</b>${deltaHTML(val(cur, f.key), prev ? val(prev, f.key) : null)}<i>vs. semana anterior</i></div>`).join('')}</section>` : ''}

      ${sec.charts ? `<section class="pp-charts">
        <figure><figcaption>Visitas al anuncio</figcaption><canvas id="pc1" width="330" height="150"></canvas></figure>
        <figure><figcaption>Contactos y visitas presenciales</figcaption><canvas id="pc2" width="330" height="150"></canvas>
          <div class="pp-legend"><span><i style="background:${col.c2}"></i>Contactos</span><span><i style="background:${SERIES[0]}"></i>Visitas presenciales</span></div></figure>
      </section>` : ''}

      ${showRatios || showDiag ? `<section class="pp-row ${showRatios && showDiag ? '' : 'single'}">
        ${showRatios ? `<div class="pp-ratios"><h3>Ratios de conversión</h3><table>
          <thead><tr><th></th><th>Semana</th><th>Anterior</th></tr></thead>
          <tbody>${RATIO_DEFS.map((x) => `<tr><td>${x.label}<i>${x.formula}</i></td><td>${pct(r[x.key])}</td><td>${pct(rp[x.key])}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${showDiag ? `<div class="pp-diag"><h3>Diagnóstico comercial</h3><p>${esc(dText)}</p></div>` : ''}
      </section>` : ''}

      ${sec.feedback && cur.feedback ? `<section class="pp-fb"><h3>Lo que dicen las visitas</h3><blockquote>“${esc(cur.feedback)}”</blockquote></section>` : ''}

      <footer class="pp-foot"><span>${esc(c.name)}</span><span>Generado el ${today.getDate()} de ${today.toLocaleDateString('es-ES', { month: 'long' })} de ${today.getFullYear()}</span><span>Página 1 de 1</span></footer>`;

    if (sec.charts) drawPaperCharts(list.slice(Math.max(0, idx - 7), idx + 1), col);
  }

  function drawPaperCharts(list, col) {
    ['pc1', 'pc2'].forEach(killChart);
    const labels = list.map((w) => weekInfo(w.week).short);
    const opts = () => {
      const o = chartBase({ animation: false, responsive: false, devicePixelRatio: 3 });
      o.plugins.tooltip = { enabled: false };
      o.scales.x.ticks.font.size = 10; o.scales.y.ticks.font.size = 10;
      return o;
    };
    const pl = (l, d, color, fill) => ({ ...line(l, d, color, fill), pointRadius: 2.5, pointBorderWidth: 0 });
    charts.pc1 = new Chart($('#pc1'), { type: 'line', data: { labels, datasets: [pl('Visitas', list.map((w) => val(w, 'visitas')), col.c2, true)] }, options: opts() });
    charts.pc2 = new Chart($('#pc2'), { type: 'line', data: { labels, datasets: [pl('Contactos', list.map((w) => val(w, 'contactos')), col.c2), pl('Presenciales', list.map((w) => val(w, 'presenciales')), SERIES[0])] }, options: opts() });
  }

  function fitPaper() {
    const wrap = $('#paperWrap'), paper = $('#paper');
    if (!wrap || !paper) return;
    const scale = Math.min(1, (wrap.clientWidth - 2) / 794);
    paper.style.transform = `scale(${scale})`;
    wrap.style.height = `${1123 * scale + 2}px`;
  }
  window.addEventListener('resize', () => { if (S.ui.view === 'informe') fitPaper(); });

  async function generatePDF() {
    const paper = $('#paper');
    const p = prop();
    const info = weekInfo(focusWeek);
    $('#gen').hidden = false;
    requestAnimationFrame(() => $('#gen').classList.add('in'));
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = await html2canvas(paper, {
        scale: 2, useCORS: true, backgroundColor: '#FFFFFF', width: 794, height: 1123, windowWidth: 1400,
        onclone: (doc) => {
          // la copia se captura sin escala ni animaciones: identica a la vista previa a tamano real
          const st = doc.createElement('style');
          st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
          doc.head.appendChild(st);
          const cp = doc.getElementById('paper');
          cp.style.transform = 'none';
          cp.style.opacity = '1';
        },
      });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
      pdf.setProperties({ title: `Informe ${p.title} ${info.label}`, author: company().name });
      const slug = p.ref.replace(/[^A-Za-z0-9-]/g, '');
      pdf.save(`Informe_${slug}_${info.short}_${info.year}.pdf`);
      toast(`PDF descargado: <b>Informe_${slug}_${info.short}_${info.year}.pdf</b>`);
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
    el.innerHTML = `
      <div class="aj-head"><h1 class="serif">Ajustes</h1><p>Empresas, campos del informe, inmuebles y usuarios. Solo para administradores.</p></div>
      <div class="g-aj">
        <div class="card">
          <div class="card-head"><div><h2>Empresas</h2><p>Logo y colores se aplican a la aplicación y al informe.</p></div></div>
          <div class="co-list">${S.companies.map((c) => `
            <div class="co" data-id="${c.id}">
              ${logoHTML(c, 'lg-md')}
              <div class="co-txt"><input class="co-name" value="${esc(c.name)}" aria-label="Nombre"><span>${S.properties.filter((p) => p.company === c.id).length} inmuebles</span></div>
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

        <div class="card" id="newProp">
          <div class="card-head"><div><h2>Nuevo inmueble</h2><p>Se añade a la empresa seleccionada: <b>${esc(company().name)}</b>.</p></div></div>
          <form class="grid-form" id="propForm">
            <label><span>Título</span><input name="title" placeholder="Piso en C/ Serrano 20, 4º B" required></label>
            <label><span>Dirección</span><input name="address" placeholder="C/ Serrano 20, 4º B · Madrid" required></label>
            <label><span>Tipo</span><input name="type" placeholder="Piso · 3 hab · 110 m²"></label>
            <label><span>Referencia</span><input name="ref" placeholder="GT-0450"></label>
            <label><span>Precio (€)</span><input name="price" type="number" min="0" placeholder="350000"></label>
            <label><span>Propietario</span><input name="owner" placeholder="D. Nombre Apellido"></label>
            <label class="full"><span>Foto</span><input name="photo" type="file" accept="image/*"></label>
            <div class="full right"><button class="btn btn-accent">Crear inmueble</button></div>
          </form>
        </div>

        <div class="card">
          <div class="card-head"><div><h2>Usuarios y roles</h2><p>Cada asesor ve solo las empresas que tiene asignadas.</p></div></div>
          <div class="users">
            <div><span class="avatar dark">DG</span><div><b>David G.</b><i>Administrador · todas las empresas</i></div></div>
            <div><span class="avatar">LG</span><div><b>Laura Gómez</b><i>Asesora · García-Toledano, Costa Hábitat</i></div></div>
            <div><span class="avatar">PO</span><div><b>Pablo Ortega</b><i>Asesor · Urbana Homes</i></div></div>
          </div>
          <p class="note">En la versión final: contraseñas cifradas, sesiones seguras y conexión HTTPS.</p>
        </div>
      </div>`;

    // Empresas
    $$('.co', el).forEach((row) => {
      const c = S.companies.find((x) => x.id === row.dataset.id);
      $('.co-name', row).onchange = (e) => { c.name = e.target.value.trim() || c.name; c.short = initials(c.name); save(); renderTop(); renderSide(); };
      $$('input[type=color]', row).forEach((i) => i.oninput = () => { c[i.dataset.c] = i.value; save(); if (c.id === company().id) applyTheme(); renderTop(); });
      $$('input[type=color]', row).forEach((i) => i.onchange = () => viewAjustes(el));
      $('[data-logo]', row).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; c.logo = await readImage(f, 360, 'image/png'); save(); renderTop(); viewAjustes(el); toast(`Logo de ${esc(c.name)} actualizado.`); };
    });
    $('#newCo').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      const id = `c${Date.now().toString(36)}`;
      S.companies.push({ id, name, short: initials(name), c1: fd.get('c1'), c2: fd.get('c2'), logo: null, tagline: 'Inmobiliaria' });
      save(); viewAjustes(el); renderTop();
      toast(`Empresa <b>${esc(name)}</b> creada.`, 'good', { label: 'Cambiar a ella', fn: () => { switchCompany(id); } });
    };

    // Campos
    $$('[data-active]', el).forEach((i) => i.onchange = () => {
      const f = S.fields.find((x) => x.key === i.dataset.active);
      if (!i.checked && S.fields.filter((x) => x.active).length === 1) { i.checked = true; toast('Debe quedar al menos un campo activo.', 'warn'); return; }
      f.active = i.checked; save();
      toast(`${esc(f.label)} ${f.active ? 'activado' : 'desactivado'} en formulario, evolución e informe.`);
    });
    $$('[data-delfield]', el).forEach((b) => b.onclick = () => {
      S.fields = S.fields.filter((f) => f.key !== b.dataset.delfield);
      save(); viewAjustes(el); toast('Campo quitado.', 'warn');
    });
    $('#newField').onsubmit = (e) => {
      e.preventDefault();
      const label = new FormData(e.target).get('label').trim();
      let key = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo';
      while (S.fields.some((f) => f.key === key)) key += '_2';
      S.fields.push({ key, label, short: label.length > 14 ? label.slice(0, 13) + '.' : label, hint: 'Campo añadido por el administrador', active: true, custom: true });
      save(); viewAjustes(el);
      toast(`Campo <b>${esc(label)}</b> añadido. Ya aparece en la pestaña Semana y en el informe.`, 'good', { label: 'Probarlo', fn: () => setView('semana') });
    };

    // Inmuebles
    $('#propForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const file = fd.get('photo');
      const photo = file && file.size ? await readImage(file, 1100, 'image/jpeg') : 'assets/media/p4.jpg';
      const id = `p${Date.now().toString(36)}`;
      S.properties.push({
        id, company: company().id, title: fd.get('title').trim(), address: fd.get('address').trim(),
        type: fd.get('type').trim() || 'Vivienda', ref: fd.get('ref').trim() || `${company().short}-${String(S.properties.length + 1).padStart(4, '0')}`,
        price: Number(fd.get('price')) || 0, owner: fd.get('owner').trim() || 'Sin asignar', photo,
      });
      S.weeks[id] = [];
      S.ui.property = id; focusWeek = editWeek = null;
      save(); renderTop(); renderSide(); setView('semana');
      toast('Inmueble creado. Introduce su primera semana.');
    };
  }
  const initials = (name) => name.replace(/&/g, ' ').split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'E';

  /* ---------- Estados vacios ---------- */
  function emptyState() {
    return `<div class="empty-card card"><h2 class="serif">Sin inmuebles</h2><p>Esta empresa todavía no tiene inmuebles.</p><button class="btn btn-accent" onclick="document.querySelector('[data-add]').click()">Crear el primero</button></div>`;
  }
  function noWeeks() {
    return `<div class="empty-card card"><h2 class="serif">Aún no hay semanas</h2><p>Guarda la primera semana de este inmueble para ver evolución, diagnóstico e informe.</p><button class="btn btn-accent" data-go="semana">Introducir datos</button></div>`;
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
    if (!S.properties.find((p) => p.id === S.ui.property && p.company === S.ui.company)) {
      const f = props()[0]; S.ui.property = f ? f.id : null;
    }
    applyTheme(); renderTop(); renderSide(); renderView();
  }

  /* ---------- Arranque ---------- */
  if (window.Chart) {
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.color = '#6B7280';
  }
  initLogin();
  bindTop();
  if (isAuthed()) { $('#login').hidden = true; enterApp(); }
})();
