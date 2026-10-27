// Traffic lights for delivery dates and overdue debts. The admin sets the thresholds in Ajustes.
import { daysBetween, today } from './format';
import { toNum } from './pricing';

export const SEMAFORO_DEF = { entregaAmarilloPct: 50, entregaRojoDias: 2, carteraAmarilloDias: 15, carteraRojoDias: 30 };
export const semaforoCfg = (cfg) => ({ ...SEMAFORO_DEF, ...(cfg?.semaforo || {}) });

const enDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);

// Green: enough time. Yellow: the chosen share of the time has passed. Red: delivery is close or late.
export function semaforoEntrega(t, cfg) {
  if (!t?.entrega || ['entregado', 'vendido', 'anulado'].includes(t.estado)) return null;
  const S = semaforoCfg(cfg);
  const hoy = today();
  const faltan = daysBetween(hoy, t.entrega);
  if (faltan < 0) return { color: 'red', dias: faltan, label: `Vencido hace ${-faltan} día${faltan === -1 ? '' : 's'}` };
  if (faltan <= toNum(S.entregaRojoDias)) return { color: 'red', dias: faltan, label: `Entrega ${enDias(faltan)}` };
  const total = Math.max(daysBetween(t.fecha || hoy, t.entrega), 1);
  const pasado = (daysBetween(t.fecha || hoy, hoy) / total) * 100;
  return { color: pasado >= toNum(S.entregaAmarilloPct) ? 'yellow' : 'green', dias: faltan, label: `Faltan ${faltan} días` };
}

// Days a debt has been open, colored by the admin's limits.
export function semaforoCartera(desde, cfg) {
  const S = semaforoCfg(cfg);
  const d = daysBetween(desde, today());
  return { dias: d, color: d >= toNum(S.carteraRojoDias) ? 'red' : d >= toNum(S.carteraAmarilloDias) ? 'yellow' : 'green', label: `${d} día${d === 1 ? '' : 's'}` };
}

export const ORDEN = { red: 0, yellow: 1, green: 2 };
