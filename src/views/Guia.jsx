import { useMemo, useState } from 'react';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Badge, Box, Button, Checkbox, Collapse, Flex, Icon, Input, InputGroup,
  InputLeftElement, Progress, SimpleGrid, Text, useColorModeValue,
} from '@chakra-ui/react';
import {
  MdAccountBalanceWallet, MdBarChart, MdContacts, MdDashboard, MdExpandMore, MdInventory, MdLock, MdLockClock, MdMoneyOff, MdPeople, MdPointOfSale,
  MdPrint, MdReceiptLong, MdRequestQuote, MdSearch, MdSettings, MdNotificationsNone, MdPlayArrow, MdLogin,
} from 'react-icons/md';
import { isDemo } from '../lib/supabase';

const A = 'admin', V = 'vendedor', T = 'todos';

const DIA = [
  { t: 'Abre la caja', d: 'Al entrar, la ventana de recordatorios te pide la base de cada caja: impresión láser e insumos. Escribe el efectivo con que empiezas y presiona «Abrir caja».' },
  { t: 'Registra cada venta', d: 'En Vender agrega impresiones o productos, elige cómo pagó el cliente y guarda. El recibo se puede enviar por WhatsApp.' },
  { t: 'Cotiza los trabajos especiales', d: 'Avisos, acrílicos o instalaciones van en el Cotizador. Envía la cotización y, cuando el cliente acepte, apruébala o pásala a venta.' },
  { t: 'Anota los gastos', d: 'Cualquier salida de dinero va en Gastos. Si fue en efectivo, se descuenta sola de la caja.' },
  { t: 'Haz el cierre', d: 'En Cierre de caja cuenta el efectivo de cada caja. El sistema compara con lo esperado y te dice si sobra o falta.' },
];

