// Custom jobs (cotizador personalizado): totals, WhatsApp text and a printable quote.
import { fdate, money, intf, today } from './format';
import { toNum } from './pricing';

export const ESTADOS = {
  cotizacion: ['Cotización', 'gray'],
  aprobado: ['Aprobado', 'blue'],
  entregado: ['Entregado', 'green'],
  vendido: ['Pasó a venta', 'green'],
  anulado: ['Anulado', 'red'],
};

// Common pieces of a sign or custom job. People can always type a new one.
export const CONCEPTOS_BASE = [
  'Acrílico', 'Servicio de corte', 'Servicio de armado', 'Acarreo', 'Instalación', 'Diseño', 'Impresión', 'Vinilo de corte',
  'Lona banner', 'MDF', 'Estructura metálica', 'Pintura', 'Iluminación LED', 'Desmonte', 'Viáticos',
];

export const lineaTotal = (l) => toNum(l.cant) * toNum(l.pu);
export const subtotal = (lineas) => lineas.reduce((a, l) => a + lineaTotal(l), 0);
export const totalTrabajo = (t) => Math.max(0, subtotal(t.lineas || []) - toNum(t.descuento));
export const numeroT = (t) => 'COT-' + String(t.numero ?? '').padStart(4, '0');

// How the client pays. It is set on the client and can be changed on each quote.
export const FORMAS_PAGO = [
  ['convenir', 'A convenir'], ['10', 'A 10 días'], ['30', 'A 30 días'], ['45', 'A 45 días'], ['60', 'A 60 días'], ['anticipo50', 'Anticipo del 50%'],
];
export const FORMA_LABEL = Object.fromEntries(FORMAS_PAGO);
export const formaPagoTxt = (forma, saldoA) => (!forma ? '' : forma === 'anticipo50' ? `Anticipo del 50% y saldo ${saldoA ? saldoA : 'contra entrega'}` : FORMA_LABEL[forma] || forma);

// Quote format chosen by the admin in Ajustes.
export const COTIZACION_DEF = {
  condiciones: 'Cotización válida por 15 días.\nPrecios en pesos colombianos.\nEl tiempo de entrega empieza a contar desde la aprobación y el anticipo.\nDiseños y artes finales aprobados por el cliente antes de producir.',
  diasSin: 5, diasCon: 8, firmaNombre: '', firmaCargo: '', firma: '', mostrarFirma: true,
  retenciones: [
    { id: 'rf-serv', label: 'Retención en la fuente servicios', pct: 4 },
    { id: 'rf-comp', label: 'Retención en la fuente compras', pct: 2.5 },
    { id: 'rf-hon', label: 'Retención en la fuente honorarios', pct: 11 },
    { id: 'reteica', label: 'ReteICA', pct: 0.966 },
  ],
};
export const cotizacionCfg = (cfg) => ({ ...COTIZACION_DEF, ...(cfg?.cotizacion || {}) });

// Withholdings only apply to private quotes; they are a % of the total and reduce what the client pays.
export const retencionValor = (t) => Math.round((t.retenciones || []).reduce((a, r) => a + totalTrabajo(t) * (toNum(r.pct) / 100), 0));
export const netoTrabajo = (t) => totalTrabajo(t) - (t.privado ? retencionValor(t) : 0);

// Working days from a date (Sundays don't count).
export function sumarHabiles(desde, n) {
  const d = new Date(desde + 'T12:00:00');
  let k = 0;
  while (k < toNum(n)) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) k += 1; }
  return d.toISOString().slice(0, 10);
}

// Working days (Monday to Saturday) from one date to a later one.
export function contarHabiles(desde, hasta) {
  if (!desde || !hasta || hasta <= desde) return 0;
  const d = new Date(desde + 'T12:00:00');
  const fin = new Date(hasta + 'T12:00:00');
  let k = 0;
  while (d < fin) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) k += 1; }
  return k;
}

