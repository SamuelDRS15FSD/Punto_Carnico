'use strict';

/* Los datos de los cortes viven en data/cortes.json (ver README.md). */
let CORTES = [];

/* Etiquetas de filtros */
const COCCIONES = [
  { k: 'asar', t: 'Asar' }, { k: 'sudar', t: 'Sudar' }, { k: 'freir', t: 'Freír' },
  { k: 'hornear', t: 'Hornear' }, { k: 'parrillar', t: 'Parrillar' }
];
const FORMATOS = [
  { k: 'medallones', t: 'Medallones' }, { k: 'entero', t: 'Entero' },
  { k: 'tiras', t: 'Tiras' }, { k: 'filetes', t: 'Filetes' }
];
const SUGERENCIAS = {
  bovina: ['Solomito', 'Lomo viche', 'Lomo fino', 'Bola negra', 'Punta gorda', 'Chata'],
  porcina: ['Cañón', 'Lomito', 'Tocino carnudo', 'Pernil', 'Baby back', 'Manitas']
};
const FUENTE_NUT = {
  a: 'AGROSAVIA (2020)', e: 'Ficha manual Éxito', x: 'Valor estimado (sin dato en los manuales)',
  r: 'Valor de referencia compartido por varios cortes en la fuente (manual Éxito)'
};
const NOTA_REFERENCIA = 'Este valor se repite en otros cortes de la fuente, así que puede no ser específico de este corte. Verifícalo antes de usarlo para cálculos nutricionales.';
/** ¿El dato nutricional es solo una referencia genérica? */
const esReferencia = (c) => c.nut.src === 'r';
/** Código del corte para mostrar en la ficha. */
const codigoCorte = (c) => (!c.imps || /^(sin imps|—|-)$/i.test(String(c.imps).trim())) ? 'Sin código asignado' : c.imps;
/** Regiones disponibles para «Mi región». */
const REGIONES = ['Medellín', 'Bogotá', 'Santander', 'Cali / Eje Cafetero', 'Costa Caribe'];

/* ==========================================================================
   2. UTILIDADES
   ========================================================================== */

/** Normaliza texto: minúsculas y sin tildes, para búsquedas tolerantes. */
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Escapa HTML para insertar texto de forma segura. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Atajo de selectores. */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
/** Formateo numérico en español de Colombia. */
const nf = (n, d = 1) => Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d });
/** Acceso seguro a localStorage (puede lanzar en modo privado). */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* sin persistencia */ } }
};
/** Respeta la preferencia de movimiento reducido. */
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Ritmo de cocción deducido de los métodos del corte: lenta (solo sudar), mixta o rápida. */
function ritmo(c) {
  const lento = c.coc.includes('sudar');
  const rapido = c.coc.some((k) => k !== 'sudar');
  if (lento && !rapido) return { k: 'lenta', t: 'Cocción lenta', i: 'timer' };
  if (lento && rapido) return { k: 'mixta', t: 'Cocción versátil', i: 'shuffle' };
  return { k: 'rapida', t: 'Cocción rápida', i: 'zap' };
}
/** Calorías aproximadas por factores de Atwater (4 kcal/g proteína, 9 kcal/g grasa). */
const kcal = (n) => Math.round(n.p * 4 + n.g * 9);
const ESPECIES = {
  bovina: { t: 'bovina', cat: 'Carne de res', icon: 'beef' },
  porcina: { t: 'porcina', cat: 'Carne de cerdo', icon: 'ham' }
};

/* ==========================================================================
   MOTOR DE BÚSQUEDA
   - Ignora tildes, mayúsculas y palabras vacías ("de", "del", "la"...).
   - Tolera plurales ("medallones") y prefijos ("sol" → solomito).
   - Cada nombre (comercial, alias o regional) se evalúa como una unidad:
     "bola negra" encuentra el Huevo de aldana, y "huevo del aldana" también.
   - Si no hay coincidencias exactas, aplica tolerancia a errores de escritura.
   ========================================================================== */
const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'al', 'en', 'y', 'con', 'a', 'un', 'una']);
/** Divide un texto normalizado en palabras útiles (sin palabras vacías y sin 's' final). */
function tokenizar(texto) {
  const palabras = norm(texto).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean);
  const utiles = palabras.filter((w) => !STOPWORDS.has(w));
  return (utiles.length ? utiles : palabras).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}
/** Distancia de Levenshtein (para errores de escritura). */
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** ¿La palabra del catálogo coincide con la palabra buscada? (0 = no; 2 = exacta; 1.5 = prefijo; 1 = aproximada) */
function palabraCoincide(w, tk, difuso) {
  if (w === tk) return 2;
  if (w.startsWith(tk) || (tk.length > 4 && tk.endsWith('es') && w.startsWith(tk.slice(0, -2)))) return tk.length >= 2 ? 1.5 : 0;
  if (difuso && tk.length >= 4) {
    const tol = tk.length >= 8 ? 2 : 1;
    if (lev(w, tk) <= tol || lev(w.slice(0, tk.length), tk) <= tol) return 1;
  }
  return 0;
}
/** Evalúa un corte: devuelve { puntaje, term } con el mejor nombre coincidente, o null. */
function evaluar(c, tokens, difuso) {
  let mejor = null;
  for (const t of c._terms) {
    let suma = 0, ok = true;
    for (const tk of tokens) {
      let m = 0;
      for (const w of t.words) { const v = palabraCoincide(w, tk, difuso); if (v > m) m = v; }
      if (!m) { ok = false; break; }
      suma += m;
    }
    if (!ok) continue;
    let puntaje = suma + (t.tipo === 'nombre' ? 1 : 0.5) + (t.words.length === tokens.length ? 1 : 0);
    if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, term: t };
  }
  return mejor;
}
/** Tokens de la consulta del usuario. */
const tokensDe = (q) => tokenizar(q);
/** Resultados de búsqueda para una especie (primero exactos; si no hay, con tolerancia a errores). */
function buscarEn(esp, q) {
  const tokens = tokensDe(q);
  const base = CORTES.filter((c) => c.esp === esp);
  if (!tokens.length) return base.map((c) => ({ c, puntaje: 0, term: null }));
  for (const difuso of [false, true]) {
    const r = base.map((c) => { const e = evaluar(c, tokens, difuso); return e && { c, puntaje: e.puntaje, term: e.term }; }).filter(Boolean);
    if (r.length) return r;
  }
  return [];
}

