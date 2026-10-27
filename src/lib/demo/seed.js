// Sample data for the demo: a few weeks of sales, products, clients and counter readings.
import { addDays, mondayOf, today } from '../format';
import { itemImpresion } from '../pricing';
import { CONFIG_COSTOS, CONFIG_PUBLICA } from './config';
import { efectivoPorCaja } from '../caja';
import { resumenGastos } from '../gastos';
import { COTIZACION_DEF } from '../trabajo';
import CATALOGO from './catalogo.json';
import LAMINAS from './laminas.json';

export const USUARIOS = {
  admin: { id: 'u-admin', nombre: 'Administrador', email: 'admin@ecoglobal.co', rol: 'admin', activo: true, creado: '2026-01-02T12:00:00Z' },
  vendedor: { id: 'u-vend', nombre: 'Laura Martínez', email: 'laura@ecoglobal.co', rol: 'vendedor', activo: true, creado: '2026-01-05T12:00:00Z' },
};

const PRODUCTOS = [
  ['Resma papel carta 75 g', 'Papelería', 'propio', 18500, 14200, 14, 5, 'resma'],
  ['Marcador permanente', 'Papelería', 'propio', 3500, 1900, 40, 10, 'und'],
  ['Cinta doble faz 1"', 'Insumos', 'propio', 6500, 3800, 14, 8, 'rollo'],
  ['Foamboard 50 x 70 cm', 'Insumos', 'propio', 9000, 5200, 12, 4, 'und'],
  ['Carpeta de presentación', 'Papelería', 'propio', 2500, 1100, 22, 10, 'und'],
  ['Vinilo adhesivo por metro', 'Gran formato', 'propio', 22000, 12500, 18, 5, 'm'],
  ['Tarjetas de presentación x1000', 'Impresión offset', 'tercerizado', 85000, 52000, null, 0, 'und', 'Litografía Andina'],
  ['Pendón 1 x 2 m con tubos', 'Gran formato', 'tercerizado', 65000, 38000, null, 0, 'und', 'Gigantografías del Valle'],
  ['Sticker troquelado x100', 'Gran formato', 'tercerizado', 45000, 26000, null, 0, 'und', 'Gigantografías del Valle'],
  ['Sello automático', 'Otros', 'tercerizado', 48000, 30000, null, 0, 'und', 'Sellos Express'],
];

// name, phone, payment terms, NIT, when the rest is paid (for the 50% advance)
const CLIENTES = [
  ['Colegio San José', '3104567890', '30', '890.123.456-1'], ['Panadería La Espiga', '3157778899', 'anticipo50', '', 'contra entrega'], ['Droguería Central', '3001234567', '45', '900.456.789-2'],
  ['Ana María Gómez', '3209988776', 'convenir'], ['Inmobiliaria Horizonte', '3016655443', '60', '901.234.567-8'], ['Restaurante El Fogón', '3112233445', 'anticipo50', '', 'al instalar'],
  ['Gimnasio Fuerza Total', '3176655001', '10'], ['Carlos Pérez', '3185544332', 'convenir'],
];

