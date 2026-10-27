// Daily expenses: what goes out of the shop's money (delivery, transport, cleaning, rent...).
// Cash expenses come out of one of the two drawers, so the daily closing subtracts them there.
import { toNum } from './pricing';

export const CATEGORIAS_GASTO = [
  'Domicilio', 'Transporte', 'Compra de insumos', 'Papelería y oficina', 'Aseo y cafetería', 'Mantenimiento de máquinas',
  'Servicios públicos', 'Internet y teléfono', 'Arriendo', 'Nómina', 'Publicidad', 'Impuestos', 'Otro',
];
export const PAGOS_GASTO = [['efectivo', 'Efectivo'], ['bancolombia', 'Bancolombia'], ['nequi', 'Nequi']];
export const CAJAS_GASTO = [['insumos', 'Caja insumos'], ['impresion', 'Caja impresión láser']];
export const CAJA_LABEL = Object.fromEntries(CAJAS_GASTO);

export function resumenGastos(gastos = []) {
  const out = { total: 0, n: gastos.length, por: { efectivo: 0, bancolombia: 0, nequi: 0 }, caja: { impresion: 0, insumos: 0 }, categorias: [] };
  const cats = {};
  for (const g of gastos) {
    const m = toNum(g.monto);
    out.total += m;
    out.por[g.pago] = (out.por[g.pago] || 0) + m;
    if (g.pago === 'efectivo') out.caja[g.caja === 'impresion' ? 'impresion' : 'insumos'] += m;
    (cats[g.categoria || 'Otro'] ||= { k: g.categoria || 'Otro', total: 0, n: 0 });
    cats[g.categoria || 'Otro'].total += m; cats[g.categoria || 'Otro'].n += 1;
  }
  out.categorias = Object.values(cats).sort((a, b) => b.total - a.total);
  return out;
}
