/* =====================================================================
   Informe Semanal - datos, calculos y diagnostico
   ---------------------------------------------------------------------
   - FIELDS: lista unica de indicadores. Anadir o quitar un campo aqui
     (o desde Ajustes > Campos en la demo) lo aplica al formulario,
     a la evolucion y al informe PDF.
   - Seed: empresas, inmuebles y 8 semanas de datos de prueba.
   - Calc: variaciones, ratios y diagnostico comercial por reglas.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- Campos (indicadores) ---------- */
  const FIELDS = [
    { key: 'visitas',      label: 'Visitas',              short: 'Visitas',      hint: 'Visitas al anuncio en portales', active: true, custom: false },
    { key: 'favoritos',    label: 'Favoritos',            short: 'Favoritos',    hint: 'Veces guardado como favorito',   active: true, custom: false },
    { key: 'contactos',    label: 'Contactos',            short: 'Contactos',    hint: 'Llamadas, emails y mensajes',    active: true, custom: false },
    { key: 'presenciales', label: 'Visitas presenciales', short: 'Presenciales', hint: 'Visitas hechas al inmueble',     active: true, custom: false },
    { key: 'ofertas',      label: 'Ofertas',              short: 'Ofertas',      hint: 'Ofertas recibidas',              active: true, custom: false },
  ];

  /* ---------- Semanas (ISO, empiezan en lunes) ---------- */
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7; // 0 = lunes
    x.setDate(x.getDate() - day);
    return x;
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }
  function weekInfo(id) {
    const start = parseDate(id);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const range = sameMonth
      ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
    const num = isoWeek(start);
    return { id, num, short: `S${num}`, label: `Semana ${num}`, range, year: end.getFullYear() };
  }
  function currentWeekId() { return isoDate(mondayOf(new Date())); }
  function shiftWeek(id, n) { return isoDate(addDays(parseDate(id), n * 7)); }

  /* ---------- Datos de prueba ---------- */
  const COMPANIES = [
    { id: 'gt', name: 'García-Toledano & Asociados', short: 'GT', c1: '#111318', c2: '#A8782F', logo: null, tagline: 'Abogados e inmobiliaria' },
    { id: 'ch', name: 'Costa Hábitat Inmobiliaria',  short: 'CH', c1: '#0F4C5C', c2: '#D9731A', logo: null, tagline: 'Inmuebles en la costa' },
    { id: 'uh', name: 'Urbana Homes Madrid',         short: 'UH', c1: '#1D3557', c2: '#C8553D', logo: null, tagline: 'Vivienda urbana' },
  ];

  // Cada inmueble trae 8 semanas para que haya tendencia y diagnostico desde el primer momento.
  const PROPS = [
    { id: 'p1', company: 'gt', title: 'Piso en C/ Mayor 12, 2º A', address: 'C/ Mayor 12, 2º A · Madrid', type: 'Piso · 3 hab · 92 m²', ref: 'GT-0412', price: 289000, owner: 'Dña. Carmen Ruiz Vidal', photo: 'assets/media/p2.jpg',
      s: { visitas: [212, 240, 236, 268, 301, 295, 330, 352], fav: [.104, .1165], contactos: [9, 11, 10, 12, 14, 12, 11, 10], presenciales: [3, 4, 3, 5, 5, 3, 3, 3], ofertas: [0, 0, 0, 0, 1, 0, 0, 0] },
      fb: ['Gusta mucho la luz y la distribución.', 'Comentan que el precio está algo alto para la zona.', 'Una pareja pide segunda visita; les preocupa la reforma de la cocina.'] },
    { id: 'p2', company: 'gt', title: 'Ático en Av. de la Constitución 45', address: 'Av. de la Constitución 45, 6º · Madrid', type: 'Ático · 2 hab · 78 m² + terraza', ref: 'GT-0398', price: 465000, owner: 'D. Javier Moreno Sanz', photo: 'assets/media/p5.jpg',
      s: { visitas: [410, 392, 371, 350, 318, 296, 281, 262], fav: [.12, .095], contactos: [18, 17, 15, 15, 13, 12, 11, 10], presenciales: [6, 5, 5, 4, 4, 3, 3, 2], ofertas: [0, 1, 0, 0, 0, 0, 0, 0] },
      fb: ['La terraza encanta.', 'Varios contactos no contestan al devolver la llamada.', 'Visitante interesado pero espera a que baje el precio.'] },
    { id: 'p3', company: 'gt', title: 'Villa en Urb. Los Altos, 8', address: 'Urb. Los Altos 8 · Pozuelo de Alarcón', type: 'Villa · 5 hab · 340 m² · parcela 900 m²', ref: 'GT-0377', price: 1150000, owner: 'Familia Ortega Blanco', photo: 'assets/media/p1.jpg',
      s: { visitas: [150, 162, 171, 180, 196, 205, 214, 231], fav: [.13, .155], contactos: [7, 8, 9, 10, 11, 12, 13, 14], presenciales: [2, 3, 3, 4, 4, 5, 5, 6], ofertas: [0, 0, 0, 1, 0, 1, 1, 2] },
      fb: ['Muy buena impresión general.', 'Dos familias piden información de la hipoteca.', 'Entran dos ofertas; una cerca del precio de salida.'] },
    { id: 'p4', company: 'ch', title: 'Apartamento Paseo Marítimo 22', address: 'Paseo Marítimo 22, 4º · Málaga', type: 'Apartamento · 2 hab · 70 m² · vistas al mar', ref: 'CH-1120', price: 335000, owner: 'D. Andrés Gil Navarro', photo: 'assets/media/p7.jpg',
      s: { visitas: [520, 548, 560, 590, 610, 640, 655, 690], fav: [.09, .1], contactos: [26, 28, 27, 30, 31, 33, 32, 35], presenciales: [3, 3, 2, 3, 2, 2, 3, 2], ofertas: [0, 0, 0, 0, 0, 0, 0, 0] },
      fb: ['Mucho interés desde el extranjero.', 'Varios contactos piden solo fotos y vídeo.', 'Cuesta cuadrar horarios de visita con el inquilino actual.'] },
    { id: 'p5', company: 'ch', title: 'Casa adosada C/ Las Dunas 4', address: 'C/ Las Dunas 4 · Marbella', type: 'Adosado · 3 hab · 120 m² · jardín', ref: 'CH-1094', price: 248000, owner: 'Dña. Lucía Serrano Pozo', photo: 'assets/media/p6.jpg',
      s: { visitas: [190, 200, 195, 210, 205, 220, 215, 225], fav: [.11, .12], contactos: [9, 9, 10, 10, 11, 10, 11, 12], presenciales: [4, 4, 5, 5, 6, 5, 6, 6], ofertas: [0, 0, 0, 0, 0, 0, 0, 0] },
      fb: ['El jardín gusta mucho.', 'Las fotos no reflejan bien el estado de los baños.', 'Comentan que el precio está por encima de otros adosados de la zona.'] },
    { id: 'p6', company: 'uh', title: 'Piso en C/ Fuencarral 87, 3º', address: 'C/ Fuencarral 87, 3º izq · Madrid', type: 'Piso · 3 hab · 105 m²', ref: 'UH-0233', price: 520000, owner: 'D. Miguel Castro León', photo: 'assets/media/p3.jpg',
      s: { visitas: [300, 315, 322, 340, 351, 366, 372, 390], fav: [.11, .125], contactos: [14, 15, 15, 16, 17, 18, 18, 19], presenciales: [4, 5, 4, 5, 6, 5, 6, 6], ofertas: [0, 0, 0, 0, 0, 1, 0, 1] },
      fb: ['Gusta la zona y la altura de techos.', 'Preguntan por la plaza de garaje.', 'Llega una oferta un 4 % por debajo del precio.'] },
    { id: 'p7', company: 'uh', title: 'Estudio en C/ Argumosa 14', address: 'C/ Argumosa 14, bajo · Madrid', type: 'Estudio · 38 m²', ref: 'UH-0219', price: 199000, owner: 'Dña. Elena Ramos Díaz', photo: 'assets/media/p8.jpg',
      s: { visitas: [260, 250, 246, 240, 236, 231, 229, 225], fav: [.1, .085], contactos: [12, 11, 9, 9, 8, 7, 7, 6], presenciales: [3, 3, 2, 2, 2, 2, 1, 1], ofertas: [0, 0, 0, 0, 0, 0, 0, 0] },
      fb: ['Comentan que es oscuro por ser bajo.', 'Interés sobre todo de inversores.', 'Piden margen de negociación antes de visitar.'] },
  ];

  function buildSeed() {
    const cur = currentWeekId();
    const weeks = {};
    const properties = PROPS.map((p) => {
      const list = [];
      for (let i = 0; i < 8; i++) {
        const id = shiftWeek(cur, i - 8); // las 8 semanas anteriores a la actual
        const vis = p.s.visitas[i];
        const r = p.s.fav[0] + (p.s.fav[1] - p.s.fav[0]) * (i / 7);
        list.push({
          week: id,
          values: {
            visitas: vis,
            favoritos: Math.round(vis * r),
            contactos: p.s.contactos[i],
            presenciales: p.s.presenciales[i],
            ofertas: p.s.ofertas[i],
          },
          feedback: i >= 5 ? p.fb[i - 5] : '',
          savedAt: Date.now(),
        });
      }
      weeks[p.id] = list;
      const { s, fb, ...meta } = p;
      return meta;
    });
    return {
      version: 1,
      companies: COMPANIES.map((c) => ({ ...c })),
      properties,
      weeks,
      fields: FIELDS.map((f) => ({ ...f })),
      report: {
        sections: { photo: true, kpis: true, charts: true, ratios: true, diagnosis: true, feedback: true },
        hidden: {},          // campos ocultos solo en el informe
        colors: {},          // por empresa: { c1, c2 } que sobrescriben la marca
        logos: {},           // por empresa: logo subido solo para el informe
        photos: {},          // por inmueble: imagen subida para el informe
        diag: {},            // por inmueble+semana: texto del diagnostico editado
      },
      ui: { company: 'gt', property: 'p1', view: 'semana' },
    };
  }

  /* ---------- Calculos ---------- */
  const val = (w, k) => (w && w.values && Number.isFinite(w.values[k]) ? w.values[k] : null);
  const ratio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
  const change = (cur, prev) => (cur == null || prev == null || prev === 0 ? null : (cur - prev) / prev);
  const sumK = (list, k) => list.reduce((s, w) => s + (val(w, k) || 0), 0);

  // Ratios de conversion de una semana
  function ratios(w) {
    return {
      interes:  ratio(val(w, 'favoritos'), val(w, 'visitas')),
      contacto: ratio(val(w, 'contactos'), val(w, 'visitas')),
      visita:   ratio(val(w, 'presenciales'), val(w, 'contactos')),
      oferta:   ratio(val(w, 'ofertas'), val(w, 'presenciales')),
    };
  }
  const RATIO_DEFS = [
    { key: 'interes',  label: 'Interés del anuncio', formula: 'favoritos ÷ visitas' },
    { key: 'contacto', label: 'Tasa de contacto',    formula: 'contactos ÷ visitas' },
    { key: 'visita',   label: 'Paso a visita',       formula: 'presenciales ÷ contactos' },
    { key: 'oferta',   label: 'Paso a oferta',       formula: 'ofertas ÷ presenciales' },
  ];

  /* ---------- Diagnostico comercial (reglas claras y editables) ---------- */
  function diagnose(list, idx) {
    const cur = list[idx];
    if (!cur) return null;
    const pct = (x) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
    const last3 = list.slice(Math.max(0, idx - 2), idx + 1);
    const prev3 = list.slice(Math.max(0, idx - 5), Math.max(0, idx - 2));
    const neg = [], pos = [], recs = [];

    // 1. Visibilidad: visitas de las 3 ultimas semanas frente a las 3 anteriores
    if (prev3.length >= 2) {
      const t = change(sumK(last3, 'visitas') / last3.length, sumK(prev3, 'visitas') / prev3.length);
      if (t != null && t >= 0.08) pos.push(`La visibilidad crece: las visitas suben un ${pct(t)} respecto a las semanas anteriores.`);
      if (t != null && t <= -0.08) { neg.push(`La visibilidad cae: las visitas bajan un ${pct(-t)} respecto a las semanas anteriores.`); recs.push('renovar el anuncio o destacarlo en los portales'); }
    }

    // 2. Tasa de contacto frente a su media anterior
    const cr = ratio(val(cur, 'contactos'), val(cur, 'visitas'));
    const base = list.slice(Math.max(0, idx - 7), Math.max(0, idx - 2)).map((w) => ratio(val(w, 'contactos'), val(w, 'visitas'))).filter((x) => x != null);
    const crBase = base.length ? base.reduce((a, b) => a + b, 0) / base.length : null;
    if (cr != null && cr < 0.03 && (crBase == null || cr < crBase * 0.85)) {
      neg.push(`El anuncio atrae, pero no convence: la tasa de contacto baja al ${pct(cr)}${crBase ? ` (antes ${pct(crBase)})` : ''}.`);
      recs.push('revisar el precio, las primeras fotos y la descripción');
    } else if (cr != null && cr >= 0.045) {
      pos.push(`Buena tasa de contacto (${pct(cr)}): el anuncio convence.`);
    }

    // 3. Contactos que no llegan a visita presencial
    const c3 = sumK(last3, 'contactos'), p3 = sumK(last3, 'presenciales'), o3 = sumK(last3, 'ofertas');
    if (c3 >= 10 && p3 / c3 < 0.25) {
      neg.push(`Muchos contactos no llegan a visita: solo el ${pct(p3 / c3)} acaba viendo el inmueble.`);
      recs.push('responder antes a los contactos y ofrecer más horarios de visita');
    }

    // 4. Visitas presenciales sin ofertas
    if (p3 >= 10 && o3 === 0) {
      neg.push(`${p3} visitas presenciales en tres semanas y ninguna oferta.`);
      recs.push('valorar un ajuste de precio o revisar qué no gusta en la visita');
    }

    // 5. Ofertas esta semana
    const of = val(cur, 'ofertas') || 0;
    if (of > 0) {
      pos.push(of === 1 ? 'Esta semana ha entrado 1 oferta: el inmueble está en negociación.' : `Esta semana han entrado ${of} ofertas: el inmueble está en negociación.`);
      recs.push('hacer seguimiento de las ofertas con el propietario');
    }

    const status = neg.length === 0
      ? { key: 'good', label: 'Captación sana' }
      : neg.length === 1 ? { key: 'warn', label: 'Requiere atención' } : { key: 'bad', label: 'Revisar estrategia' };

    const sentences = [...neg, ...pos].slice(0, 3);
    if (!sentences.length) sentences.push('Semana estable, sin cambios relevantes respecto a las anteriores.');
    const rec = recs.length ? `Recomendación: ${recs.slice(0, 2).join(' y ')}.` : 'Recomendación: mantener la estrategia actual.';
    return {
      status,
      headline: (neg[0] || pos[0] || sentences[0]).split(':')[0],
      items: sentences,
      rec: rec.charAt(0).toUpperCase() + rec.slice(1),
      text: `${sentences.join(' ')} ${rec}`,
    };
  }

  global.ISD = { FIELDS, buildSeed, weekInfo, currentWeekId, shiftWeek, ratios, RATIO_DEFS, change, diagnose, val };
})(window);
