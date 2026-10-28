-- Publiinsumos Caja: esquema completo de Supabase.
-- Ejecútalo una sola vez en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

-- ============================================================
-- Usuarios y roles
-- ============================================================
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  email text not null default '',
  rol text not null default 'vendedor' check (rol in ('admin', 'vendedor')),
  activo boolean not null default false,
  creado timestamptz not null default now()
);

create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select activo from perfiles where id = auth.uid()), false);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select activo and rol = 'admin' from perfiles where id = auth.uid()), false);
$$;

-- El primer usuario que se registra queda como administrador activo.
-- Los siguientes quedan como vendedores pendientes hasta que el admin los active.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hay_admin boolean;
begin
  select exists(select 1 from perfiles where rol = 'admin') into hay_admin;
  insert into perfiles (id, nombre, email, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    case when hay_admin then 'vendedor' else 'admin' end,
    not hay_admin
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- ============================================================
-- Configuración (precios visibles para todos, costos solo admin)
-- ============================================================
create table if not exists public.config_publica (
  id int primary key default 1 check (id = 1),
  datos jsonb not null,
  actualizado timestamptz not null default now()
);

create table if not exists public.config_costos (
  id int primary key default 1 check (id = 1),
  datos jsonb not null,
  actualizado timestamptz not null default now()
);

-- ============================================================
-- Inventario, clientes, ventas
-- ============================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default '',
  tipo text not null default 'propio' check (tipo in ('propio', 'tercerizado')),
  proveedor text not null default '',
  precio numeric not null default 0,
  stock numeric,
  stock_min numeric not null default 0,
  unidad text not null default 'und',
  creado timestamptz not null default now()
);

create table if not exists public.producto_costos (
  producto_id uuid primary key references public.productos on delete cascade,
  costo numeric not null default 0
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_key text generated always as (lower(btrim(nombre))) stored unique,
  telefono text not null default '',
  creado timestamptz not null default now()
);

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  numero bigserial unique,
  fecha date not null,
  creado timestamptz not null default now(),
  cliente_id uuid references public.clientes on delete set null,
  cliente text not null default '',
  telefono text not null default '',
  items jsonb not null default '[]',
  total numeric not null default 0,
  pago text not null check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia', 'credito')),
  abonado numeric not null default 0,
  saldo numeric not null default 0,
  nota text not null default '',
  vendedor_id uuid references public.perfiles on delete set null,
  fe boolean not null default false
);
create index if not exists ventas_fecha_idx on public.ventas (fecha);
create index if not exists ventas_saldo_idx on public.ventas (saldo) where saldo > 0;

create table if not exists public.venta_costos (
  venta_id uuid primary key references public.ventas on delete cascade,
  costo numeric not null default 0
);

create table if not exists public.abonos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas on delete cascade,
  fecha date not null,
  monto numeric not null check (monto > 0),
  pago text not null check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia')),
  usuario_id uuid references public.perfiles on delete set null,
  creado timestamptz not null default now()
);
create index if not exists abonos_venta_idx on public.abonos (venta_id);
create index if not exists abonos_fecha_idx on public.abonos (fecha);

create table if not exists public.contador (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'general' check (tipo in ('general', 'color', 'bn')),
  inicio date not null,
  contador_inicial bigint not null,
  fin date not null,
  contador_final bigint not null check (contador_final >= contador_inicial),
  creado timestamptz not null default now()
);

-- ============================================================
-- Versión 2: medios de pago Bancolombia y Nequi, F-E, contador por color,
-- cotizador personalizado con cartera privada y cierres de caja.
-- Estas líneas también actualizan una base creada con la versión anterior.
-- ============================================================
alter table public.ventas add column if not exists fe boolean not null default false;
alter table public.contador add column if not exists tipo text not null default 'general';
alter table public.ventas drop constraint if exists ventas_pago_check;
alter table public.ventas add constraint ventas_pago_check check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia', 'credito'));
alter table public.abonos drop constraint if exists abonos_pago_check;
alter table public.abonos add constraint abonos_pago_check check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia'));
alter table public.contador drop constraint if exists contador_tipo_check;
alter table public.contador add constraint contador_tipo_check check (tipo in ('general', 'color', 'bn'));

