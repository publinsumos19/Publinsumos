import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Box, Button, Flex, Portal, Text, useColorModeValue } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isDemo } from '../lib/supabase';

export const abrirTour = () => window.dispatchEvent(new Event('abrir-tour'));

// What each part of the menu is for. Steps for screens the user can't open are skipped.
const PASOS = [
  { titulo: '¡Bienvenido a Publiinsumos!', texto: 'Te muestro en un minuto dónde está cada cosa. Puedes saltar el tour cuando quieras y volver a verlo con el botón de ayuda (?).' },
  { sel: 'menu', titulo: 'El menú', texto: 'En el celular, el menú está en este botón. Desde ahí entras a todas las pantallas.', soloMovil: true },
  { sel: 'nav/dashboard', titulo: 'Dashboard', texto: 'El resumen del negocio: ventas de hoy, de la semana y del mes, ganancia, cartera, gastos, utilidad y clics de la impresora.' },
  { sel: 'nav/vender', titulo: 'Vender', texto: 'Aquí registras cada venta: impresiones (el precio sale solo según papel, tamaño y cantidad) y productos de la tienda. Eliges cómo pagó: efectivo, Bancolombia, Nequi o crédito.' },
  { sel: 'nav/cotizador', titulo: 'Cotizador', texto: 'Para trabajos personalizados: avisos, acrílicos, instalaciones. Armas el desglose, lo envías por WhatsApp o lo imprimes, y cuando el cliente aprueba se vuelve trabajo.' },
  { sel: 'nav/clientes', titulo: 'Clientes', texto: 'Los datos de cada cliente, su forma de pago, sus sucursales y cuánto debe. Su forma de pago se pone sola en sus cotizaciones.' },
  { sel: 'nav/ventas', titulo: 'Ventas', texto: 'El historial de todas las ventas. Al abrir una ves su detalle y su recibo, y el administrador puede anularla.' },
  { sel: 'nav/cartera', titulo: 'Cartera', texto: 'Las ventas a crédito que faltan por pagar. Registras los abonos y el semáforo te avisa las deudas atrasadas.' },
  { sel: 'nav/cartera-privada', titulo: 'Cartera privada', texto: 'Solo la ve el administrador: los trabajos privados aprobados, con retenciones y abonos.' },
  { sel: 'nav/inventario', titulo: 'Inventario', texto: 'Productos, precios y existencias. Cada venta descuenta stock; aquí registras las entradas de mercancía y el conteo de inventario.' },
  { sel: 'nav/cuadre', titulo: 'Cuadre del contador', texto: 'Comparas los clics que marca la impresora (color y blanco y negro) con lo que se vendió, para saber si cuadra.' },
  { sel: 'nav/gastos', titulo: 'Gastos', texto: 'Anota cada gasto con su forma de pago. Los gastos en efectivo se descuentan de la caja en el cierre.' },
  { sel: 'nav/cierre', titulo: 'Cierre de caja', texto: 'Al final del día cuentas el efectivo de cada caja (impresión láser e insumos) y el sistema te dice si sobra o falta.' },
  { sel: 'nav/reportes', titulo: 'Reportes', texto: 'Ventas por día, impresiones por papel, medios de pago, mejores clientes y productos más vendidos, en el periodo que elijas. Las ventas se pueden descargar en CSV.' },
  { sel: 'nav/ajustes', titulo: 'Ajustes', texto: 'Precios de impresión, costos, días del semáforo, formato de cotizaciones, copias de seguridad, cerrar el registro y apagar este tour.' },
  { sel: 'nav/usuarios', titulo: 'Usuarios', texto: 'Activas a los vendedores, cambias su rol y les pones una contraseña nueva si la olvidan.' },
  { sel: 'recordatorios', titulo: 'Recordatorios', texto: 'La campana muestra lo pendiente del día: abrir la caja, cierres sin hacer, entregas que se acercan y deudas atrasadas.' },
  { sel: 'ayuda', titulo: 'Ayuda', texto: 'Aquí vuelves a ver este tour o abres la guía completa paso a paso. ¡Listo, a vender!' },
];

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
const buscar = (sel) => (sel ? [...document.querySelectorAll(`[data-tour="${sel}"]`)].find(visible) : null);
const hayModal = () => !!document.querySelector('.chakra-modal__content');

