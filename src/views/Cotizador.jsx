import { useMemo, useState } from 'react';
import { Alert, AlertIcon, Badge, Box, Button, Flex, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import { MdAssignment, MdBuild, MdRequestQuote } from 'react-icons/md';
import Card from '../components/card/Card';
import MiniStatistics from '../components/card/MiniStatistics';
import DataTable from '../components/DataTable';
import Segmented from '../components/Segmented';
import TrabajoModal, { EstadoBadge } from '../components/TrabajoModal';
import { TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { fdate, money, normalize } from '../lib/format';
import { formaPagoTxt, numeroT } from '../lib/trabajo';
import { toNum } from '../lib/pricing';
import { semaforoEntrega } from '../lib/semaforo';
import Semaforo from '../components/Semaforo';

export default function Cotizador() {
  const { isAdmin, cfg } = useAuth();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState('activos');
  const [q, setQ] = useState('');
  const trabajos = useLive(() => supabase.from('trabajos').select('*').order('creado', { ascending: false }), ['trabajos']);
  const all = trabajos.data || [];
  const conceptos = useMemo(() => [...new Set(all.flatMap((t) => t.lineas.map((l) => l.concepto)))], [all]);

  const list = all.filter((t) => (
    filtro === 'todos' || (filtro === 'activos' ? ['cotizacion', 'aprobado'].includes(t.estado) : filtro === 'privados' ? t.privado : t.estado === filtro)
  ) && (!q || normalize(`${t.cliente} ${t.titulo} ${numeroT(t)}`).includes(normalize(q))));
  const cot = all.filter((t) => t.estado === 'cotizacion');
  const curso = all.filter((t) => t.estado === 'aprobado');

  return (
    <Flex direction="column" gap="20px">
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="20px">
        <MiniStatistics icon={MdRequestQuote} name="Cotizaciones abiertas" value={cot.length} help={money(cot.reduce((a, t) => a + toNum(t.total), 0))} />
        <MiniStatistics icon={MdBuild} name="Trabajos en curso" value={curso.length} help={`Saldo ${money(curso.reduce((a, t) => a + toNum(t.saldo), 0))}`} tone="orange" />
        <MiniStatistics icon={MdAssignment} name="Entregados" value={all.filter((t) => ['entregado', 'vendido'].includes(t.estado)).length} tone="green" />
      </SimpleGrid>
      <Card>
        <Flex gap="12px" wrap="wrap" align="center" mb="10px">
          <Box me="auto">
            <Text fontSize="22px" fontWeight="700" color={textColor}>Cotizador personalizado</Text>
            <Text fontSize="sm" color="secondaryGray.600">Avisos, letreros y trabajos a la medida, con su desglose de material y servicios.</Text>
          </Box>
          <Button variant="brand" onClick={() => setAbierto({})}>Nueva cotización</Button>
        </Flex>
        <Alert status="info" borderRadius="14px" fontSize="sm" mb="14px">
          <AlertIcon />
          {isAdmin
            ? 'Lo que cotizas tú queda privado: el vendedor no lo ve y sus saldos van a tu Cartera privada. Puedes desmarcar "Privado" si es un trabajo de la tienda.'
            : 'Tus cotizaciones las ve también el administrador. Cuando el cliente acepte, usa "Pasar a venta" y queda en la caja y en la Cartera del negocio.'}
        </Alert>
        <Flex gap="10px" wrap="wrap" mb="12px">
          <Segmented value={filtro} onChange={setFiltro} options={[['activos', 'Activos'], ['cotizacion', 'Cotizaciones'], ['aprobado', 'En curso'], ['entregado', 'Entregados'], ...(isAdmin ? [['privados', 'Privados']] : []), ['todos', 'Todos']]} />
          <Box flex="1" minW="200px"><TextIn type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o trabajo" /></Box>
        </Flex>
        <DataTable
          rows={list}
          onRowClick={(t) => setAbierto(t)}
          empty={trabajos.loading ? 'Cargando…' : 'No hay trabajos con este filtro.'}
          columns={[
            { key: 'n', label: 'N°', render: (t) => <><Text fontWeight="600">{numeroT(t)}</Text><Text fontSize="xs" color="secondaryGray.600">{fdate(t.fecha)}</Text></> },
            { key: 'c', label: 'Cliente y trabajo', render: (t) => <><Flex gap="6px" align="center"><Text fontWeight="700">{t.cliente}</Text>{isAdmin && t.privado && <Badge colorScheme="purple">Privado</Badge>}</Flex><Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>{t.titulo} · {t.lineas.length} conceptos</Text></> },
            { key: 'e', label: 'Estado', render: (t) => <Flex direction="column" gap="4px" align="flex-start"><EstadoBadge t={t} />{t.estado === 'cotizacion' && (t.enviada ? <Badge colorScheme="teal" variant="subtle">Enviada {fdate(t.enviada)}</Badge> : <Text fontSize="xs" color="secondaryGray.600">Sin enviar</Text>)}</Flex> },
            { key: 'fp', label: 'Forma de pago', render: (t) => (t.forma_pago ? <><Text fontSize="sm">{formaPagoTxt(t.forma_pago, t.saldo_a)}</Text>{t.instalacion === 'con' && <Text fontSize="xs" color="secondaryGray.600">Con instalación</Text>}</> : <Text fontSize="sm" color="secondaryGray.600">—</Text>) },
            { key: 'f', label: 'Entrega', render: (t) => (t.entrega ? <Flex direction="column" gap="4px" align="flex-start"><Text fontSize="sm">{fdate(t.entrega)}</Text><Semaforo s={semaforoEntrega(t, cfg)} small /></Flex> : <Text fontSize="sm" color="secondaryGray.600">Sin fecha</Text>) },
            { key: 't', label: 'Total', num: true, render: (t) => <>{money(t.total)}{toNum(t.retencion) > 0 && <Text fontSize="xs" color="secondaryGray.600">Neto {money(toNum(t.total) - toNum(t.retencion))}</Text>}</> },
            { key: 's', label: 'Saldo', num: true, render: (t) => (toNum(t.saldo) > 0 ? <Text color="orange.500" fontWeight="700">{money(t.saldo)}</Text> : '—') },
          ]}
        />
      </Card>
      {abierto && <TrabajoModal trabajo={abierto.id ? abierto : null} conceptos={conceptos} onClose={() => setAbierto(null)} />}
    </Flex>
  );
}
