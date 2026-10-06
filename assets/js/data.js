/* =====================================================================
   Informe Semanal - datos, calculos, indicador de fuerza y diagnostico
   ---------------------------------------------------------------------
   - FIELDS: lista unica de indicadores semanales. Anadir o quitar un
     campo aqui (o desde Ajustes > Campos en la demo) lo aplica al
     formulario, a la evolucion y al informe PDF.
   - MOTIVOS: motivos que se marcan en el feedback de cada visita.
   - strength(): indicador de fuerza comercial (0-100) de cada semana.
   - diagnose(): diagnostico comercial por reglas, en tono neutro.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- Campos semanales ---------- */
  const FIELDS = [
    { key: 'visualizaciones', label: 'Visualizaciones',       short: 'Visualiz.',    hint: 'Vistas del anuncio en portales',              active: true, custom: false },
    { key: 'favoritos',       label: 'Favoritos',             short: 'Favoritos',    hint: 'Veces guardado como favorito',                 active: true, custom: false },
    { key: 'solicitudes',     label: 'Solicitudes de información', short: 'Solicitudes', hint: 'Contactos recibidos por portales',          active: true, custom: false },
    { key: 'ofrecidos',       label: 'Ofrecido a clientes',   short: 'Ofrecido',     hint: 'Clientes de la base de datos del bufete',      active: true, custom: false },
    { key: 'noViables',       label: 'No viables (financiación)', short: 'No viables', hint: 'Descartados por el departamento hipotecario', active: true, custom: false },
    { key: 'presenciales',    label: 'Visitas presenciales',  short: 'Visitas',      hint: 'Visitas hechas al inmueble',                   active: true, custom: false },
    { key: 'ofertas',         label: 'Ofertas',               short: 'Ofertas',      hint: 'Ofertas recibidas',                            active: true, custom: false },
  ];

  /* ---------- Motivos del feedback ---------- */
  const MOTIVOS = ['Zona', 'Precio', 'Tamaño', 'Estado / reforma', 'Distribución', 'Tipo de vivienda', 'Luz / orientación', 'Otros'];
  const FB_TIPOS = { visita: 'Visita', cliente: 'Cliente del bufete', noViable: 'No viable (financiación)' };
  const VALORACION = { positiva: 'Le gusta', dudas: 'Con dudas', negativa: 'Descartado' };

  /* ---------- Semanas (ISO, empiezan en lunes) ---------- */
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
  }
  function weekInfo(id) {
    const start = parseDate(id), end = addDays(start, 6);
    const range = start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
    const num = isoWeek(start);
    return { id, num, short: `S${num}`, label: `Semana ${num}`, range, year: end.getFullYear() };
  }
  const fmtDay = (s) => { const d = parseDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  function currentWeekId() { return isoDate(mondayOf(new Date())); }
  function shiftWeek(id, n) { return isoDate(addDays(parseDate(id), n * 7)); }
  function dayOf(weekId, n) { return isoDate(addDays(parseDate(weekId), n)); }

  /* ---------- Datos de prueba ---------- */
  // Empresas: la principal (bufete) y la inmobiliaria AS, cada una con su logo, colores y tipografia.
  // logo: version pequena (icono) · logoFull: logo completo para la cabecera del informe (ambos sobre fondo oscuro)
  const FONTS = ['Fraunces', 'Cinzel', 'Playfair Display', 'Lora', 'Montserrat', 'Inter'];
  const COMPANIES = [
    { id: 'gt', name: 'García-Toledano & Asociados', short: 'GT', c1: '#111318', c2: '#A8782F', font: 'Fraunces',
      logo: 'assets/media/gt-mark.png', logoFull: 'assets/media/gt-logo.png', tagline: 'Bufete de abogados e inmobiliaria', address: 'C/ Poeta García Lorca, 29 · San Vicente del Raspeig (03690)' },
    { id: 'as', name: 'AS Grupo Inmobiliario', short: 'AS', c1: '#0B0B0C', c2: '#C9A24A', font: 'Cinzel',
      logo: 'assets/media/as-mark.png', logoFull: 'assets/media/as-logo.png', tagline: 'Tu historia comienza aquí', address: 'San Vicente del Raspeig (Alicante)' },
  ];

  // s: 8 valores por campo (de la semana mas antigua a la mas reciente). fb: feedback por semana (indice -> lista)
  const PROPS = [
    { id: 'p1', company: 'gt', title: 'Piso en venta en C/ Alfonso XII, 18 – San Vicente del Raspeig', short: 'Piso C/ Alfonso XII, 18',
      address: 'C/ Alfonso XII, 18, 3º B · San Vicente del Raspeig', type: 'Piso', ref: 'GT-0412', price: 214000, owner: 'Dña. Carmen Ruiz Vidal', photo: 'assets/media/p2.jpg',
      features: ['148 m² construidos', '3 dormitorios', '2 baños', 'Terraza', 'Balcón', 'Buen estado', 'Armarios empotrados', 'Trastero', 'Plaza de garaje'],
      s: { visualizaciones: [3180, 1300, 950, 720, 540, 430, 360, 320], favoritos: [96, 54, 33, 22, 15, 11, 9, 8], solicitudes: [5, 3, 2, 2, 2, 1, 1, 1],
           ofrecidos: [3, 1, 1, 1, 1, 1, 0, 1], noViables: [1, 0, 1, 0, 0, 1, 0, 0], presenciales: [2, 2, 2, 1, 1, 0, 0, 0], ofertas: [0, 0, 0, 0, 0, 0, 0, 0] },
      fb: {
        0: [['visita', 2, 'Vanesa', 'dudas', ['Zona'], 'Le gusta el piso, pero no está muy convencida con la zona.'],
            ['visita', 4, 'Marta', 'dudas', ['Zona'], 'Le gusta mucho el piso; busca algo más céntrico o en la zona sur.'],
            ['noViable', 3, 'Cliente portal', 'negativa', [], 'El departamento hipotecario no aprueba la viabilidad de la compra.']],
        1: [['visita', 1, 'María', 'positiva', [], 'Le gusta el piso y todo; lo está pensando y comparando opciones.'],
            ['visita', 3, 'Elena', 'dudas', ['Zona'], 'Le gusta el piso, pero no le convence la zona.']],
        2: [['visita', 2, 'Mari Ángeles', 'negativa', ['Tamaño', 'Precio', 'Zona'], 'El balcón le parece pequeño y la terraza no es privativa. Considera el precio elevado para lo que es.'],
            ['noViable', 4, 'Cliente bufete', 'negativa', [], 'Sin solvencia acreditada para la operación.']],
        3: [['visita', 5, 'Jorge', 'dudas', ['Precio'], 'Buena impresión; espera a que el precio se ajuste antes de decidir.']],
        4: [['visita', 2, 'Lucía', 'negativa', ['Zona', 'Precio'], 'Prefiere el centro; para la zona ve el precio alto.']],
        5: [['noViable', 1, 'Cliente portal', 'negativa', [], 'No supera el estudio del departamento hipotecario.']],
        6: [['visita', 3, 'Sergio', 'dudas', ['Precio'], 'Le encaja el piso, pero compara con otros más baratos en la misma calle.']],
      } },
    { id: 'p2', company: 'gt', title: 'Bungalow en venta en C/ Riu Serpis, 6 – Mutxamel', short: 'Bungalow C/ Riu Serpis, 6',
      address: 'C/ Riu Serpis, 6 · Mutxamel', type: 'Bungalow', ref: 'GT-0429', price: 385000, owner: 'D. Javier Moreno Sanz', photo: 'assets/media/p1.jpg',
      features: ['304 m² construidos', '264 m² útiles', '4 dormitorios', '3 baños', 'Terraza', 'Muy buen estado', 'Año de construcción: 2021', 'Orientación norte y sur', 'Plaza de garaje'],
      s: { visualizaciones: [1950, 720, 540, 470], favoritos: [61, 24, 15, 12], solicitudes: [0, 1, 0, 0], ofrecidos: [2, 1, 0, 1],
           noViables: [0, 0, 0, 0], presenciales: [0, 1, 0, 0], ofertas: [0, 0, 0, 0] },
      fb: {
        0: [['cliente', 2, 'Cliente bufete', 'negativa', ['Tipo de vivienda'], 'Busca chalet independiente.'],
            ['cliente', 4, 'Cliente bufete', 'negativa', ['Tipo de vivienda'], 'Su búsqueda se centra en chalet independiente.']],
        1: [['visita', 3, 'Andrés', 'dudas', ['Precio'], 'Le gusta la vivienda; ve el precio por encima de su presupuesto.']],
        3: [['cliente', 2, 'Cliente bufete', 'negativa', ['Tipo de vivienda'], 'Prefiere vivienda unifamiliar aislada.']],
      } },
    { id: 'p3', company: 'gt', title: 'Ático en venta en Av. de la Libertad, 41 – Sant Joan d’Alacant', short: 'Ático Av. de la Libertad, 41',
      address: 'Av. de la Libertad, 41, 6º · Sant Joan d’Alacant', type: 'Ático', ref: 'GT-0398', price: 289000, owner: 'Familia Ortega Blanco', photo: 'assets/media/p5.jpg',
      features: ['112 m² construidos', '3 dormitorios', '2 baños', 'Terraza de 40 m²', 'Reformado', 'Ascensor', 'Plaza de garaje'],
      s: { visualizaciones: [2410, 1380, 1120, 980, 940, 900, 870, 850], favoritos: [88, 61, 49, 44, 41, 40, 38, 37], solicitudes: [6, 5, 5, 4, 4, 4, 3, 4],
           ofrecidos: [4, 2, 1, 1, 1, 1, 0, 1], noViables: [1, 1, 0, 1, 0, 0, 1, 0], presenciales: [3, 3, 3, 2, 3, 2, 2, 3], ofertas: [0, 0, 0, 1, 0, 1, 0, 1] },
      fb: {
        3: [['visita', 2, 'Raúl', 'positiva', [], 'Encantado con la terraza; presenta oferta.']],
        5: [['visita', 4, 'Pilar', 'positiva', ['Precio'], 'Oferta un 5 % por debajo del precio de salida.']],
        6: [['noViable', 2, 'Cliente portal', 'negativa', [], 'Pendiente de aprobación hipotecaria; no viable de momento.']],
        7: [['visita', 1, 'Familia Soler', 'positiva', [], 'Segunda visita; oferta cercana al precio de salida.']],
      } },
    { id: 'p4', company: 'as', title: 'Apartamento en venta en Av. Carrer la Mar, 64 – El Campello', short: 'Apartamento Carrer la Mar, 64',
      address: 'Av. Carrer la Mar, 64, 4º · El Campello', type: 'Apartamento', ref: 'AS-1120', price: 245000, owner: 'D. Andrés Gil Navarro', photo: 'assets/media/p7.jpg',
      features: ['82 m² construidos', '2 dormitorios', '2 baños', 'Vistas al mar', 'Piscina comunitaria', 'Plaza de garaje'],
      s: { visualizaciones: [2900, 1600, 1350, 1220, 1150, 1100, 1060, 1040], favoritos: [120, 70, 58, 52, 50, 47, 45, 44], solicitudes: [9, 7, 7, 6, 6, 6, 5, 6],
           ofrecidos: [2, 1, 1, 0, 1, 0, 1, 0], noViables: [2, 2, 1, 2, 2, 1, 2, 2], presenciales: [2, 1, 1, 1, 1, 0, 1, 1], ofertas: [0, 0, 0, 0, 0, 0, 0, 0] },
      fb: { 7: [['visita', 3, 'Mark (comprador extranjero)', 'dudas', ['Precio'], 'Pide más fotos y vídeo antes de una segunda visita.']] } },
    { id: 'p5', company: 'as', title: 'Piso en venta en C/ Castaños, 22 – Alicante', short: 'Piso C/ Castaños, 22',
      address: 'C/ Castaños, 22, 2º · Alicante', type: 'Piso', ref: 'AS-0233', price: 265000, owner: 'D. Miguel Castro León', photo: 'assets/media/p3.jpg',
      features: ['105 m² construidos', '3 dormitorios', '2 baños', 'Balcón', 'Reformado', 'Ascensor'],
      s: { visualizaciones: [2100, 1300, 1150, 1080, 1020, 990, 960, 940], favoritos: [80, 55, 49, 46, 44, 42, 41, 40], solicitudes: [6, 5, 5, 5, 5, 4, 5, 4],
           ofrecidos: [2, 1, 1, 1, 0, 1, 0, 1], noViables: [1, 0, 1, 0, 1, 0, 0, 1], presenciales: [3, 3, 2, 3, 2, 2, 3, 2], ofertas: [0, 0, 0, 0, 1, 0, 0, 1] },
      fb: { 7: [['visita', 2, 'Laura', 'positiva', [], 'Oferta un 4 % por debajo del precio.']] } },
  ];

  function buildSeed() {
    const cur = currentWeekId();
    const weeks = {};
    const properties = PROPS.map((p) => {
      const n = p.s.visualizaciones.length;
      const list = [];
      for (let i = 0; i < n; i++) {
        const id = shiftWeek(cur, i - n);
        const values = {};
        Object.keys(p.s).forEach((k) => { values[k] = p.s[k][i]; });
        const feedback = (p.fb[i] || []).map(([tipo, day, nombre, valoracion, motivos, comentario]) => ({ tipo, fecha: dayOf(id, day), nombre, valoracion, motivos, comentario }));
        list.push({ week: id, values, feedback, savedAt: Date.now() });
      }
      weeks[p.id] = list;
      const { s, fb, ...meta } = p;
      return { ...meta, published: list[0].week };
    });
    return {
      version: 2,
      companies: COMPANIES.map((c) => ({ ...c })),
      properties,
      weeks,
      fields: FIELDS.map((f) => ({ ...f })),
      report: {
        sections: { features: true, gauge: true, kpis: true, cumulative: true, charts: true, ratios: true, feedback: true, diagnosis: true },
        hidden: {}, colors: {}, logos: {}, photos: {}, diag: {},
      },
      ui: { company: 'gt', property: 'p1', view: 'semana' },
    };
  }

  /* ---------- Calculos basicos ---------- */
  const val = (w, k) => (w && w.values && Number.isFinite(w.values[k]) ? w.values[k] : null);
  const v0 = (w, k) => val(w, k) || 0;
  const ratio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
  const change = (cur, prev) => (cur == null || prev == null || prev === 0 ? null : (cur - prev) / prev);
  const sumK = (list, k) => list.reduce((s, w) => s + v0(w, k), 0);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Contactos: solicitudes por portales + clientes del bufete. Los no viables no cuentan como contacto util.
  const contactos = (w) => v0(w, 'solicitudes') + v0(w, 'ofrecidos');
  const viables = (w) => Math.max(0, contactos(w) - v0(w, 'noViables'));

  function ratios(w) {
    return {
      interes:  ratio(val(w, 'favoritos'), val(w, 'visualizaciones')),
      solicitud: ratio(val(w, 'solicitudes'), val(w, 'visualizaciones')),
      visita:   ratio(val(w, 'presenciales'), viables(w) || null),
      oferta:   ratio(val(w, 'ofertas'), val(w, 'presenciales')),
    };
  }
  const RATIO_DEFS = [
    { key: 'interes',   label: 'Interés del anuncio', formula: 'favoritos ÷ visualizaciones', digits: 1 },
    { key: 'solicitud', label: 'Tasa de solicitud',   formula: 'solicitudes ÷ visualizaciones', digits: 2 },
    { key: 'visita',    label: 'Paso a visita',       formula: 'visitas ÷ contactos viables', digits: 0 },
    { key: 'oferta',    label: 'Paso a oferta',       formula: 'ofertas ÷ visitas', digits: 0 },
  ];

  /* ---------- Acumulado desde la publicacion ---------- */
  function cumulative(list, idx) {
    const upto = list.slice(0, idx + 1);
    const out = { semanas: upto.length, contactos: 0, viables: 0, feedback: 0, motivos: {} };
    FIELDS.forEach((f) => { out[f.key] = sumK(upto, f.key); });
    upto.forEach((w) => {
      out.contactos += contactos(w); out.viables += viables(w);
      (w.feedback || []).forEach((fb) => {
        if (fb.tipo === 'noViable') return;
        out.feedback++;
        (fb.motivos || []).forEach((m) => { out.motivos[m] = (out.motivos[m] || 0) + 1; });
      });
    });
    out.visitasFb = upto.reduce((s, w) => s + (w.feedback || []).filter((f) => f.tipo === 'visita').length, 0);
    out.topMotivos = Object.entries(out.motivos).sort((a, b) => b[1] - a[1]);
    return out;
  }

  /* ---------- Indicador de fuerza comercial (0-100) ----------
     Cuatro componentes, cada uno de 0 a 100, con las dos ultimas semanas para suavizar:
     - Visibilidad (20 %): visualizaciones frente a lo esperable para su semana en el mercado
       (los portales concentran el impacto al principio y luego baja de forma natural).
     - Interes (30 %): contactos viables por cada 1.000 visualizaciones, frente a la referencia.
     - Paso a visita (30 %): visitas presenciales frente a contactos viables.
     - Ofertas (20 %): ofertas recientes; muchas visitas sin oferta restan.
     Zonas: 65-100 favorable · 40-64 atencion · 0-39 revision. Los parametros se ajustan con la inmobiliaria. */
  const REF = { decay: [1, 0.42, 0.33, 0.29, 0.27, 0.26, 0.25, 0.24], contactosPorMil: 2.5, pasoVisita: 0.45, w: { vis: 0.2, int: 0.3, vst: 0.3, ofe: 0.2 } };
  const ZONES = [
    { key: 'good', label: 'Favorable', from: 65 },
    { key: 'warn', label: 'Atención', from: 40 },
    { key: 'bad', label: 'Revisión', from: 0 },
  ];
  const zoneOf = (x) => ZONES.find((z) => x >= z.from);
  const score = (r) => clamp(r, 0, 1.25) * 80;

  function strength(list, idx) {
    if (!list[idx]) return null;
    const win = list.slice(Math.max(0, idx - 1), idx + 1);
    const base = v0(list[0], 'visualizaciones') || 1;
    const expected = win.reduce((s, w, i) => s + base * (REF.decay[Math.max(0, idx - (win.length - 1) + i)] ?? 0.22), 0);
    const vis = score(sumK(win, 'visualizaciones') / expected);
    const views = sumK(win, 'visualizaciones');
    const viab = win.reduce((s, w) => s + viables(w), 0);
    // se mide contra las visualizaciones esperables (y no las reales) para que una caida de visibilidad no infle el interes
    const int = score((viab / Math.max(views, expected) * 1000) / REF.contactosPorMil);
    const vst = viab ? score((sumK(win, 'presenciales') / viab) / REF.pasoVisita) : (sumK(win, 'presenciales') ? 70 : 25);
    const last3 = list.slice(Math.max(0, idx - 2), idx + 1);
    const of3 = sumK(last3, 'ofertas');
    const visAcc = sumK(list.slice(0, idx + 1), 'presenciales');
    const ofe = of3 > 0 ? 100 : (visAcc >= 5 && idx >= 3) ? 15 : idx < 2 ? 75 : 45; // muchas visitas acumuladas sin oferta restan
    const total = Math.round(vis * REF.w.vis + int * REF.w.int + vst * REF.w.vst + ofe * REF.w.ofe);
    return { value: total, zone: zoneOf(total), parts: { visibilidad: Math.round(vis), interes: Math.round(int), visita: Math.round(vst), ofertas: Math.round(ofe) } };
  }
  const strengthSeries = (list, idx) => list.slice(0, idx + 1).map((_, i) => strength(list, i).value);

  /* ---------- Diagnostico comercial (reglas claras, tono neutro) ---------- */
  function diagnose(list, idx) {
    const cur = list[idx];
    if (!cur) return null;
    const pct = (x, d = 0) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: d })} %`;
    const st = strength(list, idx);
    const series = strengthSeries(list, idx);
    const acc = cumulative(list, idx);
    const weeksOn = idx + 1;
    const items = [], recs = [];

    // 1. Evolucion del indicador
    const first = series[0];
    if (weeksOn >= 3 && st.value <= first - 15) items.push(`El indicador de fuerza comercial ha pasado de ${first} a ${st.value} puntos en ${weeksOn} semanas de comercialización.`);
    else if (weeksOn >= 3 && st.value >= first - 5) items.push(`El inmueble mantiene su fuerza comercial tras ${weeksOn} semanas en el mercado (${st.value} puntos).`);

    // 2. Embudo acumulado
    if (acc.visualizaciones) items.push(`Desde la publicación: ${acc.visualizaciones.toLocaleString('es-ES', { useGrouping: 'always' })} visualizaciones, ${acc.contactos} contactos (${acc.viables} viables), ${acc.presenciales} visitas presenciales y ${acc.ofertas} ${acc.ofertas === 1 ? 'oferta' : 'ofertas'}.`);

    // 3. No viables: no se atribuyen al inmueble
    if (acc.noViables > 0) items.push(`${acc.noViables} ${acc.noViables === 1 ? 'contacto no ha superado' : 'contactos no han superado'} el estudio de viabilidad financiera; no se tienen en cuenta en los ratios del inmueble.`);

    // 4. Motivo mas repetido en el feedback
    const top = acc.topMotivos[0];
    if (top && acc.feedback >= 2 && top[1] >= 2) {
      items.push(`El motivo más repetido en el feedback es «${top[0].toLowerCase()}» (${top[1]} de ${acc.feedback} comentarios).`);
      if (top[0] === 'Tipo de vivienda') recs.push('orientar la difusión a clientes que buscan este tipo de vivienda');
    }

    // 5. Conclusiones derivadas de los datos acumulados
    const p3 = sumK(list.slice(Math.max(0, idx - 2), idx + 1), 'presenciales');
    const of = acc.ofertas;
    const precioMot = acc.motivos['Precio'] || 0;
    if (st.zone.key === 'bad' && weeksOn >= 4 && of === 0) {
      recs.push(acc.presenciales >= 4 || precioMot >= 2
        ? 'valorar con el propietario una revisión del precio, como conclusión de los datos acumulados'
        : 'reforzar la visibilidad del anuncio y valorar con el propietario el posicionamiento del precio');
    } else if (st.zone.key === 'warn') {
      recs.push(viables(cur) === 0 ? 'reactivar la difusión del anuncio y ofrecerlo de nuevo a clientes de la base de datos' : 'seguir de cerca la evolución de las próximas dos semanas');
    } else if (v0(cur, 'ofertas') > 0) {
      recs.push('dar seguimiento a la oferta recibida con el propietario');
    } else if (st.zone.key === 'good') {
      recs.push('mantener la estrategia actual');
    }
    if (!items.length) items.push('Semana sin cambios relevantes respecto a las anteriores.');

    const headline = st.zone.key === 'good'
      ? (v0(cur, 'ofertas') > 0 ? 'Buena respuesta del mercado, con oferta esta semana' : 'El inmueble mantiene una buena respuesta del mercado')
      : st.zone.key === 'warn' ? 'El interés del mercado se está moderando' : 'Los datos acumulados indican pérdida de fuerza comercial';
    const rec = `Recomendación: ${recs.slice(0, 2).join(' y ')}.`;
    return {
      status: { key: st.zone.key, label: st.zone.label },
      strength: st, headline, items,
      rec: rec.charAt(0).toUpperCase() + rec.slice(1),
      text: `${items.join(' ')} ${rec}`,
    };
  }

  global.ISD = {
    FIELDS, FONTS, MOTIVOS, FB_TIPOS, VALORACION, ZONES, REF,
    buildSeed, weekInfo, fmtDay, currentWeekId, shiftWeek, dayOf,
    ratios, RATIO_DEFS, change, diagnose, val, contactos, viables, cumulative, strength, strengthSeries, zoneOf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
