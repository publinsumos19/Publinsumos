import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Button, Flex, SimpleGrid, Text, useColorModeValue, useToast } from '@chakra-ui/react';
import Card from '../components/card/Card';
import Segmented from '../components/Segmented';
import DataTable from '../components/DataTable';
import { Field, NumIn, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { addDays, fdate, intf, money, mondayOf, today } from '../lib/format';
import { costoClicDe, toNum } from '../lib/pricing';

// The machine has a general counter and separate ones for color and black-and-white clics.
export const TIPOS = {
  general: { label: 'General', titulo: 'Cuadre del contador', ultimo: 'ultimoContador' },
  color: { label: 'Color', titulo: 'Cuadre del contador a color', ultimo: 'ultimoContadorColor' },
  bn: { label: 'Blanco y negro', titulo: 'Cuadre del contador blanco y negro', ultimo: 'ultimoContadorBN' },
};
const delTipo = (tipo) => (i) => i.tipo === 'imp' && (tipo === 'general' || (tipo === 'color') === !!i.det?.color);
const clicsEn = (ventas, a, b, tipo = 'general') =>
  (ventas || []).filter((v) => v.fecha >= a && v.fecha <= b).flatMap((v) => v.items).filter(delTipo(tipo)).reduce((s, i) => s + toNum(i.clics), 0);
const tipoDe = (r) => r.tipo || 'general';

export default function Cuadre() {
  const [tipo, setTipo] = useState('general');
  return (
    <Flex direction="column" gap="20px">
      <Flex gap="12px" wrap="wrap" align="center">
        <Segmented value={tipo} onChange={setTipo} options={Object.entries(TIPOS).map(([k, t]) => [k, t.label])} />
      </Flex>
      <CuadreTipo key={tipo} tipo={tipo} />
    </Flex>
  );
}

function CuadreTipo({ tipo }) {
  const T = TIPOS[tipo];
  const navigate = useNavigate();
  const { cfg, costos } = useAuth();
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const todos = useLive(() => supabase.from('contador').select('*').order('fin', { ascending: false }).limit(90), ['contador']);
  const registros = { data: todos.data ? todos.data.filter((r) => tipoDe(r) === tipo).slice(0, 30) : null };
  const [f, setF] = useState(null);
  const [armed, setArmed] = useState(null);

  useEffect(() => {
    if (f || !registros.data) return;
    const last = registros.data[0];
    setF({ inicio: last ? addDays(last.fin, 1) : mondayOf(today()), cIni: last ? last.contador_final : cfg?.[T.ultimo] ?? '', fin: today(), cFin: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.data, f, cfg]);

  const desde = useMemo(() => [f?.inicio, ...(todos.data || []).map((r) => r.inicio)].filter(Boolean).sort()[0] || today(), [f, todos.data]);
  const ventas = useLive(() => supabase.from('ventas').select('fecha, items').gte('fecha', desde), ['ventas'], [desde]);

  const tol = toNum(cfg?.tolerancia ?? 5) / 100;
  const costoClic = tipo === 'general' ? toNum(costos?.costoClic) : costoClicDe(costos, tipo === 'color');
  const Dif = ({ d, maq }) => (Math.abs(d) <= tol * Math.max(maq, 1)
    ? <Badge colorScheme="green">{intf(d)} · Cuadra</Badge>
    : <Badge colorScheme={d > 0 ? 'red' : 'orange'}>{intf(d)} · Revisar</Badge>);

  if (!f) return <Text color="secondaryGray.600">Cargando…</Text>;
  const maq = toNum(f.cFin) - toNum(f.cIni);
  const ok = f.inicio && f.fin && f.cFin !== '' && maq >= 0 && f.fin >= f.inicio;
  const ven = clicsEn(ventas.data, f.inicio, f.fin, tipo);
  const d = maq - ven;

  const guardar = async () => {
    const { error } = await supabase.from('contador').insert({ tipo, inicio: f.inicio, contador_inicial: toNum(f.cIni), fin: f.fin, contador_final: toNum(f.cFin) });
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('contador');
    toast({ title: 'Cuadre guardado', status: 'success' });
    setF({ inicio: addDays(f.fin, 1), cIni: toNum(f.cFin), fin: addDays(f.fin, 1), cFin: '' });
  };
  const borrar = async (id) => {
    if (armed !== id) return setArmed(id);
    const { error } = await supabase.from('contador').delete().eq('id', id);
    if (error) toast({ title: errorMessage(error), status: 'error' });
    notifyChange('contador');
    setArmed(null);
  };

  return (
    <Flex direction="column" gap="20px">
      <Card>
        <Text fontSize="22px" fontWeight="700" color={textColor}>{T.titulo}</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="16px">
          Anota la lectura del contador de la máquina al empezar (lunes) y al cerrar (sábado). La app compara los clics de la máquina con los clics vendidos en ese periodo
          {tipo === 'color' ? ', contando solo las impresiones a color.' : tipo === 'bn' ? ', contando solo las impresiones en blanco y negro.' : '.'}
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="14px">
          <Field label="Fecha inicial"><TextIn type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
          <Field label="Contador inicial"><NumIn value={f.cIni} onChange={(e) => setF({ ...f, cIni: e.target.value })} /></Field>
          <Field label="Fecha de cierre"><TextIn type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} /></Field>
          <Field label="Contador de cierre"><NumIn value={f.cFin} onChange={(e) => setF({ ...f, cFin: e.target.value })} /></Field>
        </SimpleGrid>
        <Box bg={panel} borderRadius="16px" p="16px" mt="16px">
          {ok ? (
            <Flex direction="column" gap="6px" fontSize="sm">
              <Flex justify="space-between"><Text>Clics de la máquina</Text><Text fontWeight="700">{intf(maq)}</Text></Flex>
              <Flex justify="space-between"><Text>Clics vendidos en la app</Text><Text fontWeight="700">{intf(ven)}</Text></Flex>
              <Flex justify="space-between"><Text>Diferencia</Text><Dif d={d} maq={maq} /></Flex>
              {d > 0 && <Text color="secondaryGray.600">Hay {intf(d)} clics usados que no aparecen en ventas (pruebas, daños o ventas sin registrar). Cuestan unos {money(d * costoClic)}.</Text>}
            </Flex>
          ) : <Text fontSize="sm" color="secondaryGray.600">{f.cFin !== '' && maq < 0 ? 'El contador de cierre no puede ser menor que el inicial.' : 'Escribe el contador de cierre para ver el cuadre.'}</Text>}
        </Box>
        <Flex mt="14px" gap="10px" wrap="wrap">
          <Button variant="brand" onClick={guardar} isDisabled={!ok}>Guardar cuadre</Button>
          <Button variant="light" onClick={() => navigate(`/cierre?tipo=semanal&desde=${f.inicio}&hasta=${f.fin}`)}>Hacer cierre de este periodo</Button>
        </Flex>
      </Card>
      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor} mb="10px">Cuadres anteriores</Text>
        <DataTable
          rows={registros.data}
          empty="Aún no hay cuadres guardados."
          columns={[
            { key: 'p', label: 'Periodo', render: (r) => `${fdate(r.inicio)} a ${fdate(r.fin)}` },
            { key: 'c', label: 'Contador', num: true, render: (r) => `${intf(r.contador_inicial)} → ${intf(r.contador_final)}` },
            { key: 'm', label: 'Clics máquina', num: true, render: (r) => intf(r.contador_final - r.contador_inicial) },
            { key: 'v', label: 'Clics vendidos', num: true, render: (r) => intf(clicsEn(ventas.data, r.inicio, r.fin, tipo)) },
            { key: 'd', label: 'Sin cobrar', num: true, render: (r) => { const m = r.contador_final - r.contador_inicial; const dd = m - clicsEn(ventas.data, r.inicio, r.fin, tipo); return <Dif d={dd} maq={m} />; } },
            { key: 'x', label: '', num: true, render: (r) => (
              <Flex gap="6px" justify="flex-end">
                <Button size="xs" variant="lightBrand" onClick={() => navigate(`/cierre?tipo=semanal&desde=${r.inicio}&hasta=${r.fin}`)}>Cierre</Button>
                <Button size="xs" variant="outline" colorScheme="red" onClick={() => borrar(r.id)}>{armed === r.id ? '¿Borrar?' : 'Borrar'}</Button>
              </Flex>
            ) },
          ]}
        />
      </Card>
    </Flex>
  );
}
