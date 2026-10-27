// Servidor de Ecoglobal Caja para Railway.
// Hace lo que Supabase hacía: crea la base de datos al arrancar, maneja las cuentas
// (registro, inicio de sesión y sesiones) y publica la API de datos con PostgREST.
// La app web (Vercel) le habla igual que a Supabase, así que no cambia nada en ella.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SQL = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const PORT = Number(process.env.PORT || 8080);
const PGRST_PORT = 3001;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('Falta la variable DATABASE_URL (la de la base Postgres de Railway).'); process.exit(1); }
const ssl = /sslmode=require/.test(DATABASE_URL) || process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined;
const db = new pg.Pool({ connectionString: DATABASE_URL, ssl, max: 5 });

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
let SECRET = '';
const sign = (p) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64(p); return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; };
const verify = (t) => {
  try {
    const [h, b, s] = String(t).split('.');
    const ok = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
    if (!s || ok.length !== s.length || !crypto.timingSafeEqual(Buffer.from(ok), Buffer.from(s))) return null;
    const c = JSON.parse(Buffer.from(b, 'base64url'));
    return c.exp && c.exp < Date.now() / 1000 ? null : c;
  } catch { return null; }
};
let ANON = '';

async function ajuste(clave, crear) {
  const { rows } = await db.query('select valor from auth.ajustes where clave = $1', [clave]);
  if (rows[0]) return rows[0].valor;
  const valor = crear();
  await db.query('insert into auth.ajustes (clave, valor) values ($1, $2) on conflict (clave) do nothing', [clave, valor]);
  return (await db.query('select valor from auth.ajustes where clave = $1', [clave])).rows[0].valor;
}

// Crea o actualiza la base: roles y usuarios, el esquema del sistema y, la primera vez, el catálogo.
async function instalar() {
  await db.query(SQL('bootstrap.sql'));
  await db.query(SQL('../supabase/schema.sql'));
  await db.query(SQL('bootstrap.sql'));
  const hecho = (await db.query("select 1 from auth.ajustes where clave = 'catalogo'")).rowCount;
  const vacio = (await db.query('select count(*)::int n from public.productos')).rows[0].n === 0;
  if (!hecho && vacio) {
    await db.query(SQL('../supabase/catalogo_publiinsumos.sql'));
    await db.query(SQL('../supabase/catalogo_laminas.sql'));
    console.log('Catálogo inicial cargado.');
  }
  await db.query("insert into auth.ajustes (clave, valor) values ('catalogo', 'si') on conflict do nothing");
  SECRET = await ajuste('jwt_secret', () => crypto.randomBytes(48).toString('base64url'));
  const clave = await ajuste('authenticator_password', () => crypto.randomBytes(24).toString('hex'));
  await db.query(`alter role authenticator with login password '${clave.replace(/'/g, "''")}'`);
  ANON = sign({ role: 'anon', iss: 'ecoglobal', exp: 4102444800 });
  return clave;
}

function iniciarPostgrest(clave) {
  const u = new URL(DATABASE_URL);
  u.username = 'authenticator';
  u.password = clave;
  const bin = process.env.POSTGREST_BIN || 'postgrest';
  const p = spawn(bin, [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGRST_DB_URI: u.toString(),
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: SECRET,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(PGRST_PORT),
      PGRST_DB_POOL: '10',
    },
  });
  p.on('exit', (code) => { console.error('PostgREST se detuvo con código', code); process.exit(1); });
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { p.kill(); process.exit(0); });
}

