// Cash closing (cierre de caja): every total the owner checks at the end of the day or the week.
// Pure functions so the screen, the saved history, the WhatsApp text and the printable page agree.
import { fdate, intf, money, LINEAS, PAGOS } from './format';
import { toNum } from './pricing';

const sum = (arr, f) => arr.reduce((a, x) => a + toNum(f(x)), 0);

function agrupar(arr, key, extra = () => ({})) {
  const g = {};
  for (const x of arr) {
    const k = key(x);
    g[k] ||= { k, n: 0, cant: 0, total: 0, costo: 0, clics: 0, ...extra(x) };
    g[k].clics += toNum(x.clics);
    g[k].n += 1;
    g[k].cant += toNum(x.cant);
    g[k].total += toNum(x.total);
    g[k].costo += toNum(x.costo);
  }
  return Object.values(g).sort((a, b) => b.total - a.total);
}

// Split a sale's cost over its items in proportion to their totals, so each line of business gets its share.
function itemsConCosto(v, admin) {
  const costo = admin ? toNum(v.venta_costos?.costo ?? v.venta_costos?.[0]?.costo) : 0;
  const tot = toNum(v.total) || 1;
  return v.items.map((i) => ({ ...i, costo: admin ? (costo * toNum(i.total)) / tot : 0, venta: v }));
}

/**
 * ventas: sales dated in the period (admins also pass venta_costos).
 * abonos: payments dated in the period, with ventas(fecha).
 * trabajos / trabajoAbonos: custom jobs the user can see and their payments in the period.
 * contador: counter readings whose end date falls in the period.
 */
