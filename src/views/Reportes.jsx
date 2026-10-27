import { useMemo, useState } from 'react';
import { Box, Button, Flex, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import Chart from 'react-apexcharts';
import { MdAccountBalanceWallet, MdAttachMoney, MdMoneyOff, MdPrint, MdSavings, MdTrendingUp } from 'react-icons/md';
import { resumenGastos } from '../lib/gastos';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import Segmented from '../components/Segmented';
import { Sel } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { addDays, fdate, intf, lastMonths, mesKey, mesLabel, money, mondayOf, monthRange, PAGOS, recibo, shiftMonth, today } from '../lib/format';
import { toNum } from '../lib/pricing';

function rango(periodo, mes) {
  const t = today();
  if (periodo === 'semana') { const a = mondayOf(t); return { desde: a, hasta: addDays(a, 6), label: 'Esta semana' }; }
  const k = periodo === 'mes' ? mesKey(t) : periodo === 'anterior' ? shiftMonth(mesKey(t), -1) : mes;
  return { ...monthRange(k), label: mesLabel(k) };
}

function group(arr, key, val = (i) => toNum(i.total)) {
  const g = {};
  for (const i of arr) {
    const k = key(i);
    g[k] ||= { id: k, k, n: 0, cant: 0, total: 0, clics: 0 };
    g[k].n += 1; g[k].cant += toNum(i.cant); g[k].total += val(i); g[k].clics += toNum(i.clics);
  }
  return Object.values(g).sort((a, b) => b.total - a.total);
}

function Mini({ title, children }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  return <Card><Text fontSize="lg" fontWeight="700" color={textColor} mb="8px">{title}</Text>{children}</Card>;
}

export default function Reportes() {
  const { cfg } = useAuth();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [periodo, setPeriodo] = useState('mes');
  const [mes, setMes] = useState(mesKey(today()));
  const R = rango(periodo, mes);
  const ventas = useLive(() => supabase.from('ventas').select('*, venta_costos(costo)').gte('fecha', R.desde).lte('fecha', R.hasta).order('creado'), ['ventas'], [R.desde, R.hasta]);
  const deudas = useLive(() => supabase.from('ventas').select('saldo').gt('saldo', 0), ['ventas', 'abonos']);
  const productos = useLive(() => supabase.from('productos').select('*').eq('tipo', 'propio'), ['productos']);
  const gastos = useLive(() => supabase.from('gastos').select('*').gte('fecha', R.desde).lte('fecha', R.hasta), ['gastos'], [R.desde, R.hasta]);
  const G = resumenGastos(gastos.data || []);

  const vs = ventas.data || [];
  const tot = vs.reduce((a, v) => a + toNum(v.total), 0);
  const costo = vs.reduce((a, v) => a + toNum(v.venta_costos?.costo ?? v.venta_costos?.[0]?.costo), 0);
  const items = vs.flatMap((v) => v.items);
  const imps = items.filter((i) => i.tipo === 'imp');
  const porCobrar = (deudas.data || []).reduce((a, v) => a + toNum(v.saldo), 0);
  const susName = (id) => cfg?.sustratos?.find((s) => s.id === id)?.nombre || 'Otro papel';

  const dias = useMemo(() => {
    const out = [];
    for (let d = R.desde; d <= R.hasta; d = addDays(d, 1)) out.push(d);
    return out;
  }, [R.desde, R.hasta]);
  const porDia = dias.map((d) => vs.filter((v) => v.fecha === d).reduce((a, v) => a + toNum(v.total), 0));

  const porDiaKey = porDia.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chart = useMemo(() => ({
    options: {
      chart: { toolbar: { show: false }, fontFamily: 'DM Sans', animations: { enabled: false } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: dias.map((d) => Number(d.slice(8))), labels: { style: { colors: '#A3AED0', fontSize: '12px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { colors: '#A3AED0', fontSize: '12px' }, formatter: (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)} M` : `$${Math.round(v / 1e3)} mil`) } },
      grid: { strokeDashArray: 5, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      colors: ['#0B8F63'],
      tooltip: { theme: 'dark', y: { formatter: (v) => money(v) }, x: { formatter: (_v, o) => fdate(dias[o.dataPointIndex]) } },
    },
    series: [{ name: 'Ventas', data: porDia }],
  }), [porDiaKey, dias]);

  const csv = () => {
    const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [['Fecha', 'Recibo', 'Cliente', 'Tipo', 'Detalle', 'Cantidad', 'Precio unitario', 'Plastificado', 'Total item', 'Clics', 'Pago', 'Total venta', 'Saldo']];
    for (const v of vs) for (const i of v.items) rows.push([fdate(v.fecha), recibo(v), v.cliente, { imp: 'Impresión', prod: 'Producto', serv: 'Servicio', pers: 'Trabajo personalizado' }[i.tipo], i.desc, i.cant, i.pu, i.extra || 0, i.total, i.clics || 0, PAGOS[v.pago], v.total, v.saldo]);
    const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ventas-${R.desde}-a-${R.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const bajos = (productos.data || []).filter((p) => toNum(p.stock) <= toNum(p.stock_min));

  return (
    <Flex direction="column" gap="20px">
      <Card>
        <Flex gap="12px" wrap="wrap" align="center">
          <Box me="auto">
            <Text fontSize="22px" fontWeight="700" color={textColor}>{R.label}</Text>
            <Text fontSize="sm" color="secondaryGray.600">Del {fdate(R.desde)} al {fdate(R.hasta)}</Text>
          </Box>
          <Segmented value={periodo} onChange={setPeriodo} options={[['semana', 'Semana'], ['mes', 'Este mes'], ['anterior', 'Mes anterior'], ['otro', 'Otro']]} />
          {periodo === 'otro' && <Box w="200px"><Sel value={mes} onChange={(e) => setMes(e.target.value)} options={lastMonths(24).map((k) => [k, mesLabel(k)])} /></Box>}
          <Button variant="light" onClick={csv} isDisabled={!vs.length}>Descargar ventas (CSV)</Button>
        </Flex>
      </Card>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="20px">
        <MiniStatistics icon={MdAttachMoney} name="Ventas" value={money(tot)} help={`${vs.length} ventas · promedio ${money(vs.length ? tot / vs.length : 0)}`} />
        <MiniStatistics icon={MdTrendingUp} name="Ganancia estimada" value={money(tot - costo)} help={`${tot ? Math.round(((tot - costo) / tot) * 100) : 0}% sobre ventas`} tone="green" />
        <MiniStatistics icon={MdPrint} name="Impresiones" value={intf(imps.reduce((a, i) => a + toNum(i.cant), 0))} help={`${intf(imps.reduce((a, i) => a + toNum(i.clics), 0))} clics vendidos`} />
        <MiniStatistics icon={MdAccountBalanceWallet} name="Por cobrar hoy" value={money(porCobrar)} help="Toda la cartera" tone="orange" />
        <MiniStatistics icon={MdMoneyOff} name="Gastos" value={money(G.total)} help={G.categorias.slice(0, 2).map((c) => `${c.k} ${money(c.total)}`).join(' · ') || 'Sin gastos'} tone="red" />
        <MiniStatistics icon={MdSavings} name="Utilidad después de gastos" value={money(tot - costo - G.total)} help={`Ganancia ${money(tot - costo)} - gastos ${money(G.total)}`} tone={tot - costo - G.total < 0 ? 'red' : 'green'} />
      </SimpleGrid>
      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Ventas por día</Text>
        {tot ? <Box h="260px"><Chart type="bar" height="100%" width="100%" options={chart.options} series={chart.series} /></Box> : <Text color="secondaryGray.600" py="30px" textAlign="center" fontSize="sm">No hay ventas en este periodo.</Text>}
      </Card>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px">
        <Mini title="Impresiones por papel">
          <DataTable rows={group(imps, (i) => susName(i.det?.sus))} columns={[{ key: 'k', label: 'Papel' }, { key: 'cant', label: 'Impresiones', num: true, render: (g) => intf(g.cant) }, { key: 'clics', label: 'Clics', num: true, render: (g) => intf(g.clics) }, { key: 'total', label: 'Ventas', num: true, render: (g) => money(g.total) }]} empty="Sin impresiones en este periodo." />
        </Mini>
        <Mini title="Por medio de pago">
          <DataTable rows={group(vs, (v) => PAGOS[v.pago])} columns={[{ key: 'k', label: 'Pago' }, { key: 'n', label: 'Ventas', num: true }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} empty="Sin ventas en este periodo." />
        </Mini>
        <Mini title="Mejores clientes">
          <DataTable rows={group(vs, (v) => v.cliente).slice(0, 8)} columns={[{ key: 'k', label: 'Cliente' }, { key: 'n', label: 'Compras', num: true }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} empty="Sin ventas en este periodo." />
        </Mini>
        <Mini title="Productos y servicios más vendidos">
          <DataTable rows={group(items.filter((i) => i.tipo !== 'imp'), (i) => i.desc).slice(0, 8)} columns={[{ key: 'k', label: 'Producto' }, { key: 'cant', label: 'Cantidad', num: true, render: (g) => intf(g.cant) }, { key: 'total', label: 'Total', num: true, render: (g) => money(g.total) }]} empty="Sin productos vendidos en este periodo." />
        </Mini>
        <Mini title="Poco stock">
          <DataTable rows={bajos} columns={[{ key: 'nombre', label: 'Producto' }, { key: 'stock', label: 'Stock', num: true, render: (p) => intf(p.stock) }, { key: 'stock_min', label: 'Mínimo', num: true, render: (p) => intf(p.stock_min) }]} empty="Todo el inventario está por encima del mínimo." />
        </Mini>
      </SimpleGrid>
    </Flex>
  );
}
