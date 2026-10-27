// Price rules from the copier sheet: price per print depends on paper and quantity scale.
export const ESCALAS = ['1 a 20', '21 a 50', '51 a 100', 'Más de 100'];
const ESC_MIN = [1, 21, 51, 101];

export const escalaIdx = (q) => (q <= 20 ? 0 : q <= 50 ? 1 : q <= 100 ? 2 : 3);

export const toNum = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};

// Color and black-and-white clics can have their own cost; when one is not set the general clic cost applies.
export const costoClicDe = (costos, color) =>
  toNum(color ? costos?.costoClicColor : costos?.costoClicBN) || toNum(costos?.costoClic);

// cfg: config_publica.datos. costos (optional, admin only): config_costos.datos.
export function calcImpresion(cfg, form, costos) {
  if (!cfg) return null;
  const s = cfg.sustratos?.find((x) => x.id === form.sus);
  if (!s) return null;
  const t = cfg.tamanos?.find((x) => x.id === s.tamano) || { clics: 1, piezas: 1, nombre: '' };
  const cant = Math.max(0, Math.floor(toNum(form.cant)));
  const plast = Math.max(0, Math.floor(toNum(form.plast)));
  const i = escalaIdx(cant);
  const pu = toNum(s.precios?.[i]);
  const g = cfg.gramajes?.find((x) => x.id === form.gram);
  const sub = pu * cant;
  const extra = plast * toNum(cfg.plastificado?.precio);
  let next = null;
  if (i < 3 && cant > 0) {
    const pn = toNum(s.precios?.[i + 1]);
    if (pn < pu) next = { faltan: ESC_MIN[i + 1] - cant, pu: pn, escala: ESCALAS[i + 1] };
  }
  let costo = null;
  if (costos) {
    const papel = s.corriente ? toNum(costos.gramajes?.[form.gram]) : toNum(costos.sustratos?.[s.id]);
    costo = Math.round(
      cant * (costoClicDe(costos, form.color) * t.clics + papel / (t.piezas || 1)) + plast * toNum(costos.plastificadoCosto),
    );
  }
  const desc =
    s.nombre +
    (s.corriente && g ? ' · ' + g.nombre : '') +
    ' · ' +
    (form.color ? 'Color' : 'B/N') +
    (plast ? ` · ${plast} plastificado${plast > 1 ? 's' : ''}` : '');
  return {
    sustrato: s,
    tamano: t,
    cant,
    plast,
    escala: i,
    pu,
    sub,
    extra,
    total: sub + extra,
    clics: t.clics * cant,
    costo,
    desc,
    next,
  };
}

export function itemImpresion(cfg, form) {
  const r = calcImpresion(cfg, form);
  if (!r || !r.cant) return null;
  return {
    tipo: 'imp',
    desc: r.desc,
    cant: r.cant,
    pu: r.pu,
    extra: r.extra,
    total: r.total,
    clics: r.clics,
    det: { sus: form.sus, gram: r.sustrato.corriente ? form.gram : null, color: !!form.color, plast: r.plast },
  };
}

// Same formula as registrar_venta in supabase/schema.sql, for previews and tests.
export function costoItem(cfg, costos, item, costoProducto = 0) {
  if (item.tipo === 'imp') {
    const r = calcImpresion(cfg, { ...item.det, cant: item.cant }, costos);
    return r?.costo ?? 0;
  }
  return Math.round(item.cant * toNum(costoProducto));
}

export const cartTotal = (cart) => cart.reduce((a, i) => a + toNum(i.total), 0);