/* Pre-cálculo de términos de búsqueda para cada corte (se ejecuta una sola vez, tras cargar los datos). */
function prepararIndice() {
  CORTES.forEach((c) => {
    const terms = [{ raw: c.n, n: norm(c.n), tipo: 'nombre' }];
    c.sub.split('·').forEach((s) => terms.push({ raw: s.trim(), n: norm(s), tipo: 'nombre' }));
    c.alias.forEach((a) => terms.push({ raw: a, n: norm(a), tipo: 'alias' }));
    Object.entries(c.reg).forEach(([region, nombre]) => {
      nombre.split('/').forEach((p) => terms.push({ raw: p.trim(), n: norm(p), tipo: 'regional', region }));
    });
    terms.forEach((t) => { t.words = tokenizar(t.n); });
    c._terms = terms;
  });
}

/* ==========================================================================
   3. ESTADO DE LA APLICACIÓN
   ========================================================================== */
const state = {
  esp: 'bovina',
  q: '',
  coc: new Set(),
  fmt: new Set(),
  orden: 'az',
  region: ''
};
let pushedFicha = false;    // ¿la ficha añadió una entrada al historial? (si se llegó por enlace directo, no)
let lastTrigger = null;      // elemento que abrió la ficha (para devolver el foco)
const baseTitle = document.title;

/* Referencias al DOM */
const el = {
  grid: $('#grid'), vacio: $('#vacio'), conteo: $('#conteo'), q: $('#q'), orden: $('#orden'),
  fCoc: $('#f-coccion'), fFmt: $('#f-formato'), toggle: $('#sp-toggle'),
  region: $('#region'), lblB: $('#lbl-bovina'), lblP: $('#lbl-porcina'), hEsp: $('#h-especie'), sug: $('#sugerencias'),
  dlg: $('#ficha'), aviso: $('#ficha-aviso'), dlgTitulo: $('#ficha-titulo'), dlgSub: $('#ficha-sub'), dlgBody: $('#ficha-body')
};

/* ==========================================================================
   4. ILUSTRACIÓN SVG GENERATIVA (decorativa)
   Genera una pieza de carne con vetas a partir del id (determinista).
   ========================================================================== */
/** Créditos de las fotografías según el manual de origen. */
const CREDITOS = {
  bovina: 'Foto: AGROSAVIA (2020), «Cortes de la canal bovina», licencia CC BY-NC-SA 4.0.',
  porcina: 'Foto: «Manual de cortes de carne de cerdo colombiano», Asoporcicultores–FNP / Cenipórcino.'
};
/** Fotografía real del corte (si existe) para la tarjeta; si falla la carga, se usa la ilustración. */
function foto(c) {
  return `<div class="card-photo-wrap"><img class="card-photo" src="${esc(c.img)}" width="800" height="600" loading="lazy" decoding="async"
    alt="Fotografía del corte ${esc(c.n)}" data-id="${esc(c.id)}"></div>`;
}
function art(c) {
  // PRNG simple con semilla derivada del id
  let seed = 0; for (const ch of c.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pork = c.esp === 'porcina';
  const col = pork ? { m: '#E3939F', v: '#F9D6DC', f: '#FFF3EE', s: '#C26B7B' } : { m: '#AE3443', v: '#E8A0A7', f: '#F8E8E0', s: '#7D1E2B' };
  // Blob: 9 puntos alrededor de una elipse con ruido
  const cx = 160, cy = 90, rx = 92 + rnd() * 20, ry = 52 + rnd() * 14, N = 9;
  const pts = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2, j = 0.88 + rnd() * 0.24;
    return [cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[N - 1], pts[0]).map((v) => v.toFixed(1))}`;
  for (let i = 0; i < N; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % N]); d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`; }
  d += 'Z';
  let veins = '';
  const nv = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < nv; i++) {
    const x1 = cx - rx * 0.7 + rnd() * rx * 1.4, y1 = cy - ry * 0.6 + rnd() * ry * 1.2;
    const x2 = x1 + (rnd() - 0.3) * 70, y2 = y1 + (rnd() - 0.5) * 36;
    veins += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${((x1 + x2) / 2 + (rnd() - 0.5) * 24).toFixed(1)},${((y1 + y2) / 2 + (rnd() - 0.5) * 24).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" stroke="${col.v}" stroke-width="${(1.5 + rnd() * 2.5).toFixed(1)}" fill="none" stroke-linecap="round" opacity=".85"/>`;
  }
  return `<svg class="card-art" viewBox="0 0 320 180" role="img" aria-label="Ilustración decorativa de ${esc(c.n)}" focusable="false" preserveAspectRatio="xMidYMid slice">
    <ellipse cx="160" cy="160" rx="110" ry="9" fill="#000" opacity=".08"/>
    <path d="${d}" fill="${col.m}" stroke="${col.f}" stroke-width="7" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${col.s}" stroke-width="1.5" opacity=".35"/>
    ${veins}
  </svg>`;
}

/* ==========================================================================
   5. FILTROS Y RENDERIZADO DE TARJETAS
   ========================================================================== */

/** Construye los chips de filtro (botones con aria-pressed). */
function buildChips() {
  const mk = (arr, set, key) => arr.map((o) =>
    `<button type="button" class="chip" data-f="${key}" data-k="${o.k}" aria-pressed="false">${o.t}</button>`).join('');
  el.fCoc.innerHTML = mk(COCCIONES, state.coc, 'coc');
  el.fFmt.innerHTML = mk(FORMATOS, state.fmt, 'fmt');
}

/** Sugerencias de búsqueda rápida según la especie activa. */
function buildSugerencias() {
  el.sug.innerHTML = SUGERENCIAS[state.esp].map((s) =>
    `<button type="button" class="underline decoration-dotted underline-offset-4 font-semibold text-accent px-1 py-1 rounded hover:bg-accent-soft" data-sug="${esc(s)}">${esc(s)}</button>`).join('<span aria-hidden="true">·</span>');
}

/** Devuelve la lista filtrada y ordenada para una especie (por defecto, la activa).
 *  Filtros: dentro de un mismo grupo (p. ej. Asar + Hornear) basta con cumplir UNO (OR);
 *  entre grupos (cocción + formato) se deben cumplir AMBOS (AND). */
