// In-browser stand-in for the Supabase client, used only by the demo build (VITE_DEMO=1).
// It keeps the data in localStorage and mirrors the rules and functions of supabase/schema.sql,
// so the screens run unchanged without a server.
import { today } from '../format';
import { toNum } from '../pricing';
import { seedDb, USUARIOS } from './seed';

const KEY = 'ecoglobal-demo-v8';
const ROLE_KEY = 'ecoglobal-demo-rol';
const SESSION_KEY = 'ecoglobal-demo-sesion';
export const DEMO_PASS = '123456';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window: keep data in memory only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(store.get(KEY)); } catch { db = null; }
  if (!db?.ventas) { db = seedDb(api); save(); }
  return db;
}
const save = () => store.set(KEY, JSON.stringify(db));

let rol = store.get(ROLE_KEY) === 'vendedor' ? 'vendedor' : 'admin';
let signedIn = store.get(SESSION_KEY) === '1';
const me = () => USUARIOS[rol];
const isAdmin = () => rol === 'admin';
const fail = (message) => ({ data: null, error: { message } });

// Tables only the admin can read or write (row-level security in schema.sql).
const ADMIN_READ = ['config_costos', 'producto_costos', 'venta_costos'];
const ADMIN_WRITE = ['conteos', 'config_publica', 'config_costos', 'productos', 'producto_costos', 'perfiles', 'contador', 'trabajo_costos'];
ADMIN_READ.push('trabajo_costos');

// Custom jobs the admin keeps private (Cartera privada) are invisible to the seller, like the RLS policies.
const privadoTrabajo = (id) => !!db.trabajos.find((t) => t.id === id)?.privado;
const visible = (t, r) => {
  if (isAdmin()) return true;
  if (t === 'trabajos') return !r.privado;
  if (t === 'trabajo_abonos') return !privadoTrabajo(r.trabajo_id);
  if (t === 'cierres') return r.ambito !== 'privado';
  return true;
};

// Embedded relations used by the screens: name -> how to find the related row.
const EMBEDS = {
  'ventas.venta_costos': (row) => db.venta_costos.find((c) => c.venta_id === row.id) || null,
  'abonos.ventas': (row) => db.ventas.find((v) => v.id === row.venta_id) || null,
  'trabajo_abonos.trabajos': (row) => db.trabajos.find((v) => v.id === row.trabajo_id) || null,
};

function project(table, row, cols) {
  if (cols.trim() === '*' || !cols.trim()) return clone(row);
  const out = {};
  for (const part of cols.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\w+)\((.*)\)$/);
    if (m) {
      const rel = EMBEDS[`${table}.${m[1]}`];
      const r = rel ? rel(row) : null;
      out[m[1]] = r && !(isAdmin() === false && ADMIN_READ.includes(m[1])) ? project(m[1], r, m[2]) : null;
    } else if (part === '*') Object.assign(out, clone(row));
    else out[part] = row[part] ?? null;
  }
  return out;
}

function onWrite(table, row) {
  if (table === 'clientes') row.nombre_key = String(row.nombre || '').trim().toLowerCase();
}