-- Trabajos personalizados (cotizador). privado = del administrador: el vendedor no los ve.
create table if not exists public.trabajos (
  id uuid primary key default gen_random_uuid(),
  numero bigserial unique,
  fecha date not null default current_date,
  cliente text not null default '',
  telefono text not null default '',
  titulo text not null default '',
  lineas jsonb not null default '[]',
  descuento numeric not null default 0,
  total numeric not null default 0,
  estado text not null default 'cotizacion' check (estado in ('cotizacion', 'aprobado', 'entregado', 'vendido', 'anulado')),
  privado boolean not null default false,
  abonado numeric not null default 0,
  saldo numeric not null default 0,
  nota text not null default '',
  entrega date,
  venta_id uuid references public.ventas on delete set null,
  usuario_id uuid references public.perfiles on delete set null default auth.uid(),
  creado timestamptz not null default now()
);
create index if not exists trabajos_estado_idx on public.trabajos (estado);

-- Costo de cada línea (solo administrador), en el mismo orden de trabajos.lineas.
create table if not exists public.trabajo_costos (
  trabajo_id uuid primary key references public.trabajos on delete cascade,
  costos jsonb not null default '[]'
);

create table if not exists public.trabajo_abonos (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references public.trabajos on delete cascade,
  fecha date not null,
  monto numeric not null check (monto > 0),
  pago text not null check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia')),
  usuario_id uuid references public.perfiles on delete set null,
  creado timestamptz not null default now()
);
create index if not exists tabonos_trabajo_idx on public.trabajo_abonos (trabajo_id);
create index if not exists tabonos_fecha_idx on public.trabajo_abonos (fecha);

-- Cierres de caja guardados (diario lo puede hacer el vendedor; semanal solo el administrador).
create table if not exists public.cierres (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diario', 'semanal')),
  desde date not null,
  hasta date not null,
  base numeric not null default 0,
  efectivo_contado numeric,
  nota text not null default '',
  resumen jsonb not null default '{}',
  usuario_id uuid references public.perfiles on delete set null default auth.uid(),
  creado timestamptz not null default now()
);

-- ============================================================
-- Versión 3: clientes con forma de pago, cotizaciones con instalación,
-- retenciones y validación de envío, apertura de caja con dos bases,
-- gastos, conteo inicial de inventario y cierres de la cartera privada.
-- Estas líneas también actualizan una base creada con una versión anterior.
-- ============================================================
-- Fecha de hoy en Colombia (el servidor de Supabase trabaja en UTC).
create or replace function public.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

alter table public.clientes add column if not exists nit text not null default '';
alter table public.clientes add column if not exists correo text not null default '';
alter table public.clientes add column if not exists direccion text not null default '';
alter table public.clientes add column if not exists forma_pago text;
alter table public.clientes add column if not exists saldo_a text not null default '';

alter table public.trabajos add column if not exists nit text not null default '';
alter table public.trabajos add column if not exists forma_pago text;
alter table public.trabajos add column if not exists saldo_a text not null default '';
alter table public.trabajos add column if not exists instalacion text not null default 'sin';
alter table public.trabajos add column if not exists dias_entrega int;
alter table public.trabajos add column if not exists condiciones text not null default '';
alter table public.trabajos add column if not exists retenciones jsonb not null default '[]';
alter table public.trabajos add column if not exists retencion numeric not null default 0;
alter table public.trabajos add column if not exists enviada date;

-- Versión 4: sucursales de cada cliente y la sucursal de cada cotización.
alter table public.clientes add column if not exists sucursales jsonb not null default '[]';
alter table public.trabajos add column if not exists sucursal text not null default '';

alter table public.cierres add column if not exists ambito text not null default 'tienda';
alter table public.cierres add column if not exists base_impresion numeric;
alter table public.cierres add column if not exists base_insumos numeric;
alter table public.cierres add column if not exists contado_impresion numeric;
alter table public.cierres add column if not exists contado_insumos numeric;
alter table public.cierres drop constraint if exists cierres_ambito_check;
alter table public.cierres add constraint cierres_ambito_check check (ambito in ('tienda', 'privado'));

-- Apertura de la caja de cada día: base de la caja de impresión láser y de la de insumos.
create table if not exists public.aperturas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  base_impresion numeric not null default 0,
  base_insumos numeric not null default 0,
  usuario_id uuid references public.perfiles on delete set null default auth.uid(),
  creado timestamptz not null default now()
);

-- Gastos del negocio. Los de efectivo dicen de qué caja salió la plata.
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default public.hoy(),
  concepto text not null,
  categoria text not null default 'Otro',
  monto numeric not null check (monto > 0),
  pago text not null check (pago in ('efectivo', 'bancolombia', 'nequi', 'transferencia')),
  caja text check (caja in ('impresion', 'insumos')),
  nota text not null default '',
  usuario_id uuid references public.perfiles on delete set null default auth.uid(),
  creado timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on public.gastos (fecha);

