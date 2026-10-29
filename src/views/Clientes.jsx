import { useMemo, useState } from 'react';
import { Badge, Box, Button, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { MdAdd } from 'react-icons/md';
import Card from '../components/card/Card';
import DataTable from '../components/DataTable';
import ClienteModal from '../components/ClienteModal';
import ImportarClientes from '../components/ImportarClientes';
import { useAuth } from '../context/AuthContext';
import { TextIn } from '../components/Field';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { money } from '../lib/format';
import { toNum } from '../lib/pricing';
import { formaPagoTxt } from '../lib/trabajo';

export default function Clientes() {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const { isAdmin } = useAuth();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const clientes = useLive(() => supabase.from('clientes').select('*').order('nombre'), ['clientes']);
  const deudas = useLive(() => supabase.from('ventas').select('cliente_id, cliente, saldo').gt('saldo', 0), ['ventas']);
  const saldoDe = useMemo(() => {
    const m = {};
    for (const v of deudas.data || []) { const k = v.cliente_id || (v.cliente || '').toLowerCase(); m[k] = (m[k] || 0) + toNum(v.saldo); }
    return m;
  }, [deudas.data]);
  const rows = (clientes.data || []).filter((c) => !q || `${c.nombre} ${c.nit || ''} ${c.telefono || ''} ${(c.sucursales || []).map((s) => s.nombre).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <Flex align="center" gap="10px" wrap="wrap" mb="12px">
        <Box me="auto">
          <Text fontSize="22px" fontWeight="700" color={textColor}>Clientes</Text>
          <Text fontSize="sm" color="secondaryGray.600">Datos y forma de pago de cada cliente. La forma de pago sale en sus cotizaciones.</Text>
        </Box>
        <Box w={{ base: '100%', md: '240px' }}><TextIn value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, NIT o teléfono" /></Box>
        {isAdmin && <ImportarClientes existentes={clientes.data || []} />}
        <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setEdit({})}>Nuevo cliente</Button>
      </Flex>
      <DataTable rows={rows} onRowClick={(c) => setEdit(c)} empty="Aún no hay clientes."
        columns={[
          { key: 'nombre', label: 'Cliente', render: (c) => <><Text fontWeight="600">{c.nombre}</Text><Text fontSize="xs" color="secondaryGray.600">{[c.nit && `NIT ${c.nit}`, c.telefono, c.sucursales?.length && `${c.sucursales.length} sucursal${c.sucursales.length === 1 ? '' : 'es'}`].filter(Boolean).join(' · ')}</Text></> },
          { key: 'forma', label: 'Forma de pago', render: (c) => (c.forma_pago ? <Badge colorScheme={c.forma_pago === 'convenir' ? 'gray' : c.forma_pago === 'anticipo50' ? 'purple' : 'blue'} whiteSpace="normal">{formaPagoTxt(c.forma_pago, c.saldo_a)}</Badge> : <Text fontSize="sm" color="secondaryGray.600">Sin definir</Text>) },
          { key: 'saldo', label: 'Debe', num: true, render: (c) => { const s = saldoDe[c.id] || 0; return s ? <Text fontWeight="700" color="orange.500">{money(s)}</Text> : '—'; } },
        ]} />
      {edit && <ClienteModal cliente={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </Card>
  );
}
