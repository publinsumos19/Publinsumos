// Margin over cost: price = cost × (1 + margin%). Prices are rounded to the nearest $100.
import { toNum } from './pricing';

export const precioConMargen = (costo, pct) => {
  const c = toNum(costo);
  if (!c || pct === '' || pct == null) return '';
  return String(Math.round((c * (1 + toNum(pct) / 100)) / 100) * 100);
};

export const margenDe = (costo, precio) => {
  const c = toNum(costo), p = toNum(precio);
  if (!c || !p) return '';
  return String(Math.round(((p - c) / c) * 1000) / 10);
};