-- Conteos de inventario (el conteo inicial del día de arranque y los siguientes).
create table if not exists public.conteos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default public.hoy(),
  contados int not null default 0,
  cambios int not null default 0,
  items jsonb not null default '[]',
  ceros boolean not null default false,
  usuario_nombre text not null default '',
  usuario_id uuid references public.perfiles on delete set null default auth.uid(),
  creado timestamptz not null default now()
);

-- ============================================================
-- Seguridad por filas
-- ============================================================
alter table public.aperturas enable row level security;
alter table public.gastos enable row level security;
alter table public.conteos enable row level security;

drop policy if exists aperturas_leer on public.aperturas;
create policy aperturas_leer on public.aperturas for select using (public.es_activo());
drop policy if exists aperturas_crear on public.aperturas;
create policy aperturas_crear on public.aperturas for insert with check (public.es_activo());
drop policy if exists aperturas_editar on public.aperturas;
create policy aperturas_editar on public.aperturas for update using (public.es_activo()) with check (public.es_activo());
drop policy if exists aperturas_borrar on public.aperturas;
create policy aperturas_borrar on public.aperturas for delete using (public.es_admin());

-- El vendedor registra gastos y solo puede borrar los suyos del mismo día; el administrador, todos.
drop policy if exists gastos_leer on public.gastos;
create policy gastos_leer on public.gastos for select using (public.es_activo());
drop policy if exists gastos_crear on public.gastos;
create policy gastos_crear on public.gastos for insert with check (public.es_activo());
drop policy if exists gastos_borrar on public.gastos;
create policy gastos_borrar on public.gastos for delete using (public.es_admin() or (public.es_activo() and usuario_id = auth.uid() and fecha = public.hoy()));
drop policy if exists gastos_admin on public.gastos;
create policy gastos_admin on public.gastos for update using (public.es_admin()) with check (public.es_admin());

drop policy if exists conteos_leer on public.conteos;
create policy conteos_leer on public.conteos for select using (public.es_activo());
drop policy if exists conteos_admin on public.conteos;
create policy conteos_admin on public.conteos for insert with check (public.es_admin());
alter table public.perfiles enable row level security;
alter table public.config_publica enable row level security;
alter table public.config_costos enable row level security;
alter table public.productos enable row level security;
alter table public.producto_costos enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_costos enable row level security;
alter table public.abonos enable row level security;
alter table public.contador enable row level security;
alter table public.trabajos enable row level security;
alter table public.trabajo_costos enable row level security;
alter table public.trabajo_abonos enable row level security;
alter table public.cierres enable row level security;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select using (id = auth.uid() or public.es_activo());
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update using (public.es_admin()) with check (public.es_admin());

drop policy if exists cfgpub_leer on public.config_publica;
create policy cfgpub_leer on public.config_publica for select using (public.es_activo());
drop policy if exists cfgpub_admin on public.config_publica;
create policy cfgpub_admin on public.config_publica for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists cfgcost_admin on public.config_costos;
create policy cfgcost_admin on public.config_costos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists productos_leer on public.productos;
create policy productos_leer on public.productos for select using (public.es_activo());
drop policy if exists productos_admin on public.productos;
create policy productos_admin on public.productos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists pcostos_admin on public.producto_costos;
create policy pcostos_admin on public.producto_costos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists clientes_leer on public.clientes;
create policy clientes_leer on public.clientes for select using (public.es_activo());
drop policy if exists clientes_admin on public.clientes;
drop policy if exists clientes_crear on public.clientes;
create policy clientes_crear on public.clientes for insert with check (public.es_activo());
drop policy if exists clientes_editar on public.clientes;
create policy clientes_editar on public.clientes for update using (public.es_activo()) with check (public.es_activo());
drop policy if exists clientes_borrar on public.clientes;
create policy clientes_borrar on public.clientes for delete using (public.es_admin());

drop policy if exists ventas_leer on public.ventas;
create policy ventas_leer on public.ventas for select using (public.es_activo());

drop policy if exists vcostos_admin on public.venta_costos;
create policy vcostos_admin on public.venta_costos for select using (public.es_admin());

drop policy if exists abonos_leer on public.abonos;
create policy abonos_leer on public.abonos for select using (public.es_activo());

drop policy if exists contador_admin on public.contador;
create policy contador_admin on public.contador for all using (public.es_admin()) with check (public.es_admin());