function filtrar(esp = state.esp) {
  const hay = tokensDe(state.q).length > 0;
  let res = buscarEn(esp, state.q);
  if (state.coc.size) res = res.filter(({ c }) => [...state.coc].some((k) => c.coc.includes(k)));
  if (state.fmt.size) res = res.filter(({ c }) => [...state.fmt].some((k) => c.fmt.includes(k)));
  const cmp = {
    az: (a, b) => a.n.localeCompare(b.n, 'es'),
    prot: (a, b) => esReferencia(a) - esReferencia(b) || b.nut.p - a.nut.p || a.n.localeCompare(b.n, 'es'),
    magro: (a, b) => esReferencia(a) - esReferencia(b) || a.nut.g - b.nut.g || a.n.localeCompare(b.n, 'es'),
    peso: (a, b) => (b.peso || 0) - (a.peso || 0) || a.n.localeCompare(b.n, 'es')
  }[state.orden];
  // Con texto de búsqueda, los más relevantes van primero; el orden elegido desempata.
  res.sort((a, b) => (hay ? b.puntaje - a.puntaje : 0) || cmp(a.c, b.c));
  return res.map((r) => r.c);
}

/** Resalta (con <mark>) la coincidencia de la búsqueda dentro de un texto. */
function resaltar(texto, q) {
  const tokens = tokensDe(q);
  if (!tokens.length) return esc(texto);
  const n = norm(texto); const marks = [];
  tokens.forEach((t) => { let i = n.indexOf(t); while (i !== -1) { marks.push([i, i + t.length]); i = n.indexOf(t, i + t.length); } });
  if (!marks.length) return esc(texto);
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [marks[0].slice()];
  for (const m of marks.slice(1)) { const l = merged[merged.length - 1]; if (m[0] <= l[1]) l[1] = Math.max(l[1], m[1]); else merged.push(m.slice()); }
  let out = '', pos = 0;
  merged.forEach(([s, e]) => { out += esc(texto.slice(pos, s)) + '<mark class="hit">' + esc(texto.slice(s, e)) + '</mark>'; pos = e; });
  return out + esc(texto.slice(pos));
}

/** Encuentra por qué un corte coincide con la búsqueda cuando no es por su nombre principal. */
function coincidencia(c, q) {
  const tokens = tokensDe(q);
  if (!tokens.length) return null;
  if (norm(c.n) === norm(q)) return null;
  const e = evaluar(c, tokens, false) || evaluar(c, tokens, true);
  if (!e || e.term.raw === c.n) return null;
  return { raw: e.term.raw, region: e.term.region || null };
}

/** Pinta la cuadrícula de tarjetas. */
let avisoEsp = '';
function renderGrid() {
  let list = filtrar();
  // Si no hay resultados aquí pero sí en la otra especie, cambiamos de especie automáticamente.
  if (!list.length && tokensDe(state.q).length) {
    const otra = state.esp === 'bovina' ? 'porcina' : 'bovina';
    if (filtrar(otra).length) {
      avisoEsp = `“${state.q.trim()}” no aparece en carne ${ESPECIES[state.esp].t}; te mostramos los resultados en carne ${ESPECIES[otra].t}.`;
      setEspecie(otra, { sinTransicion: true });
      return;
    }
  }
  el.grid.setAttribute('aria-busy', 'false');
  const aviso = $('#aviso-esp');
  if (aviso) { aviso.textContent = avisoEsp; aviso.classList.toggle('hidden', !avisoEsp); }
  avisoEsp = '';
  const esp = ESPECIES[state.esp];
  el.grid.innerHTML = list.map((c, i) => {
    const m = coincidencia(c, state.q);
    const matchHtml = m ? `<p class="text-sm"><span class="sr-only">Coincidencia: </span><i data-lucide="link" class="w-3.5 h-3.5 inline -mt-0.5 text-accent" aria-hidden="true"></i> También se conoce como <strong>${resaltar(m.raw, state.q)}</strong>${m.region ? ' <span class="text-muted">(' + esc(m.region) + ')</span>' : ''}</p>` : '';
    const cocs = c.coc.map((k) => `<li class="badge">${COCCIONES.find((o) => o.k === k).t}</li>`).join('');
    const local = state.region && c.reg[state.region] && norm(c.reg[state.region]) !== norm(c.n) ? c.reg[state.region] : '';
    const regionHtml = local ? `<p class="text-sm"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline -mt-0.5 text-accent" aria-hidden="true"></i> En ${esc(state.region.split(' / ')[0])}: <strong>${esc(local)}</strong></p>` : '';
    const ap = esReferencia(c) ? '≈ ' : '';
    return `<li>
      <article class="card cards-enter" style="animation-delay:${Math.min(i, 12) * 35}ms" aria-labelledby="t-${c.id}">
        ${c.img ? foto(c) : art(c)}
        <div class="p-4 flex flex-col gap-3 grow">
          <div class="flex items-center justify-between gap-2">
            <span class="badge">${esc(c.grupo)}</span>
            <span class="text-sm text-muted whitespace-nowrap" title="Peso aproximado de la pieza en la canal">${c.peso ? '≈ ' + nf(c.peso, 2) + ' kg' : 'Peso variable'}</span>
          </div>
          <div>
            <h3 id="t-${c.id}" class="text-xl font-bold leading-snug">${resaltar(c.n, state.q)}</h3>
            <p class="text-sm text-muted mt-0.5">${esc(c.sub)}</p>
          </div>
          ${regionHtml}
          ${matchHtml}
          <p class="ritmo ritmo-${ritmo(c).k}"><i data-lucide="${ritmo(c).i}" class="w-4 h-4" aria-hidden="true"></i>${ritmo(c).t}</p>
          <ul class="flex flex-wrap gap-1.5 list-none p-0 m-0" aria-label="Métodos de cocción">${cocs}</ul>
          <dl class="grid grid-cols-3 gap-2 text-center border-t border-line pt-3 mt-auto">
            <div><dt class="text-xs uppercase tracking-wide text-muted">Proteína</dt><dd class="font-bold">${ap}${nf(c.nut.p)} g</dd></div>
            <div><dt class="text-xs uppercase tracking-wide text-muted">Grasa</dt><dd class="font-bold">${ap}${nf(c.nut.g)} g</dd></div>
            <div><dt class="text-xs uppercase tracking-wide text-muted">Energía</dt><dd class="font-bold">${ap}${kcal(c.nut)} kcal</dd></div>
          </dl>
          <button type="button" class="card-btn btn ghost w-full" data-id="${c.id}" aria-haspopup="dialog" aria-label="Ver ficha técnica de ${esc(c.n)}">
            Ver ficha técnica <i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>
          </button>
        </div>
      </article>
    </li>`;
  }).join('');

  const total = CORTES.filter((c) => c.esp === state.esp).length;
  el.vacio.classList.toggle('hidden', list.length > 0);
  el.grid.classList.toggle('hidden', list.length === 0);
  el.conteo.textContent = `Mostrando ${list.length} de ${total} cortes de carne ${esp.t}`;
  if (window.lucide) lucide.createIcons();
}