export function resumenCierre({ desde, hasta, ventas = [], abonos = [], trabajos = [], trabajoAbonos = [], contador = [], cfg, admin, perfiles = [], cartera = 0, incluirPrivado = true }) {
  const items = ventas.flatMap((v) => itemsConCosto(v, admin));
  const total = sum(ventas, (v) => v.total);
  const costo = sum(items, (i) => i.costo);

  const lineas = Object.keys(LINEAS).map((k) => {
    const its = items.filter((i) => (i.tipo || 'serv') === k);
    return { k, label: LINEAS[k], n: its.length, cant: sum(its, (i) => i.cant), total: sum(its, (i) => i.total), costo: sum(its, (i) => i.costo) };
  });

  const medios = ['efectivo', 'bancolombia', 'nequi', 'transferencia'];
  const recibidoPor = Object.fromEntries(medios.map((m) => [m, sum(abonos.filter((a) => a.pago === m), (a) => a.monto)]));
  const deCartera = abonos.filter((a) => a.ventas?.fecha && a.ventas.fecha < desde);
  const ventasPorPago = ['efectivo', 'bancolombia', 'nequi', 'transferencia', 'credito'].map((m) => {
    const vs = ventas.filter((v) => v.pago === m);
    return { k: m, label: PAGOS[m], n: vs.length, total: sum(vs, (v) => v.total) };
  }).filter((x) => x.n || ['efectivo', 'bancolombia', 'nequi', 'credito'].includes(x.k));
  const creditos = ventas.filter((v) => v.pago === 'credito');

  const imps = items.filter((i) => i.tipo === 'imp');
  const susName = (id) => cfg?.sustratos?.find((s) => s.id === id)?.nombre || 'Otro papel';
  const porColor = (c) => {
    const its = imps.filter((i) => !!i.det?.color === c);
    return { cant: sum(its, (i) => i.cant), clics: sum(its, (i) => i.clics), total: sum(its, (i) => i.total), costo: sum(its, (i) => i.costo) };
  };
  const porPapel = agrupar(imps, (i) => susName(i.det?.sus));

  const nombreDe = (id) => perfiles.find((p) => p.id === id)?.nombre || 'Sin nombre';
  const vendedores = agrupar(ventas.map((v) => ({ ...v, cant: 1 })), (v) => nombreDe(v.vendedor_id));

  const conFe = ventas.filter((v) => v.fe);
  const porDia = agrupar(ventas.map((v) => ({ ...v, cant: 1 })), (v) => v.fecha).sort((a, b) => (a.k < b.k ? -1 : 1));

  const lecturas = ['general', 'color', 'bn'].map((tipo) => {
    const rows = contador.filter((r) => (r.tipo || 'general') === tipo);
    if (!rows.length) return null;
    const ini = Math.min(...rows.map((r) => r.contador_inicial));
    const fin = Math.max(...rows.map((r) => r.contador_final));
    const a = rows.map((r) => r.inicio).sort()[0];
    const b = rows.map((r) => r.fin).sort().slice(-1)[0];
    const vend = sum(ventas.filter((v) => v.fecha >= a && v.fecha <= b).flatMap((v) => v.items)
      .filter((i) => i.tipo === 'imp' && (tipo === 'general' || (tipo === 'color') === !!i.det?.color)), (i) => i.clics);
    return { tipo, label: { general: 'Contador general', color: 'Contador color', bn: 'Contador blanco y negro' }[tipo], inicio: a, fin: b, ini, finC: fin, maquina: fin - ini, vendidos: vend, dif: fin - ini - vend };
  }).filter(Boolean);

  let privado = null;
  if (admin && incluirPrivado) {
    const priv = trabajos.filter((t) => t.privado);
    const abP = trabajoAbonos.filter((a) => a.trabajos?.privado);
    privado = {
      nuevos: priv.filter((t) => t.fecha >= desde && t.fecha <= hasta),
      recibido: sum(abP, (a) => a.monto),
      recibidoPor: Object.fromEntries(medios.map((m) => [m, sum(abP.filter((a) => a.pago === m), (a) => a.monto)])),
      abonos: abP,
      saldo: sum(priv.filter((t) => t.estado !== 'cotizacion' && t.estado !== 'anulado'), (t) => t.saldo),
      pendientes: priv.filter((t) => toNum(t.saldo) > 0 && !['cotizacion', 'anulado'].includes(t.estado)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
      cotizado: sum(priv.filter((t) => t.estado === 'cotizacion' && t.fecha >= desde && t.fecha <= hasta), (t) => t.total),
      retenciones: sum(priv.filter((t) => t.fecha >= desde && t.fecha <= hasta && t.estado !== 'anulado'), (t) => toNum(t.retencion)),
    };
  }
  const abT = trabajoAbonos.filter((a) => !a.trabajos?.privado);

  return {
    desde, hasta,
    ventas: { n: ventas.length, total, costo, ganancia: total - costo, promedio: ventas.length ? total / ventas.length : 0 },
    lineas, ventasPorPago,
    recibido: { total: sum(abonos, (a) => a.monto), por: recibidoPor, deCartera: sum(deCartera, (a) => a.monto), nCartera: deCartera.length },
    credito: { n: creditos.length, total: sum(creditos, (v) => v.total), saldo: sum(creditos, (v) => v.saldo) },
    impresiones: { porPapel, color: porColor(true), bn: porColor(false) },
    productos: agrupar(items.filter((i) => i.tipo === 'prod'), (i) => i.desc),
    terceros: agrupar(items.filter((i) => i.tipo === 'serv'), (i) => i.desc, (i) => ({ proveedor: i.proveedor || '' })),
    personalizados: agrupar(items.filter((i) => i.tipo === 'pers'), (i) => i.desc),
    trabajosTienda: { recibido: sum(abT, (a) => a.monto), n: abT.length },
    vendedores, porDia,
    fe: { n: conFe.length, total: sum(conFe, (v) => v.total) },
    sinFe: { n: ventas.length - conFe.length, total: total - sum(conFe, (v) => v.total) },
    contador: lecturas, cartera, privado, admin,
  };
}

const rango = (R) => (R.desde === R.hasta ? fdate(R.desde) : `${fdate(R.desde)} al ${fdate(R.hasta)}`);

// Short version for WhatsApp.
const difTxt = (d) => (Math.abs(d) < 1 ? 'Cuadra' : `${d > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(d))}`);

export function cierreText(negocio, R, tipo, extra = {}) {
  const L = [`*${negocio?.nombre || 'Publiinsumos'}*`, `Cierre de caja ${tipo === 'semanal' ? 'semanal' : 'diario'} · ${rango(R)}`, ''];
  L.push(`*Ventas: ${money(R.ventas.total)}* (${R.ventas.n})`);
  for (const l of R.lineas) if (l.total) L.push(`• ${l.label}: ${money(l.total)}`);
  L.push('', '*Dinero recibido*');
  for (const [m, v] of Object.entries(R.recibido.por)) if (v) L.push(`• ${PAGOS[m]}: ${money(v)}`);
  L.push(`Total recibido: ${money(R.recibido.total)}`);
  if (R.recibido.deCartera) L.push(`(incluye ${money(R.recibido.deCartera)} de abonos a cartera)`);
  if (R.credito.n) L.push(`Fiado en el periodo: ${money(R.credito.saldo)}`);
  if (extra.cajas?.length) {
    L.push('', '*Cuadre de cajas*');
    for (const c of extra.cajas) {
      L.push(`${c.label}: base ${money(c.base)} + efectivo ${money(c.efectivo)}${c.gastos ? ` - gastos ${money(c.gastos)}` : ''} = ${money(c.esperado)}`);
      if (c.contado !== '' && c.contado != null) L.push(`   Contado ${money(c.contado)} · ${difTxt(toNum(c.contado) - c.esperado)}`);
    }
  } else if (extra.contado != null && extra.contado !== '') {
    L.push('', `Efectivo esperado: ${money(extra.esperado)}`, `Efectivo contado: ${money(extra.contado)}`, `Diferencia: ${money(toNum(extra.contado) - extra.esperado)}`);
  }
  if (extra.gastos?.length) {
    L.push('', `*Gastos: ${money(extra.G.total)}*`);
    for (const g of extra.gastos) L.push(`• ${g.concepto} (${PAGOS[g.pago]}): ${money(g.monto)}`);
    L.push(`Recibido menos gastos: ${money(R.recibido.total - extra.G.total)}`);
  }
  L.push('', `Impresiones color: ${intf(R.impresiones.color.cant)} (${intf(R.impresiones.color.clics)} clics)`, `Impresiones B/N: ${intf(R.impresiones.bn.cant)} (${intf(R.impresiones.bn.clics)} clics)`);
  for (const c of R.contador) L.push(`${c.label}: ${intf(c.maquina)} clics máquina, ${intf(c.vendidos)} vendidos (${c.dif > 0 ? '+' : ''}${intf(c.dif)})`);
  L.push(`Con factura electrónica: ${R.fe.n} ventas · ${money(R.fe.total)}`);
  if (R.admin) L.push('', `Ganancia estimada: ${money(R.ventas.ganancia)}`);
  if (R.admin && extra.G) L.push(`Ganancia después de gastos: ${money(R.ventas.ganancia - extra.G.total)}`);
  L.push(`Cartera por cobrar: ${money(R.cartera)}`);
  if (R.privado) L.push('', '*Trabajos personalizados (privado)*', `Recibido: ${money(R.privado.recibido)}`, `Saldo por cobrar: ${money(R.privado.saldo)}`);
  if (extra.nota) L.push('', `Nota: ${extra.nota}`);
  return L.join('\n');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tabla = (cab, filas, pie) => `<table><thead><tr>${cab.map((c, i) => `<th${i ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
  filas.length ? filas.map((f) => `<tr>${f.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cab.length}" class="v">Sin movimientos</td></tr>`
}</tbody>${pie ? `<tfoot><tr>${pie.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr></tfoot>` : ''}</table>`;

// Full printable report, as a standalone HTML page.
export function cierreHtml(negocio, R, tipo, extra = {}) {
  const A = R.admin;
  const sec = [];
  sec.push(`<h2>Resumen</h2><div class="kpis">
    <div><span>Ventas</span><b>${money(R.ventas.total)}</b><small>${R.ventas.n} ventas · promedio ${money(R.ventas.promedio)}</small></div>
    <div><span>Dinero recibido</span><b>${money(R.recibido.total)}</b><small>Abonos a cartera: ${money(R.recibido.deCartera)}</small></div>
    <div><span>Fiado en el periodo</span><b>${money(R.credito.saldo)}</b><small>${R.credito.n} ventas a crédito</small></div>
    ${A ? `<div><span>Ganancia estimada</span><b>${money(R.ventas.ganancia)}</b><small>Costo ${money(R.ventas.costo)}</small></div>` : ''}
  </div>`);
  sec.push(`<h2>Ventas por línea de negocio</h2>${tabla(['Línea', 'Ítems', 'Ventas', ...(A ? ['Costo', 'Ganancia'] : [])],
    R.lineas.map((l) => [l.label, intf(l.n), money(l.total), ...(A ? [money(l.costo), money(l.total - l.costo)] : [])]),
    ['Total', intf(R.lineas.reduce((a, l) => a + l.n, 0)), money(R.ventas.total), ...(A ? [money(R.ventas.costo), money(R.ventas.ganancia)] : [])])}`);
  sec.push(`<h2>Dinero recibido por medio de pago</h2>${tabla(['Medio', 'Recibido'], Object.entries(R.recibido.por).filter(([k, v]) => v || k !== 'transferencia').map(([k, v]) => [PAGOS[k], money(v)]), ['Total', money(R.recibido.total)])}
    <p class="nota">Incluye el pago de las ventas del periodo y los abonos que llegaron a deudas anteriores.</p>`);
  if (extra.cajas?.length) {
    sec.push(`<h2>Apertura y cuadre de cajas</h2>${tabla(['Caja', 'Base', 'Efectivo recibido', 'Gastos', 'Debería haber', 'Contado', 'Diferencia'],
      extra.cajas.map((c) => [c.label, money(c.base), money(c.efectivo), money(c.gastos || 0), money(c.esperado), c.contado === '' || c.contado == null ? '—' : money(c.contado), c.contado === '' || c.contado == null ? '—' : difTxt(toNum(c.contado) - c.esperado)]),
      ['Total', money(extra.cajas.reduce((a, c) => a + c.base, 0)), money(extra.cajas.reduce((a, c) => a + c.efectivo, 0)), money(extra.cajas.reduce((a, c) => a + (c.gastos || 0), 0)), money(extra.esperado), '', ''])}
      ${extra.apertura === false ? '<p class="nota">Este día no tuvo apertura de caja registrada.</p>' : ''}`);
  } else if (extra.contado != null && extra.contado !== '') {
    const d = toNum(extra.contado) - extra.esperado;
    sec.push(`<h2>Cuadre de efectivo</h2>${tabla(['Concepto', 'Valor'], [['Base de caja', money(extra.base)], ['Efectivo recibido', money(R.recibido.por.efectivo)], ['Efectivo esperado', money(extra.esperado)], ['Efectivo contado', money(extra.contado)]], ['Diferencia', `${d > 0 ? 'Sobra ' : d < 0 ? 'Falta ' : ''}${money(Math.abs(d))}`])}`);
  }
  if (extra.gastos) {
    sec.push(`<h2>Gastos</h2>${tabla(['Fecha', 'Gasto', 'Categoría', 'Pago', 'Valor'], extra.gastos.map((g) => [fdate(g.fecha), g.concepto, g.categoria, PAGOS[g.pago] + (g.caja ? ' · caja ' + g.caja : ''), money(g.monto)]), ['Total', '', '', '', money(extra.G.total)])}
      <p class="nota">Recibido menos gastos: <b>${money(R.recibido.total - extra.G.total)}</b>${A ? ` · Ganancia después de gastos: <b>${money(R.ventas.ganancia - extra.G.total)}</b>` : ''}</p>`);
  }
  sec.push(`<h2>Ventas por forma de pago</h2>${tabla(['Forma de pago', 'Ventas', 'Total'], R.ventasPorPago.map((p) => [p.label, intf(p.n), money(p.total)]))}`);
  sec.push(`<h2>Fotocopiadora: color y blanco y negro</h2>${tabla(['Tipo', 'Impresiones', 'Clics', 'Ventas', ...(A ? ['Costo'] : [])],
    [['Color', intf(R.impresiones.color.cant), intf(R.impresiones.color.clics), money(R.impresiones.color.total), ...(A ? [money(R.impresiones.color.costo)] : [])],
      ['Blanco y negro', intf(R.impresiones.bn.cant), intf(R.impresiones.bn.clics), money(R.impresiones.bn.total), ...(A ? [money(R.impresiones.bn.costo)] : [])]])}
    ${tabla(['Papel', 'Impresiones', 'Clics', 'Ventas'], R.impresiones.porPapel.map((g) => [g.k, intf(g.cant), intf(g.clics), money(g.total)]))}`);
  if (R.contador.length) {
    sec.push(`<h2>Contador de la máquina</h2>${tabla(['Contador', 'Lecturas', 'Clics máquina', 'Clics vendidos', 'Diferencia'],
      R.contador.map((c) => [c.label, `${intf(c.ini)} → ${intf(c.finC)}`, intf(c.maquina), intf(c.vendidos), intf(c.dif)]))}`);
  }
  sec.push(`<h2>Insumos vendidos</h2>${tabla(['Producto', 'Cantidad', 'Total'], R.productos.map((g) => [g.k, intf(g.cant), money(g.total)]))}`);
  sec.push(`<h2>Productos y servicios de terceros</h2>${tabla(['Servicio', 'Proveedor', 'Cantidad', 'Total', ...(A ? ['Se le debe al proveedor'] : [])],
    R.terceros.map((g) => [g.k, g.proveedor, intf(g.cant), money(g.total), ...(A ? [money(g.costo)] : [])]))}`);
  sec.push(`<h2>Trabajos personalizados de la tienda</h2>${tabla(['Trabajo', 'Cantidad', 'Total'], R.personalizados.map((g) => [g.k, intf(g.cant), money(g.total)]))}`);
  sec.push(`<h2>Por vendedor</h2>${tabla(['Vendedor', 'Ventas', 'Total'], R.vendedores.map((g) => [g.k, intf(g.n), money(g.total)]))}`);
  sec.push(`<h2>Factura electrónica</h2>${tabla(['F-E', 'Ventas', 'Total'], [['Sí', intf(R.fe.n), money(R.fe.total)], ['No', intf(R.sinFe.n), money(R.sinFe.total)]])}`);
  if (R.porDia.length > 1) sec.push(`<h2>Ventas por día</h2>${tabla(['Día', 'Ventas', 'Total'], R.porDia.map((g) => [fdate(g.k), intf(g.n), money(g.total)]))}`);
  sec.push(`<h2>Cartera</h2>${tabla(['Concepto', 'Valor'], [['Cartera del negocio por cobrar', money(R.cartera)]])}`);
  if (R.privado) {
    sec.push(`<h2 class="priv">Trabajos personalizados (privado)</h2>${tabla(['Medio', 'Recibido'], Object.entries(R.privado.recibidoPor).filter(([, v]) => v).map(([k, v]) => [PAGOS[k], money(v)]), ['Total recibido', money(R.privado.recibido)])}
      ${tabla(['Nuevos trabajos', 'Estado', 'Total'], R.privado.nuevos.map((t) => [`${t.cliente} · ${t.titulo}`, t.estado, money(t.total)]))}
      <p class="nota">Saldo privado por cobrar: <b>${money(R.privado.saldo)}</b></p>`);
  }
  if (extra.nota) sec.push(`<h2>Nota</h2><p>${esc(extra.nota)}</p>`);
  const out = extra._secciones || sec;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cierre ${tipo} ${esc(rango(R))}</title>
<style>
body{font-family:"DM Sans",system-ui,sans-serif;color:#1B2559;margin:0;padding:28px max(16px,4vw);background:#fff}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;border-bottom:3px solid #0B8F63;padding-bottom:12px}
h1{margin:0;font-size:24px}header p{margin:4px 0 0;color:#5f6b8a}
h2{font-size:16px;margin:26px 0 8px;color:#08744F}h2.priv{color:#7a4b00}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.kpis div{border:1px solid #e3e8f2;border-radius:12px;padding:10px 12px}.kpis span{display:block;font-size:12px;color:#5f6b8a}
.kpis b{display:block;font-size:20px;margin:2px 0}.kpis small{color:#5f6b8a}
table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 4px;font-variant-numeric:tabular-nums}
th{text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#5f6b8a;border-bottom:1px solid #d6dcea;padding:6px 8px}
td{border-bottom:1px solid #eef1f7;padding:6px 8px}.n{text-align:right}.v{color:#8f9bba;text-align:center}
tfoot td{font-weight:700;border-top:2px solid #1B2559}.nota{font-size:12px;color:#5f6b8a}
footer{margin-top:30px;font-size:11px;color:#8f9bba}
@media print{body{padding:0}h2{break-after:avoid}table{break-inside:avoid}}
</style></head><body>
<header><div><h1>${esc(negocio?.nombre || 'Publiinsumos')} · ${extra._titulo || 'Cierre de caja'} ${tipo === 'semanal' ? 'semanal' : 'diario'}</h1><p>${esc(rango(R))}${extra.usuario ? ' · ' + esc(extra.usuario) : ''}</p></div><p>Generado el ${fdate(new Date().toISOString().slice(0, 10))}</p></header>
${out.join('\n')}
<footer>Publiinsumos Caja</footer>
</body></html>`;
}

// Closing of the admin's private work only: what came in, what was quoted and who still owes.
export function privadoText(negocio, R, tipo, extra = {}) {
  const P = R.privado;
  const L = [`*${negocio?.nombre || 'Publiinsumos'}*`, `Cierre privado ${tipo === 'semanal' ? 'semanal' : 'diario'} · ${rango(R)}`, ''];
  L.push(`*Recibido: ${money(P.recibido)}*`);
  for (const [m, v] of Object.entries(P.recibidoPor)) if (v) L.push(`• ${PAGOS[m]}: ${money(v)}`);
  for (const a of P.abonos) L.push(`  ${fdate(a.fecha)} · ${a.trabajos?.cliente || ''}: ${money(a.monto)}`);
  L.push('', `Trabajos nuevos: ${P.nuevos.length}`, `Cotizado en el periodo: ${money(P.cotizado)}`);
  if (P.retenciones) L.push(`Retenciones descontadas: ${money(P.retenciones)}`);
  L.push('', `*Saldo privado por cobrar: ${money(P.saldo)}*`);
  for (const t of P.pendientes) L.push(`• ${t.cliente} · ${t.titulo}: ${money(t.saldo)}`);
  if (extra.nota) L.push('', `Nota: ${extra.nota}`);
  return L.join('\n');
}

export function privadoHtml(negocio, R, tipo, extra = {}) {
  const P = R.privado;
  const sec = [
    `<h2>Resumen</h2><div class="kpis"><div><span>Recibido</span><b>${money(P.recibido)}</b><small>${P.abonos.length} abonos</small></div><div><span>Saldo por cobrar</span><b>${money(P.saldo)}</b><small>${P.pendientes.length} trabajos</small></div><div><span>Cotizado</span><b>${money(P.cotizado)}</b><small>${P.nuevos.length} trabajos nuevos</small></div>${P.retenciones ? `<div><span>Retenciones</span><b>${money(P.retenciones)}</b><small>Descontadas en el periodo</small></div>` : ''}</div>`,
    `<h2>Abonos recibidos</h2>${tabla(['Fecha', 'Cliente', 'Trabajo', 'Medio', 'Valor'], P.abonos.map((a) => [fdate(a.fecha), a.trabajos?.cliente || '', a.trabajos?.titulo || '', PAGOS[a.pago], money(a.monto)]), ['Total', '', '', '', money(P.recibido)])}`,
    `<h2>Trabajos nuevos</h2>${tabla(['Fecha', 'Cliente y trabajo', 'Estado', 'Total'], P.nuevos.map((t) => [fdate(t.fecha), `${t.cliente} · ${t.titulo}`, ({ cotizacion: 'Cotización', aprobado: 'Aprobado', entregado: 'Entregado', vendido: 'Pasó a venta', anulado: 'Anulado' })[t.estado] || t.estado, money(t.total)]))}`,
    `<h2>Saldo por cobrar</h2>${tabla(['Desde', 'Cliente y trabajo', 'Saldo'], P.pendientes.map((t) => [fdate(t.fecha), `${t.cliente} · ${t.titulo}`, money(t.saldo)]), ['Total', '', money(P.saldo)])}`,
  ];
  if (extra.nota) sec.push(`<h2>Nota</h2><p>${esc(extra.nota)}</p>`);
  return cierreHtml(negocio, R, tipo, { ...extra, _secciones: sec, _titulo: 'Cierre privado' });
}
