import { useState } from 'react';
import { Badge, Box, Button, Flex, IconButton, SimpleGrid, Text, useColorModeValue, useDisclosure, useToast } from '@chakra-ui/react';
import { MdAccountBalance, MdAdd, MdDelete, MdMoneyOff, MdPayments } from 'react-icons/md';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import GastoModal from '../components/GastoModal';
import { Sel } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { fdate, lastMonths, mesKey, mesLabel, money, PAGOS, today } from '../lib/format';
import { CAJA_LABEL, resumenGastos } from '../lib/gastos';

const finMes = (k) => { const [y, m] = k.split('-').map(Number); return `${k}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };

export default function Gastos() {
  const { isAdmin, perfil } = useAuth();
  const toast = useToast();
  const nuevo = useDisclosure();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [mes, setMes] = useState(mesKey(today()));
  const gastos = useLive(() => supabase.from('gastos').select('*').gte('fecha', mes + '-01').lte('fecha', finMes(mes)).order('fecha', { ascending: false }).order('creado', { ascending: false }), ['gastos'], [mes]);
  const perfiles = useLive(() => supabase.from('perfiles').select('id, nombre'), ['perfiles']);
  const G = resumenGastos(gastos.data || []);
  const hoy = (gastos.data || []).filter((g) => g.fecha === today());

  // The seller can only undo their own expenses of today; the admin can delete any.
  const borrar = async (g) => {
    const { error } = await supabase.from('gastos').delete().eq('id', g.id);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('gastos');
    toast({ title: 'Gasto eliminado', status: 'info' });
  };

  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px">
        <MiniStatistics icon={MdMoneyOff} name="Gastos de hoy" value={money(hoy.reduce((a, g) => a + g.monto, 0))} help={`${hoy.length} gastos`} tone="red" />
        <MiniStatistics icon={MdMoneyOff} name={`Gastos de ${mesLabel(mes)}`} value={money(G.total)} help={`${G.n} gastos`} tone="red" />
        <MiniStatistics icon={MdPayments} name="Pagados en efectivo" value={money(G.por.efectivo)} help={`Insumos ${money(G.caja.insumos)} · Láser ${money(G.caja.impresion)}`} tone="orange" />
        <MiniStatistics icon={MdAccountBalance} name="Bancolombia y Nequi" value={money(G.por.bancolombia + G.por.nequi)} help={`Bancolombia ${money(G.por.bancolombia)} · Nequi ${money(G.por.nequi)}`} />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" alignItems="start">
        <Card gridColumn={{ xl: 'span 2' }}>
          <Flex align="center" gap="10px" wrap="wrap" mb="12px">
            <Box me="auto">
              <Text fontSize="22px" fontWeight="700" color={textColor}>Gastos</Text>
              <Text fontSize="sm" color="secondaryGray.600">Lo que sale del negocio. Los gastos en efectivo se restan de su caja en el cierre del día.</Text>
            </Box>
            <Box w="190px"><Sel value={mes} onChange={(e) => setMes(e.target.value)} options={lastMonths(12).map((k) => [k, mesLabel(k)])} /></Box>
            <Button variant="brand" leftIcon={<MdAdd />} onClick={nuevo.onOpen}>Registrar gasto</Button>
          </Flex>
          <DataTable rows={gastos.data} empty="No hay gastos registrados en este mes."
            columns={[
              { key: 'concepto', label: 'Gasto', render: (g) => <><Text fontWeight="600">{g.concepto}</Text><Text fontSize="xs" color="secondaryGray.600">{fdate(g.fecha)} · {g.categoria}{g.nota ? ' · ' + g.nota : ''}</Text></> },
              { key: 'monto', label: 'Valor', num: true, render: (g) => <Text fontWeight="700" whiteSpace="nowrap">{money(g.monto)}</Text> },
              { key: 'pago', label: 'Pago', render: (g) => <><Badge colorScheme={g.pago === 'efectivo' ? 'orange' : 'blue'}>{PAGOS[g.pago]}</Badge>{g.caja && <Text fontSize="xs" color="secondaryGray.600">{CAJA_LABEL[g.caja]}</Text>}</> },
              { key: 'u', label: 'Registró', render: (g) => (perfiles.data || []).find((p) => p.id === g.usuario_id)?.nombre || '' },
              { key: 'x', label: '', num: true, render: (g) => ((isAdmin || (g.usuario_id === perfil?.id && g.fecha === today()))
                ? <IconButton size="sm" variant="ghost" aria-label="Eliminar gasto" icon={<MdDelete />} onClick={() => borrar(g)} /> : null) },
            ]} />
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="8px">Por categoría</Text>
          <DataTable rows={G.categorias.map((c) => ({ id: c.k, ...c }))} empty="Sin gastos."
            columns={[
              { key: 'k', label: 'Categoría', render: (c) => <><Text>{c.k}</Text><Text fontSize="xs" color="secondaryGray.600">{c.n} gasto{c.n === 1 ? '' : 's'}</Text></> },
              { key: 'total', label: 'Total', num: true, render: (c) => money(c.total) },
              { key: 'p', label: '%', num: true, render: (c) => `${G.total ? Math.round((c.total / G.total) * 100) : 0}%` },
            ]} />
        </Card>
      </SimpleGrid>
      <GastoModal isOpen={nuevo.isOpen} onClose={nuevo.onClose} />
    </Flex>
  );
}