-- Trabajos: todos los activos ven y editan los de la tienda; los privados solo el administrador.
drop policy if exists trabajos_leer on public.trabajos;
create policy trabajos_leer on public.trabajos for select using (public.es_activo() and (not privado or public.es_admin()));
drop policy if exists trabajos_crear on public.trabajos;
create policy trabajos_crear on public.trabajos for insert with check (public.es_activo() and (not privado or public.es_admin()));
drop policy if exists trabajos_editar on public.trabajos;
create policy trabajos_editar on public.trabajos for update using (public.es_activo() and (not privado or public.es_admin())) with check (not privado or public.es_admin());
drop policy if exists trabajos_borrar on public.trabajos;
create policy trabajos_borrar on public.trabajos for delete using (public.es_admin());

drop policy if exists tcostos_admin on public.trabajo_costos;
create policy tcostos_admin on public.trabajo_costos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists tabonos_leer on public.trabajo_abonos;
create policy tabonos_leer on public.trabajo_abonos for select using (
  public.es_activo() and exists (select 1 from public.trabajos t where t.id = trabajo_id and (not t.privado or public.es_admin()))
);

drop policy if exists cierres_leer on public.cierres;
create policy cierres_leer on public.cierres for select using (public.es_activo() and (ambito <> 'privado' or public.es_admin()));
drop policy if exists cierres_crear on public.cierres;
create policy cierres_crear on public.cierres for insert with check (public.es_activo() and ((tipo = 'diario' and ambito = 'tienda') or public.es_admin()));
drop policy if exists cierres_admin on public.cierres;
create policy cierres_admin on public.cierres for delete using (public.es_admin());

-- ============================================================
-- Operaciones (cada una se ejecuta completa o no se ejecuta)
-- ============================================================

-- Registra una venta: guarda la venta, calcula clics y costos en el servidor,
-- descuenta inventario, guarda el cliente y el abono inicial.
create or replace function public.registrar_venta(p jsonb) returns public.ventas
language plpgsql security definer set search_path = public as $$
declare
  pub jsonb;
  cst jsonb;
  it jsonb;
  items_out jsonb := '[]'::jsonb;
  v_sus jsonb;
  v_tam jsonb;
  v_cant numeric;
  v_plast numeric;
  v_papel numeric;
  v_clics numeric;
  v_costo numeric;
  v_cclic numeric;
  v_total numeric := 0;
  v_costo_total numeric := 0;
  v_abonado numeric;
  v_cliente_id uuid;
  v_nombre text := nullif(btrim(coalesce(p->>'cliente', '')), '');
  v_tel text := btrim(coalesce(p->>'telefono', ''));
  v_pago text := coalesce(p->>'pago', 'efectivo');
  v_fecha date := coalesce((p->>'fecha')::date, current_date);
  v_venta ventas;
