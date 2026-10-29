// Custom jobs (cotizador personalizado): totals, WhatsApp text and a printable quote.
import { fdate, money, intf, today } from './format';
import { toNum } from './pricing';
import LOGO from '../assets/logo-publiinsumos.jpg?inline';

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
// Quote numbers: "COT-0012" or, as the shop's letters use, year + consecutive ("2026012").
// The format is chosen in Ajustes; AuthContext sets it when the settings load.
let formatoNumero = 'cot';
export const setFormatoNumero = (f) => { formatoNumero = f || 'cot'; };
export const numeroT = (t) => (formatoNumero === 'anio'
  ? `${String(t.fecha || today()).slice(0, 4)}${String(t.numero ?? '').padStart(3, '0')}`
  : 'COT-' + String(t.numero ?? '').padStart(4, '0'));
export const numeroR = (n) => 'REM-' + String(n ?? '').padStart(4, '0');

// A finished product made of parts: the client only sees the product, its quantity and price.
// Each part says how much goes into ONE unit of the product.
export const esCompuesto = (l) => Array.isArray(l.componentes) && l.componentes.length > 0;
export const precioComponentes = (l) => (l.componentes || []).reduce((a, c) => a + toNum(c.cant) * toNum(c.pu), 0);
export const costoComponentes = (l, costos = []) => (l.componentes || []).reduce((a, c, k) => a + toNum(c.cant) * toNum(costos[k]), 0);

