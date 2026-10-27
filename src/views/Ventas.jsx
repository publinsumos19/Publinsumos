import { useMemo, useState } from 'react';
import { Badge, Box, Flex, SimpleGrid, Text, Tr, Td, useColorModeValue } from '@chakra-ui/react';
import { MdAttachMoney, MdCreditCard, MdPhoneIphone, MdReceipt } from 'react-icons/md';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import PagoBadge from '../components/PagoBadge';
import VentaModal from '../components/VentaModal';
import { Sel, TextIn } from '../components/Field';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { fdate, lastMonths, mesKey, mesLabel, money, monthRange, normalize, recibo, today } from '../lib/format';

const DIGITAL = ['bancolombia', 'nequi', 'transferencia'];

export default function Ventas() {
  const [mes, setMes] = useState(mesKey(today()));
  const [pago, setPago] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const { desde, hasta } = monthRange(mes);
  const ventas = useLive(
    () => supabase.from('ventas').select('*').gte('fecha', desde).lte('fecha', hasta).order('creado', { ascending: false }),
    ['ventas'], [mes],
  );
  const abonosHoy = useLive(() => supabase.from('abonos').select('monto, pago, venta_id, ventas(fecha)').eq('fecha', today()), ['abonos']);
  const hoyRows = useLive(() => supabase.from('ventas').select('total, pago').eq('fecha', today()), ['ventas']);

  const list = useMemo(() => {
    const nq = normalize(q);
    return (ventas.data || []).filter((v) =>
      (!pago || (pago === 'debe' ? Number(v.saldo) > 0 : pago === 'fe' ? v.fe : v.pago === pago)) &&
      (!q || normalize(v.cliente).includes(nq) || recibo(v).includes(q)));
  }, [ventas.data, pago, q]);

  const hoy = hoyRows.data || [];
  const sum = (arr) => arr.reduce((a, x) => a + Number(x.total ?? x.monto), 0);
  // Payments on today's credit sales are already in the sale; count only payments on older ones.
  const abonosAntes = (abonosHoy.data || []).filter((a) => a.ventas?.fecha !== today());

  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px">
        <MiniStatistics icon={MdReceipt} name="Vendido hoy" value={money(sum(hoy))} help={`${hoy.length} venta${hoy.length === 1 ? '' : 's'}`} />
        <MiniStatistics icon={MdAttachMoney} name="Efectivo hoy" value={money(sum(hoy.filter((v) => v.pago === 'efectivo')))} help={`Más abonos: ${money(sum(abonosAntes.filter((a) => a.pago === 'efectivo')))}`} />
        <MiniStatistics icon={MdPhoneIphone} name="Bancolombia y Nequi hoy" value={money(sum(hoy.filter((v) => DIGITAL.includes(v.pago))))}
          help={`Bancolombia ${money(sum(hoy.filter((v) => v.pago === 'bancolombia')))} · Nequi ${money(sum(hoy.filter((v) => v.pago === 'nequi')))} · más abonos ${money(sum(abonosAntes.filter((a) => DIGITAL.includes(a.pago))))}`} />
        <MiniStatistics icon={MdCreditCard} name="A crédito hoy" value={money(sum(hoy.filter((v) => v.pago === 'credito')))} help="Queda en cartera" tone="orange" />
      </SimpleGrid>
      <Card>
        <Flex gap="12px" wrap="wrap" align="center" mb="14px">
          <Text fontSize="22px" fontWeight="700" color={textColor} me="auto">Ventas</Text>
          <Box w={{ base: '100%', sm: '200px' }}><Sel value={mes} onChange={(e) => setMes(e.target.value)} options={lastMonths(12).map((k) => [k, mesLabel(k)])} /></Box>
          <Box w={{ base: '100%', sm: '220px' }}><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={[['', 'Todos los pagos'], ['efectivo', 'Efectivo'], ['bancolombia', 'Bancolombia'], ['nequi', 'Nequi'], ['credito', 'Crédito'], ['transferencia', 'Transferencia (anteriores)'], ['debe', 'Con saldo pendiente'], ['fe', 'Con F-E']]} /></Box>
        </Flex>
        <TextIn type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o número de recibo" mb="14px" />
        {ventas.loading ? <Text color="secondaryGray.600" py="20px">Cargando…</Text> : (
          <DataTable
            rows={list}
            onRowClick={(v) => setOpen(v.id)}
            empty="No hay ventas con estos filtros."
            columns={[
              { key: 'fecha', label: 'Fecha', render: (v) => <><Text>{fdate(v.fecha)}</Text><Text fontSize="xs" color="secondaryGray.600">{recibo(v)}</Text></> },
              { key: 'cliente', label: 'Cliente' },
              { key: 'det', label: 'Detalle', render: (v) => <><Text noOfLines={1}>{v.items[0]?.desc}</Text>{v.items.length > 1 && <Text fontSize="xs" color="secondaryGray.600">y {v.items.length - 1} más</Text>}</> },
              { key: 'pago', label: 'Pago', render: (v) => <Flex gap="4px" wrap="wrap"><PagoBadge v={v} />{v.fe && <Badge colorScheme="blue">F-E</Badge>}</Flex> },
              { key: 'total', label: 'Total', num: true, render: (v) => money(v.total) },
            ]}
            footer={<Tr><Td colSpan={4} fontWeight="700">{list.length} ventas</Td><Td isNumeric fontWeight="700">{money(sum(list))}</Td></Tr>}
          />
        )}
      </Card>
      <VentaModal ventaId={open} onClose={() => setOpen(null)} />
    </Flex>
  );
}