export function trabajoText(negocio, t) {
  const L = [`*${negocio?.nombre || 'Ecoglobal'}*`, `${t.estado === 'cotizacion' ? 'Cotización' : 'Trabajo'} ${numeroT(t)} · ${fdate(t.fecha || today())}`];
  if (t.cliente) L.push(`Cliente: ${t.cliente}${t.sucursal ? ` · ${t.sucursal}` : ''}`);
  if (t.titulo) L.push(`*${t.titulo}*`);
  L.push('');
  for (const l of t.lineas || []) {
    L.push(`• ${l.concepto}${l.detalle ? ` (${l.detalle})` : ''}`);
    L.push(`   ${intf(l.cant)} × ${money(l.pu)} = ${money(lineaTotal(l))}`);
  }
  if (toNum(t.descuento)) L.push('', `Subtotal: ${money(subtotal(t.lineas))}`, `Descuento: -${money(t.descuento)}`);
  L.push('', `*Total: ${money(totalTrabajo(t))}*`);
  if (t.privado && retencionValor(t)) {
    for (const r of t.retenciones) L.push(`${r.label} (${r.pct}%): -${money(totalTrabajo(t) * (toNum(r.pct) / 100))}`);
    L.push(`*Neto a pagar: ${money(netoTrabajo(t))}*`);
  }
  if (toNum(t.abonado)) L.push(`Abonado: ${money(t.abonado)}`, `Saldo: ${money(netoTrabajo(t) - toNum(t.abonado))}`);
  if (t.forma_pago) L.push(`Forma de pago: ${formaPagoTxt(t.forma_pago, t.saldo_a)}`);
  if (t.instalacion) L.push(`Instalación: ${t.instalacion === 'con' ? 'incluida' : 'no incluida'}`);
  if (toNum(t.dias_entrega)) L.push(`Tiempo de entrega: ${t.dias_entrega} días hábiles`);
  if (t.entrega) L.push(`Entrega: ${fdate(t.entrega)}`);
  if (t.nota) L.push('', t.nota);
  if (t.condiciones) L.push('', '*Condiciones*', t.condiciones);
  else if (t.estado === 'cotizacion') L.push('', 'Cotización válida por 15 días.');
  if (negocio?.telefono) L.push(`Tel: ${negocio.telefono}`);
  return L.join('\n');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function trabajoHtml(negocio, t, fmt = {}) {
  const total = totalTrabajo(t);
  const filas = (t.lineas || []).map((l, i) => `<tr><td>${i + 1}</td><td><b>${esc(l.concepto)}</b>${l.detalle ? `<br><small>${esc(l.detalle)}</small>` : ''}</td><td class="n">${intf(l.cant)}</td><td class="n">${money(l.pu)}</td><td class="n">${money(lineaTotal(l))}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(numeroT(t))} ${esc(t.cliente || '')}</title>
<style>
body{font-family:"DM Sans",system-ui,sans-serif;color:#1B2559;margin:0;padding:32px max(16px,5vw);background:#fff}
header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:3px solid #0B8F63;padding-bottom:14px}
h1{margin:0;font-size:26px}.m{color:#5f6b8a;margin:4px 0 0}.doc{text-align:right}.doc b{font-size:18px;display:block}
.cli{margin:22px 0 6px}.cli h2{margin:0 0 4px;font-size:18px}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;font-variant-numeric:tabular-nums}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5f6b8a;border-bottom:1px solid #d6dcea;padding:8px}
td{padding:9px 8px;border-bottom:1px solid #eef1f7;vertical-align:top}td small{color:#5f6b8a}.n{text-align:right;white-space:nowrap}
.tot{margin-left:auto;width:min(320px,100%);margin-top:12px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:4px 8px}
.tot div span:last-child{white-space:nowrap;padding-left:10px}.tot .g{border-top:2px solid #1B2559;font-size:20px;font-weight:700;padding-top:8px}
.nota{margin-top:24px;font-size:13px;color:#3d4766;white-space:pre-wrap}
.cond{margin-top:22px;font-size:13px;color:#3d4766}.cond h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;color:#1B2559}.cond p{margin:0;white-space:pre-wrap}
.datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:18px;font-size:13px}.datos div{background:#f4f7fe;border-radius:10px;padding:8px 10px}.datos span{display:block;font-size:11px;color:#5f6b8a}
.firma{margin-top:44px;width:260px}.firma img{max-width:220px;max-height:90px;display:block}.firma .l{border-top:1px solid #1B2559;padding-top:6px;font-size:13px}.firma small{color:#5f6b8a}
footer{margin-top:40px;font-size:12px;color:#8f9bba}
</style></head><body>
<header><div><h1>${esc(negocio?.nombre || 'Ecoglobal')}</h1><p class="m">${esc(negocio?.telefono ? 'Tel. ' + negocio.telefono : '')}</p></div>
<div class="doc"><b>${t.estado === 'cotizacion' ? 'Cotización' : 'Orden de trabajo'} ${esc(numeroT(t))}</b><span class="m">${fdate(t.fecha || today())}</span></div></header>
<div class="cli"><h2>${esc(t.titulo || 'Trabajo personalizado')}</h2><p class="m">Cliente: ${esc(t.cliente || '—')}${t.sucursal ? ' · ' + esc(t.sucursal) : ''}${t.nit ? ' · NIT ' + esc(t.nit) : ''}${t.telefono ? ' · ' + esc(t.telefono) : ''}${t.entrega ? ' · Entrega: ' + fdate(t.entrega) : ''}</p></div>
<table><thead><tr><th>#</th><th>Concepto</th><th class="n">Cant.</th><th class="n">Valor unitario</th><th class="n">Total</th></tr></thead><tbody>${filas}</tbody></table>
<div class="tot">${toNum(t.descuento) ? `<div><span>Subtotal</span><span>${money(subtotal(t.lineas))}</span></div><div><span>Descuento</span><span>-${money(t.descuento)}</span></div>` : ''}
<div class="g"><span>Total</span><span>${money(total)}</span></div>
${t.privado && retencionValor(t) ? (t.retenciones || []).map((r) => `<div><span>${esc(r.label)} (${r.pct}%)</span><span>-${money(total * (toNum(r.pct) / 100))}</span></div>`).join('') + `<div class="g"><span>Neto a pagar</span><span>${money(netoTrabajo(t))}</span></div>` : ''}
${toNum(t.abonado) ? `<div><span>Abonado</span><span>${money(t.abonado)}</span></div><div><span>Saldo</span><span>${money(netoTrabajo(t) - toNum(t.abonado))}</span></div>` : ''}</div>
${t.forma_pago || t.instalacion || toNum(t.dias_entrega) ? `<div class="datos">${t.forma_pago ? `<div><span>Forma de pago</span>${esc(formaPagoTxt(t.forma_pago, t.saldo_a))}</div>` : ''}${t.instalacion ? `<div><span>Instalación</span>${t.instalacion === 'con' ? 'Incluida' : 'No incluida'}</div>` : ''}${toNum(t.dias_entrega) ? `<div><span>Tiempo de entrega</span>${t.dias_entrega} días hábiles${t.entrega ? ' · ' + fdate(t.entrega) : ''}</div>` : ''}</div>` : ''}
${t.nota ? `<p class="nota">${esc(t.nota)}</p>` : ''}
${t.condiciones ? `<div class="cond"><h3>Condiciones</h3><p>${esc(t.condiciones)}</p></div>` : t.estado === 'cotizacion' ? '<p class="nota">Cotización válida por 15 días.</p>' : ''}
${fmt.mostrarFirma !== false && (fmt.firma || fmt.firmaNombre) ? `<div class="firma">${fmt.firma ? `<img src="${fmt.firma}" alt="Firma">` : ''}<div class="l"><b>${esc(fmt.firmaNombre || '')}</b><br><small>${esc(fmt.firmaCargo || '')}${fmt.firmaCargo && negocio?.nombre ? ' · ' : ''}${esc(negocio?.nombre || '')}</small></div></div>` : ''}
<footer>${esc(negocio?.pie || '')}</footer>
</body></html>`;
}