/** Sincroniza visualmente los chips con el estado. */
function syncChips() {
  document.querySelectorAll('.chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(state[b.dataset.f].has(b.dataset.k)));
  });
}

/* ==========================================================================
   6. SELECTOR DE ESPECIE (interruptor)
   ========================================================================== */
function setEspecie(esp, opts = {}) {
  if (!ESPECIES[esp]) esp = 'bovina';
  const cambio = esp !== state.esp;
  state.esp = esp;
  document.documentElement.dataset.species = esp;
  const pork = esp === 'porcina';
  el.toggle.setAttribute('aria-checked', String(pork));
  el.toggle.setAttribute('aria-label', pork ? 'Mostrar carne bovina (activado: carne porcina)' : 'Mostrar carne porcina (desactivado: carne bovina)');
  el.lblB.dataset.active = String(!pork);
  el.lblP.dataset.active = String(pork);
  el.hEsp.textContent = ESPECIES[esp].t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', pork ? '#9B3A55' : '#7A1F2B');
  store.set('cortes.especie', esp);
  try { const u = new URL(location.href); u.searchParams.set('especie', esp); history.replaceState(null, '', u); } catch (_) { /* file:// */ }
  buildSugerencias();
  if (opts.sinTransicion || !cambio || reducedMotion()) { renderGrid(); return; }
  // Transición suave: se desvanece la cuadrícula, se vuelve a pintar y reaparece
  el.grid.style.transition = 'opacity .15s ease'; el.grid.style.opacity = '0';
  setTimeout(() => { renderGrid(); el.grid.style.opacity = '1'; }, 160);
}

/* ==========================================================================
   7. FICHA TÉCNICA (MODAL) Y CALCULADORA DE PORCIONES
   ========================================================================== */

/** Formatea cantidades de ingredientes ya escaladas. */
function fmtCantidad(q, unidad) {
  if (q === null || q === undefined) return 'al gusto';
  if (unidad === 'g') { if (q >= 1000) return nf(q / 1000, 2) + ' kg'; return nf(Math.round(q / 5) * 5 || Math.round(q)) + ' g'; }
  if (unidad === 'ml') { if (q >= 1000) return nf(q / 1000, 2) + ' L'; return nf(Math.round(q / 5) * 5 || Math.round(q)) + ' ml'; }
  const r = Math.max(0.25, Math.round(q * 4) / 4);
  const ent = Math.floor(r), fr = r - ent;
  const fracc = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[fr];
  const num = (ent ? ent : '') + (ent && fracc ? ' ' : '') + fracc;
  const u = { u: 'und.', cda: 'cda.', cdta: 'cdta.', dientes: r <= 1 ? 'diente' : 'dientes', diente: r <= 1 ? 'diente' : 'dientes', tallos: r <= 1 ? 'tallo' : 'tallos' }[unidad] || unidad;
  return `${num} ${u}`.trim();
}

/** Recalcula ingredientes y resumen según el número de comensales. */
function actualizarReceta(c, n) {
  const rec = c.rec; const f = n / rec.porciones;
  $('#ing-list').innerHTML = rec.ingr.map(([q, u, nombre]) =>
    `<li><span>${esc(nombre)}</span><strong>${q === null ? (/al gusto/i.test(nombre) ? '' : 'al gusto') : fmtCantidad(q * f, u)}</strong></li>`).join('');
  const principal = rec.ingr.find((i) => i[3]) || rec.ingr[0];
  const cant = principal[0] * f;
  const porPersona = principal[1] === 'g' ? ` · ≈ ${nf(Math.round(principal[0] / rec.porciones))} g por comensal` : '';
  $('#rec-resumen').textContent = `Receta para ${n} ${n === 1 ? 'comensal' : 'comensales'}: ${fmtCantidad(cant, principal[1])} de ${principal[2].toLowerCase()}${porPersona}.`;
  $('#com-menos').disabled = n <= 1; $('#com-mas').disabled = n >= 60;
  $('#com-reset').hidden = n === rec.porciones;
}

/** Busca un corte por nombre o alias (para enlazar sustitutos).
 *  - Acepta «Chata (solomo redondo)», «tablón / sabaleta» y «Pernil de cerdo».
 *  - Prefiere cortes de la misma especie; nunca enlaza a un nombre genérico ambiguo (p. ej. «Carne para sudar»). */
function buscarCorte(nombre, esp) {
  const base = new Set([String(nombre).trim()]);
  const m = String(nombre).match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) { base.add(m[1].trim()); base.add(m[2].trim()); }
  [...base].forEach((t) => t.split('/').forEach((p) => p.trim() && base.add(p.trim())));
  const sinEspecie = new Set();
  [...base].forEach((t) => { const r = t.replace(/\s+de\s+(cerdo|res)$/i, '').trim(); if (r && r !== t) sinEspecie.add(r); });

  const en = (pool, cands) => {
    for (const cand of cands) {
      const n = norm(cand); if (!n) continue;
      const exacto = pool.filter((c) => norm(c.n) === n);
      if (exacto.length === 1) return exacto[0];
      const alias = pool.filter((c) => c.alias.some((a) => norm(a) === n));
      if (alias.length === 1) return alias[0];
      if (alias.length > 1) { const p = alias.filter((c) => norm(c.n).startsWith(n)); if (p.length === 1) return p[0]; continue; }
      if (n.length > 4) { const st = pool.filter((c) => norm(c.n).startsWith(n)); if (st.length === 1) return st[0]; }
    }
    return null;
  };
  const misma = esp ? CORTES.filter((c) => c.esp === esp) : CORTES;
  return en(misma, [...base]) ||
         (esp ? en(CORTES.filter((c) => c.esp !== esp), [...base]) : null) ||
         en(misma, [...sinEspecie]);
}