const MODULOS = [
  { id: 'dashboard', icon: MdDashboard, t: 'Dashboard', rol: T, d: 'El resumen del negocio de un vistazo.', pasos: ['Arriba ves ventas de hoy, de la semana y del mes.', 'El administrador ve además ganancia, cartera, cartera privada, gastos, utilidad y clics de la impresora.', 'Abajo están la gráfica de ventas de 30 días, las ventas por línea, el dinero recibido y el último cuadre del contador.'] },
  { id: 'vender', icon: MdPointOfSale, t: 'Vender', rol: T, d: 'Registrar impresiones y productos.', pasos: ['Para impresiones elige papel, tamaño y cantidad: el precio sale solo según la escala.', 'Para productos usa el buscador del desplegable: escribe parte del nombre o la medida (ej. «media 3 mm cristal»).', 'Escribe el nombre y WhatsApp del cliente (obligatorio para el vendedor).', 'Elige el pago: efectivo, Bancolombia, Nequi o crédito. El crédito pasa a Cartera.', 'Guarda y envía el recibo por WhatsApp si el cliente lo quiere.'] },
  { id: 'cotizador', icon: MdRequestQuote, t: 'Cotizador', rol: T, d: 'Trabajos personalizados de principio a fin.', pasos: ['Presiona «Nueva cotización» y escribe cliente, WhatsApp y trabajo.', 'Elige con o sin instalación y la fecha de entrega en el calendario.', 'Arma el desglose: busca productos de la tienda o crea conceptos nuevos. El administrador pone el costo y el % de margen y el precio sale solo.', 'Envíala por WhatsApp, imprímela o descárgala.', 'Cuando el cliente acepte: el vendedor la pasa a venta; el administrador la aprueba y, si es privada, va a Cartera privada.'] },
  { id: 'clientes', icon: MdContacts, t: 'Clientes', rol: T, d: 'Datos, forma de pago y sucursales.', pasos: ['Crea el cliente con su NIT, teléfono, correo y dirección.', 'Elige cómo paga: a convenir, a 10, 30, 45 o 60 días, o anticipo del 50%.', 'Agrega sus sucursales si tiene varias sedes; en el cotizador podrás elegir a cuál va.', 'En la lista ves cuánto debe cada cliente.'] },
  { id: 'ventas', icon: MdReceiptLong, t: 'Ventas', rol: T, d: 'El historial completo.', pasos: ['Busca y filtra las ventas por fecha.', 'Abre una venta para ver su detalle y su recibo.', 'El administrador puede anular una venta: el stock vuelve al inventario.'] },
  { id: 'cartera', icon: MdAccountBalanceWallet, t: 'Cartera', rol: T, d: 'Lo que los clientes deben.', pasos: ['Aquí están las ventas a crédito con saldo pendiente.', 'Registra cada abono con su forma de pago.', 'El semáforo marca en amarillo y rojo las deudas que se están atrasando.'] },
  { id: 'privada', icon: MdLock, t: 'Cartera privada', rol: A, d: 'Trabajos privados del administrador.', pasos: ['Solo la ve el administrador.', 'Muestra los trabajos privados aprobados, con retenciones, neto a pagar y abonos.'] },
  { id: 'inventario', icon: MdInventory, t: 'Inventario', rol: T, d: 'Productos, precios y existencias.', pasos: ['Cada venta descuenta del stock automáticamente.', 'Usa «Entrada de stock» cuando llegue mercancía.', 'El conteo de inventario sirve para poner las existencias reales de toda la tienda.', 'El panel de poco stock te avisa qué hay que pedir.'] },
  { id: 'cuadre', icon: MdPrint, t: 'Cuadre del contador', rol: A, d: 'Que los clics de la impresora cuadren.', pasos: ['Escribe la lectura del contador general, color y blanco y negro.', 'El sistema compara con los clics vendidos en ese periodo y te muestra la diferencia.'] },
  { id: 'gastos', icon: MdMoneyOff, t: 'Gastos', rol: T, d: 'Cada salida de dinero.', pasos: ['Escribe concepto, categoría, valor y forma de pago.', 'Si fue en efectivo, elige de qué caja salió: se descuenta en el cierre.', 'El vendedor puede borrar sus propios gastos del mismo día.'] },
  { id: 'cierre', icon: MdLockClock, t: 'Cierre de caja', rol: T, d: 'Cuadrar el efectivo del día.', pasos: ['Cuenta el efectivo de la caja de impresión láser y de la de insumos.', 'El sistema calcula lo esperado: base + ventas en efectivo + abonos − gastos en efectivo.', 'El administrador también hace el cierre semanal y puede ver la tienda y lo privado por separado.'] },
  { id: 'reportes', icon: MdBarChart, t: 'Reportes', rol: A, d: 'Cómo va el negocio.', pasos: ['Elige el periodo y mira ventas por día, impresiones por papel, medios de pago, mejores clientes y productos más vendidos.', 'Descarga las ventas en CSV para abrirlas en Excel.'] },
  { id: 'ajustes', icon: MdSettings, t: 'Ajustes', rol: A, d: 'Configurar el sistema.', pasos: ['Precios de impresión por escala, tamaños, gramajes y costos.', 'Días del semáforo, formato de cotizaciones, retenciones y firma.', 'Cerrar el registro de cuentas nuevas y apagar el tour guiado.', 'Descargar la copia de seguridad diaria y reiniciar el sistema en ceros.'] },
  { id: 'usuarios', icon: MdPeople, t: 'Usuarios', rol: A, d: 'Quién entra y qué puede ver.', pasos: ['Cuando alguien crea su cuenta queda inactivo hasta que el administrador lo active.', 'Elige su rol: administrador o vendedor.', 'Si alguien olvida su contraseña, ponle una nueva con «Cambiar contraseña».'] },
  { id: 'recordatorios', icon: MdNotificationsNone, t: 'Recordatorios', rol: T, d: 'La campana de arriba.', pasos: ['Te recuerda abrir la caja y los días sin cierre.', 'Muestra las entregas del cotizador que se acercan y las deudas atrasadas, con su color del semáforo.'] },
];

const PREGUNTAS = [
  ['¿Qué ve el vendedor y qué ve el administrador?', 'El vendedor vende, cotiza, registra gastos, abonos y su cierre diario. No ve costos, ganancias, la cartera privada, reportes, ajustes ni usuarios.'],
  ['¿Qué pasa si se va el internet?', 'El sistema funciona en línea. Si se cae la conexión, espera a que vuelva y repite la última acción; nada se guarda a medias.'],
  ['¿Las pantallas se actualizan solas?', 'Sí. Si el vendedor registra una venta, el administrador la ve en pocos segundos sin recargar.'],
  ['¿Hay copia de seguridad?', 'Sí. Todas las noches a las 11:30 p. m. se guarda una copia completa que reemplaza la anterior. El administrador la descarga en Ajustes cuando quiera, por ejemplo cada fin de semana.'],
  ['Olvidé mi contraseña', 'Pídele al administrador que te ponga una nueva en Usuarios → Cambiar contraseña.'],
  ['¿Cómo empiezo de cero después de las pruebas?', 'En Ajustes → Reiniciar sistema en ceros. Se borran ventas, cotizaciones, cierres y gastos de prueba, y se conservan clientes, inventario, usuarios y precios.'],
];