const DEFAULTS = {
  productos: () => ({ id: uuid(), categoria: '', tipo: 'propio', proveedor: '', precio: 0, stock: null, stock_min: 0, unidad: 'und', creado: now() }),
  contador: () => ({ id: uuid(), tipo: 'general', creado: now() }),
  trabajos: () => ({
    id: uuid(), numero: ++db.seqT, fecha: today(), cliente: '', telefono: '', titulo: '', lineas: [], descuento: 0, total: 0,
    estado: 'cotizacion', privado: isAdmin(), abonado: 0, saldo: 0, nota: '', entrega: null, venta_id: null, usuario_id: me().id, creado: now(),
  }),
  cierres: () => ({ id: uuid(), usuario_id: me().id, creado: now(), nota: '', base: 0, efectivo_contado: null }),
  trabajo_abonos: () => ({ id: uuid(), usuario_id: me().id, creado: now() }),
  conteos: () => ({ id: uuid(), usuario_id: me().id, creado: now() }),
  gastos: () => ({ id: uuid(), fecha: today(), categoria: 'Otro', nota: '', caja: null, usuario_id: me().id, creado: now() }),
  aperturas: () => ({ id: uuid(), usuario_id: me().id, creado: now(), base_insumos: 0, base_impresion: 0 }),
  producto_costos: () => ({ costo: 0 }),
  config_publica: () => ({}),
  config_costos: () => ({}),
};
const PK = { producto_costos: 'producto_id', venta_costos: 'venta_id', trabajo_costos: 'trabajo_id' };
const pkOf = (t) => PK[t] || 'id';

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = 'select';
    this.cols = '*';
    this.orders = [];
    this.lim = null;
    this.one = null;
    this.payload = null;
  }
  select(cols = '*') { if (this.op === 'select') this.cols = cols; else this.returnCols = cols; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
  gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
  lt(c, v) { this.filters.push((r) => r[c] < v); return this; }
  order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }

  run() {
    load();
    const t = this.table;
    const rows = db[t] || (db[t] = []);
    if (this.op === 'select') {
      if (ADMIN_READ.includes(t) && !isAdmin()) return this.wrap([]);
      let out = rows.filter((r) => visible(t, r) && this.filters.every((f) => f(r)));
      for (const [c, asc] of [...this.orders].reverse()) {
        out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (this.lim != null) out = out.slice(0, this.lim);
      return this.wrap(out.map((r) => project(t, r, this.cols)));
    }
    if (ADMIN_WRITE.includes(t) && !isAdmin()) return fail('permission denied for table ' + t);
    if (t === 'cierres' && !isAdmin() && [].concat(this.payload || []).some((p) => p.tipo !== 'diario')) return fail('Solo el administrador hace el cierre semanal');
    let changed = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      for (const p of [].concat(this.payload)) {
        const pk = pkOf(t);
        const prev = this.op === 'upsert' && p[pk] != null ? rows.find((r) => String(r[pk]) === String(p[pk])) : null;
        if (prev) { Object.assign(prev, p); onWrite(t, prev); changed.push(prev); } else {
          const row = { ...(DEFAULTS[t]?.() || { id: uuid(), creado: now() }), ...p };
          onWrite(t, row);
          rows.push(row);
          changed.push(row);
        }
      }
    } else if (this.op === 'update') {
      changed = rows.filter((r) => visible(t, r) && this.filters.every((f) => f(r)));
      changed.forEach((r) => { Object.assign(r, this.payload); onWrite(t, r); });
    } else if (this.op === 'delete') {
      changed = rows.filter((r) => visible(t, r) && this.filters.every((f) => f(r)));
      db[t] = rows.filter((r) => !changed.includes(r));
      if (t === 'trabajos') db.trabajo_abonos = db.trabajo_abonos.filter((a) => !changed.some((x) => x.id === a.trabajo_id));
      if (t === 'productos') db.producto_costos = db.producto_costos.filter((c) => !changed.some((p) => p.id === c.producto_id));
    }
    save();
    return this.wrap(changed.map((r) => project(t, r, this.returnCols || '*')));
  }

  wrap(list) {
    if (this.one === 'single') return list.length === 1 ? { data: list[0], error: null } : fail('No se encontró el registro');
    if (this.one === 'maybe') return { data: list[0] ?? null, error: null };
    return { data: list, error: null };
  }
}

