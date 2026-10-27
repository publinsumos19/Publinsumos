# Ecoglobal Caja

Aplicación web para un negocio de insumos de publicidad e impresión láser:

- **Vender:** impresiones con precio automático por escala (1 a 20, 21 a 50, 51 a 100, más de 100), clics del contador y plastificado. También productos propios, que descuentan inventario, y servicios tercerizados.
- **Cotizaciones** y **recibos por WhatsApp**.
- **Cartera:** ventas a crédito, abonos y recordatorios.
- **Inventario** con aviso de poco stock.
- **Cuadre semanal del contador** de la fotocopiadora contra los clics vendidos.
- **Reportes:** ventas, ganancia estimada, impresiones por papel, mejores clientes y descarga en CSV.
- **Dashboard** con ventas del día, semana y mes, ganancia, carteras, clics y entregas pendientes.
- **Cotizador personalizado** para avisos y trabajos a la medida (material, corte, armado, acarreo, instalación y cualquier concepto nuevo). Lo que cotiza el administrador es privado y va a su **Cartera privada**; lo del vendedor pasa a venta y a la Cartera del negocio.
- **Cierre de caja** diario y semanal: ventas por línea de negocio, dinero recibido por Efectivo, Bancolombia y Nequi, cuadre del efectivo contado, color y B/N, contador, insumos, terceros, vendedores y F-E. Se puede enviar por WhatsApp, imprimir y descargar.
- **Contador por tipo:** cuadre general, a color y en blanco y negro, cada uno con su costo por clic.
- **Apertura de caja** con dos bases (impresión láser e insumos) y **cierre por cajón**, con recordatorios al abrir la app y semáforos de entregas y cartera.
- **Gastos** del negocio: los de efectivo se restan de la caja de donde salió la plata.
- **Clientes** con NIT, correo, dirección y forma de pago, que se copian a la cotización.
- **Cotizaciones** con margen sobre el costo, productos de la tienda o conceptos nuevos, instalación, días hábiles de entrega, condiciones, firma, retenciones y marca de enviada.
- **Catálogo y conteo inicial:** 670 productos cargados (publiinsumos y láminas Formaplax) y una pantalla para contar el inventario el día de arranque.
- **Usuarios:** administrador y vendedor. El vendedor no ve costos ni puede cambiar precios. Esto se aplica en la base de datos, no solo en la pantalla.

