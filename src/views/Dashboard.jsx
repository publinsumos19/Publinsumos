import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Flex, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import Chart from 'react-apexcharts';
import {
  MdAccountBalanceWallet, MdAttachMoney, MdBuild, MdCalendarToday, MdDateRange, MdLock, MdMoneyOff, MdPrint, MdRequestQuote, MdSavings, MdTrendingUp,
} from 'react-icons/md';
import { resumenGastos } from '../lib/gastos';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import PagoBadge from '../components/PagoBadge';
import VentaModal from '../components/VentaModal';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { addDays, fdate, intf, LINEAS, mesKey, money, mondayOf, recibo, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { numeroT } from '../lib/trabajo';
import { semaforoEntrega } from '../lib/semaforo';
import Semaforo from '../components/Semaforo';

const sumT = (vs) => vs.reduce((a, v) => a + toNum(v.total), 0);
const costoV = (v) => toNum(v.venta_costos?.costo ?? v.venta_costos?.[0]?.costo);
const COLORES = ['#0B8F63', '#4318FF', '#FFB547', '#E31A1A', '#6AD2FF'];

function Panel({ title, children, action }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  return (
    <Card>
      <Flex justify="space-between" align="center" mb="8px" gap="8px"><Text fontSize="lg" fontWeight="700" color={textColor}>{title}</Text>{action}</Flex>
      {children}
    </Card>
  );
}

export default function Dashboard() {
  const { isAdmin, perfil, cfg } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const axis = useColorModeValue('#A3AED0', '#A3AED0');
  const hoy = today();
  const mes = mesKey(hoy);
  const desde = [addDays(hoy, -29), mes + '-01'].sort()[0];

  const ventas = useLive(() => supabase.from('ventas').select(isAdmin ? '*, venta_costos(costo)' : '*').gte('fecha', desde).order('numero', { ascending: false }), ['ventas'], [desde, isAdmin]);
  const abonos = useLive(() => supabase.from('abonos').select('monto, pago, fecha').gte('fecha', mes + '-01'), ['abonos'], [mes]);
  const cartera = useLive(() => supabase.from('ventas').select('saldo').gt('saldo', 0), ['ventas', 'abonos']);
  const productos = useLive(() => supabase.from('productos').select('*').eq('tipo', 'propio'), ['productos']);
  const trabajos = useLive(() => supabase.from('trabajos').select('*'), ['trabajos']);
  const gastos = useLive(() => supabase.from('gastos').select('monto, pago, caja, categoria, fecha').gte('fecha', mes + '-01'), ['gastos'], [mes]);
  const contador = useLive(() => (isAdmin ? supabase.from('contador').select('*').order('fin', { ascending: false }).limit(12) : Promise.resolve({ data: [] })), ['contador'], [isAdmin]);

  const vs = ventas.data || [];
  const delMes = vs.filter((v) => v.fecha.startsWith(mes));
  const deHoy = vs.filter((v) => v.fecha === hoy);
  const semana = vs.filter((v) => v.fecha >= mondayOf(hoy));
  const mias = deHoy.filter((v) => v.vendedor_id === perfil?.id);
  const ts = trabajos.data || [];
  const porCobrar = (cartera.data || []).reduce((a, v) => a + toNum(v.saldo), 0);
  const privado = ts.filter((t) => t.privado && ['aprobado', 'entregado'].includes(t.estado)).reduce((a, t) => a + toNum(t.saldo), 0);
  const enCurso = ts.filter((t) => t.estado === 'aprobado');
  const abiertas = ts.filter((t) => t.estado === 'cotizacion');
  const itemsMes = delMes.flatMap((v) => v.items);
  const imps = itemsMes.filter((i) => i.tipo === 'imp');
  const clics = (c) => imps.filter((i) => !!i.det?.color === c).reduce((a, i) => a + toNum(i.clics), 0);
  const bajos = (productos.data || []).filter((p) => toNum(p.stock) <= toNum(p.stock_min));

  const dias = useMemo(() => Array.from({ length: isAdmin ? 30 : 7 }, (_, i) => addDays(hoy, i - (isAdmin ? 29 : 6))), [hoy, isAdmin]);
  const serie = dias.map((d) => sumT(vs.filter((v) => v.fecha === d)));
  const lineas = Object.keys(LINEAS).map((k) => itemsMes.filter((i) => (i.tipo || 'serv') === k).reduce((a, i) => a + toNum(i.total), 0));
  const medios = ['efectivo', 'bancolombia', 'nequi', 'transferencia'].map((m) => (abonos.data || []).filter((a) => a.pago === m).reduce((s, a) => s + toNum(a.monto), 0));

  const ultimoCuadre = ['general', 'color', 'bn'].map((tipo) => (contador.data || []).find((r) => (r.tipo || 'general') === tipo)).filter(Boolean);
  const clicsVend = (r) => vs.filter((v) => v.fecha >= r.inicio && v.fecha <= r.fin).flatMap((v) => v.items)
    .filter((i) => i.tipo === 'imp' && ((r.tipo || 'general') === 'general' || (r.tipo === 'color') === !!i.det?.color)).reduce((a, i) => a + toNum(i.clics), 0);
  const tol = toNum(cfg?.tolerancia ?? 5) / 100;

  const serieKey = serie.join(',');
  // Stable chart props: ApexCharts redraws on every new options object, which flickers and can error during navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const area = useMemo(() => ({
    options: {
      chart: { toolbar: { show: false }, fontFamily: 'DM Sans', animations: { enabled: false } },
      dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05 } },
      xaxis: { categories: dias.map((d) => fdate(d).slice(0, 5)), labels: { style: { colors: axis, fontSize: '11px' }, rotate: 0, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false }, tickAmount: 8 },
      yaxis: { labels: { style: { colors: axis, fontSize: '12px' }, formatter: (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)} M` : `$${Math.round(v / 1e3)} mil`) } },
      grid: { strokeDashArray: 5, xaxis: { lines: { show: false } } },
      colors: ['#0B8F63'], tooltip: { theme: 'dark', y: { formatter: (v) => money(v) } },
    },
    series: [{ name: 'Ventas', data: serie }],
  }), [serieKey, axis]);
  const donut = (labels, data) => ({
    options: {
      labels, colors: COLORES, chart: { fontFamily: 'DM Sans', animations: { enabled: false } }, legend: { position: 'bottom', labels: { colors: axis } },
      dataLabels: { enabled: false }, stroke: { width: 0 }, tooltip: { y: { formatter: (v) => money(v) } },
      plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Total', color: axis, formatter: (w) => money(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) }, value: { formatter: (v) => money(v) } } } } },
    },
    series: data,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dLineas = useMemo(() => donut(Object.values(LINEAS), lineas), [lineas.join(','), axis]);
  const mediosL = ['Efectivo', 'Bancolombia', 'Nequi', 'Transferencia'];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dMedios = useMemo(() => donut(mediosL.filter((_, i) => medios[i] || i < 3), medios.filter((v, i) => v || i < 3)), [medios.join(','), axis]);

  const recientes = (
    <DataTable rows={vs.slice(0, 6)} onRowClick={(v) => setOpen(v.id)} empty="Aún no hay ventas."
      columns={[
        { key: 'f', label: 'Venta', render: (v) => (
          <>
            <Text fontWeight="600">{v.cliente}</Text>
            <Text fontSize="xs" color="secondaryGray.600">{recibo(v)} · {fdate(v.fecha)}</Text>
            <Flex gap="4px" wrap="wrap" mt="2px"><PagoBadge v={v} />{v.fe && <Badge colorScheme="blue">F-E</Badge>}</Flex>
          </>
        ) },
        { key: 't', label: 'Total', num: true, render: (v) => money(v.total) },
      ]} />
  );
  // Capped height so a long low-stock list scrolls inside its card.
  const stock = (
    <Box maxH="440px" overflowY="auto" pe="4px">
    <DataTable rows={bajos} empty="Todo el inventario está por encima del mínimo."
      columns={[{ key: 'nombre', label: 'Producto' }, { key: 's', label: 'Stock', num: true, render: (p) => <Badge colorScheme={toNum(p.stock) <= 0 ? 'red' : 'orange'}>{intf(p.stock)} {p.unidad}</Badge> }]} />
    </Box>
  );

  if (!isAdmin) {
    return (
      <Flex direction="column" gap="20px">
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px">
          <MiniStatistics icon={MdAttachMoney} name="Ventas de hoy (tienda)" value={money(sumT(deHoy))} help={`${deHoy.length} ventas`} />
          <MiniStatistics icon={MdCalendarToday} name="Mis ventas de hoy" value={money(sumT(mias))} help={`${mias.length} ventas`} tone="green" />
          <MiniStatistics icon={MdAccountBalanceWallet} name="Cartera del negocio" value={money(porCobrar)} tone="orange" />
          <MiniStatistics icon={MdRequestQuote} name="Cotizaciones abiertas" value={abiertas.length} help={money(abiertas.reduce((a, t) => a + toNum(t.total), 0))} />
        </SimpleGrid>
        <Panel title="Ventas de los últimos 7 días"><Box h="240px"><Chart type="area" height="100%" width="100%" options={area.options} series={area.series} /></Box></Panel>
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" alignItems="start">
          <Panel title="Últimas ventas">{recientes}</Panel>
          <Panel title={`Poco stock${bajos.length ? ` (${bajos.length})` : ''}`}>{stock}</Panel>
        </SimpleGrid>
        <VentaModal ventaId={open} onClose={() => setOpen(null)} />
      </Flex>
    );
  }

  const ganMes = sumT(delMes) - delMes.reduce((a, v) => a + costoV(v), 0);
  const G = resumenGastos(gastos.data || []);
  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3, '2xl': 5 }} gap="20px">
        <MiniStatistics icon={MdAttachMoney} name="Ventas de hoy" value={money(sumT(deHoy))} help={`${deHoy.length} ventas`} />
        <MiniStatistics icon={MdDateRange} name="Esta semana" value={money(sumT(semana))} help={`${semana.length} ventas desde el lunes`} />
        <MiniStatistics icon={MdCalendarToday} name="Este mes" value={money(sumT(delMes))} help={`${delMes.length} ventas`} />
        <MiniStatistics icon={MdTrendingUp} name="Ganancia del mes" value={money(ganMes)} help={`${sumT(delMes) ? Math.round((ganMes / sumT(delMes)) * 100) : 0}% sobre ventas`} tone="green" />
        <MiniStatistics icon={MdAccountBalanceWallet} name="Cartera del negocio" value={money(porCobrar)} help={`${(cartera.data || []).length} ventas con saldo`} tone="orange" />
        <MiniStatistics icon={MdLock} name="Cartera privada" value={money(privado)} help="Trabajos personalizados" tone="purple" />
        <MiniStatistics icon={MdBuild} name="Trabajos en curso" value={enCurso.length} help={`${abiertas.length} cotizaciones abiertas`} />
        <MiniStatistics icon={MdMoneyOff} name="Gastos del mes" value={money(G.total)} help={`${G.n} gastos · efectivo ${money(G.por.efectivo)}`} tone="red" />
        <MiniStatistics icon={MdSavings} name="Utilidad del mes" value={money(ganMes - G.total)} help="Ganancia menos gastos" tone={ganMes - G.total < 0 ? 'red' : 'green'} />
        <MiniStatistics icon={MdPrint} name="Clics del mes" value={intf(clics(true) + clics(false))} help={`Color ${intf(clics(true))} · B/N ${intf(clics(false))}`} />
      </SimpleGrid>

      <Panel title="Ventas de los últimos 30 días"><Box h="260px"><Chart type="area" height="100%" width="100%" options={area.options} series={area.series} /></Box></Panel>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" alignItems="start">
        <Panel title="Ventas del mes por línea">{sumT(delMes) ? <Box h="300px"><Chart type="donut" height="100%" width="100%" options={dLineas.options} series={dLineas.series} /></Box> : <Text color="secondaryGray.600" fontSize="sm">Sin ventas este mes.</Text>}</Panel>
        <Panel title="Dinero recibido este mes">{medios.some(Boolean) ? <Box h="300px"><Chart type="donut" height="100%" width="100%" options={dMedios.options} series={dMedios.series} /></Box> : <Text color="secondaryGray.600" fontSize="sm">Sin pagos este mes.</Text>}</Panel>
        <Panel title="Último cuadre del contador" action={<Text fontSize="sm" color="brand.500" cursor="pointer" onClick={() => navigate('/cuadre')}>Ir al cuadre</Text>}>
          <DataTable rows={ultimoCuadre} empty="Aún no hay cuadres."
            columns={[
              { key: 't', label: 'Contador', render: (r) => <><Text fontWeight="600">{{ general: 'General', color: 'Color', bn: 'Blanco y negro' }[r.tipo || 'general']}</Text><Text fontSize="xs" color="secondaryGray.600">{fdate(r.inicio)} a {fdate(r.fin)}</Text></> },
              { key: 'd', label: 'Diferencia', num: true, render: (r) => { const m = r.contador_final - r.contador_inicial; const d = m - clicsVend(r); return <Badge colorScheme={Math.abs(d) <= tol * Math.max(m, 1) ? 'green' : 'red'}>{intf(d)} {Math.abs(d) <= tol * Math.max(m, 1) ? 'cuadra' : 'revisar'}</Badge>; } },
            ]} />
        </Panel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" alignItems="start">
        <Panel title="Últimas ventas" action={<Text fontSize="sm" color="brand.500" cursor="pointer" onClick={() => navigate('/ventas')}>Ver todas</Text>}>{recientes}</Panel>
        <Panel title="Próximas entregas" action={<Text fontSize="sm" color="brand.500" cursor="pointer" onClick={() => navigate('/cotizador')}>Cotizador</Text>}>
          <DataTable rows={[...enCurso].sort((a, b) => String(a.entrega || '9').localeCompare(String(b.entrega || '9')))} empty="No hay trabajos en curso."
            columns={[
              { key: 'c', label: 'Trabajo', render: (t) => <><Flex gap="6px" align="center"><Text fontWeight="600">{t.cliente}</Text>{t.privado && <Badge colorScheme="purple">Privado</Badge>}</Flex><Text fontSize="xs" color="secondaryGray.600">{numeroT(t)} · {t.titulo}</Text></> },
              { key: 'e', label: 'Entrega', num: true, render: (t) => (t.entrega ? <Flex direction="column" align="flex-end" gap="4px"><Text fontSize="sm">{fdate(t.entrega)}</Text><Semaforo s={semaforoEntrega(t, cfg)} small /></Flex> : '—') },
            ]} />
        </Panel>
        <Panel title={`Poco stock${bajos.length ? ` (${bajos.length})` : ''}`} action={<Text fontSize="sm" color="brand.500" cursor="pointer" onClick={() => navigate('/inventario')}>Inventario</Text>}>{stock}</Panel>
      </SimpleGrid>
      <VentaModal ventaId={open} onClose={() => setOpen(null)} />
    </Flex>
  );
}