/** Construye el HTML completo de la ficha. */
function fichaHTML(c) {
  const meta = ESPECIES[c.esp];
  const n = c.nut, porc = 150, f = porc / 100;
  const mAct = coincidencia(c, state.q);
  const filas = Object.entries(c.reg).map(([r, v]) => {
    const hit = (mAct && norm(v).includes(norm(mAct.raw))) || (state.region && r === state.region);
    return `<tr${hit ? ' style="background:var(--accent-soft)"' : ''}><th scope="row">${esc(r)}</th><td>${hit ? '<strong>' + esc(v) + '</strong>' : esc(v)}</td></tr>`;
  }).join('');
  const sinSustituto = c.sus.length === 0 || c.sus.every((s) => /^no tiene/i.test(s));
  const subs = sinSustituto
    ? '<li class="text-sm text-muted">Este corte no tiene un sustituto directo.</li>'
    : c.sus.map((s) => {
        const t = buscarCorte(s, c.esp);
        return t && t.id !== c.id
          ? `<li><button type="button" class="chip" data-goto="${t.id}">${esc(s)} <i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i></button></li>`
          : `<li><span class="chip" style="cursor:default">${esc(s)}</span></li>`;
      }).join('');
  const cocs = c.coc.map((k) => `<li class="badge">${COCCIONES.find((o) => o.k === k).t}</li>`).join('');
  const fmts = c.fmt.map((k) => `<li class="badge">${FORMATOS.find((o) => o.k === k).t}</li>`).join('');
  const bar = (v, max) => `<div class="bar" aria-hidden="true"><span style="width:${Math.min(100, (v / max) * 100)}%"></span></div>`;
  const fila = (lbl, v100, unit, max, d = 1) => `
    <tr><th scope="row">${lbl}</th>
      <td>${nf(v100, d)} ${unit}${bar(v100, max)}</td>
      <td>${nf(v100 * f, d)} ${unit}</td></tr>`;
  const e = c.emp;
  const rec = c.rec;
  const stepsHtml = rec.pasos.map((p) => `<li class="pl-1">${esc(p)}</li>`).join('');

  const figura = c.img ? `<figure class="ficha-foto"><img src="${esc(c.img)}" width="800" height="600" decoding="async" alt="Fotografía del corte ${esc(c.n)}"><figcaption>${esc(CREDITOS[c.esp])}</figcaption></figure>` : '';
  const r = ritmo(c);
  const resumen = `<div class="resumen" role="group" aria-label="Resumen del corte">
    <span class="resumen-item"><i data-lucide="${r.i}" class="w-4 h-4" aria-hidden="true"></i>${r.t}</span>
    <span class="resumen-item"><i data-lucide="scale" class="w-4 h-4" aria-hidden="true"></i>${c.peso ? '≈ ' + nf(c.peso, 2) + ' kg' : 'Peso variable'}</span>
    <span class="resumen-item"><i data-lucide="beef" class="w-4 h-4" aria-hidden="true"></i>${esReferencia(c) ? '≈ ' : ''}${nf(c.nut.p)} g proteína · ${esReferencia(c) ? '≈ ' : ''}${nf(c.nut.g)} g grasa</span>
    <a class="btn resumen-cta" href="#f-rec" data-ir-receta><i data-lucide="chef-hat" class="w-4 h-4" aria-hidden="true"></i>Ver receta</a>
  </div>`;
  return `
  ${resumen}
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Columna izquierda: ficha, nutrición, regionales -->
    <div class="grid gap-4 content-start">
      ${figura}
      <section class="panel" aria-labelledby="f-ficha">
        <h3 id="f-ficha"><i data-lucide="info" class="w-5 h-5" aria-hidden="true"></i>Ficha técnica</h3>
        <p>${esc(c.desc)}</p>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt class="text-muted font-semibold">Especie</dt><dd>${meta.cat}</dd></div>
          <div><dt class="text-muted font-semibold">Ubicación / grupo</dt><dd>${esc(c.grupo)}</dd></div>
          <div><dt class="text-muted font-semibold">Peso aprox. de la pieza (canal)</dt><dd>${c.peso ? nf(c.peso, 2) + ' kg por pieza' : 'Variable'}</dd></div>
          <div><dt class="text-muted font-semibold">${c.esp === 'bovina' ? 'Código IMPS' : 'Código del manual'}</dt><dd>${esc(codigoCorte(c))}</dd></div>
          <div class="col-span-2"><dt class="text-muted font-semibold">Uso según el manual</dt><dd>${esc(c.uso)}</dd></div>
        </dl>
        <div class="mt-3"><p class="text-sm font-semibold text-muted mb-1">Métodos de cocción recomendados</p><ul class="flex flex-wrap gap-1.5 list-none p-0 m-0">${cocs}</ul></div>
        <div class="mt-3"><p class="text-sm font-semibold text-muted mb-1">Formatos comerciales</p><ul class="flex flex-wrap gap-1.5 list-none p-0 m-0">${fmts}</ul></div>
        <p class="note mt-4"><strong>Consejo de cocción:</strong> ${esc(c.tip)}</p>
      </section>

      <section class="panel" aria-labelledby="f-nut">
        <h3 id="f-nut"><i data-lucide="scale" class="w-5 h-5" aria-hidden="true"></i>Valores nutricionales aproximados</h3>
        <table class="data">
          <caption>Carne cruda. Ración de referencia: ${porc} g por comensal.</caption>
          <thead><tr><th scope="col">Nutriente</th><th scope="col">Por 100 g</th><th scope="col">Por ración (${porc} g)</th></tr></thead>
          <tbody>
            ${fila('Energía', kcal(n), 'kcal', 400, 0)}
            ${fila('Proteína', n.p, 'g', 30)}
            ${fila('Grasa', n.g, 'g', 40)}
            ${fila('Hierro', n.fe, 'mg', 4)}
            ${n.pho ? fila('Fósforo', n.pho, 'mg', 250, 0) : ''}
          </tbody>
        </table>
        <p class="text-xs text-muted mt-2">Fuente: ${FUENTE_NUT[n.src]}. Energía calculada con factores de Atwater.</p>
        ${esReferencia(c) ? `<p class="note mt-2"><strong>Dato de referencia.</strong> ${esc(n.nota || NOTA_REFERENCIA)}</p>` : ''}
      </section>

      <section class="panel" aria-labelledby="f-reg">
        <h3 id="f-reg"><i data-lucide="store" class="w-5 h-5" aria-hidden="true"></i>Nombres regionales en Colombia</h3>
        <table class="data">
          <caption>Cómo se llama este corte según la región.</caption>
          <thead><tr><th scope="col">Región</th><th scope="col">Nombre local</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <p class="text-xs text-muted mt-2">También buscado como: ${c.alias.map(esc).join(', ')}.</p>
      </section>
    </div>

    <!-- Columna derecha: sustitutos, empaque, receta -->
    <div class="grid gap-4 content-start">
      <section class="panel" aria-labelledby="f-sus">
        <h3 id="f-sus"><i data-lucide="utensils-crossed" class="w-5 h-5" aria-hidden="true"></i>Cortes sustitutos recomendados</h3>
        <ul class="flex flex-wrap gap-2 list-none p-0 m-0">${subs}</ul>
      </section>

      <section class="panel" aria-labelledby="f-emp">
        <h3 id="f-emp"><i data-lucide="package" class="w-5 h-5" aria-hidden="true"></i>Empaque y exhibición (autoservicio)</h3>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div class="col-span-2"><dt class="font-semibold text-muted">Presentación comercial</dt><dd>${esc(e.pres)}</dd></div>
          <div class="col-span-2"><dt class="font-semibold text-muted">Tipo de bandeja</dt><dd>${esc(e.bandeja)}</dd></div>
          <div class="col-span-2"><dt class="font-semibold text-muted">Empaque</dt><dd>${esc(e.env)}</dd></div>
          <div class="col-span-2"><dt class="font-semibold text-muted">Exhibición</dt><dd>${esc(e.exh)}</dd></div>
          <div><dt class="font-semibold text-muted">Conservación</dt><dd>${esc(e.conserv || 'Refrigeración de −2 a +2 °C')}</dd></div>
          <div><dt class="font-semibold text-muted">Vida útil</dt><dd>${esc(e.vida || '5 días (2 en venta en almacén)')}</dd></div>
        </dl>
      </section>

      <section class="panel" aria-labelledby="f-rec">
        <h3 id="f-rec"><i data-lucide="chef-hat" class="w-5 h-5" aria-hidden="true"></i>Receta asociada</h3>
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <p class="font-display text-xl font-bold">${esc(rec.titulo)}</p>
          <span class="badge">${rec.fuente === 'Éxito' ? 'Receta del manual Éxito (adaptada)' : 'Receta sugerida'}</span>
        </div>
        <p class="text-sm text-muted flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4" aria-hidden="true"></i>${esc(rec.tiempo)} · receta base para ${rec.porciones} ${rec.porciones === 1 ? 'comensal' : 'comensales'}</p>

        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label for="comensales" class="block font-bold text-sm mb-1.5"><i data-lucide="users" class="w-4 h-4 inline -mt-0.5" aria-hidden="true"></i> Número de comensales</label>
            <div class="stepper">
              <button type="button" id="com-menos" aria-label="Reducir un comensal" aria-controls="ing-list"><i data-lucide="minus" class="w-5 h-5" aria-hidden="true"></i></button>
              <input id="comensales" type="number" inputmode="numeric" min="1" max="60" step="1" value="${rec.porciones}" aria-describedby="rec-resumen" aria-controls="ing-list">
              <button type="button" id="com-mas" aria-label="Aumentar un comensal" aria-controls="ing-list"><i data-lucide="plus" class="w-5 h-5" aria-hidden="true"></i></button>
            </div>
          </div>
          <button type="button" id="com-reset" class="btn ghost" hidden><i data-lucide="rotate-ccw" class="w-4 h-4" aria-hidden="true"></i>Receta base</button>
        </div>
        <p id="rec-resumen" class="mt-3 font-semibold" role="status" aria-live="polite" aria-atomic="true"></p>

        <h4 class="mt-4 font-bold">Ingredientes</h4>
        <ul id="ing-list" class="ing list-none p-0 m-0 mt-1"></ul>
        <h4 class="mt-4 font-bold">Preparación</h4>
        <ol class="mt-1 list-decimal pl-5 space-y-2 marker:font-bold marker:text-accent">${stepsHtml}</ol>
      </section>
    </div>
  </div>`;
}