// ---------- Cuentas (mismas rutas y respuestas que Supabase Auth) ----------
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.raw_user_meta_data || {}, app_metadata: { provider: 'email' }, created_at: u.created_at, email_confirmed_at: u.created_at });
async function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const rt = crypto.randomBytes(32).toString('base64url');
  await db.query('insert into auth.refresh_tokens (token, user_id) values ($1, $2)', [rt, u.id]);
  return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: now + 3600, iat: now }), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userObj(u) };
}
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*' };
const send = (res, code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const authErr = (res, code, msg, error_code) => send(res, code, { code, error_code, msg, error: error_code, error_description: msg });

// Pausa corta tras una contraseña equivocada, para frenar a quien intente adivinarla.
const espera = () => new Promise((r) => setTimeout(r, 600));

async function auth(req, res, ruta, url) {
  if (ruta === '/signup' && req.method === 'POST') {
    const b = await body(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authErr(res, 422, 'Unable to validate email address: invalid format', 'validation_failed');
    if (!b.password || String(b.password).length < 6) return authErr(res, 422, 'Password should be at least 6 characters', 'weak_password');
    try {
      const { rows } = await db.query("insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, crypt($2, gen_salt('bf')), $3) returning *", [email, String(b.password), b.data || {}]);
      return send(res, 200, await session(rows[0]));
    } catch (e) {
      if (e.code === '23505') return authErr(res, 422, 'User already registered', 'user_already_exists');
      throw e;
    }
  }
  if (ruta === '/token' && req.method === 'POST') {
    const b = await body(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows: [u] } = await db.query('select * from auth.users where email = $1 and encrypted_password = crypt($2, encrypted_password)', [String(b.email || '').trim().toLowerCase(), String(b.password || '')]);
      if (!u) { await espera(); return authErr(res, 400, 'Invalid login credentials', 'invalid_credentials'); }
      return send(res, 200, await session(u));
    }
    if (grant === 'refresh_token') {
      const { rows: [t] } = await db.query('delete from auth.refresh_tokens where token = $1 returning user_id', [String(b.refresh_token || '')]);
      if (!t) return authErr(res, 400, 'Invalid Refresh Token: Refresh Token Not Found', 'refresh_token_not_found');
      const { rows: [u] } = await db.query('select * from auth.users where id = $1', [t.user_id]);
      if (!u) return authErr(res, 400, 'User not found', 'user_not_found');
      return send(res, 200, await session(u));
    }
    return authErr(res, 400, 'Unsupported grant type', 'unsupported_grant_type');
  }
  if (ruta === '/user') {
    const c = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!c?.sub) return authErr(res, 401, 'Invalid token', 'bad_jwt');
    const { rows: [u] } = await db.query('select * from auth.users where id = $1', [c.sub]);
    if (!u) return authErr(res, 404, 'User not found', 'user_not_found');
    return send(res, 200, userObj(u));
  }
  if (ruta === '/logout') {
    const c = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (c?.sub) await db.query('delete from auth.refresh_tokens where user_id = $1', [c.sub]);
    res.writeHead(204, cors); return res.end();
  }
  if (ruta === '/recover') return authErr(res, 400, 'Sin correo de recuperación: pídele al administrador que te ponga una contraseña nueva en Usuarios.', 'no_email');
  return authErr(res, 404, 'Not found', 'not_found');
}

function proxy(req, res, ruta) {
  const headers = { ...req.headers };
  delete headers.host;
  // Sin sesión, la app manda su clave pública: la API la atiende como visitante anónimo.
  const c = verify((headers.authorization || '').replace(/^Bearer /, ''));
  if (!c) headers.authorization = `Bearer ${ANON}`;
  const p = http.request({ host: '127.0.0.1', port: PGRST_PORT, path: ruta, method: req.method, headers }, (pr) => {
    const h = { ...pr.headers };
    for (const k of Object.keys(h)) if (k.startsWith('access-control')) delete h[k];
    res.writeHead(pr.statusCode, { ...h, ...cors });
    pr.pipe(res);
  });
  p.on('error', () => send(res, 503, { message: 'La base de datos está arrancando, intenta de nuevo en unos segundos.' }));
  req.pipe(p);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/rest/v1/')) return proxy(req, res, url.pathname.slice(8) + url.search);
    if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url.pathname.slice(8), url);
    if (url.pathname === '/' || url.pathname === '/salud') return send(res, 200, { ok: true, app: 'Ecoglobal Caja' });
    return send(res, 404, { message: 'Not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { message: 'Error del servidor' });
  }
});
// Tiempo real no está disponible en este servidor: la app sigue funcionando y se actualiza al navegar.
server.on('upgrade', (_req, socket) => socket.destroy());

instalar()
  .then((clave) => {
    iniciarPostgrest(clave);
    server.listen(PORT, '0.0.0.0', () => console.log(`Ecoglobal Caja servidor listo en el puerto ${PORT}`));
  })
  .catch((e) => { console.error('No se pudo preparar la base de datos:', e); process.exit(1); });