// The four server functions of schema.sql, same rules.
const RPC = {
  registrar_venta({ p }) {
    const pub = db.config_publica[0]?.datos || {};
    const cst = db.config_costos[0]?.datos || {};
    if (!p?.items?.length) throw new Error('La venta no tiene items');
    let total = 0;
    let costoTotal = 0;
    const items = p.items.map((src) => {
      const it = { ...src };
      const cant = toNum(it.cant);
      if (cant <= 0) throw new Error('Cantidad inválida');
      let costo = 0;
      if (it.tipo === 'imp') {
        const sus = pub.sustratos.find((s) => s.id === it.det?.sus) || {};
        const tam = pub.tamanos.find((x) => x.id === sus.tamano) || { clics: 1, piezas: 1 };
        const papel = sus.corriente ? toNum(cst.gramajes?.[it.det?.gram]) : toNum(cst.sustratos?.[it.det?.sus]);
        costo = cant * (toNum(cst.costoClic) * tam.clics + papel / Math.max(tam.piezas || 1, 1)) + toNum(it.det?.plast) * toNum(cst.plastificadoCosto);
        it.clics = cant * tam.clics;
      } else if (it.productoId) {
        costo = cant * toNum(db.producto_costos.find((c) => c.producto_id === it.productoId)?.costo);
        if (it.tipo === 'prod') {
          const prod = db.productos.find((x) => x.id === it.productoId && x.tipo === 'propio');
          if (prod) prod.stock = toNum(prod.stock) - cant;
        }
      } else if (isAdmin() && 'costoManual' in it) costo = cant * toNum(it.costoManual);
      delete it.costoManual;
      total += toNum(it.total);
      costoTotal += Math.round(costo);
      return it;
    });
    const nombre = String(p.cliente || '').trim();
    let tel = String(p.telefono || '').trim();
    let clienteId = null;
    if (nombre) {
      const key = nombre.toLowerCase();
      let c = db.clientes.find((x) => x.nombre_key === key);
      if (c) { if (tel) c.telefono = tel; } else {
        c = { id: uuid(), nombre, nombre_key: key, telefono: tel, creado: p._creado || now() };
        db.clientes.push(c);
      }
      clienteId = c.id;
      tel = c.telefono;
    }
    const pago = p.pago || 'efectivo';
    const abonado = pago === 'credito' ? Math.min(Math.max(toNum(p.abono), 0), total) : total;
    const fecha = p.fecha || today();
    const v = {
      id: uuid(), numero: ++db.seq, fecha, creado: p._creado || now(), cliente_id: clienteId, cliente: nombre || 'Cliente de mostrador',
      telefono: tel, items, total, pago, abonado, saldo: total - abonado, nota: String(p.nota || '').trim(), vendedor_id: p._vendedor || me().id, fe: !!p.fe,
    };
    db.ventas.push(v);
    db.venta_costos.push({ venta_id: v.id, costo: costoTotal });
    if (abonado > 0) {
      db.abonos.push({ id: uuid(), venta_id: v.id, fecha, monto: abonado, pago: pago === 'credito' ? p.pagoAbono || 'efectivo' : pago, usuario_id: v.vendedor_id, creado: v.creado });
    }
    return v;
  },
  registrar_abono({ p_venta, p_monto, p_pago, p_fecha }) {
    const v = db.ventas.find((x) => x.id === p_venta);
    if (!v) throw new Error('Venta no encontrada');
    const m = Math.min(toNum(p_monto), toNum(v.saldo));
    if (m <= 0) throw new Error('Abono inválido');
    db.abonos.push({ id: uuid(), venta_id: v.id, fecha: p_fecha || today(), monto: m, pago: p_pago, usuario_id: me().id, creado: now() });
    v.abonado += m;
    v.saldo -= m;
    return v;
  },
  // Payment towards a custom job (cotizador). Private jobs only accept payments from the admin.
  abonar_trabajo({ p_trabajo, p_monto, p_pago, p_fecha }) {
    const t = db.trabajos.find((x) => x.id === p_trabajo);
    if (!t || !visible('trabajos', t)) throw new Error('Trabajo no encontrado');
    const m = Math.min(toNum(p_monto), toNum(t.saldo));
    if (m <= 0) throw new Error('Abono inválido');
    db.trabajo_abonos.push({ id: uuid(), trabajo_id: t.id, fecha: p_fecha || today(), monto: m, pago: p_pago, usuario_id: me().id, creado: now() });
    t.abonado = toNum(t.abonado) + m;
    t.saldo = toNum(t.total) - toNum(t.retencion) - t.abonado;
    return t;
  },
  anular_venta({ p_venta }) {
    if (!isAdmin()) throw new Error('Solo el administrador puede anular ventas');
    const v = db.ventas.find((x) => x.id === p_venta);
    if (!v) return null;
    for (const it of v.items) {
      const prod = it.tipo === 'prod' && db.productos.find((x) => x.id === it.productoId && x.tipo === 'propio');
      if (prod) prod.stock = toNum(prod.stock) + toNum(it.cant);
    }
    db.ventas = db.ventas.filter((x) => x.id !== v.id);
    db.venta_costos = db.venta_costos.filter((x) => x.venta_id !== v.id);
    db.abonos = db.abonos.filter((x) => x.venta_id !== v.id);
    return null;
  },
  entrada_stock({ p_producto, p_cant, p_costo }) {
    if (!isAdmin()) throw new Error('Solo el administrador');
    const prod = db.productos.find((x) => x.id === p_producto);
    if (prod) prod.stock = toNum(prod.stock) + toNum(p_cant);
    if (p_costo != null) {
      const c = db.producto_costos.find((x) => x.producto_id === p_producto);
      if (c) c.costo = p_costo; else db.producto_costos.push({ producto_id: p_producto, costo: p_costo });
    }
    return null;
  },
};

