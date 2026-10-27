import { money, intf, fdate, today, recibo, PAGOS } from './format';

export function receiptText(negocio, v, kind) {
  const n = negocio || {};
  const L = [`*${n.nombre || 'Ecoglobal'}*`];
  L.push(kind === 'quote' ? `Cotización · ${fdate(today())}` : `Recibo ${recibo(v)} · ${fdate(v.fecha)}`);
  if (v.cliente) L.push(`Cliente: ${v.cliente}`);
  L.push('');
  for (const it of v.items) {
    L.push(`• ${intf(it.cant)} × ${it.desc}`);
    L.push(`   ${money(it.pu)} c/u${it.extra ? ' + plastificado ' + money(it.extra) : ''} = ${money(it.total)}`);
  }
  L.push('', `*Total: ${money(v.total)}*`);
  if (kind === 'quote') L.push('Precios válidos por 8 días.');
  else {
    L.push(`Pago: ${PAGOS[v.pago] || v.pago}`);
    if (v.pago === 'credito') L.push(`Abonado: ${money(v.abonado)}`, `Saldo pendiente: ${money(v.saldo)}`);
    if (v.fe) L.push('Factura electrónica: Sí');
  }
  if (v.nota) L.push(`Nota: ${v.nota}`);
  if (n.pie) L.push('', n.pie);
  if (n.telefono) L.push(`Tel: ${n.telefono}`);
  return L.join('\n');
}

export function debtText(negocio, cliente, ventas) {
  const tot = ventas.reduce((a, v) => a + Number(v.saldo), 0);
  return [
    `Hola ${cliente}, te saluda *${negocio?.nombre || 'Ecoglobal'}*.`,
    'Te compartimos tu saldo pendiente:',
    '',
    ...ventas.map((v) => `• ${recibo(v)} del ${fdate(v.fecha)}: ${money(v.saldo)}`),
    '',
    `*Total: ${money(tot)}*`,
    '',
    'Gracias por tu confianza.',
  ].join('\n');
}

export function waLink(negocio, tel, text) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 10) d = (negocio?.indicativo || '57') + d;
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
}