// Small deterministic random generator so every demo starts the same.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function seedDb(api) {
  const db = {
    seq: 0,
    perfiles: Object.values(USUARIOS),
    config_publica: [{ id: 1, datos: CONFIG_PUBLICA, actualizado: '2026-01-02T12:00:00Z' }],
    config_costos: [{ id: 1, datos: CONFIG_COSTOS, actualizado: '2026-01-02T12:00:00Z' }],
    productos: [], producto_costos: [], clientes: [], ventas: [], venta_costos: [], abonos: [], contador: [],
    seqT: 0, trabajos: [], trabajo_abonos: [], trabajo_costos: [], cierres: [], aperturas: [], gastos: [], conteos: [],
  };
  PRODUCTOS.forEach(([nombre, categoria, tipo, precio, costo, stock, stock_min, unidad, proveedor = ''], i) => {
    const id = 'p' + (i + 1);
    db.productos.push({ id, nombre, categoria, tipo, proveedor, precio, stock, stock_min, unidad, creado: '2026-01-03T12:00:00Z' });
    db.producto_costos.push({ producto_id: id, costo });
  });
  // The shop's real supplies list (COSTOS Y LISTA DE PRECIOS.xlsx), with the stock from its last count.
  CATALOGO.forEach((c, i) => {
    const id = 'q' + (i + 1);
    db.productos.push({ id, nombre: c.nombre, categoria: c.categoria, tipo: 'propio', proveedor: '', precio: c.precio, stock: c.stock, stock_min: 0, unidad: c.unidad, creado: '2026-01-03T12:00:00Z' });
    db.producto_costos.push({ producto_id: id, costo: c.costo });
  });
  LAMINAS.forEach((c, i) => {
    const id = 'l' + (i + 1);
    db.productos.push({ id, nombre: c.nombre, categoria: c.categoria, tipo: 'propio', proveedor: 'Formaplax', precio: c.precio, stock: 0, stock_min: 0, unidad: c.unidad, creado: '2026-01-03T12:00:00Z' });
    db.producto_costos.push({ producto_id: id, costo: c.costo });
  });
  CLIENTES.forEach(([nombre, telefono, forma_pago = null, nit = '', saldo_a = ''], i) => {
    db.clientes.push({ id: 'c' + (i + 1), nombre, nombre_key: nombre.toLowerCase(), telefono, forma_pago, nit, saldo_a, correo: '', direccion: '', creado: '2026-01-04T12:00:00Z' });
  });

  // Sales go through the same functions the app uses, so totals, costs and stock add up.
  const run = (name, args) => api.seedRpc(db, name, args);

  const rand = rng(20261017);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const hoy = today();
  const inicio = addDays(mondayOf(hoy), -35);
  const sus = CONFIG_PUBLICA.sustratos.map((s) => s.id);
  const pesos = ['cc', 'cc', 'cc', 'cc', 'c48', 'c48', 'opc', 'adc', 'ad48', 'vin', 'met', 'c70', 'c100'];
  const gram = ['g75', 'g150', 'g200', 'g240', 'g300'];

  for (let f = inicio; f <= hoy; f = addDays(f, 1)) {
    const dow = new Date(f + 'T12:00:00').getDay();
    if (dow === 0) continue;
    const n = (f === hoy ? 3 : 3 + Math.floor(rand() * 5));
    for (let k = 0; k < n; k++) {
      const items = [];
      const nItems = 1 + Math.floor(rand() * 2);
      for (let j = 0; j < nItems; j++) {
        const r = rand();
        if (r < 0.7) {
          const s = pick(pesos);
          const big = rand() < 0.25;
          const cant = big ? 30 + Math.floor(rand() * 120) : 1 + Math.floor(rand() * 18);
          const plast = s === 'opc' && rand() < 0.5 ? Math.min(cant, 1 + Math.floor(rand() * 10)) : 0;
          const it = itemImpresion(CONFIG_PUBLICA, { sus: sus.includes(s) ? s : 'cc', gram: pick(gram), color: rand() < 0.7, cant, plast });
          if (it) items.push(it);
        } else if (r < 0.9) {
          const p = pick(PRODUCTOS.slice(0, 6));
          const idx = PRODUCTOS.indexOf(p);
          const cant = 1 + Math.floor(rand() * 3);
          const enStock = db.productos[idx].stock;
          if (enStock - cant < 2) continue;
          items.push({ tipo: 'prod', productoId: 'p' + (idx + 1), desc: p[0], cant, pu: p[3], total: cant * p[3] });
        } else {
          const p = pick(PRODUCTOS.slice(6));
          const idx = PRODUCTOS.indexOf(p);
          items.push({ tipo: 'serv', productoId: 'p' + (idx + 1), desc: p[0], proveedor: p[8], cant: 1, pu: p[3], total: p[3] });
        }
      }
      if (!items.length) continue;
      const conCliente = rand() < 0.6;
      const c = conCliente ? pick(CLIENTES) : null;
      const credito = c && rand() < 0.22;
      const total = items.reduce((a, i) => a + i.total, 0);
      const rp = rand();
      const pago = credito ? 'credito' : rp < 0.55 ? 'efectivo' : rp < 0.8 ? 'nequi' : 'bancolombia';
      const hora = String(8 + Math.floor((k / n) * 10)).padStart(2, '0') + ':' + String(Math.floor(rand() * 60)).padStart(2, '0');
      const v = run('registrar_venta', {
        p: {
          fecha: f, cliente: c?.[0] || '', telefono: c?.[1] || '', items, pago,
          abono: credito ? Math.round((total * (rand() < 0.5 ? 0 : 0.4)) / 1000) * 1000 : null, pagoAbono: 'efectivo', fe: !!c && rand() < 0.3,
          _creado: new Date(`${f}T${hora}:00`).toISOString(), _vendedor: rand() < 0.6 ? USUARIOS.vendedor.id : USUARIOS.admin.id,
        },
      });
      // Some older credits got paid in part later.
      if (credito && f < addDays(hoy, -7) && rand() < 0.5 && v.saldo > 0) {
        run('registrar_abono', { p_venta: v.id, p_monto: Math.round(v.saldo / 2000) * 1000 || v.saldo, p_pago: rand() < 0.5 ? 'nequi' : 'bancolombia', p_fecha: addDays(f, 5) });
      }
    }
  }

  // Day-to-day expenses: small cash ones from the drawers, and the monthly bills by bank transfer.
  const CHICOS = [['Domicilio', 'Domicilio de pedido al centro', 6000, 12000], ['Transporte', 'Bus para comprar papel', 4000, 8000],
    ['Aseo y cafetería', 'Café y azúcar', 8000, 15000], ['Compra de insumos', 'Cinta y pegante', 10000, 25000], ['Domicilio', 'Mensajero entrega de pendones', 8000, 15000]];
  let ng = 0;
  const gasto = (fecha, categoria, concepto, monto, pago, caja = null, usuario = USUARIOS.vendedor.id) =>
    db.gastos.push({ id: 'g' + (++ng), fecha, categoria, concepto, monto, pago, caja: pago === 'efectivo' ? caja : null, nota: '', usuario_id: usuario, creado: `${fecha}T${String(10 + (ng % 8)).padStart(2, '0')}:15:00Z` });
  for (let f = inicio; f <= hoy; f = addDays(f, 1)) {
    if (new Date(f + 'T12:00:00').getDay() === 0) continue;
    const n = f === hoy ? 1 : Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const [cat, txt, min, max] = pick(CHICOS);
      gasto(f, cat, txt, Math.round((min + rand() * (max - min)) / 500) * 500, 'efectivo', rand() < 0.7 ? 'insumos' : 'impresion');
    }
    if (f.endsWith('-05')) {
      gasto(f, 'Arriendo', 'Arriendo del local', 1200000, 'bancolombia', null, USUARIOS.admin.id);
      gasto(f, 'Internet y teléfono', 'Internet fibra', 95000, 'nequi', null, USUARIOS.admin.id);
    }
    if (f.endsWith('-12')) gasto(f, 'Servicios públicos', 'Energía y agua', 186000, 'bancolombia', null, USUARIOS.admin.id);
    if (f.endsWith('-18')) gasto(f, 'Mantenimiento de máquinas', 'Revisión fotocopiadora', 120000, 'efectivo', 'impresion', USUARIOS.admin.id);
  }

  // Cash openings and daily closings for the last working days. The last day was opened but not closed,
  // and today is not opened yet, so the demo shows both reminders.
  const dias = [...new Set(db.ventas.map((v) => v.fecha))].filter((f) => f < hoy).sort().slice(-12);
  dias.forEach((f, i) => {
    const apertura = { id: 'ap-' + f, fecha: f, base_impresion: 150000, base_insumos: 100000, usuario_id: USUARIOS.vendedor.id, creado: `${f}T08:00:00Z` };
    db.aperturas.push(apertura);
    if (i === dias.length - 1) return;
    const vs = db.ventas.filter((v) => v.fecha === f);
    const abs = db.abonos.filter((a) => a.fecha === f).map((a) => ({ ...a, ventas: db.ventas.find((v) => v.id === a.venta_id) }));
    const ef = efectivoPorCaja(abs, []);
    const gs = resumenGastos(db.gastos.filter((g) => g.fecha === f));
    const esp = { impresion: apertura.base_impresion + ef.impresion - gs.caja.impresion, insumos: apertura.base_insumos + ef.insumos - gs.caja.insumos };
    const falta = i === dias.length - 4 ? 5000 : 0;
    const total = vs.reduce((a, v) => a + v.total, 0);
    db.cierres.push({
      id: 'ci-' + f, tipo: 'diario', desde: f, hasta: f, ambito: 'tienda', nota: falta ? 'Faltaron $5.000 en la caja de insumos' : '',
      base: apertura.base_impresion + apertura.base_insumos, base_impresion: apertura.base_impresion, base_insumos: apertura.base_insumos,
      contado_impresion: esp.impresion, contado_insumos: esp.insumos - falta, efectivo_contado: esp.impresion + esp.insumos - falta,
      resumen: { ventas: { total, n: vs.length }, recibido: { total: abs.reduce((a, x) => a + x.monto, 0) }, esperado: esp.impresion + esp.insumos, gastos: gs.total },
      usuario_id: USUARIOS.vendedor.id, creado: `${f}T19:30:00Z`,
    });
  });

  // A private weekly closing from last week, so the history can be filtered by store or private.
  const lunesPasado = addDays(mondayOf(hoy), -7);
  db.cierres.push({ id: 'ci-priv-' + lunesPasado, tipo: 'semanal', desde: lunesPasado, hasta: addDays(lunesPasado, 5), ambito: 'privado', nota: '',
    resumen: { ventas: { total: 0, n: 0 }, recibido: { total: 250000 }, privado: { recibido: 250000, saldo: 430000, cotizado: 480000, nuevos: 1 } },
    usuario_id: USUARIOS.admin.id, creado: `${addDays(lunesPasado, 5)}T20:00:00Z` });

  // Counter readings for the finished weeks: machine clics = clics sold + a few tests or damaged sheets.
  // The machine has a general counter plus one for color and one for black and white.
  const conts = { general: CONFIG_PUBLICA.ultimoContador, color: 128450, bn: 68259 };
  const esTipo = (tipo) => (i) => i.tipo === 'imp' && (tipo === 'general' || (tipo === 'color') === !!i.det?.color);
  let semana = 0;
  for (let w = inicio; addDays(w, 5) < hoy; w = addDays(w, 7), semana++) {
    const fin = addDays(w, 5);
    const its = db.ventas.filter((v) => v.fecha >= w && v.fecha <= fin).flatMap((v) => v.items);
    const vend = (t) => its.filter(esTipo(t)).reduce((a, i) => a + i.clics, 0);
    const extraColor = Math.round(vend('color') * (semana === 1 ? 0.12 : 0.02));
    const extraBN = Math.round(vend('bn') * 0.02);
    const maq = { color: vend('color') + extraColor, bn: vend('bn') + extraBN };
    maq.general = maq.color + maq.bn;
    for (const tipo of ['general', 'color', 'bn']) {
      db.contador.push({ id: `k-${tipo}-${w}`, tipo, inicio: w, contador_inicial: conts[tipo], fin, contador_final: conts[tipo] + maq[tipo], creado: `${fin}T19:00:00Z` });
      conts[tipo] += maq[tipo];
    }
  }

  // Custom jobs from the quote tool: the seller's go to the shop, the admin's are private.
  const trabajo = (t) => {
    const lineas = t.lineas.map(([concepto, detalle, cant, pu, costo = 0]) => ({ concepto, detalle, cant, pu, total: cant * pu, costo }));
    const total = lineas.reduce((a, l) => a + l.total, 0) - (t.descuento || 0);
    const row = {
      id: 't' + (db.trabajos.length + 1), numero: ++db.seqT, fecha: t.fecha, cliente: t.cliente, telefono: t.tel || '', titulo: t.titulo,
      lineas: lineas.map(({ costo, ...l }) => l), descuento: t.descuento || 0, total, estado: t.estado, privado: t.privado, abonado: 0, saldo: t.estado === 'cotizacion' ? 0 : total,
      nota: t.nota || '', entrega: t.entrega || null, venta_id: null, usuario_id: t.privado ? USUARIOS.admin.id : USUARIOS.vendedor.id, creado: `${t.fecha}T15:00:00Z`,
    };
    const cli = CLIENTES.find((c) => c[0] === t.cliente) || [];
    const inst = lineas.some((l) => /instalaci/i.test(l.concepto)) ? 'con' : 'sin';
    const ret = (t.ret || []).map((id) => COTIZACION_DEF.retenciones.find((r) => r.id === id)).filter(Boolean);
    Object.assign(row, {
      nit: cli[3] || '', forma_pago: cli[2] || 'convenir', saldo_a: cli[4] || '', instalacion: inst, dias_entrega: inst === 'con' ? COTIZACION_DEF.diasCon : COTIZACION_DEF.diasSin,
      condiciones: COTIZACION_DEF.condiciones, enviada: t.enviada || null, retenciones: ret, retencion: Math.round(ret.reduce((a, r) => a + total * (r.pct / 100), 0)),
    });
    db.trabajos.push(row);
    db.trabajo_costos.push({ trabajo_id: row.id, costos: lineas.map((l) => l.costo) });
    for (const [fecha, monto, pago] of t.abonos || []) {
      db.trabajo_abonos.push({ id: `ta-${row.id}-${fecha}`, trabajo_id: row.id, fecha, monto, pago, usuario_id: row.usuario_id, creado: `${fecha}T16:00:00Z` });
      row.abonado += monto;
    }
    row.saldo = row.estado === 'cotizacion' ? 0 : row.total - row.retencion - row.abonado;
  };
  trabajo({ fecha: addDays(hoy, -9), cliente: 'Restaurante El Fogón', tel: '3112233445', titulo: 'Aviso en acrílico para fachada', estado: 'aprobado', privado: false, entrega: addDays(hoy, 2),
    lineas: [['Acrílico', '120 x 60 cm, 3 mm', 1, 180000], ['Servicio de corte', 'Láser, letras y logo', 1, 60000], ['Servicio de armado', 'Separadores y base', 1, 45000], ['Acarreo', 'Hasta el local', 1, 20000], ['Instalación', 'En fachada, 2 personas', 1, 50000]],
    abonos: [[addDays(hoy, -9), 180000, 'nequi']] });
  trabajo({ fecha: addDays(hoy, -1), cliente: 'Panadería La Espiga', tel: '3125550199', titulo: 'Pendones para inauguración', estado: 'aprobado', privado: false, entrega: addDays(hoy, 12),
    lineas: [['Lona banner', '80 x 180 cm, full color', 2, 65000], ['Estructura metálica', 'Porta pendón tipo araña', 2, 35000]],
    abonos: [[addDays(hoy, -1), 100000, 'efectivo']] });
  trabajo({ fecha: addDays(hoy, -12), cliente: 'Ferretería El Tornillo', tel: '3157778899', titulo: 'Vinilo para vitrina', estado: 'aprobado', privado: false, entrega: addDays(hoy, -1),
    lineas: [['Vinilo de corte', 'Logo y horario', 1, 85000], ['Instalación', 'En vitrina', 1, 30000]],
    abonos: [[addDays(hoy, -12), 50000, 'nequi']] });
  trabajo({ fecha: addDays(hoy, -2), cliente: 'Gimnasio Fuerza Total', tel: '3176655001', titulo: 'Señalización interna', estado: 'cotizacion', privado: false, enviada: addDays(hoy, -1),
    lineas: [['Vinilo de corte', 'Letras 30 cm alto', 6, 18000], ['Instalación', 'En vidrio', 1, 40000]] });
  trabajo({ fecha: addDays(hoy, -15), cliente: 'Inmobiliaria Horizonte', tel: '3016655443', titulo: 'Valla publicitaria 3 x 2 m', estado: 'entregado', privado: true, ret: ['rf-serv'],
    lineas: [['Lona banner', '3 x 2 m, impresión full color', 1, 290000, 160000], ['Estructura metálica', 'Tubo cuadrado 1"', 1, 350000, 210000], ['Instalación', 'Con andamio', 1, 150000, 60000]],
    abonos: [[addDays(hoy, -15), 400000, 'bancolombia'], [addDays(hoy, -4), 200000, 'bancolombia']] });
  trabajo({ fecha: addDays(hoy, -6), cliente: 'Colegio San José', tel: '3104567890', titulo: 'Letras corpóreas en MDF', estado: 'aprobado', privado: true, entrega: addDays(hoy, 4),
    lineas: [['MDF', '15 mm, letras de 40 cm', 1, 220000, 90000], ['Servicio de corte', 'CNC', 1, 120000, 50000], ['Pintura', 'Laca dorada', 1, 80000, 30000], ['Instalación', '', 1, 70000, 25000]],
    abonos: [[addDays(hoy, -6), 250000, 'efectivo']] });
  trabajo({ fecha: addDays(hoy, -1), cliente: 'Droguería Central', tel: '3001234567', titulo: 'Caja de luz 1 x 0,5 m', estado: 'cotizacion', privado: true, ret: ['rf-comp'],
    lineas: [['Acrílico opal', '100 x 50 cm', 1, 160000, 85000], ['Iluminación LED', 'Módulos y fuente', 1, 120000, 70000], ['Estructura en aluminio', '', 1, 140000, 80000], ['Instalación', '', 1, 60000, 20000]] });

  db.config_publica[0].datos = {
    ...CONFIG_PUBLICA, negocio: { ...CONFIG_PUBLICA.negocio, telefono: '3001112233' },
    ultimoContador: conts.general, ultimoContadorColor: conts.color, ultimoContadorBN: conts.bn,
  };
  db.config_costos[0].datos = { ...CONFIG_COSTOS, costoClicColor: 655, sustratos: { ...CONFIG_COSTOS.sustratos, opc: 2709, adc: 2304, vin: 8800, met: 10000 } };
  return db;
}
