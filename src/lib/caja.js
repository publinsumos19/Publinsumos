// Two cash drawers: one for laser printing and one for supplies (which also takes third-party and custom work).
import { toNum } from './pricing';

export const CAJAS = [
  { k: 'impresion', label: 'Caja impresión láser', base: 'base_impresion', contado: 'contado_impresion' },
  { k: 'insumos', label: 'Caja insumos', base: 'base_insumos', contado: 'contado_insumos' },
];

// Cash payments split by drawer, in proportion to each sale's print and non-print lines.
export function efectivoPorCaja(abonos = [], abonosTrabajos = []) {
  const out = { impresion: 0, insumos: 0 };
  for (const a of abonos) {
    if (a.pago !== 'efectivo') continue;
    const items = a.ventas?.items || [];
    const tot = items.reduce((s, i) => s + toNum(i.total), 0);
    const imp = items.filter((i) => i.tipo === 'imp').reduce((s, i) => s + toNum(i.total), 0);
    const share = tot > 0 ? Math.min(Math.max(imp / tot, 0), 1) : 0;
    out.impresion += toNum(a.monto) * share;
    out.insumos += toNum(a.monto) * (1 - share);
  }
  for (const a of abonosTrabajos) if (a.pago === 'efectivo' && !a.trabajos?.privado) out.insumos += toNum(a.monto);
  out.impresion = Math.round(out.impresion);
  out.insumos = Math.round(out.insumos);
  return out;
}