// Default file name: number, client and first product.
const limpiarNombre = (x) => String(x || '').replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
export function nombreArchivo(t, tipo = 'Cotización') {
  const producto = t.titulo || (t.lineas || []).find((l) => l.concepto)?.concepto || '';
  const num = tipo === 'Remisión' ? numeroR(t.remision) : numeroT(t);
  // Without accents: some browsers drop a download name that has them.
  return [`${tipo} ${num}`, limpiarNombre(t.cliente), limpiarNombre(producto)].filter(Boolean).join(' - ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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
  const L = [`*${negocio?.nombre || 'Publiinsumos'}*`, `${t.estado === 'cotizacion' ? 'Cotización' : 'Trabajo'} ${numeroT(t)} · ${fdate(t.fecha || today())}`];
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (ymd) => { const [y, m, d] = String(ymd || today()).split('-').map(Number); return `${String(d).padStart(2, '0')} de ${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} del ${y}`; };

// Letter layout of the shop's own quotes: logo, city and date, "Señores", reference,
// description, items table, commercial conditions numbered, signature and footer.
const CSS = `
*{box-sizing:border-box}body{font-family:Calibri,"Segoe UI","DM Sans",system-ui,sans-serif;color:#111;margin:0;padding:28px max(18px,6vw) 24px;background:#fff;font-size:14px;line-height:1.35}
.logo{height:70px;display:block;margin-bottom:22px}.logo-t{font-size:26px;font-weight:800;color:#1c3f94;margin-bottom:22px}
p{margin:0}.b{font-weight:700}.up{text-transform:uppercase}.sp{height:14px}
.num{font-weight:700;margin-top:16px}.ref{display:grid;grid-template-columns:80px 1fr;gap:4px 12px;margin-top:12px;font-weight:700}
.desc{margin-top:12px;white-space:pre-wrap;text-align:justify}
table{width:100%;border-collapse:collapse;margin-top:16px;font-variant-numeric:tabular-nums}
th{background:#fff;border-bottom:2px solid #111;padding:6px 8px;text-align:center;font-size:13px}
td{border:1px solid #9aa3b5;padding:6px 8px;vertical-align:top}.n{text-align:right;white-space:nowrap}.c{text-align:center}
.tot{margin-left:auto;width:min(330px,100%);margin-top:10px}.tot div{display:flex;justify-content:space-between;padding:3px 8px}.tot .g{border-top:2px solid #111;font-weight:700;font-size:16px;padding-top:6px}
.datos{margin-top:14px}.datos div{margin:2px 0}.nota{margin-top:12px;white-space:pre-wrap;font-weight:700}
h3{font-size:15px;font-weight:400;margin:22px 0 8px;text-transform:uppercase}.conds p{display:flex;gap:8px;margin:3px 0;text-align:justify}.conds span{flex:none;min-width:16px}
.firma{margin-top:22px}.firma img{max-width:200px;max-height:80px;display:block;margin:6px 0}
.cajas{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:50px}.cajas div{border-top:1px solid #111;padding-top:6px;font-size:13px}
footer{margin-top:30px;border-top:1px solid #ccd2df;padding-top:8px;text-align:center;font-size:12px;color:#333}
@media print{body{padding:10mm 14mm}}
`;
const encabezado = (negocio, titulo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
${negocio?.logo || LOGO ? `<img class="logo" src="${esc(negocio?.logo || LOGO)}" alt="${esc(negocio?.nombre || '')}">` : `<div class="logo-t">${esc(negocio?.nombre || '')}</div>`}`;
const pie = (negocio) => {
  const l1 = [negocio?.direccion, negocio?.ciudad, negocio?.correo].filter(Boolean).join(' – ');
  const l2 = negocio?.telefono ? `Celular: ${negocio.telefono}` : '';
  return l1 || l2 ? `<footer>${esc(l1).toUpperCase()}${l1 && l2 ? '<br>' : ''}${esc(l2).toUpperCase()}</footer>` : '';
};
const destinatario = (t) => `<p>Señores:</p><p class="b up">${esc(t.cliente || '—')}</p>${t.sucursal ? `<p class="b">${esc(t.sucursal)}</p>` : ''}${t.contacto ? `<p class="b up">${esc(t.contacto)}</p>` : ''}${t.cargo ? `<p class="b">${esc(t.cargo)}</p>` : ''}${t.ciudad ? `<p class="b">${esc(t.ciudad)}</p>` : ''}${t.nit ? `<p>NIT ${esc(t.nit)}</p>` : ''}`;

export function trabajoHtml(negocio, t, fmt = {}) {
  const total = totalTrabajo(t);
  const filas = (t.lineas || []).map((l) => `<tr><td>${esc(l.concepto)}</td><td>${esc(l.detalle || '')}</td><td class="c">${intf(l.cant)}</td><td class="n">${money(l.pu)}</td><td class="n">${money(lineaTotal(l))}</td></tr>`).join('');
  const cotiza = t.estado === 'cotizacion';
  const conds = String(t.condiciones || (cotiza ? 'Cotización válida por 15 días.' : '')).split('\n').map((x) => x.trim()).filter(Boolean);
  const datos = [
    t.forma_pago && `<div><b>Forma de pago:</b> ${esc(formaPagoTxt(t.forma_pago, t.saldo_a))}</div>`,
    t.instalacion && `<div><b>Instalación:</b> ${t.instalacion === 'con' ? 'incluida' : 'no incluida'}</div>`,
    toNum(t.dias_entrega) ? `<div><b>Tiempo de entrega:</b> ${t.dias_entrega} días hábiles${t.entrega ? ' · ' + fdate(t.entrega) : ''}</div>` : t.entrega ? `<div><b>Entrega:</b> ${fdate(t.entrega)}</div>` : '',
    t.orden_compra && `<div><b>Orden de compra:</b> ${esc(t.orden_compra)}</div>`,
  ].filter(Boolean).join('');
  return `${encabezado(negocio, fmt.titulo || nombreArchivo(t))}
<p>${esc(negocio?.ciudad || 'Manizales')}, ${fechaLarga(t.fecha)}</p><div class="sp"></div>
${destinatario(t)}
<p class="num up">${cotiza ? 'Cotización' : 'Orden de trabajo'} ${esc(numeroT(t))}</p>
${t.titulo ? `<div class="ref"><span>REF:</span><span class="up">${esc(t.titulo)}</span></div>` : ''}
${t.descripcion ? `<div class="desc">${esc(t.descripcion)}</div>` : ''}
<table><thead><tr><th>ITEM</th><th>MEDIDA</th><th>CANTIDAD</th><th>PRECIO</th><th>SUBTOTAL</th></tr></thead><tbody>${filas}</tbody></table>
<div class="tot">${toNum(t.descuento) ? `<div><span>Subtotal</span><span>${money(subtotal(t.lineas))}</span></div><div><span>Descuento</span><span>-${money(t.descuento)}</span></div>` : ''}
<div class="g"><span>Total</span><span>${money(total)}</span></div>
${t.privado && retencionValor(t) ? (t.retenciones || []).map((r) => `<div><span>${esc(r.label)} (${r.pct}%)</span><span>-${money(total * (toNum(r.pct) / 100))}</span></div>`).join('') + `<div class="g"><span>Neto a pagar</span><span>${money(netoTrabajo(t))}</span></div>` : ''}
${toNum(t.abonado) ? `<div><span>Abonado</span><span>${money(t.abonado)}</span></div><div><span>Saldo</span><span>${money(netoTrabajo(t) - toNum(t.abonado))}</span></div>` : ''}</div>
${t.nota ? `<p class="nota">${esc(t.nota)}</p>` : ''}
${datos ? `<div class="datos">${datos}</div>` : ''}
${conds.length ? `<h3>Condiciones comerciales:</h3><div class="conds">${conds.map((c, i) => `<p><span>${i + 1}.</span>${esc(c.replace(/^\d+[.)]\s*/, ''))}</p>`).join('')}</div>` : ''}
<p style="margin-top:18px">Cualquier inquietud, comentario o sugerencia con gusto será atendida. Cordial saludo,</p>
<div class="firma">${fmt.mostrarFirma !== false && fmt.firma ? `<img src="${fmt.firma}" alt="Firma">` : '<div style="height:36px"></div>'}
<p class="b up">${esc(fmt.firmaNombre || '')}</p>${fmt.firmaCargo ? `<p>${esc(fmt.firmaCargo)}</p>` : ''}<p>${esc(negocio?.nombre || '')}</p>${negocio?.direccion ? `<p>${esc(negocio.direccion)}</p>` : ''}${negocio?.correo ? `<p>Email: ${esc(negocio.correo)}${negocio?.ciudad ? ' ' + esc(negocio.ciudad) + '.' : ''}</p>` : ''}</div>
${pie(negocio)}
</body></html>`;
}

// Delivery note: what was delivered and in what quantity, no prices, with signatures.
export function remisionHtml(negocio, t, fmt = {}) {
  const filas = (t.lineas || []).map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.concepto)}</td><td>${esc(l.detalle || '')}</td><td class="c">${intf(l.cant)}</td></tr>`).join('');
  const refs = [`Cotización ${esc(numeroT(t))}`, t.orden_compra && `Orden de compra ${esc(t.orden_compra)}`].filter(Boolean).join(' · ');
  return `${encabezado(negocio, nombreArchivo(t, 'Remisión'))}
<p>${esc(negocio?.ciudad || 'Manizales')}, ${fechaLarga(t.remision_fecha || today())}</p><div class="sp"></div>
${destinatario(t)}
<p class="num up">Remisión ${esc(numeroR(t.remision))}</p>
<div class="ref"><span>REF:</span><span class="up">${esc(t.titulo || 'Trabajo personalizado')}</span></div>
<p style="margin-top:6px">${refs}</p>
<table><thead><tr><th>#</th><th>ITEM</th><th>MEDIDA</th><th>CANTIDAD</th></tr></thead><tbody>${filas}</tbody></table>
${t.nota ? `<p class="nota">${esc(t.nota)}</p>` : ''}
<div class="cajas"><div><b>Entregado por</b><br>${esc(fmt.firmaNombre || negocio?.nombre || '')}</div><div><b>Recibido por</b><br>Nombre, cédula y fecha</div></div>
${pie(negocio)}
</body></html>`;
}