export default function TourGuiado({ rutas = [] }) {
  const { perfil, cfg } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pasos, setPasos] = useState(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const bg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const clave = `tour-visto-${perfil?.id || 'x'}`;
  const activo = cfg && cfg.tourActivo !== false;

  const empezar = useCallback(() => {
    const movil = window.innerWidth < 1200;
    setPasos(PASOS.filter((p) => !p.sel || (p.soloMovil ? movil : !p.sel.startsWith('nav/') || rutas.includes(p.sel.slice(3)))));
    setI(0);
  }, [rutas]);

  // First visit of each user (after the reminders window is closed), ?tour=1, or the help button.
  useEffect(() => {
    if (!activo || !perfil) return undefined;
    const forzar = new URLSearchParams(location.search).get('tour') === '1';
    let visto = true;
    try { visto = !!localStorage.getItem(clave); } catch { /* sin almacenamiento */ }
    if (!forzar && (visto || isDemo)) return undefined;
    if (forzar) navigate(location.pathname, { replace: true });
    const t = setInterval(() => { if (!hayModal()) { clearInterval(t); empezar(); } }, 600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, perfil?.id]);
  useEffect(() => {
    const abrir = () => empezar();
    window.addEventListener('abrir-tour', abrir);
    return () => window.removeEventListener('abrir-tour', abrir);
  }, [empezar]);

  const paso = pasos?.[i];
  const medir = useCallback(() => {
    if (!paso) return;
    const el = buscar(paso.sel);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [paso]);
  useLayoutEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [medir]);

  if (!paso) return null;
  const cerrar = () => { try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ } setPasos(null); };
  const siguiente = () => (i + 1 >= pasos.length ? cerrar() : setI(i + 1));
  const anterior = () => setI(Math.max(0, i - 1));

  const W = Math.min(340, window.innerWidth - 24);
  const pad = 6;
  let pos = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (rect) {
    const derecha = rect.left + rect.width + 16;
    if (derecha + W < window.innerWidth) pos = { top: Math.max(12, Math.min(rect.top - 10, window.innerHeight - 240)), left: derecha };
    else if (rect.top + rect.height + 200 < window.innerHeight) pos = { top: rect.top + rect.height + 14, left: Math.max(12, Math.min(rect.left + rect.width - W, window.innerWidth - W - 12)) };
    else pos = { top: Math.max(12, rect.top - 220), left: Math.max(12, window.innerWidth - W - 12) };
  }
  // A screen hidden in the mobile menu: tell the user where it is.
  const texto = !rect && paso.sel?.startsWith('nav/') ? `${paso.texto} (La encuentras en el menú ☰.)` : paso.texto;

  return (
    <Portal>
      <Box position="fixed" inset="0" zIndex={2000} onClick={(e) => e.stopPropagation()}>
        {rect ? (
          <Box position="fixed" top={`${rect.top - pad}px`} left={`${rect.left - pad}px`} w={`${rect.width + pad * 2}px`} h={`${rect.height + pad * 2}px`}
            borderRadius="14px" boxShadow="0 0 0 9999px rgba(11, 20, 55, 0.55)" border="2px solid" borderColor="brand.400"
            transition="all .25s ease" pointerEvents="none" />
        ) : <Box position="fixed" inset="0" bg="rgba(11, 20, 55, 0.55)" />}
        <Box position="fixed" {...pos} w={`${W}px`} bg={bg} borderRadius="18px" boxShadow="xl" p="18px" transition="top .25s ease, left .25s ease">
          <Text fontSize="xs" color="brand.500" fontWeight="700" mb="4px">Paso {i + 1} de {pasos.length}</Text>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="6px">{paso.titulo}</Text>
          <Text fontSize="sm" color="secondaryGray.600" mb="14px">{texto}</Text>
          <Flex gap="4px" mb="14px">
            {pasos.map((_, k) => <Box key={k} h="4px" flex="1" borderRadius="2px" bg={k <= i ? 'brand.500' : 'secondaryGray.300'} />)}
          </Flex>
          <Flex gap="8px" align="center">
            <Button size="sm" variant="ghost" onClick={cerrar}>Saltar</Button>
            <Box flex="1" />
            {i > 0 && <Button size="sm" variant="light" onClick={anterior}>Anterior</Button>}
            <Button size="sm" variant="brand" onClick={siguiente}>{i === pasos.length - 1 ? 'Terminar' : 'Siguiente'}</Button>
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
}