/** Abre (o actualiza) la ficha de un corte. */
function abrirFicha(id, trigger) {
  const c = CORTES.find((x) => x.id === id);
  if (!c) return;
  if (trigger) lastTrigger = trigger;
  if (c.esp !== state.esp) setEspecie(c.esp, { sinTransicion: true });
  // Navegación anterior/siguiente dentro de la lista visible (o de la especie si el corte quedó filtrado)
  let ids = filtrar().map((x) => x.id);
  if (!ids.includes(id)) ids = CORTES.filter((x) => x.esp === c.esp).map((x) => x.id);
  const pos = ids.indexOf(id), n = ids.length;
  const idAnt = ids[(pos - 1 + n) % n], idSig = ids[(pos + 1) % n];
  const nom = (i) => CORTES.find((x) => x.id === i).n;
  const bAnt = $('#ficha-prev'), bSig = $('#ficha-next');
  bAnt.dataset.go = idAnt; bAnt.setAttribute('aria-label', `Corte anterior: ${nom(idAnt)}`); bAnt.title = `Anterior: ${nom(idAnt)}`;
  bSig.dataset.go = idSig; bSig.setAttribute('aria-label', `Corte siguiente: ${nom(idSig)}`); bSig.title = `Siguiente: ${nom(idSig)}`;
  bAnt.hidden = bSig.hidden = n < 2;
  el.dlgTitulo.textContent = c.n;
  el.dlgSub.textContent = `${ESPECIES[c.esp].cat} · ${c.sub}`;
  el.dlgBody.innerHTML = fichaHTML(c);
  actualizarReceta(c, c.rec.porciones);
  el.dlgBody.scrollTop = 0;
  if (window.lucide) lucide.createIcons();
  if (!el.dlg.open) { el.dlg.showModal(); document.body.classList.add('modal-open'); }
  document.title = `${c.n} | ${ESPECIES[c.esp].cat} – Catálogo de cortes de carne`;
  try {
    const url = `${location.pathname}${location.search}#corte=${id}`;
    // Primera apertura: añade una entrada al historial (así «Atrás» cierra la ficha); al saltar entre fichas solo reemplaza.
    if (!location.hash.startsWith('#corte=')) { history.pushState(null, '', url); pushedFicha = true; }
    else history.replaceState(null, '', url);
  } catch (_) { /* file:// */ }
  el.dlg.dataset.id = id;
}