const authListeners = new Set();
const session = () => (signedIn ? { user: { id: me().id, email: me().email } } : null);
const emitAuth = () => authListeners.forEach((fn) => fn(signedIn ? 'SIGNED_IN' : 'SIGNED_OUT', session()));
const setSignedIn = (v) => { signedIn = v; store.set(SESSION_KEY, v ? '1' : '0'); emitAuth(); };

const channel = () => {
  const ch = { on: () => ch, subscribe: () => ch };
  return ch;
};

export const api = {
  rpc(name, args) {
    load();
    try {
      const data = RPC[name](args || {});
      save();
      return Promise.resolve({ data: data ? clone(data) : null, error: null });
    } catch (e) {
      return Promise.resolve(fail(e.message));
    }
  },
  // Used while building the sample data, before the store exists.
  seedRpc(target, name, args) {
    const prev = db;
    db = target;
    try { return RPC[name](args); } finally { db = prev; }
  },
};

export const demoClient = {
  from: (t) => new Query(t),
  rpc: api.rpc,
  channel,
  removeChannel: () => {},
  auth: {
    getSession: () => Promise.resolve({ data: { session: session() } }),
    onAuthStateChange: (fn) => {
      authListeners.add(fn);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(fn) } } };
    },
    // Two sample users, both with the password DEMO_PASS.
    signOut: () => { setSignedIn(false); return Promise.resolve({ error: null }); },
    signInWithPassword: ({ email, password }) => {
      const r = Object.keys(USUARIOS).find((k) => USUARIOS[k].email === String(email || '').trim().toLowerCase());
      if (!r || password !== DEMO_PASS) return Promise.resolve({ data: { session: null }, error: { message: 'Invalid login credentials' } });
      rol = r;
      store.set(ROLE_KEY, r);
      setSignedIn(true);
      return Promise.resolve({ data: { session: session() }, error: null });
    },
    signUp: () => Promise.resolve({ data: { session: null }, error: { message: 'En la demo usa una de las dos cuentas de ejemplo.' } }),
    resetPasswordForEmail: () => Promise.resolve({ error: null }),
  },
};

export const demo = {
  get rol() { return rol; },
  setRol(r) {
    rol = r;
    store.set(ROLE_KEY, r);
    emitAuth();
    window.dispatchEvent(new CustomEvent('db-change', { detail: ['perfiles', 'ventas', 'productos', 'abonos', 'clientes', 'contador', 'trabajos', 'trabajo_abonos', 'cierres', 'aperturas', 'gastos', 'conteos'] }));
  },
  reset() {
    store.del(KEY);
    db = null;
    load();
    window.location.hash = '#/';
    window.location.reload();
  },
};

