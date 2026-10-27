import { useMemo, useState } from 'react';
import { Button, Flex, Link, SimpleGrid, Text, useColorModeValue, useDisclosure } from '@chakra-ui/react';
import { MdAccountBalanceWallet, MdPeople } from 'react-icons/md';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import ShareModal from '../components/ShareModal';
import VentaModal from '../components/VentaModal';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { fdate, money } from '../lib/format';
import { semaforoCartera, ORDEN } from '../lib/semaforo';
import Semaforo from '../components/Semaforo';
import { debtText } from '../lib/receipt';

function Dias({ desde }) {
  const { cfg } = useAuth();
  return <Semaforo s={semaforoCartera(desde, cfg)} small />;
}

export default function Cartera() {
  const { cfg } = useAuth();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const share = useDisclosure();
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const deudas = useLive(() => supabase.from('ventas').select('id, numero, fecha, cliente, cliente_id, telefono, total, saldo').gt('saldo', 0).order('fecha'), ['ventas']);

  const grupos = useMemo(() => {
    const g = {};
    for (const v of deudas.data || []) {
      const k = v.cliente_id || v.cliente;
      (g[k] ||= { id: k, cliente: v.cliente, tel: '', ventas: [] }).ventas.push(v);
      if (v.telefono) g[k].tel = v.telefono;
    }
    // Most overdue first (red, then yellow), then by amount.
    return Object.values(g).map((x) => ({ ...x, saldo: x.ventas.reduce((a, v) => a + Number(v.saldo), 0), desde: x.ventas[0].fecha }))
      .sort((a, b) => ORDEN[semaforoCartera(a.desde, cfg).color] - ORDEN[semaforoCartera(b.desde, cfg).color] || b.saldo - a.saldo);
  }, [deudas.data, cfg]);
  const total = grupos.reduce((a, g) => a + g.saldo, 0);

  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
        <MiniStatistics icon={MdAccountBalanceWallet} name="Por cobrar" value={money(total)} tone="orange" />
        <MiniStatistics icon={MdPeople} name="Clientes con saldo" value={grupos.length} />
      </SimpleGrid>
      <Card>
        <Text fontSize="22px" fontWeight="700" color={textColor} mb="14px">Clientes que deben</Text>
        <DataTable
          rows={grupos}
          empty="Nadie debe nada. Las ventas a crédito con saldo aparecen aquí."
          columns={[
            { key: 'cliente', label: 'Cliente', render: (g) => (
              <>
                <Text fontWeight="700">{g.cliente}</Text>
                <Flex gap="8px" wrap="wrap" fontSize="xs">
                  {g.ventas.map((v) => <Link key={v.id} color="brand.500" onClick={() => setOpen(v.id)}>{fdate(v.fecha)} · {money(v.saldo)}</Link>)}
                </Flex>
              </>
            ) },
            { key: 'desde', label: 'Desde', render: (g) => <Flex gap="8px" align="center" wrap="wrap"><Text>{fdate(g.desde)}</Text><Dias desde={g.desde} /></Flex> },
            { key: 'saldo', label: 'Saldo', num: true, render: (g) => <Text fontWeight="700">{money(g.saldo)}</Text> },
            { key: 'acc', label: '', num: true, render: (g) => (
              <Button size="sm" variant="lightBrand" onClick={() => { setMsg({ title: 'Recordatorio de saldo', text: debtText(cfg?.negocio, g.cliente, g.ventas), tel: g.tel }); share.onOpen(); }}>Recordar</Button>
            ) },
          ]}
        />
      </Card>
      {msg && <ShareModal isOpen={share.isOpen} onClose={share.onClose} {...msg} />}
      <VentaModal ventaId={open} onClose={() => setOpen(null)} />
    </Flex>
  );
}