/** Muestra un mensaje breve dentro de la ficha (región aria-live). */
let avisoT;
function avisar(texto) {
  el.aviso.textContent = texto; el.aviso.classList.add('visible');
  clearTimeout(avisoT); avisoT = setTimeout(() => el.aviso.classList.remove('visible'), 2600);
}
/** Comparte el enlace de la ficha (menú del sistema en móvil; copia el enlace en escritorio). */
async function compartirFicha() {
  const c = CORTES.find((x) => x.id === el.dlg.dataset.id); if (!c) return;
  const url = `${location.href.split('#')[0]}#corte=${c.id}`;
  const datos = { title: `${c.n} | Catálogo de cortes de carne`, text: `${c.n} (${c.sub}) – ficha, nombres regionales y receta.`, url };
  if (navigator.share) {
    try { await navigator.share(datos); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); avisar('Enlace copiado'); }
  catch (_) { avisar('No se pudo copiar. Copia la dirección desde la barra del navegador.'); }
}

/** Impresión: copia la ficha abierta a #print-root (imprimir un <dialog> modal directamente omite contenido en algunos navegadores). */
window.addEventListener('beforeprint', () => {
  const c = CORTES.find((x) => x.id === el.dlg.dataset.id);
  const raiz = $('#print-root');
  if (!el.dlg.open || !c || !raiz) return;
  raiz.innerHTML = `<div class="print-head"><p>${esc(ESPECIES[c.esp].cat)} · ${esc(c.sub)}</p><h1>${esc(c.n)}</h1></div>` +
    el.dlgBody.innerHTML.replace(/\sid="[^"]*"/g, '').replace(/\saria-controls="[^"]*"/g, '');
  document.body.classList.add('printing');
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
  const raiz = $('#print-root'); if (raiz) raiz.innerHTML = '';
});

