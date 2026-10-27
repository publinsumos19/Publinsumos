export const money = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');
export const intf = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');
export const cantf = (n) => (Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => ymd(new Date());
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const fdate = (s) => {
  if (!s) return '—';
  const d = parseYmd(s);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
};
export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const mondayOf = (s) => addDays(s, -((parseYmd(s).getDay() + 6) % 7));
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mesKey = (s) => s.slice(0, 7);
export const mesLabel = (k) => {
  const [y, m] = k.split('-').map(Number);
  return MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + ' ' + y;
};
export const shiftMonth = (k, n) => {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
};
export const monthRange = (k) => {
  const [y, m] = k.split('-').map(Number);
  return { desde: k + '-01', hasta: k + '-' + pad(new Date(y, m, 0).getDate()) };
};
export const lastMonths = (n) => Array.from({ length: n }, (_, i) => shiftMonth(mesKey(today()), -i));

export const recibo = (v) => 'N° ' + String(v.numero ?? '').padStart(5, '0');

export const PAGOS = { efectivo: 'Efectivo', bancolombia: 'Bancolombia', nequi: 'Nequi', credito: 'Crédito', transferencia: 'Transferencia' };
// Payment choices shown when selling and when receiving a payment. "Transferencia" stays only for older sales.
export const PAGOS_VENTA = [['efectivo', 'Efectivo'], ['bancolombia', 'Bancolombia'], ['nequi', 'Nequi'], ['credito', 'Crédito']];
export const PAGOS_ABONO = [['efectivo', 'Efectivo'], ['bancolombia', 'Bancolombia'], ['nequi', 'Nequi']];
// Lines of business, used by the cash closing and the dashboard.
export const LINEAS = { imp: 'Fotocopiadora e impresiones', prod: 'Insumos (productos propios)', serv: 'Terceros (tercerizados)', pers: 'Trabajos personalizados' };

export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
