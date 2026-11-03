import { describe, expect, it } from 'vitest';
import { resumenCierre } from './cierre';

const ventas = [
  { id: 'v1', fecha: '2026-10-20', total: 30000, saldo: 0, pago: 'efectivo', fe: true, vendedor_id: 'u1', venta_costos: { costo: 12000 },
    items: [{ tipo: 'imp', cant: 10, total: 21000, clics: 10, det: { sus: 'cc', color: true } }, { tipo: 'prod', desc: 'Marcador', cant: 1, total: 9000 }] },
  { id: 'v2', fecha: '2026-10-20', total: 50000, saldo: 30000, pago: 'credito', vendedor_id: 'u1', venta_costos: { costo: 20000 },
    items: [{ tipo: 'serv', desc: 'Pendón', proveedor: 'P', cant: 1, total: 50000 }] },
];
const abonos = [
  { monto: 30000, pago: 'efectivo', ventas: { fecha: '2026-10-20' } },
  { monto: 20000, pago: 'nequi', ventas: { fecha: '2026-10-20' } },
  { monto: 15000, pago: 'bancolombia', ventas: { fecha: '2026-10-01' } },
];

describe('resumenCierre', () => {
  const R = resumenCierre({ desde: '2026-10-20', hasta: '2026-10-20', ventas, abonos, admin: true, perfiles: [{ id: 'u1', nombre: 'Laura' }] });
  it('adds sales, money received and credit', () => {
    expect(R.ventas.total).toBe(80000);
    expect(R.ventas.ganancia).toBe(48000);
    expect(R.recibido.total).toBe(65000);
    expect(R.recibido.por).toMatchObject({ efectivo: 30000, nequi: 20000, bancolombia: 15000 });
    expect(R.recibido.deCartera).toBe(15000);
    expect(R.credito.saldo).toBe(30000);
  });
  it('splits by line of business, color and F-E', () => {
    expect(R.lineas.find((l) => l.k === 'imp').total).toBe(21000);
    expect(R.lineas.find((l) => l.k === 'serv').total).toBe(50000);
    expect(R.impresiones.color.clics).toBe(10);
    expect(R.impresiones.bn.clics).toBe(0);
    expect(R.fe).toEqual({ n: 1, total: 30000 });
    expect(R.vendedores[0]).toMatchObject({ k: 'Laura', n: 2, total: 80000 });
  });
});

describe('impresiones dañadas', () => {
  const cfg = { tamanos: [{ id: 'carta', clics: 1, piezas: 9 }], sustratos: [{ id: 'cc', nombre: 'Corriente', tamano: 'carta', corriente: true, precios: [2100, 1900, 1700, 1600] }], gramajes: [{ id: 'g75' }] };
  const costos = { costoClic: 655, gramajes: { g75: 369 } };
  const danos = [{ fecha: '2026-10-20', sus: 'cc', gram: 'g75', color: true, cant: 3, clics: 3 }];
  const contador = [{ tipo: 'general', inicio: '2026-10-20', fin: '2026-10-20', contador_inicial: 100, contador_final: 113 }];
  it('subtracts damaged clics from the counter difference and reports the loss to the admin', () => {
    const R = resumenCierre({ desde: '2026-10-20', hasta: '2026-10-20', ventas, abonos, contador, danos, costos, cfg, admin: true });
    expect(R.contador[0]).toMatchObject({ maquina: 13, vendidos: 10, danadas: 3, dif: 0 });
    expect(R.danadas).toMatchObject({ n: 1, cant: 3, clics: 3, costo: Math.round(3 * (655 + 369 / 9)) });
  });
  it('hides the loss from the seller', () => {
    expect(resumenCierre({ desde: '2026-10-20', hasta: '2026-10-20', ventas, abonos, contador, danos, costos, cfg, admin: false }).danadas.costo).toBe(0);
  });
});