/** Restablece el estado al cerrar la ficha. */
function alCerrarFicha() {
  document.body.classList.remove('modal-open');
  document.title = baseTitle;
  try {
    if (location.hash.startsWith('#corte=')) {
      // Si el cierre vino del botón «Cerrar»/Esc, retrocede una entrada para no dejar historial huérfano.
      if (pushedFicha) history.back();
      else history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
  } catch (_) { /* file:// */ }
  pushedFicha = false;
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  lastTrigger = null;
}

/* ==========================================================================
   8. JSON-LD DINÁMICO (Product + Recipe) a partir de los mismos datos
   ========================================================================== */
function publicarJSONLD() {
  const base = (document.querySelector('link[rel="canonical"]') || { href: location.href }).href.replace(/#.*$/, '');
  const img = (document.querySelector('meta[property="og:image"]') || { content: '' }).content;
  const graph = [];
  CORTES.forEach((c) => {
    const url = `${base}#corte=${c.id}`;
    const nombresRegionales = Object.values(c.reg);
    graph.push({
      '@type': 'Product', '@id': `${url}-producto`, name: c.n,
      description: c.desc, category: ESPECIES[c.esp].cat, image: c.img ? new URL(c.img, location.href).href : img, url,
      alternateName: [...new Set([...c.alias, ...nombresRegionales])],
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Proteína por 100 g', value: c.nut.p, unitText: 'g' },
        { '@type': 'PropertyValue', name: 'Grasa por 100 g', value: c.nut.g, unitText: 'g' },
        { '@type': 'PropertyValue', name: 'Métodos de cocción', value: c.coc.join(', ') },
        { '@type': 'PropertyValue', name: 'Conservación', value: '-2 a +2 °C' }
      ]
    });
    graph.push({
      '@type': 'Recipe', '@id': `${url}-receta`, name: c.rec.titulo, image: c.img ? new URL(c.img, location.href).href : img, url,
      description: `Receta de ${c.rec.titulo.toLowerCase()} con ${c.n.toLowerCase()} (${ESPECIES[c.esp].cat.toLowerCase()}).`,
      recipeCategory: 'Plato principal', recipeCuisine: 'Colombiana', inLanguage: 'es-CO',
      recipeYield: `${c.rec.porciones} porciones`,
      recipeIngredient: c.rec.ingr.map(([q, u, n]) => (q === null ? n : `${fmtCantidad(q, u)} ${n}`)),
      recipeInstructions: c.rec.pasos.map((p, i) => ({ '@type': 'HowToStep', position: i + 1, text: p })),
      isBasedOn: { '@id': `${url}-producto` }
    });
  });
  const tag = document.createElement('script');
  tag.type = 'application/ld+json'; tag.id = 'ld-dinamico';
  tag.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  document.head.appendChild(tag);
}

/* ==========================================================================
   9. EVENTOS
   ========================================================================== */
function initEventos() {
  // Si una foto no carga, se sustituye por la ilustración generada.
  el.grid.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('card-photo')) return;
    const c = CORTES.find((x) => x.id === img.dataset.id);
    if (c) img.closest('.card-photo-wrap').outerHTML = art(c);
  }, true);
  /* Interruptor de especie: clic, y flechas del teclado */
  el.toggle.addEventListener('click', () => setEspecie(state.esp === 'bovina' ? 'porcina' : 'bovina'));
  el.toggle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setEspecie('porcina'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setEspecie('bovina'); }
  });
  el.lblB.addEventListener('click', () => setEspecie('bovina'));
  el.lblP.addEventListener('click', () => setEspecie('porcina'));

  /* Búsqueda con retardo (debounce) para no recalcular en cada tecla */
  let t; el.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = el.q.value; renderGrid(); }, 120); });
  $('#filtros').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(t); state.q = el.q.value; renderGrid(); });
  el.orden.addEventListener('change', () => { state.orden = el.orden.value; renderGrid(); });
  el.region.addEventListener('change', () => { state.region = el.region.value; store.set('cortes.region', state.region); renderGrid(); });

  /* Chips de filtro (delegación de eventos) */
  $('#filtros').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-f]');
    if (chip) {
      const set = state[chip.dataset.f];
      set.has(chip.dataset.k) ? set.delete(chip.dataset.k) : set.add(chip.dataset.k);
      syncChips(); renderGrid(); return;
    }
    const sug = e.target.closest('[data-sug]');
    if (sug) { el.q.value = sug.dataset.sug; state.q = sug.dataset.sug; renderGrid(); el.q.focus(); }
  });

  const limpiar = () => { state.q = ''; state.coc.clear(); state.fmt.clear(); state.orden = 'az'; el.q.value = ''; el.orden.value = 'az'; syncChips(); renderGrid(); };
  $('#limpiar').addEventListener('click', limpiar);
  $('#vacio-limpiar').addEventListener('click', limpiar);

  /* Abrir ficha desde una tarjeta */
  el.grid.addEventListener('click', (e) => {
    const b = e.target.closest('.card-btn'); if (b) abrirFicha(b.dataset.id, b);
  });

  /* Eventos dentro del modal */
  el.dlg.addEventListener('click', (e) => {
    if (e.target === el.dlg) { el.dlg.close(); return; }               // clic en el fondo
    if (e.target.closest('#ficha-cerrar')) { el.dlg.close(); return; }
    const nav = e.target.closest('#ficha-prev, #ficha-next');
    if (nav) { abrirFicha(nav.dataset.go); return; }
    if (e.target.closest('#ficha-compartir')) { compartirFicha(); return; }
    if (e.target.closest('#ficha-imprimir')) { window.print(); return; }
    const ir = e.target.closest('[data-ir-receta]');
    if (ir) { e.preventDefault(); const t = $('#f-rec'); if (t) { t.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } return; }
    const go = e.target.closest('[data-goto]');
    if (go) { abrirFicha(go.dataset.goto); el.dlg.querySelector('#ficha-cerrar').focus(); return; }
    const c = CORTES.find((x) => x.id === el.dlg.dataset.id); if (!c) return;
    const inp = $('#comensales'); if (!inp) return;
    const set = (v) => { v = Math.max(1, Math.min(60, Math.round(Number(v) || 1))); inp.value = v; actualizarReceta(c, v); };
    if (e.target.closest('#com-menos')) set(Number(inp.value) - 1);
    if (e.target.closest('#com-mas')) set(Number(inp.value) + 1);
    if (e.target.closest('#com-reset')) { set(c.rec.porciones); inp.focus(); }
  });
  el.dlg.addEventListener('input', (e) => {
    if (e.target.id !== 'comensales') return;
    const c = CORTES.find((x) => x.id === el.dlg.dataset.id);
    const v = Number(e.target.value); if (c && v >= 1 && v <= 60) actualizarReceta(c, Math.round(v));
  });
  el.dlg.addEventListener('change', (e) => {                       // normaliza valores fuera de rango al salir del campo
    if (e.target.id !== 'comensales') return;
    const c = CORTES.find((x) => x.id === el.dlg.dataset.id);
    const v = Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 1))); e.target.value = v; actualizarReceta(c, v);
  });
  el.dlg.addEventListener('keydown', (e) => {                       // ← → cambian de corte (sin romper campos de texto)
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const b = e.key === 'ArrowLeft' ? $('#ficha-prev') : e.key === 'ArrowRight' ? $('#ficha-next') : null;
    if (b && !b.hidden && b.dataset.go) { e.preventDefault(); abrirFicha(b.dataset.go); }
  });
  el.dlg.addEventListener('close', alCerrarFicha);

  /* Enlaces profundos: #corte=id */
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#corte=')) abrirDesdeHash();
    else if (el.dlg.open) el.dlg.close();          // «Atrás» del navegador cierra la ficha
  });
}

function abrirDesdeHash() {
  const m = location.hash.match(/^#corte=([\w-]+)/);
  if (m && CORTES.some((c) => c.id === m[1])) abrirFicha(m[1]);
}

/* ==========================================================================
   10. ARRANQUE
   ========================================================================== */
async function cargarDatos() {
  if (Array.isArray(window.CORTES_DATA) && window.CORTES_DATA.length > 0) {
    return window.CORTES_DATA;
  }
  const r = await fetch('data/cortes.json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function arrancar() {
  const params = new URLSearchParams(location.search);
  const m = location.hash.match(/^#corte=([\w-]+)/);
  const deHash = m && CORTES.find((c) => c.id === m[1]);
  const inicial = deHash ? deHash.esp : (params.get('especie') || store.get('cortes.especie') || 'bovina');
  buildChips();
  const regGuardada = store.get('cortes.region');
  if (REGIONES.includes(regGuardada)) { state.region = regGuardada; el.region.value = regGuardada; }
  initEventos();
  setEspecie(inicial, { sinTransicion: true });
  if (window.lucide) lucide.createIcons();
  publicarJSONLD();
  if (deHash) abrirFicha(deHash.id);
}

cargarDatos().then((datos) => { CORTES = datos; prepararIndice(); arrancar(); }).catch((err) => {
  console.error('No se pudieron cargar los datos:', err);
  el.grid.innerHTML = ''; el.grid.setAttribute('aria-busy', 'false'); el.conteo.textContent = '';
  const v = document.getElementById('vacio');
  if (v) {
    v.classList.remove('hidden');
    v.querySelector('h3').textContent = 'No se pudo cargar el catálogo';
    v.querySelector('p').textContent = 'Los datos se leen de data/cortes.json. Abre el sitio desde un servidor web (por ejemplo: npx serve . o python3 -m http.server) o publícalo en un hosting; abrir index.html con doble clic bloquea esta lectura en algunos navegadores.';
    const btn = v.querySelector('button'); if (btn) btn.hidden = true;
  }
});
