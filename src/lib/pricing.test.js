import { describe, it, expect } from 'vitest';
import { calcImpresion, escalaIdx, itemImpresion, costoClicDe } from './pricing';

const cfg = {
  plastificado: { precio: 1000 },
  tamanos: [
    { id: 'carta', nombre: 'Carta', clics: 1, piezas: 9 },
    { id: 't48', nombre: '33 x 48 cm', clics: 2, piezas: 4 },
  ],
  gramajes: [{ id: 'g200', nombre: 'Propalcote 200 g' }],
  sustratos: [
    { id: 'cc', nombre: 'Corriente Carta/Oficio', tamano: 'carta', corriente: true, precios: [2100, 1900, 1700, 1600] },
    { id: 'c48', nombre: 'Corriente 33 x 48 cm', tamano: 't48', corriente: true, precios: [4000, 3600, 3300, 3000] },
    { id: 'ad48', nombre: 'Adhesivo 33 x 48 cm', tamano: 't48', corriente: false, precios: [4500, 4300, 4100, 3900] },
  ],
};
const costos = { costoClic: 655, plastificadoCosto: 0, gramajes: { g200: 972 }, sustratos: { ad48: 2300 } };

describe('escalas', () => {
  it('uses the sheet thresholds', () => {
    expect([1, 20, 21, 50, 51, 100, 101, 206].map(escalaIdx)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('calcImpresion matches rows from CUADRE SEMANAL DIGITAL.xlsx', () => {
  it('bareque: 24 × 33x48 with 24 plastificados = 110.400 and 48 clics', () => {
    const r = calcImpresion(cfg, { sus: 'c48', gram: 'g200', color: true, cant: 24, plast: 24 });
    expect(r.pu).toBe(3600);
    expect(r.sub).toBe(86400);
    expect(r.extra).toBe(24000);
    expect(r.total).toBe(110400);
    expect(r.clics).toBe(48);
  });
  it('LUKER: 41 carta = 77.900', () => {
    expect(calcImpresion(cfg, { sus: 'cc', gram: 'g200', cant: 41 }).total).toBe(77900);
  });
  it('agriculture: 206 × 33x48 = 618.000', () => {
    expect(calcImpresion(cfg, { sus: 'c48', gram: 'g200', cant: 206 }).total).toBe(618000);
  });
  it('suggests the next scale when it is close', () => {
    const r = calcImpresion(cfg, { sus: 'c48', gram: 'g200', cant: 18 });
    expect(r.next).toEqual({ faltan: 3, pu: 3600, escala: '21 a 50' });
  });
  it('estimates cost with clic and paper costs', () => {
    // 25 × (655*2 + 972/4) = 25 × 1553 = 38825
    expect(calcImpresion(cfg, { sus: 'c48', gram: 'g200', cant: 25 }, costos).costo).toBe(38825);
    // special paper uses its own sheet cost: 10 × (1310 + 2300/4) = 18850
    expect(calcImpresion(cfg, { sus: 'ad48', gram: 'g200', cant: 10 }, costos).costo).toBe(18850);
  });
  it('builds a cart item without gramaje for special papers', () => {
    const it = itemImpresion(cfg, { sus: 'ad48', gram: 'g200', color: true, cant: 10, plast: 0 });
    expect(it.det.gram).toBeNull();
    expect(it.desc).toBe('Adhesivo 33 x 48 cm · Color');
  });
});

describe('costoClicDe', () => {
  it('uses the color or B/N clic cost when set, else the general one', () => {
    expect(costoClicDe({ costoClic: 655, costoClicColor: 700 }, true)).toBe(700);
    expect(costoClicDe({ costoClic: 655, costoClicColor: 700 }, false)).toBe(655);
    expect(costoClicDe({ costoClic: 655, costoClicBN: 0 }, false)).toBe(655);
  });
});