export default function Guia() {
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('todos');
  const [abierto, setAbierto] = useState(null);
  const [hechos, setHechos] = useState(() => { try { return JSON.parse(localStorage.getItem('guia-dia') || '[]'); } catch { return []; } });
  const bg = useColorModeValue('secondaryGray.300', 'navy.900');
  const card = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const borde = useColorModeValue('secondaryGray.100', 'whiteAlpha.100');
  const iconBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const base = isDemo ? '#/' : '/';

  const marcar = (k) => {
    const n = hechos.includes(k) ? hechos.filter((x) => x !== k) : [...hechos, k];
    setHechos(n);
    try { localStorage.setItem('guia-dia', JSON.stringify(n)); } catch { /* sin almacenamiento */ }
  };
  const lista = useMemo(() => {
    const w = q.trim().toLowerCase();
    return MODULOS.filter((m) => (rol === 'todos' || m.rol === T || m.rol === rol)
      && (!w || `${m.t} ${m.d} ${m.pasos.join(' ')}`.toLowerCase().includes(w)));
  }, [q, rol]);

  return (
    <Box minH="100vh" bg={bg}>
      <Box bgGradient="linear(135deg, #24b47e 0%, #0b8a5a 55%, #075e3f 100%)" color="white" px={{ base: '16px', md: '40px' }} pt={{ base: '36px', md: '56px' }} pb={{ base: '80px', md: '110px' }} borderBottomRadius={{ base: '28px', md: '60px' }}>
        <Box maxW="1100px" mx="auto">
          <Flex align="center" gap="10px" mb="28px">
            <Box display="grid" gridTemplateColumns="repeat(2, 10px)" gap="4px" aria-hidden>
              {['#06a3e3', '#e6297e', '#f5c200', '#ffffff'].map((c) => <Box key={c} w="10px" h="10px" borderRadius="50%" bg={c} />)}
            </Box>
            <Text fontWeight="700" fontSize="lg">Ecoglobal Caja</Text>
          </Flex>
          <Text fontSize={{ base: '32px', md: '52px' }} fontWeight="800" lineHeight="1.05" maxW="760px">Guía de uso, paso a paso</Text>
          <Text fontSize={{ base: 'md', md: 'xl' }} opacity={0.9} mt="14px" maxW="680px">Todo lo que necesitas para vender, cotizar, controlar la caja y el inventario. Busca una pantalla o sigue el día a día.</Text>
          <Flex gap="10px" mt="26px" wrap="wrap">
            <Button as="a" href={base} leftIcon={<MdLogin />} bg="white" color="brand.600" _hover={{ bg: 'whiteAlpha.900' }}>Entrar al sistema</Button>
            <Button as="a" href={`${base}?tour=1`} leftIcon={<MdPlayArrow />} variant="outline" color="white" borderColor="whiteAlpha.700" _hover={{ bg: 'whiteAlpha.200' }}>Hacer el tour guiado</Button>
          </Flex>
        </Box>
      </Box>

      <Box maxW="1100px" mx="auto" px={{ base: '16px', md: '40px' }} mt={{ base: '-52px', md: '-70px' }} pb="60px">
        <Box bg={card} borderRadius="24px" p={{ base: '18px', md: '28px' }} boxShadow="0 18px 40px rgba(112,144,176,.16)">
          <Flex justify="space-between" align="center" wrap="wrap" gap="8px" mb="6px">
            <Text fontSize="xl" fontWeight="700" color={textColor}>Tu día en 5 pasos</Text>
            <Text fontSize="sm" color="secondaryGray.600">{hechos.length} de {DIA.length} listos</Text>
          </Flex>
          <Progress value={(hechos.length / DIA.length) * 100} colorScheme="green" size="sm" borderRadius="8px" mb="18px" />
          <SimpleGrid columns={{ base: 1, md: 5 }} gap="12px">
            {DIA.map((p, k) => {
              const ok = hechos.includes(k);
              return (
                <Box key={p.t} p="14px" borderRadius="16px" border="1px solid" borderColor={ok ? 'brand.400' : borde} bg={ok ? 'rgba(36,180,126,.08)' : 'transparent'} transition="all .2s" cursor="pointer" onClick={() => marcar(k)}>
                  <Flex align="center" gap="8px" mb="6px">
                    <Flex w="28px" h="28px" borderRadius="50%" bg={ok ? 'brand.500' : iconBg} color={ok ? 'white' : 'brand.500'} align="center" justify="center" fontWeight="800" fontSize="sm" flex="none">{ok ? '✓' : k + 1}</Flex>
                    <Text fontWeight="700" fontSize="sm" color={textColor}>{p.t}</Text>
                  </Flex>
                  <Text fontSize="xs" color="secondaryGray.600">{p.d}</Text>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>

        <Flex mt="34px" mb="14px" gap="10px" align={{ md: 'center' }} direction={{ base: 'column', md: 'row' }}>
          <Text fontSize="2xl" fontWeight="800" color={textColor} me="auto">Pantallas del sistema</Text>
          <Flex bg={card} p="4px" borderRadius="14px" gap="4px">
            {[['todos', 'Todas'], [A, 'Administrador'], [V, 'Vendedor']].map(([k, l]) => (
              <Button key={k} size="sm" borderRadius="10px" variant={rol === k ? 'brand' : 'ghost'} onClick={() => setRol(k)}>{l}</Button>
            ))}
          </Flex>
          <InputGroup w={{ base: '100%', md: '260px' }}>
            <InputLeftElement pointerEvents="none"><MdSearch color="gray" /></InputLeftElement>
            <Input bg={card} borderRadius="14px" border="none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: abono, cierre, stock…" />
          </InputGroup>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="14px" alignItems="start">
          {lista.map((m) => {
            const open = abierto === m.id || !!q.trim();
            return (
              <Box key={m.id} bg={card} borderRadius="20px" p="16px" boxShadow={open ? '0 12px 30px rgba(112,144,176,.18)' : 'none'} transition="all .2s" _hover={{ transform: 'translateY(-2px)' }}>
                <Flex align="center" gap="12px" cursor="pointer" onClick={() => setAbierto(abierto === m.id ? null : m.id)}>
                  <Flex w="44px" h="44px" borderRadius="50%" bg={iconBg} align="center" justify="center" flex="none"><Icon as={m.icon} boxSize="22px" color="brand.500" /></Flex>
                  <Box flex="1" minW={0}>
                    <Flex align="center" gap="6px" wrap="wrap">
                      <Text fontWeight="700" color={textColor}>{m.t}</Text>
                      {m.rol === A && <Badge colorScheme="purple" fontSize="9px">Solo admin</Badge>}
                    </Flex>
                    <Text fontSize="sm" color="secondaryGray.600">{m.d}</Text>
                  </Box>
                  <Icon as={MdExpandMore} boxSize="22px" color="secondaryGray.600" transform={open ? 'rotate(180deg)' : 'none'} transition="transform .2s" />
                </Flex>
                <Collapse in={open} animateOpacity>
                  <Box as="ol" mt="12px" ps="20px" fontSize="sm" color={textColor} sx={{ li: { mb: '6px' } }}>
                    {m.pasos.map((p) => <li key={p}>{p}</li>)}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
          {!lista.length && <Text color="secondaryGray.600">No hay pantallas con esa búsqueda.</Text>}
        </SimpleGrid>

        <Text fontSize="2xl" fontWeight="800" color={textColor} mt="40px" mb="14px">Preguntas frecuentes</Text>
        <Accordion allowToggle bg={card} borderRadius="20px" overflow="hidden">
          {PREGUNTAS.map(([p, r]) => (
            <AccordionItem key={p} borderColor={borde}>
              <AccordionButton py="14px" px="18px"><Text flex="1" textAlign="left" fontWeight="600" color={textColor}>{p}</Text><AccordionIcon /></AccordionButton>
              <AccordionPanel px="18px" pb="16px"><Text fontSize="sm" color="secondaryGray.600">{r}</Text></AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        <Flex mt="40px" justify="center"><Button as="a" href={base} variant="brand" size="lg" leftIcon={<MdLogin />}>Entrar al sistema</Button></Flex>
      </Box>
    </Box>
  );
}
