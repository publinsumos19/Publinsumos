// Half sheets: acrylic and polystyrene sheets can be sold by halves.
// Price of a half = half the sheet price + the cutting fee (set in Ajustes).
// The item keeps cant in sheets (0.5 per half) so stock and cost stay right; `medias` is what the customer bought.
import { cantf, intf, money, normalize } from './format';
import { toNum } from './pricing';

export const CORTE_MEDIA = { acrilico: 6000, poliestireno: 1000 };
export const LAMINA_LABEL = { acrilico: 'Lámina acrílica', poliestireno: 'Lámina de poliestireno' };

export function tipoLamina(p) {
  const c = normalize(p?.categoria || '');
  if (c.includes('lamina') && c.includes('acril')) return 'acrilico';
  if (c.includes('poliestireno')) return 'poliestireno';
  return null;
}

export const corteMedia = (cfg, tipo) => toNum(cfg?.mediaLamina?.[tipo] ?? CORTE_MEDIA[tipo]);
export const precioMedia = (cfg, p) => Math.round(toNum(p?.precio) / 2) + corteMedia(cfg, tipoLamina(p));

// Vinyls and other rolls sold by the metre can be sold in centimetres (60 cm, 1,8 m...).
// Price = price per metre × metres, rounded UP to the next $100. cant stays in metres for stock and cost.
const UNIDADES_METRO = ['m', 'mt', 'mts', 'metro', 'metros', 'ml'];
export const porMetro = (p) => !tipoLamina(p) && UNIDADES_METRO.includes(normalize(p?.unidad || '').replace(/\./g, '').trim());
export const precioCm = (precioMetro, cm) => Math.ceil((toNum(precioMetro) * toNum(cm)) / 100 / 100) * 100;

// "2 medias" for half sheets, "60 cm" for vinyl cuts, otherwise the plain quantity.
export const cantItem = (it) => {
  if (it?.medias) return `${intf(it.medias)} media${toNum(it.medias) === 1 ? '' : 's'}`;
  if (it?.cm) return `${cantf(it.cm)} cm`;
  return cantf(it?.cant);
};
// Small line under each ticket item: "3 × $ 5.000", or "60 cm · $ 5.700 el metro".
export const detalleItem = (it) => (it?.cm ? `${cantItem(it)} · ${money(it.pu)} el metro` : `${cantItem(it)} × ${money(it.pu)}`);
