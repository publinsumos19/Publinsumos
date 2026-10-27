import { useMemo, useState } from 'react';
import { Badge, Button, Flex, Link, SimpleGrid, Text, useColorModeValue, useDisclosure } from '@chakra-ui/react';
import { MdAccountBalanceWallet, MdLock, MdPayments, MdTrendingUp } from 'react-icons/md';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import ShareModal from '../components/ShareModal';
import TrabajoModal, { EstadoBadge } from '../components/TrabajoModal';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { fdate, mesKey, money, PAGOS, today } from '../lib/format';
import { numeroT } from '../lib/trabajo';
import { toNum } from '../lib/pricing';
import { semaforoCartera } from '../lib/semaforo';
import Semaforo from '../components/Semaforo';

// The admin's own accounts for private custom jobs. Kept apart from the shop's Cartera; the seller never reaches it.
export default function CarteraPrivada() {
  const { cfg } = useAuth();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const share = useDisclosure();
  const [msg, setMsg] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const trabajos = useLive(() => supabase.from('trabajos').select('*').eq('privado', true).order('fecha'), ['trabajos']);
  const costos = useLive(() => supabase.from('trabajo_costos').select('*'), ['trabajos']);
  const abonos = useLive(() => supabase.from('trabajo_abonos').select('*, trabajos(privado, cliente, titulo, numero)').order('fecha', { ascending: false }), ['trabajo_abonos', 'trabajos']);

  const all = trabajos.data || [];
  const conSaldo = all.filter((t) => ['aprobado', 'entregado'].includes(t.estado) && toNum(t.saldo) > 0);
  const priv = (abonos.data || []).filter((a) => a.trabajos?.privado);
  const mes = mesKey(today());
  const delMes = priv.filter((a) => a.fecha.startsWith(mes));
  const costoDe = useMemo(() => Object.fromEntries((costos.data || []).map((c) => [c.trabajo_id, c.costos || []])), [costos.data]);
  const vendidos = all.filter((t) => ['aprobado', 'entregado'].includes(t.estado));
  const ganancia = vendidos.reduce((a, t) => a + toNum(t.total) - toNum(t.retencion) - t.lineas.reduce((s, l, i) => s + toNum(l.cant) * toNum(costoDe[t.id]?.[i]), 0), 0);

  const grupos = useMemo(() => {
    const g = {};
    for (const t of conSaldo) (g[t.cliente] ||= { id: t.cliente, cliente: t.cliente, tel: t.telefono, trabajos: [] }).trabajos.push(t);
    return Object.values(g).map((x) => ({ ...x, saldo: x.trabajos.reduce((a, t) => a + toNum(t.saldo), 0), desde: x.trabajos[0].fecha })).sort((a, b) => b.saldo - a.saldo);
  }, [conSaldo]);

  const recordar = (g) => {
    const L = [`Hola ${g.cliente}, te saluda *${cfg?.negocio?.nombre || 'Ecoglobal'}*.`, 'Te compartimos el saldo de tus trabajos:', '',
      ...g.trabajos.map((t) => `• ${numeroT(t)} ${t.titulo}: ${money(t.saldo)}`), '', `*Total: ${money(g.saldo)}*`, '', 'Gracias por tu confianza.'];
    setMsg({ title: 'Recordatorio de saldo', text: L.join('\n'), tel: g.tel });
    share.onOpen();
  };

  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px">
        <MiniStatistics icon={MdAccountBalanceWallet} name="Por cobrar (privado)" value={money(grupos.reduce((a, g) => a + g.saldo, 0))} help={`${conSaldo.length} trabajos con saldo`} tone="purple" />
        <MiniStatistics icon={MdPayments} name="Recibido este mes" value={money(delMes.reduce((a, x) => a + toNum(x.monto), 0))} help={`${delMes.length} abonos`} />
        <MiniStatistics icon={MdTrendingUp} name="Ganancia estimada" value={money(ganancia)} help="Trabajos aprobados y entregados" tone="green" />
        <MiniStatistics icon={MdLock} name="Cotizaciones privadas" value={all.filter((t) => t.estado === 'cotizacion').length} help="Sin aprobar" />
      </SimpleGrid>
      <Card>
        <Flex align="center" gap="8px" mb="4px"><Text fontSize="22px" fontWeight="700" color={textColor}>Cartera privada</Text><Badge colorScheme="purple">Solo tú la ves</Badge></Flex>
        <Text fontSize="sm" color="secondaryGray.600" mb="14px">Saldos de tus trabajos personalizados. No se mezcla con la Cartera del negocio y el vendedor no tiene acceso.</Text>
        <DataTable
          rows={grupos}
          empty="Nadie te debe trabajos privados."
          columns={[
            { key: 'c', label: 'Cliente', render: (g) => <><Text fontWeight="700">{g.cliente}</Text><Flex gap="8px" wrap="wrap" fontSize="xs">{g.trabajos.map((t) => <Link key={t.id} color="purple.500" onClick={() => setAbierto(t)}>{numeroT(t)} {t.titulo} · {money(t.saldo)}</Link>)}</Flex></> },
            { key: 'd', label: 'Desde', render: (g) => <Flex gap="8px" align="center" wrap="wrap"><Text>{fdate(g.desde)}</Text><Semaforo s={semaforoCartera(g.desde, cfg)} small /></Flex> },
            { key: 's', label: 'Saldo', num: true, render: (g) => <Text fontWeight="700">{money(g.saldo)}</Text> },
            { key: 'a', label: '', num: true, render: (g) => <Button size="sm" variant="lightBrand" onClick={() => recordar(g)}>Recordar</Button> },
          ]}
        />
      </Card>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" alignItems="start">
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="8px">Mis trabajos privados</Text>
          <DataTable rows={[...all].reverse()} onRowClick={(t) => setAbierto(t)} empty="Aún no tienes trabajos privados. Créalos en el Cotizador."
            columns={[
              { key: 'n', label: 'Trabajo', render: (t) => <><Text fontWeight="600">{t.cliente}</Text><Text fontSize="xs" color="secondaryGray.600">{numeroT(t)} · {t.titulo}</Text></> },
              { key: 'e', label: 'Estado', render: (t) => <EstadoBadge t={t} /> },
              { key: 't', label: 'Total', num: true, render: (t) => money(t.total) },
            ]} />
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="8px">Últimos abonos</Text>
          <DataTable rows={priv.slice(0, 12)} empty="Sin abonos todavía."
            columns={[
              { key: 'f', label: 'Fecha', render: (a) => fdate(a.fecha) },
              { key: 'c', label: 'Trabajo', render: (a) => <><Text>{a.trabajos?.cliente}</Text><Text fontSize="xs" color="secondaryGray.600">{a.trabajos?.titulo}</Text></> },
              { key: 'p', label: 'Medio', render: (a) => PAGOS[a.pago] },
              { key: 'm', label: 'Monto', num: true, render: (a) => money(a.monto) },
            ]} />
        </Card>
      </SimpleGrid>
      {abierto && <TrabajoModal trabajo={abierto} onClose={() => setAbierto(null)} />}
      {msg && <ShareModal isOpen={share.isOpen} onClose={share.onClose} {...msg} />}
    </Flex>
  );
}