Tecnología: React + Vite, diseño basado en [Horizon UI](https://github.com/horizon-ui/horizon-ui-chakra) (Chakra UI, licencia MIT) y [Supabase](https://supabase.com) como base de datos e inicio de sesión. Se publica en [Vercel](https://vercel.com).

---

## Instalación para un cliente nuevo

Hay dos formas de instalarlo. La **opción A (GitHub + Railway + Vercel)** es la que usa Ecoglobal. La opción B usa Supabase en lugar de Railway.

### Opción A: Railway (base de datos y servidor) + Vercel (la app)

El servidor de [`server/`](server/) hace lo que haría Supabase: al arrancar crea todas las tablas, las reglas de seguridad, los precios y el catálogo de 670 productos, y maneja las cuentas de usuario. No hay que correr nada a mano.

1. **Railway:** entra a <https://railway.com>, elige **New Project > Deploy from GitHub repo** y escoge este repositorio. Railway lee el `Dockerfile` y `railway.json` solo.
2. En el mismo proyecto toca **+ Create > Database > PostgreSQL**.
3. Abre el servicio del repositorio, ve a **Variables > New Variable > Add Reference** y elige `DATABASE_URL` de Postgres. Así el servidor queda conectado a la base.
4. En **Settings > Networking > Generate Domain**, crea el dominio público. Por ejemplo `https://publinsumos-production.up.railway.app`. Ábrelo: debe decir `{"ok":true}`.
5. **Vercel:** importa este mismo repositorio (o abre el proyecto que ya tienes). En **Settings > Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = el dominio de Railway del paso 4.
   - `VITE_SUPABASE_ANON_KEY` = `publico` (con Railway no hace falta una clave real; el nombre de la variable se mantiene).
6. En **Deployments**, toca **Redeploy** para que tome las variables.

Notas de esta opción:
- No hay correo de recuperación: si alguien olvida su contraseña, el administrador le pone una nueva en **Usuarios > Cambiar contraseña**.
- La pantalla del otro usuario se actualiza al cambiar de sección o recargar, no al instante.
- Railway cobra por uso desde el inicio (el plan Hobby cuesta unos USD 5 al mes).

### Opción B: Supabase + Vercel

#### 1. Base de datos (Supabase)

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo, idealmente a nombre del cliente. Elige la región **South America (São Paulo)**.
2. Entra a **SQL Editor > New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y presiona **Run**. Así se crean las tablas, las reglas de seguridad y los precios iniciales.
3. En **Authentication > Sign In / Providers > Email**:
   - Si quieres que las cuentas se puedan usar sin confirmar el correo, desactiva **Confirm email**.
   - Si lo dejas activo, cada persona debe abrir el enlace del correo antes de entrar.
4. En **Authentication > URL Configuration**, pon en **Site URL** el dominio final del cliente (por ejemplo `https://caja.ecoglobal.com`).
5. En **Project Settings > API** copia:
   - **Project URL**, que va en `VITE_SUPABASE_URL`.
   - **anon public key**, que va en `VITE_SUPABASE_ANON_KEY`.

   La clave `service_role` **no** se usa nunca en esta app; no la copies a ningún lado.

6. Para cargar el catálogo de productos, ejecuta también, cada uno en una consulta nueva: [`supabase/catalogo_publiinsumos.sql`](supabase/catalogo_publiinsumos.sql) y [`supabase/catalogo_laminas.sql`](supabase/catalogo_laminas.sql). Si un producto ya existe con el mismo nombre, no se repite.

**Si ya tenías la versión anterior instalada:** vuelve a ejecutar `supabase/schema.sql` completo. Agrega las tablas y columnas nuevas sin borrar datos.

#### 2. Publicar (Vercel)

1. Entra a <https://vercel.com>, elige **Add New > Project** e importa este repositorio de GitHub.
2. Vercel detecta Vite solo. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del paso anterior.
3. Presiona **Deploy**.
4. Para el dominio del cliente: **Project > Settings > Domains > Add**, escribe el dominio y crea en el proveedor del dominio el registro DNS que Vercel indica.

### Primer uso (las dos opciones)

1. Abre la app y elige **Crear cuenta**. **El primer usuario que se registra queda como administrador.**
2. Revisa **Ajustes**: nombre del negocio, teléfono, logo, precios y costos.
3. En **Inventario > Conteo inicial**, cuenta lo que hay en la tienda y guarda. Lo que no se cuente puede quedar en 0.
4. El vendedor crea su cuenta desde la misma pantalla. Queda pendiente hasta que el administrador lo active en **Usuarios**.

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y pega los datos de Supabase
npm run dev                  # http://localhost:5173
npm test                     # pruebas de la lógica de precios
npm run build
npm run build:demo           # demo de un solo archivo con datos de ejemplo (dist-demo/index.html)
```

## Estructura

| Carpeta | Qué contiene |
| --- | --- |
| `supabase/schema.sql` | Tablas, seguridad por filas, funciones de venta, abono, anulación y precios iniciales |
| `src/lib/pricing.js` | Cálculo de precios por escala, clics y costos (con pruebas en `pricing.test.js`) |
| `src/lib/receipt.js` | Texto de recibos, cotizaciones y recordatorios para WhatsApp |
| `src/views/` | Pantallas: Vender, Ventas, Cartera, Inventario, Cuadre, Reportes, Ajustes, Usuarios |
| `src/theme/` | Tema de Horizon UI con la paleta del negocio |

Para cambiar el color de marca, edita `brand` en `src/theme/styles.js`.

## Seguridad

- Cada tabla tiene reglas de seguridad por filas (RLS). Un usuario sin activar no puede leer nada.
- Los costos (`config_costos`, `producto_costos`, `venta_costos`) solo los lee el administrador.
- Las ventas se registran con la función `registrar_venta`, que calcula clics y costos en el servidor y descuenta el inventario en la misma operación.
- Solo el administrador puede anular ventas (`anular_venta`), lo que devuelve el stock.

## Licencias

El diseño parte de Horizon UI Free © Horizon UI, con licencia MIT (ver [`LICENSE-horizon-ui.md`](LICENSE-horizon-ui.md)).
