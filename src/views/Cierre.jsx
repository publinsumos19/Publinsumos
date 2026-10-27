import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge, Box, Button, Flex, SimpleGrid, Switch, Text, Tr, Td, useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { MdAccountBalanceWallet, MdAdd, MdAttachMoney, MdCreditCard, MdDownload, MdMoneyOff, MdPrint, MdSave, MdTrendingUp } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import Segmented from '../components/Segmented';
import ShareModal from '../components/ShareModal';
import { Field, NumIn, Sel, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { addDays, fdate, intf, money, mondayOf, PAGOS, recibo, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { cierreHtml, cierreText, privadoHtml, privadoText, resumenCierre } from '../lib/cierre';
import { semaforoCartera } from '../lib/semaforo';
import Semaforo from '../components/Semaforo';
import { ESTADOS } from '../lib/trabajo';
import { canPrint, csvFrom, printHtml, saveFile } from '../lib/export';
import { CAJAS, efectivoPorCaja } from '../lib/caja';
import AperturaCaja from '../components/AperturaCaja';
import GastoModal from '../components/GastoModal';
import { CAJA_LABEL, resumenGastos } from '../lib/gastos';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// The weekly closing runs from Monday to the closing day the owner chose in Ajustes (Saturday by default).
export function semanaDe(fecha, cierreDia = 6) {
  const lunes = mondayOf(fecha);
  return { desde: lunes, hasta: addDays(lunes, ((cierreDia + 6) % 7)) };
}

function Seccion({ title, children, help, tone }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  return (
    <Card>
      <Flex align="center" gap="8px" mb="8px" wrap="wrap">
        <Text fontSize="lg" fontWeight="700" color={textColor}>{title}</Text>
        {tone && <Badge colorScheme={tone}>Solo administrador</Badge>}
      </Flex>
      {help && <Text fontSize="sm" color="secondaryGray.600" mb="8px">{help}</Text>}
      {children}
    </Card>
  );
}

const Pie = ({ cells }) => (
  <Tr>{cells.map((c, i) => <Td key={i} isNumeric={i > 0} fontWeight="700" fontSize="sm" sx={{ fontVariantNumeric: 'tabular-nums' }}>{c}</Td>)}</Tr>
);

export default function Cierre() {
  const { cfg, isAdmin, perfil } = useAuth();
  const toast = useToast();
  const share = useDisclosure();
  const nuevoGasto = useDisclosure();
  const [params] = useSearchParams();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const cierreDia = toNum(cfg?.cierreDia ?? 6);

  const [tipo, setTipo] = useState(isAdmin && params.get('tipo') === 'semanal' ? 'semanal' : 'diario');
  const [dia, setDia] = useState(params.get('dia') || today());
  const [sem, setSem] = useState(() => (params.get('desde') ? { desde: params.get('desde'), hasta: params.get('hasta') || params.get('desde') } : semanaDe(today(), cierreDia)));
  const [contado, setContado] = useState({ impresion: '', insumos: '' });
  const [editBases, setEditBases] = useState(false);
  const [nota, setNota] = useState('');
  const [vista, setVista] = useState('todo');
  const privado = vista !== 'tienda';
  const [filtro, setFiltro] = useState({ ambito: 'todos', tipo: 'todos', desde: '', hasta: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (!isAdmin && tipo !== 'diario') setTipo('diario'); }, [isAdmin, tipo]);

  const desde = tipo === 'diario' ? dia : sem.desde;
  const hasta = tipo === 'diario' ? dia : sem.hasta;
  const deps = [desde, hasta, isAdmin];
  const ventas = useLive(() => supabase.from('ventas').select(isAdmin ? '*, venta_costos(costo)' : '*').gte('fecha', desde).lte('fecha', hasta).order('creado'), ['ventas'], deps);
  const abonos = useLive(() => supabase.from('abonos').select('*, ventas(fecha, numero, cliente, items, total)').gte('fecha', desde).lte('fecha', hasta), ['abonos', 'ventas'], deps);
  const trabajos = useLive(() => supabase.from('trabajos').select('*'), ['trabajos'], deps);
  const tAbonos = useLive(() => supabase.from('trabajo_abonos').select('*, trabajos(privado, cliente, titulo, numero)').gte('fecha', desde).lte('fecha', hasta), ['trabajo_abonos', 'trabajos'], deps);
  const contador = useLive(() => supabase.from('contador').select('*').gte('fin', desde).lte('fin', hasta), ['contador'], deps);
  const perfiles = useLive(() => supabase.from('perfiles').select('id, nombre'), ['perfiles']);
  const cartera = useLive(() => supabase.from('ventas').select('saldo').gt('saldo', 0), ['ventas', 'abonos']);
  const aperturas = useLive(() => supabase.from('aperturas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'), ['aperturas'], deps);
  const diarios = useLive(() => supabase.from('cierres').select('*').eq('tipo', 'diario').gte('desde', desde).lte('desde', hasta), ['cierres'], deps);
  const gastos = useLive(() => supabase.from('gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'), ['gastos'], deps);
  const historial = useLive(() => supabase.from('cierres').select('*').order('creado', { ascending: false }).limit(300), ['cierres']);

  const listo = [ventas, abonos, trabajos, tAbonos, contador].every((q) => q.data);
  const R = useMemo(() => (listo ? resumenCierre({
    desde, hasta, cfg, admin: isAdmin, incluirPrivado: privado,
    ventas: ventas.data, abonos: abonos.data, trabajos: trabajos.data, trabajoAbonos: tAbonos.data, contador: contador.data,
    perfiles: perfiles.data || [], cartera: (cartera.data || []).reduce((a, v) => a + toNum(v.saldo), 0),
  }) : null), [listo, desde, hasta, cfg, isAdmin, privado, ventas.data, abonos.data, trabajos.data, tAbonos.data, contador.data, perfiles.data, cartera.data]);

  if (!R) return <Text color="secondaryGray.600">Cargando…</Text>;

  // Daily closing: each drawer starts with the base from that day's opening.
  const apertura = tipo === 'diario' ? (aperturas.data || []).find((a) => a.fecha === dia) : null;
  const ef = efectivoPorCaja(abonos.data || [], tAbonos.data || []);
  // Expenses paid in cash come out of the drawer they were taken from.
  const G = resumenGastos(gastos.data || []);
  const cajas = CAJAS.map((c) => {
    const base = toNum(apertura?.[c.base]);
    const esp = base + ef[c.k] - G.caja[c.k];
    return { ...c, base, efectivo: ef[c.k], gastos: G.caja[c.k], esperado: esp, contado: contado[c.k], dif: contado[c.k] === '' ? null : toNum(contado[c.k]) - esp };
  });
  const esperado = cajas.reduce((a, c) => a + c.esperado, 0);
  const contadoTotal = cajas.every((c) => c.contado !== '') ? cajas.reduce((a, c) => a + toNum(c.contado), 0) : null;
  const extra = tipo === 'diario' ? { cajas, apertura: !!apertura, esperado, nota, usuario: perfil?.nombre, gastos: gastos.data || [], G } : { nota, usuario: perfil?.nombre, gastos: gastos.data || [], G };
  const titulo = tipo === 'semanal' ? `Cierre semanal del ${fdate(desde)} al ${fdate(hasta)}` : `Cierre del día ${fdate(desde)}`;
  const archivo = `cierre-${tipo}-${desde}${desde !== hasta ? '-a-' + hasta : ''}`;

  const guardar = async () => {
    setBusy(true);
    const { error } = await supabase.from('cierres').insert(soloPriv ? {
      tipo, desde, hasta, nota: nota.trim(), ambito: 'privado',
      resumen: { ventas: { total: 0, n: 0 }, recibido: { total: R.privado.recibido }, privado: { recibido: R.privado.recibido, saldo: R.privado.saldo, cotizado: R.privado.cotizado, nuevos: R.privado.nuevos.length } },
    } : {
      tipo, desde, hasta, nota: nota.trim(), ambito: 'tienda',
      ...(tipo === 'diario' ? {
        base: cajas.reduce((a, c) => a + c.base, 0), efectivo_contado: contadoTotal, base_impresion: cajas[0].base, base_insumos: cajas[1].base,
        contado_impresion: contado.impresion === '' ? null : toNum(contado.impresion), contado_insumos: contado.insumos === '' ? null : toNum(contado.insumos),
      } : {}),
      resumen: { ventas: R.ventas, recibido: R.recibido, credito: R.credito, lineas: R.lineas.map(({ k, total }) => ({ k, total })), esperado, fe: R.fe, gastos: G.total },
    });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('cierres');
    toast({ title: 'Cierre guardado', status: 'success' });
  };
  const filtrando = filtro.ambito !== 'todos' || filtro.tipo !== 'todos' || filtro.desde || filtro.hasta;
  const guardados = (historial.data || []).filter((c) => (filtro.ambito === 'todos' || (c.ambito || 'tienda') === filtro.ambito)
    && (filtro.tipo === 'todos' || c.tipo === filtro.tipo) && (!filtro.desde || c.hasta >= filtro.desde) && (!filtro.hasta || c.desde <= filtro.hasta));
  const soloPriv = isAdmin && vista === 'privado' && R.privado;
  const htmlDe = () => (soloPriv ? privadoHtml : cierreHtml)(cfg?.negocio, R, tipo, extra);
  const textoDe = () => (soloPriv ? privadoText : cierreText)(cfg?.negocio, R, tipo, extra);
  const imprimir = async () => {
    const html = htmlDe();
    if (canPrint()) return printHtml(html);
    try {
      if (await saveFile(`${archivo}.html`, html)) toast({ title: 'Abre el archivo descargado y usa Imprimir o Guardar como PDF.', status: 'info', duration: 6000 });
    } catch (e) { toast({ title: e.message, status: 'error' }); }
  };
  const descargar = async (fmt) => {
    try {
      if (fmt === 'html') return await saveFile(`${archivo}${soloPriv ? '-privado' : ''}.html`, htmlDe(), 'text/html;charset=utf-8');
      const rows = [['Fecha', 'Recibo', 'Cliente', 'Línea', 'Detalle', 'Cantidad', 'Precio unitario', 'Total ítem', 'Clics', 'Color', 'Pago', 'F-E', 'Total venta', 'Saldo']];
      for (const v of ventas.data) for (const i of v.items) {
        rows.push([fdate(v.fecha), recibo(v), v.cliente, i.tipo, i.desc, i.cant, i.pu, i.total, i.clics || 0, i.tipo === 'imp' ? (i.det?.color ? 'Color' : 'B/N') : '', PAGOS[v.pago], v.fe ? 'Sí' : 'No', v.total, v.saldo]);
      }
      return await saveFile(`${archivo}.csv`, csvFrom(rows), 'text/csv;charset=utf-8');
    } catch (e) { return toast({ title: e.message, status: 'error' }); }
  };

  const lineCols = [
    { key: 'label', label: 'Línea de negocio' },
    { key: 'n', label: 'Ítems', num: true, render: (l) => intf(l.n) },
    { key: 'total', label: 'Ventas', num: true, render: (l) => money(l.total) },
    ...(isAdmin ? [
      { key: 'costo', label: 'Costo', num: true, render: (l) => money(l.costo) },
      { key: 'g', label: 'Ganancia', num: true, render: (l) => money(l.total - l.costo) },
    ] : []),
  ];

  return (
    <Flex direction="column" gap="20px">
      <Card>
        <Flex gap="12px" wrap="wrap" align="center" mb="14px">
          <Box me="auto">
            <Text fontSize="22px" fontWeight="700" color={textColor}>Cierre de caja</Text>
            <Text fontSize="sm" color="secondaryGray.600">{titulo}</Text>
          </Box>
          <Segmented value={tipo} onChange={setTipo} options={isAdmin ? [['diario', 'Diario'], ['semanal', 'Semanal']] : [['diario', 'Diario']]} />
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="14px" alignItems="end">
          {tipo === 'diario' ? (
            <Field label="Día"><TextIn type="date" value={dia} onChange={(e) => setDia(e.target.value || today())} /></Field>
          ) : (
            <>
              <Field label="Desde"><TextIn type="date" value={sem.desde} onChange={(e) => setSem({ ...sem, desde: e.target.value })} /></Field>
              <Field label={`Hasta (cierre los ${DIAS[cierreDia]})`}><TextIn type="date" value={sem.hasta} onChange={(e) => setSem({ ...sem, hasta: e.target.value })} /></Field>
              <Flex gap="8px">
                <Button variant="light" onClick={() => setSem(semanaDe(addDays(sem.desde, -7), cierreDia))}>Semana anterior</Button>
                <Button variant="light" onClick={() => setSem(semanaDe(today(), cierreDia))}>Esta semana</Button>
              </Flex>
            </>
          )}
          {isAdmin && (
            <Field label="Ver" gridColumn={{ md: 'span 2' }} overflowX="auto">
              <Segmented nowrap value={vista} onChange={setVista} options={[['todo', 'Tienda y privado'], ['tienda', 'Solo tienda'], ['privado', 'Solo privado']]} />
            </Field>
          )}
        </SimpleGrid>
      </Card>

      {soloPriv ? (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px">
            <MiniStatistics icon={MdAccountBalanceWallet} name="Recibido privado" value={money(R.privado.recibido)} help={`${R.privado.abonos.length} abonos`} tone="purple" />
            <MiniStatistics icon={MdCreditCard} name="Saldo privado por cobrar" value={money(R.privado.saldo)} help={`${R.privado.pendientes.length} trabajos`} tone="orange" />
            <MiniStatistics icon={MdAttachMoney} name="Cotizado en el periodo" value={money(R.privado.cotizado)} help={`${R.privado.nuevos.length} trabajos nuevos`} />
            <MiniStatistics icon={MdMoneyOff} name="Retenciones" value={money(R.privado.retenciones)} help="Descontadas en el periodo" tone="red" />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" alignItems="start">
            <Seccion title="Abonos privados recibidos" tone="purple" help="Solo tus trabajos privados. No se suman a la caja de la tienda.">
              <DataTable rows={R.privado.abonos} empty="No recibiste abonos privados en este periodo."
                columns={[
                  { key: 'fecha', label: 'Fecha', render: (a) => fdate(a.fecha) },
                  { key: 'c', label: 'Cliente', render: (a) => <><Text fontWeight="600">{a.trabajos?.cliente}</Text><Text fontSize="xs" color="secondaryGray.600">{a.trabajos?.titulo}</Text></> },
                  { key: 'p', label: 'Medio', render: (a) => PAGOS[a.pago] },
                  { key: 'm', label: 'Valor', num: true, render: (a) => money(a.monto) },
                ]}
                footer={R.privado.recibido ? <Pie cells={['Total', '', '', money(R.privado.recibido)]} /> : null} />
              <Field label="Nota del cierre (opcional)" mt="12px"><TextIn value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
              <Flex gap="10px" mt="14px" wrap="wrap">
                <Button variant="brand" leftIcon={<MdSave />} onClick={guardar} isLoading={busy}>Guardar cierre privado</Button>
                <Button leftIcon={<FaWhatsapp />} bg="#25D366" color="white" _hover={{ bg: '#1ebe5b' }} onClick={() => { setMsg({ title: `${titulo} (privado)`, text: textoDe(), tel: '' }); share.onOpen(); }}>Enviar</Button>
                <Button variant="light" leftIcon={<MdPrint />} onClick={imprimir}>Imprimir</Button>
                <Button variant="light" leftIcon={<MdDownload />} onClick={() => descargar('html')}>Descargar</Button>
              </Flex>
            </Seccion>
            <Seccion title="Saldo privado por cobrar" tone="purple">
              <DataTable rows={R.privado.pendientes} empty="Nadie te debe trabajos privados."
                columns={[
                  { key: 'c', label: 'Cliente y trabajo', render: (t) => <><Text fontWeight="600">{t.cliente}</Text><Text fontSize="xs" color="secondaryGray.600">{t.titulo}</Text></> },
                  { key: 'd', label: 'Desde', render: (t) => <Semaforo s={semaforoCartera(t.fecha, cfg)} small /> },
                  { key: 's', label: 'Saldo', num: true, render: (t) => money(t.saldo) },
                ]}
                footer={R.privado.saldo ? <Pie cells={['Total', '', money(R.privado.saldo)]} /> : null} />
            </Seccion>
            <Seccion title="Trabajos privados nuevos" tone="purple">
              <DataTable rows={R.privado.nuevos} empty="No hay trabajos privados nuevos en este periodo."
                columns={[
                  { key: 'f', label: 'Fecha', render: (t) => fdate(t.fecha) },
                  { key: 'c', label: 'Cliente y trabajo', render: (t) => <><Text fontWeight="600">{t.cliente}</Text><Text fontSize="xs" color="secondaryGray.600">{t.titulo}</Text></> },
                  { key: 'e', label: 'Estado', render: (t) => (ESTADOS[t.estado] || [t.estado])[0] },
                  { key: 't', label: 'Total', num: true, render: (t) => money(t.total) },
                ]} />
            </Seccion>
          </SimpleGrid>
        </>
      ) : (
        <>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3, '2xl': 5 }} gap="20px">
        <MiniStatistics icon={MdAttachMoney} name="Ventas" value={money(R.ventas.total)} help={`${R.ventas.n} ventas · promedio ${money(R.ventas.promedio)}`} />
        <MiniStatistics icon={MdAccountBalanceWallet} name="Dinero recibido" value={money(R.recibido.total)} help={`Abonos a cartera: ${money(R.recibido.deCartera)}`} />
        <MiniStatistics icon={MdCreditCard} name="Fiado en el periodo" value={money(R.credito.saldo)} help={`${R.credito.n} ventas a crédito`} tone="orange" />
        {isAdmin
          ? <MiniStatistics icon={MdTrendingUp} name="Ganancia estimada" value={money(R.ventas.ganancia)} help={`${R.ventas.total ? Math.round((R.ventas.ganancia / R.ventas.total) * 100) : 0}% sobre ventas · después de gastos ${money(R.ventas.ganancia - G.total)}`} tone="green" />
          : <MiniStatistics icon={MdAccountBalanceWallet} name="Cartera por cobrar" value={money(R.cartera)} tone="orange" />}
        <MiniStatistics icon={MdMoneyOff} name="Gastos" value={money(G.total)} help={`${G.n} gastos · en efectivo ${money(G.por.efectivo)}`} tone="red" />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" alignItems="start">
        <Seccion title={tipo === 'diario' ? 'Apertura y cuadre de las cajas' : 'Cierres diarios de la semana'}
          help={tipo === 'diario' ? 'Cada caja empieza con su base. Cuenta la plata de cada cajón y escríbela: la app la compara con lo que debería haber.' : 'Cada día debe tener su apertura y su cierre de caja.'}>
          {tipo === 'diario' ? (
            <>
              {!apertura || editBases ? (
                <Box bg={panel} borderRadius="16px" p="14px" mb="12px">
                  <Text fontWeight="700" mb="6px">{apertura ? 'Corregir bases' : `La caja del ${fdate(dia)} no se abrió`}</Text>
                  <AperturaCaja fecha={dia} apertura={apertura} onDone={() => setEditBases(false)} compact />
                </Box>
              ) : (
                <Flex fontSize="sm" mb="10px" gap="8px" align="center" wrap="wrap">
                  <Badge colorScheme="green">Caja abierta</Badge>
                  <Text>por {(perfiles.data || []).find((x) => x.id === apertura.usuario_id)?.nombre || '—'}</Text>
                  <Button size="xs" variant="ghost" onClick={() => setEditBases(true)}>Corregir bases</Button>
                </Flex>
              )}
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px">
                {cajas.map((c) => (
                  <Box key={c.k} bg={panel} borderRadius="16px" p="14px" fontSize="sm">
                    <Text fontWeight="700" mb="6px">{c.label}</Text>
                    <Flex justify="space-between"><Text>Base</Text><Text fontWeight="700">{money(c.base)}</Text></Flex>
                    <Flex justify="space-between"><Text>Efectivo recibido</Text><Text fontWeight="700">{money(c.efectivo)}</Text></Flex>
                    <Flex justify="space-between"><Text>Gastos de esta caja</Text><Text fontWeight="700" color="red.500" whiteSpace="nowrap">{c.gastos ? '-' + money(c.gastos) : money(0)}</Text></Flex>
                    <Flex justify="space-between" mb="8px"><Text>Debería haber</Text><Text fontWeight="700">{money(c.esperado)}</Text></Flex>
                    <Field label="Efectivo contado"><NumIn min={0} value={c.contado} onChange={(e) => setContado({ ...contado, [c.k]: e.target.value })} placeholder="Escribe lo que hay" bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                    {c.dif != null && (
                      <Flex justify="space-between" mt="8px" align="center"><Text>Diferencia</Text>
                        <Badge colorScheme={Math.abs(c.dif) < 1 ? 'green' : c.dif > 0 ? 'blue' : 'red'} fontSize="sm">{Math.abs(c.dif) < 1 ? 'Cuadra' : `${c.dif > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(c.dif))}`}</Badge>
                      </Flex>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
              <Flex justify="space-between" fontSize="sm" mt="10px" px="4px"><Text>Total que debería haber en las dos cajas</Text><Text fontWeight="700">{money(esperado)}</Text></Flex>
              <Text fontSize="xs" color="secondaryGray.600" px="4px">El efectivo de una venta se reparte entre las cajas según lo que se vendió de impresión y de insumos. Terceros y trabajos van a la caja de insumos. Los gastos en efectivo se restan de la caja de donde salieron.</Text>
            </>
          ) : (
            <DataTable
              rows={(() => { const out = []; for (let d = desde; d <= hasta; d = addDays(d, 1)) out.push(d); return out; })().map((d) => {
                const a = (aperturas.data || []).find((x) => x.fecha === d);
                const c = (diarios.data || []).find((x) => x.desde === d);
                return { id: d, d, a, c, ventas: (ventas.data || []).filter((v) => v.fecha === d).length };
              }).filter((r) => r.a || r.c || r.ventas)}
              empty="No hubo movimiento esta semana."
              columns={[
                { key: 'd', label: 'Día', render: (r) => fdate(r.d) },
                { key: 'a', label: 'Bases', num: true, render: (r) => (r.a ? money(toNum(r.a.base_impresion) + toNum(r.a.base_insumos)) : <Badge colorScheme="orange">Sin apertura</Badge>) },
                { key: 'e', label: 'Cierre', num: true, render: (r) => {
                  if (!r.c) return <Button size="xs" variant="outline" colorScheme="red" onClick={() => { setTipo('diario'); setDia(r.d); }}>Sin cerrar · cerrar</Button>;
                  if (r.c.efectivo_contado == null) return <Badge colorScheme="gray">Cerrada</Badge>;
                  const dd = toNum(r.c.efectivo_contado) - toNum(r.c.resumen?.esperado);
                  return <Badge colorScheme={Math.abs(dd) < 1 ? 'green' : dd > 0 ? 'blue' : 'red'}>{Math.abs(dd) < 1 ? 'Cuadró' : `${dd > 0 ? 'Sobró' : 'Faltó'} ${money(Math.abs(dd))}`}</Badge>;
                } },
              ]}
            />
          )}
          <Field label="Nota del cierre (opcional)" mt="12px"><TextIn value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. el cliente pagó con billete de $100.000" /></Field>
          <Flex gap="10px" mt="14px" wrap="wrap">
            <Button variant="brand" leftIcon={<MdSave />} onClick={guardar} isLoading={busy}>Guardar cierre</Button>
            <Button leftIcon={<FaWhatsapp />} bg="#25D366" color="white" _hover={{ bg: '#1ebe5b' }} onClick={() => { setMsg({ title: titulo, text: textoDe(), tel: '' }); share.onOpen(); }}>Enviar</Button>
            <Button variant="light" leftIcon={<MdPrint />} onClick={imprimir}>Imprimir</Button>
            <Button variant="light" leftIcon={<MdDownload />} onClick={() => descargar('html')}>Descargar</Button>
            <Button variant="light" leftIcon={<MdDownload />} onClick={() => descargar('csv')}>Excel (CSV)</Button>
          </Flex>
        </Seccion>

        <Seccion title="Gastos del periodo" help="Domicilios, transporte, compras y pagos del negocio. Los de efectivo ya se restaron de su caja.">
          <DataTable rows={gastos.data} empty="No se registraron gastos."
            columns={[
              ...(tipo === 'semanal' ? [{ key: 'fecha', label: 'Fecha', render: (g) => fdate(g.fecha) }] : []),
              { key: 'concepto', label: 'Gasto', render: (g) => <><Text fontWeight="600">{g.concepto}</Text><Text fontSize="xs" color="secondaryGray.600">{g.categoria}</Text></> },
              { key: 'pago', label: 'Pago', render: (g) => <><Text fontSize="sm">{PAGOS[g.pago]}</Text>{g.caja && <Text fontSize="xs" color="secondaryGray.600">{CAJA_LABEL[g.caja]}</Text>}</> },
              { key: 'monto', label: 'Valor', num: true, render: (g) => money(g.monto) },
            ]}
            footer={gastos.data?.length ? <Pie cells={[...(tipo === 'semanal' ? [''] : []), 'Total', '', money(G.total)]} /> : null} />
          <Flex justify="space-between" fontSize="sm" mt="10px" px="4px"><Text>Recibido menos gastos</Text><Text fontWeight="700">{money(R.recibido.total - G.total)}</Text></Flex>
          <Button mt="12px" size="sm" variant="lightBrand" leftIcon={<MdAdd />} onClick={nuevoGasto.onOpen}>Registrar gasto</Button>
          <GastoModal isOpen={nuevoGasto.isOpen} onClose={nuevoGasto.onClose} fecha={tipo === 'diario' ? dia : today()} />
        </Seccion>

        <Seccion title="Dinero recibido por medio de pago" help="Pagos de las ventas del periodo más los abonos que llegaron a deudas anteriores.">
          <DataTable rows={Object.entries(R.recibido.por).filter(([k, v]) => v || k !== 'transferencia').map(([k, v]) => ({ id: k, k: PAGOS[k], v }))}
            columns={[{ key: 'k', label: 'Medio' }, { key: 'v', label: 'Recibido', num: true, render: (r) => money(r.v) }]}
            footer={<Pie cells={['Total', money(R.recibido.total)]} />} />
          <Text fontSize="lg" fontWeight="700" color={textColor} mt="16px" mb="4px">Ventas por forma de pago</Text>
          <DataTable rows={R.ventasPorPago.map((p) => ({ ...p, id: p.k }))}
            columns={[{ key: 'label', label: 'Forma de pago' }, { key: 'n', label: 'Ventas', num: true }, { key: 'total', label: 'Total', num: true, render: (p) => money(p.total) }]} />
        </Seccion>
      </SimpleGrid>

      <Seccion title="Ventas por línea de negocio">
        <DataTable rows={R.lineas.map((l) => ({ ...l, id: l.k }))} columns={lineCols}
          footer={<Pie cells={['Total', intf(R.lineas.reduce((a, l) => a + l.n, 0)), money(R.ventas.total), ...(isAdmin ? [money(R.ventas.costo), money(R.ventas.ganancia)] : [])]} />} />
      </Seccion>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" alignItems="start">
        <Seccion title="Fotocopiadora: color y blanco y negro">
          <DataTable rows={[{ id: 'c', k: 'Color', ...R.impresiones.color }, { id: 'b', k: 'Blanco y negro', ...R.impresiones.bn }]}
            columns={[{ key: 'k', label: 'Tipo' }, { key: 'cant', label: 'Impresiones', num: true, render: (r) => intf(r.cant) }, { key: 'clics', label: 'Clics', num: true, render: (r) => intf(r.clics) }, { key: 'total', label: 'Ventas', num: true, render: (r) => money(r.total) }, ...(isAdmin ? [{ key: 'costo', label: 'Costo', num: true, render: (r) => money(r.costo) }] : [])]} />
          <Text fontSize="md" fontWeight="700" color={textColor} mt="14px">Por papel</Text>
          <DataTable rows={R.impresiones.porPapel.map((g) => ({ ...g, id: g.k }))} empty="Sin impresiones."
            columns={[{ key: 'k', label: 'Papel' }, { key: 'cant', label: 'Impresiones', num: true, render: (g) => intf(g.cant) }, { key: 'clics', label: 'Clics', num: true, render: (g) => intf(g.clics) }, { key: 'total', label: 'Ventas', num: true, render: (g) => money(g.total) }]} />
        </Seccion>
        <Seccion title="Contador de la máquina" help={R.contador.length ? 'Lecturas guardadas en Cuadre que cierran dentro de este periodo.' : 'No hay lecturas del contador que cierren en este periodo. Regístralas en Cuadre.'}>
          {R.contador.length > 0 && (
            <DataTable rows={R.contador.map((c) => ({ ...c, id: c.tipo }))}
              columns={[{ key: 'label', label: 'Contador', render: (c) => ({ general: 'General', color: 'Color', bn: 'B/N' }[c.tipo]) }, { key: 'l', label: 'Lecturas', num: true, render: (c) => `${intf(c.ini)} → ${intf(c.finC)}` }, { key: 'maquina', label: 'Máquina', num: true, render: (c) => intf(c.maquina) }, { key: 'vendidos', label: 'Vendidos', num: true, render: (c) => intf(c.vendidos) },
                { key: 'dif', label: 'Diferencia', num: true, render: (c) => <Badge colorScheme={Math.abs(c.dif) <= (toNum(cfg?.tolerancia ?? 5) / 100) * Math.max(c.maquina, 1) ? 'green' : 'red'}>{intf(c.dif)}</Badge> }]} />
          )}
          <Text fontSize="md" fontWeight="700" color={textColor} mt="14px">Factura electrónica</Text>
          <DataTable rows={[{ id: 's', k: 'Con F-E', ...R.fe }, { id: 'n', k: 'Sin F-E', ...R.sinFe }]}
            columns={[{ key: 'k', label: 'F-E' }, { key: 'n', label: 'Ventas', num: true }, { key: 'total', label: 'Total', num: true, render: (r) => money(r.total) }]} />
        </Seccion>
        <Seccion title="Insumos vendidos">
          <DataTable rows={R.productos.map((g) => ({ ...g, id: g.k }))} empty="No se vendieron insumos."
            columns={[{ key: 'k', label: 'Producto' }, { key: 'cant', label: 'Cantidad', num: true, render: (g) => intf(g.cant) }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} />
        </Seccion>
        <Seccion title="Productos y servicios de terceros">
          <DataTable rows={R.terceros.map((g) => ({ ...g, id: g.k }))} empty="No hubo ventas de terceros."
            columns={[{ key: 'k', label: 'Servicio', render: (g) => <><Text>{g.k}</Text>{g.proveedor && <Text fontSize="xs" color="secondaryGray.600">{g.proveedor}</Text>}</> }, { key: 'cant', label: 'Cantidad', num: true, render: (g) => intf(g.cant) }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) },
              ...(isAdmin ? [{ key: 'costo', label: 'Para el proveedor', num: true, render: (g) => money(g.costo) }] : [])]} />
        </Seccion>
        <Seccion title="Trabajos personalizados de la tienda">
          <DataTable rows={R.personalizados.map((g) => ({ ...g, id: g.k }))} empty="No se vendieron trabajos personalizados."
            columns={[{ key: 'k', label: 'Trabajo' }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} />
          {R.trabajosTienda.recibido > 0 && <Text fontSize="sm" mt="8px">Anticipos recibidos de cotizaciones de la tienda: <b>{money(R.trabajosTienda.recibido)}</b></Text>}
        </Seccion>
        <Seccion title="Por vendedor">
          <DataTable rows={R.vendedores.map((g) => ({ ...g, id: g.k }))} empty="Sin ventas."
            columns={[{ key: 'k', label: 'Vendedor' }, { key: 'n', label: 'Ventas', num: true }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} />
        </Seccion>
        {R.porDia.length > 1 && (
          <Seccion title="Ventas por día">
            <DataTable rows={R.porDia.map((g) => ({ ...g, id: g.k }))}
              columns={[{ key: 'k', label: 'Día', render: (g) => fdate(g.k) }, { key: 'n', label: 'Ventas', num: true }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} />
          </Seccion>
        )}
        {R.privado && (
          <Seccion title="Trabajos personalizados (privado)" tone="purple" help="Tu cartera privada. No se suma a la caja del negocio.">
            <DataTable rows={Object.entries(R.privado.recibidoPor).filter(([, v]) => v).map(([k, v]) => ({ id: k, k: PAGOS[k], v }))} empty="No recibiste abonos privados en este periodo."
              columns={[{ key: 'k', label: 'Medio' }, { key: 'v', label: 'Recibido', num: true, render: (r) => money(r.v) }]}
              footer={R.privado.recibido ? <Pie cells={['Total', money(R.privado.recibido)]} /> : null} />
            <Text fontSize="sm" mt="8px">Nuevos trabajos: <b>{R.privado.nuevos.length}</b> · Saldo privado por cobrar: <b>{money(R.privado.saldo)}</b></Text>
          </Seccion>
        )}
      </SimpleGrid>
        </>
      )}

      <Card>
        <Flex align="center" gap="10px" wrap="wrap" mb="10px">
          <Text fontSize="lg" fontWeight="700" color={textColor} me="auto">Cierres guardados</Text>
          <Text fontSize="sm" color="secondaryGray.600">{guardados.length} cierre{guardados.length === 1 ? '' : 's'}</Text>
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2, xl: isAdmin ? 5 : 4 }} gap="12px" mb="12px" alignItems="end">
          {isAdmin && <Field label="De"><Sel value={filtro.ambito} onChange={(e) => setFiltro({ ...filtro, ambito: e.target.value })} options={[['todos', 'Tienda y privado'], ['tienda', 'Solo tienda'], ['privado', 'Solo privado (admin)']]} /></Field>}
          <Field label="Tipo"><Sel value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })} options={[['todos', 'Diarios y semanales'], ['diario', 'Diarios'], ['semanal', 'Semanales']]} /></Field>
          <Field label="Desde"><TextIn type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></Field>
          <Field label="Hasta"><TextIn type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></Field>
          <Button variant="ghost" onClick={() => setFiltro({ ambito: 'todos', tipo: 'todos', desde: '', hasta: '' })}>Quitar filtros</Button>
        </SimpleGrid>
        <DataTable rows={guardados.slice(0, filtrando ? 300 : 20)} empty={filtrando ? 'No hay cierres con estos filtros.' : 'Aún no hay cierres guardados.'}
          columns={[
            { key: 'amb', label: 'De', render: (c) => (c.ambito === 'privado' ? <Badge colorScheme="purple">Privado</Badge> : <Badge colorScheme="gray">Tienda</Badge>) },
            { key: 'tipo', label: 'Cierre', render: (c) => <><Badge colorScheme={c.tipo === 'semanal' ? 'purple' : 'green'}>{c.tipo}</Badge><Text fontSize="xs" color="secondaryGray.600">{c.desde === c.hasta ? fdate(c.desde) : `${fdate(c.desde)} al ${fdate(c.hasta)}`}</Text></> },
            { key: 'v', label: 'Ventas', num: true, render: (c) => (c.ambito === 'privado' ? <Text fontSize="xs" color="secondaryGray.600">Saldo {money(c.resumen?.privado?.saldo)}</Text> : money(c.resumen?.ventas?.total)) },
            { key: 'r', label: 'Recibido', num: true, render: (c) => money(c.resumen?.recibido?.total) },
            { key: 'd', label: 'Efectivo', num: true, render: (c) => (c.efectivo_contado == null ? '—' : (() => { const d = toNum(c.efectivo_contado) - toNum(c.resumen?.esperado); return <Badge colorScheme={Math.abs(d) < 1 ? 'green' : d > 0 ? 'blue' : 'red'}>{Math.abs(d) < 1 ? 'Cuadró' : `${d > 0 ? 'Sobró' : 'Faltó'} ${money(Math.abs(d))}`}</Badge>; })()) },
            { key: 'u', label: 'Hizo', render: (c) => (perfiles.data || []).find((p) => p.id === c.usuario_id)?.nombre || '' },
            { key: 'x', label: '', num: true, render: (c) => <Button size="xs" variant="lightBrand" onClick={() => { setTipo(isAdmin ? c.tipo : 'diario'); if (isAdmin) setVista(c.ambito === 'privado' ? 'privado' : 'todo'); if (c.tipo === 'diario') setDia(c.desde); else setSem({ desde: c.desde, hasta: c.hasta }); setContado({ impresion: c.contado_impresion == null ? '' : String(c.contado_impresion), insumos: c.contado_insumos == null ? '' : String(c.contado_insumos) }); setNota(c.nota || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Ver</Button> },
          ]} />
      </Card>
      {msg && <ShareModal isOpen={share.isOpen} onClose={share.onClose} {...msg} />}
    </Flex>
  );
}
