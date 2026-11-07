// Traffic lights for delivery dates and overdue debts. The admin sets the thresholds in Ajustes.
import { addDays, daysBetween, fdate, today } from './format';
import { toNum } from './pricing';

export const SEMAFORO_DEF = { entregaAmarilloPct: 50, entregaRojoDias: 2, carteraAmarilloDias: 15, carteraRojoDias: 30, creditoAmarilloDias: 7 };
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

// Credit terms: "30" / "60"... from the client's forma de pago; anything else has no fixed term.
export const plazoForma = (forma) => (/^\d+$/.test(String(forma ?? '')) ? Number(forma) : null);
// Due date = invoice date + agreed days. Without an invoice there is no due date yet.
export const venceCredito = (x) => (x?.factura_fecha ? addDays(x.factura_fecha, toNum(x.dias_credito)) : null);

// Invoiced debts count down to their due date; the rest keep counting days since the sale.
// `peso` sorts the worst first inside the same color.
export function semaforoCredito(x, cfg) {
  const vence = venceCredito(x);
  if (!vence) {
    const s = semaforoCartera(x.fecha, cfg);
    return { ...s, peso: s.dias, label: `${s.label} · sin factura` };
  }
  const faltan = daysBetween(today(), vence);
  if (faltan < 0) return { dias: -faltan, peso: 1000 - faltan, color: 'red', label: `Vencida hace ${-faltan} día${faltan === -1 ? '' : 's'}` };
  const S = semaforoCfg(cfg);
  return { dias: faltan, peso: -faltan, color: faltan <= toNum(S.creditoAmarilloDias) ? 'yellow' : 'green', label: faltan === 0 ? 'Vence hoy' : `Vence ${fdate(vence)} (${faltan} día${faltan === 1 ? '' : 's'})` };
}
// Worst light among several debts of the same client.
export const peorSemaforo = (lista, cfg) => lista.map((x) => semaforoCredito(x, cfg))
  .sort((a, b) => ORDEN[a.color] - ORDEN[b.color] || b.peso - a.peso)[0];
