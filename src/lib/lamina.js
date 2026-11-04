// Half sheets: acrylic and polystyrene sheets can be sold by halves.
// Price of a half = half the sheet price + the cutting fee (set in Ajustes).
// The item keeps cant in sheets (0.5 per half) so stock and cost stay right; `medias` is what the customer bought.
import { cantf, intf, normalize } from './format';
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

// "2 medias" for half sheets, otherwise the plain quantity.
export const cantItem = (it) => (it?.medias ? `${intf(it.medias)} media${toNum(it.medias) === 1 ? '' : 's'}` : cantf(it?.cant));