begin
  if not es_activo() then raise exception 'Usuario sin acceso'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'La venta no tiene items'; end if;

  select datos into pub from config_publica where id = 1;
  select datos into cst from config_costos where id = 1;
  pub := coalesce(pub, '{}'); cst := coalesce(cst, '{}');

  for it in select * from jsonb_array_elements(p->'items') loop
    v_cant := coalesce((it->>'cant')::numeric, 0);
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    v_costo := 0;
    if it->>'tipo' = 'imp' then
      select s into v_sus from jsonb_array_elements(pub->'sustratos') s where s->>'id' = it->'det'->>'sus';
      select t into v_tam from jsonb_array_elements(pub->'tamanos') t where t->>'id' = v_sus->>'tamano';
      v_plast := coalesce((it->'det'->>'plast')::numeric, 0);
      v_clics := v_cant * coalesce((v_tam->>'clics')::numeric, 1);
      if coalesce((v_sus->>'corriente')::boolean, false) then
        v_papel := coalesce((cst->'gramajes'->>(it->'det'->>'gram'))::numeric, 0);
      else
        v_papel := coalesce((cst->'sustratos'->>(it->'det'->>'sus'))::numeric, 0);
      end if;
      -- Clic a color o B/N con su propio costo si está configurado; si no, el costo general.
      v_cclic := coalesce(nullif((cst->>(case when coalesce((it->'det'->>'color')::boolean, false) then 'costoClicColor' else 'costoClicBN' end))::numeric, 0),
                          (cst->>'costoClic')::numeric, 0);
      v_costo := v_cant * (v_cclic * coalesce((v_tam->>'clics')::numeric, 1)
                 + v_papel / greatest(coalesce((v_tam->>'piezas')::numeric, 1), 1))
                 + v_plast * coalesce((cst->>'plastificadoCosto')::numeric, 0);
      it := it || jsonb_build_object('clics', v_clics);
    elsif it->>'productoId' is not null and it->>'productoId' <> '' then
      v_costo := v_cant * coalesce((select costo from producto_costos where producto_id = (it->>'productoId')::uuid), 0);
      if it->>'tipo' = 'prod' then
        update productos set stock = coalesce(stock, 0) - v_cant
          where id = (it->>'productoId')::uuid and tipo = 'propio';
      end if;
    elsif es_admin() and it ? 'costoManual' then
      v_costo := v_cant * coalesce((it->>'costoManual')::numeric, 0);
    end if;
    it := it - 'costoManual';
    v_total := v_total + coalesce((it->>'total')::numeric, 0);
    v_costo_total := v_costo_total + round(v_costo);
    items_out := items_out || jsonb_build_array(it);
  end loop;

  if v_nombre is not null then
    insert into clientes (nombre, telefono) values (v_nombre, v_tel)
    on conflict (nombre_key) do update set telefono = coalesce(nullif(excluded.telefono, ''), clientes.telefono)
    returning id, telefono into v_cliente_id, v_tel;
  end if;

  v_abonado := case when v_pago = 'credito' then least(greatest(coalesce((p->>'abono')::numeric, 0), 0), v_total) else v_total end;

  insert into ventas (fecha, cliente_id, cliente, telefono, items, total, pago, abonado, saldo, nota, vendedor_id, fe)
  values (v_fecha, v_cliente_id, coalesce(v_nombre, 'Cliente de mostrador'), v_tel, items_out, v_total, v_pago,
          v_abonado, v_total - v_abonado, btrim(coalesce(p->>'nota', '')), auth.uid(), coalesce((p->>'fe')::boolean, false))
  returning * into v_venta;

  insert into venta_costos (venta_id, costo) values (v_venta.id, v_costo_total);
  if v_abonado > 0 then
    insert into abonos (venta_id, fecha, monto, pago, usuario_id)
    values (v_venta.id, v_fecha, v_abonado, case when v_pago = 'credito' then coalesce(p->>'pagoAbono', 'efectivo') else v_pago end, auth.uid());
  end if;
  return v_venta;
end;
$$;

-- Registra un abono a una venta a crédito.
create or replace function public.registrar_abono(p_venta uuid, p_monto numeric, p_pago text, p_fecha date) returns public.ventas
language plpgsql security definer set search_path = public as $$
declare
  v ventas;
  m numeric;
begin
  if not es_activo() then raise exception 'Usuario sin acceso'; end if;
  select * into v from ventas where id = p_venta for update;
  if v.id is null then raise exception 'Venta no encontrada'; end if;
  m := least(p_monto, v.saldo);
  if m <= 0 then raise exception 'Abono inválido'; end if;
  insert into abonos (venta_id, fecha, monto, pago, usuario_id) values (v.id, coalesce(p_fecha, current_date), m, p_pago, auth.uid());
  update ventas set abonado = abonado + m, saldo = saldo - m where id = v.id returning * into v;
  return v;
end;
$$;

-- Abono a un trabajo personalizado. Los privados solo los abona el administrador.
create or replace function public.abonar_trabajo(p_trabajo uuid, p_monto numeric, p_pago text, p_fecha date) returns public.trabajos
language plpgsql security definer set search_path = public as $$
declare
  t trabajos;
  m numeric;
begin
  if not es_activo() then raise exception 'Usuario sin acceso'; end if;
  select * into t from trabajos where id = p_trabajo for update;
  if t.id is null or (t.privado and not es_admin()) then raise exception 'Trabajo no encontrado'; end if;
  m := least(p_monto, t.saldo);
  if m <= 0 then raise exception 'Abono inválido'; end if;
  insert into trabajo_abonos (trabajo_id, fecha, monto, pago, usuario_id) values (t.id, coalesce(p_fecha, current_date), m, p_pago, auth.uid());
  update trabajos set abonado = abonado + m, saldo = total - retencion - (abonado + m) where id = t.id returning * into t;
  return t;
end;
$$;

-- Anula una venta (solo admin) y devuelve al inventario lo que se había descontado.
create or replace function public.anular_venta(p_venta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v ventas;
  it jsonb;
begin
  if not es_admin() then raise exception 'Solo el administrador puede anular ventas'; end if;
  select * into v from ventas where id = p_venta for update;
  if v.id is null then return; end if;
  for it in select * from jsonb_array_elements(v.items) loop
    if it->>'tipo' = 'prod' and coalesce(it->>'productoId', '') <> '' then
      update productos set stock = coalesce(stock, 0) + (it->>'cant')::numeric
        where id = (it->>'productoId')::uuid and tipo = 'propio';
    end if;
  end loop;
  delete from ventas where id = v.id;
end;
$$;

-- Suma una entrada de inventario (solo admin).
create or replace function public.entrada_stock(p_producto uuid, p_cant numeric, p_costo numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
  update productos set stock = coalesce(stock, 0) + p_cant where id = p_producto;
  if p_costo is not null then
    insert into producto_costos (producto_id, costo) values (p_producto, p_costo)
    on conflict (producto_id) do update set costo = excluded.costo;
  end if;
end;
$$;

-- El administrador le pone una contraseña nueva a un usuario que la olvidó.
create or replace function public.cambiar_clave(p_usuario uuid, p_clave text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
  if length(coalesce(p_clave, '')) < 6 then raise exception 'Password should be at least 6 characters'; end if;
  update auth.users set encrypted_password = crypt(p_clave, gen_salt('bf')) where id = p_usuario;
end;
$$;
revoke all on function public.cambiar_clave(uuid, text) from public, anon;
grant execute on function public.cambiar_clave(uuid, text) to authenticated;

revoke all on function public.registrar_venta(jsonb) from public, anon;
revoke all on function public.registrar_abono(uuid, numeric, text, date) from public, anon;
revoke all on function public.anular_venta(uuid) from public, anon;
revoke all on function public.entrada_stock(uuid, numeric, numeric) from public, anon;
revoke all on function public.abonar_trabajo(uuid, numeric, text, date) from public, anon;
grant execute on function public.abonar_trabajo(uuid, numeric, text, date) to authenticated;
grant execute on function public.registrar_venta(jsonb) to authenticated;
grant execute on function public.registrar_abono(uuid, numeric, text, date) to authenticated;
grant execute on function public.anular_venta(uuid) to authenticated;
grant execute on function public.entrada_stock(uuid, numeric, numeric) to authenticated;

-- ============================================================
-- Tiempo real (la pantalla se actualiza sola cuando el otro usuario vende)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['ventas', 'abonos', 'productos', 'clientes', 'config_publica', 'contador', 'perfiles', 'trabajos', 'trabajo_abonos', 'cierres', 'aperturas', 'gastos', 'conteos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================
-- Precios iniciales (tomados de CUADRE SEMANAL DIGITAL.xlsx)
-- ============================================================
insert into public.config_publica (id, datos) values (1, '{
  "negocio": {"nombre": "Publiinsumos", "telefono": "", "pie": "¡Gracias por tu compra!", "indicativo": "57"},
  "tolerancia": 5,
  "cierreDia": 6,
  "ultimoContador": 196709,
  "ultimoContadorColor": 0,
  "ultimoContadorBN": 0,
  "conceptos": ["Acrílico", "Servicio de corte", "Servicio de armado", "Acarreo", "Instalación", "Diseño"],
  "plastificado": {"precio": 1000},
  "tamanos": [
    {"id": "carta", "nombre": "Carta/Oficio (23 x 33 cm)", "clics": 1, "piezas": 9},
    {"id": "t48", "nombre": "33 x 48 cm", "clics": 2, "piezas": 4},
    {"id": "t70", "nombre": "33 x 70 cm", "clics": 3, "piezas": 3},
    {"id": "t100", "nombre": "33 x 100 cm", "clics": 4, "piezas": 3},
    {"id": "t46", "nombre": "32 x 46 cm", "clics": 2, "piezas": 4}
  ],
  "gramajes": [
    {"id": "g75", "nombre": "Bond 75 g"},
    {"id": "g150", "nombre": "Propalcote 150 g"},
    {"id": "g200", "nombre": "Propalcote 200 g"},
    {"id": "g240", "nombre": "Propalcote 240 g"},
    {"id": "g300", "nombre": "Propalcote 300 g"}
  ],
  "sustratos": [
    {"id": "cc", "nombre": "Corriente Carta/Oficio", "tamano": "carta", "corriente": true, "precios": [2100, 1900, 1700, 1600]},
    {"id": "c48", "nombre": "Corriente 33 x 48 cm", "tamano": "t48", "corriente": true, "precios": [4000, 3600, 3300, 3000]},
    {"id": "c70", "nombre": "Corriente 33 x 70 cm", "tamano": "t70", "corriente": true, "precios": [5600, 5300, 5000, 4700]},
    {"id": "c100", "nombre": "Corriente 33 x 100 cm", "tamano": "t100", "corriente": true, "precios": [8000, 7500, 7000, 6500]},
    {"id": "opc", "nombre": "Opalina Carta/Oficio", "tamano": "carta", "corriente": false, "precios": [2400, 2200, 2000, 1800]},
    {"id": "adc", "nombre": "Adhesivo Carta/Oficio", "tamano": "carta", "corriente": false, "precios": [2600, 2400, 2200, 2000]},
    {"id": "ad48", "nombre": "Adhesivo 33 x 48 cm", "tamano": "t48", "corriente": false, "precios": [4500, 4300, 4100, 3900]},
    {"id": "vin", "nombre": "Vinilo blanco o transparente 32 x 46 cm", "tamano": "t46", "corriente": false, "precios": [6800, 6500, 6200, 5900]},
    {"id": "met", "nombre": "Metalizado 33 x 48 cm", "tamano": "t48", "corriente": false, "precios": [6000, 5800, 5600, 5400]}
  ]
}') on conflict (id) do nothing;

insert into public.config_costos (id, datos) values (1, '{
  "costoClic": 655,
  "costoClicColor": 655,
  "costoClicBN": 0,
  "plastificadoCosto": 0,
  "gramajes": {"g75": 369, "g150": 728, "g200": 972, "g240": 1165, "g300": 1495},
  "sustratos": {"opc": 2709, "adc": 2304, "ad48": 2300, "vin": 8800, "met": 10000}
}') on conflict (id) do nothing;

-- ============================================================
-- Versión 5: copia de seguridad diaria, reiniciar el sistema,
-- cerrar el registro y aviso de cambios para actualizar las pantallas.
-- ============================================================

-- Una sola copia por tipo, que se sobrescribe: 'diario' (cada noche) y 'antes_reinicio'.
create table if not exists public.respaldos (
  tipo text primary key,
  creado timestamptz not null default now(),
  datos jsonb not null
);
alter table public.respaldos enable row level security;

-- Solo la puede llamar el servidor (cada noche) o un administrador.
create or replace function public.puede_respaldar() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or session_user not in ('authenticator', 'anon', 'authenticated');
$$;

create or replace function public.hacer_respaldo(p_tipo text default 'diario') returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  t text;
  tablas jsonb := '{}';
  filas jsonb;
  ahora timestamptz := now();
begin
  if not public.puede_respaldar() then raise exception 'Solo el administrador puede hacer copias'; end if;
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'respaldos' order by tablename loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from public.%I x', t) into filas;
    tablas := tablas || jsonb_build_object(t, filas);
  end loop;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'encrypted_password', encrypted_password, 'raw_user_meta_data', raw_user_meta_data, 'created_at', created_at)), '[]')
      into filas from auth.users;
    tablas := tablas || jsonb_build_object('auth.users', filas);
  exception when others then null;
  end;
  insert into respaldos (tipo, creado, datos)
  values (p_tipo, ahora, jsonb_build_object('sistema', 'Publiinsumos Caja', 'creado', ahora, 'tablas', tablas))
  on conflict (tipo) do update set creado = excluded.creado, datos = excluded.datos;
  return ahora;
end $$;

create or replace function public.respaldos_info() returns table (tipo text, creado timestamptz, bytes int)
language sql stable security definer set search_path = public as $$
  select r.tipo, r.creado, octet_length(r.datos::text) from respaldos r where public.es_admin() order by r.creado desc;
$$;

create or replace function public.descargar_respaldo(p_tipo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede descargar copias'; end if;
  return (select datos from respaldos where tipo = p_tipo);
end $$;

-- Deja el sistema en ceros para empezar de verdad: borra ventas, abonos, cotizaciones,
-- cierres, aperturas, gastos y lecturas del contador. Conserva usuarios, ajustes,
-- clientes, productos con su stock y conteos. Antes guarda una copia 'antes_reinicio'.
create or replace function public.reiniciar_sistema(p_confirma text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede reiniciar el sistema'; end if;
  if p_confirma is distinct from 'REINICIAR' then raise exception 'Escribe REINICIAR para confirmar'; end if;
  perform public.hacer_respaldo('antes_reinicio');
  delete from abonos where true;
  delete from venta_costos where true;
  delete from ventas where true;
  delete from trabajo_abonos where true;
  delete from trabajo_costos where true;
  delete from trabajos where true;
  delete from cierres where true;
  delete from aperturas where true;
  delete from gastos where true;
  delete from contador where true;
  perform setval(pg_get_serial_sequence('public.ventas', 'numero'), 1, false);
  perform setval(pg_get_serial_sequence('public.trabajos', 'numero'), 1, false);
  update config_publica set datos = datos || '{"ultimoContador": 0}'::jsonb where id = 1;
end $$;

-- La pantalla de inicio pregunta si se pueden crear cuentas nuevas.
create or replace function public.registro_abierto() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from perfiles)
      or coalesce((select (datos->>'registroCerrado')::boolean from config_publica where id = 1), false) = false;
$$;

-- Un contador por tabla que sube con cada cambio. La app lo consulta cada pocos
-- segundos y recarga solo lo que cambió (en Railway no hay tiempo real).
create table if not exists public.cambios (
  tabla text primary key,
  n bigint not null default 0
);
alter table public.cambios enable row level security;
drop policy if exists cambios_leer on public.cambios;
create policy cambios_leer on public.cambios for select using (public.es_activo());

create or replace function public.marcar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into cambios (tabla, n) values (TG_TABLE_NAME, 1)
  on conflict (tabla) do update set n = cambios.n + 1;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ventas', 'abonos', 'productos', 'clientes', 'config_publica', 'contador', 'perfiles', 'trabajos', 'trabajo_abonos', 'cierres', 'aperturas', 'gastos', 'conteos'] loop
    execute format('drop trigger if exists marcar_cambio on public.%I', t);
    execute format('create trigger marcar_cambio after insert or update or delete on public.%I for each statement execute function public.marcar_cambio()', t);
  end loop;
end $$;

-- El negocio se llama Publiinsumos: corrige el nombre que traía la instalación inicial.
update public.config_publica
   set datos = jsonb_set(datos, '{negocio,nombre}', '"Publiinsumos"')
 where id = 1 and datos->'negocio'->>'nombre' = 'Eco' || 'global';

-- Restaura una copia descargada (el archivo .json): reemplaza todos los datos del
-- sistema por los de la copia. Antes guarda una copia 'antes_restaurar' de lo actual.
create or replace function public.restaurar_respaldo(p_datos jsonb, p_confirma text) returns void
language plpgsql security definer set search_path = public as $$
declare
  orden text[] := array['config_publica', 'config_costos', 'perfiles', 'productos', 'producto_costos', 'clientes', 'ventas', 'venta_costos', 'abonos',
    'contador', 'trabajos', 'trabajo_costos', 'trabajo_abonos', 'cierres', 'aperturas', 'gastos', 'conteos'];
  t text;
  cols text;
  tablas jsonb := p_datos->'tablas';
  s record;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede restaurar copias'; end if;
  if p_confirma is distinct from 'RESTAURAR' then raise exception 'Escribe RESTAURAR para confirmar'; end if;
  if tablas is null or jsonb_typeof(tablas->'productos') is distinct from 'array' or jsonb_typeof(tablas->'perfiles') is distinct from 'array' then
    raise exception 'El archivo no es una copia de seguridad de este sistema';
  end if;
  perform public.hacer_respaldo('antes_restaurar');
  -- Las cuentas de la copia vuelven con su misma contraseña (las demás se quedan, sin perfil).
  if jsonb_typeof(tablas->'auth.users') = 'array' then
    insert into auth.users (id, email, encrypted_password, raw_user_meta_data, created_at)
    select u.id, u.email, u.encrypted_password, coalesce(u.raw_user_meta_data, '{}'), coalesce(u.created_at, now())
      from jsonb_to_recordset(tablas->'auth.users') as u(id uuid, email text, encrypted_password text, raw_user_meta_data jsonb, created_at timestamptz)
    on conflict (id) do update set email = excluded.email, encrypted_password = excluded.encrypted_password, raw_user_meta_data = excluded.raw_user_meta_data;
  end if;
  execute 'truncate table ' || (select string_agg(format('public.%I', x), ', ') from unnest(orden) x) || ' cascade';
  foreach t in array orden loop
    if jsonb_typeof(tablas->t) = 'array' and jsonb_array_length(tablas->t) > 0 then
      select string_agg(format('%I', column_name), ', ' order by ordinal_position) into cols
        from information_schema.columns where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
      execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)', t, cols, cols, t) using tablas->t;
    end if;
  end loop;
  -- La numeración sigue desde el último número restaurado.
  for s in select c.table_name, c.column_name, pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name) seq
             from information_schema.columns c where c.table_schema = 'public' and c.table_name = any(orden)
              and pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name) is not null loop
    execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', s.seq, s.column_name, s.table_name);
  end loop;
  insert into cambios (tabla, n) select x, 1 from unnest(orden) x on conflict (tabla) do update set n = cambios.n + 1;
end $$;
