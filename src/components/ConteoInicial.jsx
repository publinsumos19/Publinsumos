import { useMemo, useState } from 'react';
import {
  Badge, Box, Button, Checkbox, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, useToast,
} from '@chakra-ui/react';
import { Field, NumIn, Sel, TextIn } from './Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { cantf, fdate, normalize, today } from '../lib/format';
import { toNum } from '../lib/pricing';

// Starting count: the shop types what is really on the shelf and the stock is set to that.
// A blank box keeps what the system has, unless "not counted = 0" is on.
export default function ConteoInicial({ productos, onClose }) {
  const { perfil } = useAuth();
  const toast = useToast();
  const head = useColorModeValue('white', 'navy.800');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [cuenta, setCuenta] = useState({});
  const [ceros, setCeros] = useState(false);
  const [busy, setBusy] = useState(false);
  const conteos = useLive(() => supabase.from('conteos').select('*').order('creado', { ascending: false }).limit(1), ['conteos']);
  const propios = productos.filter((p) => p.tipo === 'propio');
  const cats = [...new Set(propios.map((p) => p.categoria).filter(Boolean))].sort();
  const lista = propios.filter((p) => (!cat || p.categoria === cat) && (!q || normalize(p.nombre).includes(normalize(q))));

  const cambios = useMemo(() => propios.map((p) => {
    const v = cuenta[p.id];
    const contado = v === undefined || v === '' ? (ceros ? 0 : null) : toNum(v);
    return contado == null || contado === toNum(p.stock) ? null : { producto_id: p.id, nombre: p.nombre, antes: toNum(p.stock), contado };
  }).filter(Boolean), [propios, cuenta, ceros]);
  const contados = Object.values(cuenta).filter((v) => v !== '' && v !== undefined).length;

  const guardar = async () => {
    setBusy(true);
    try {
      for (const c of cambios) {
        const { error } = await supabase.from('productos').update({ stock: c.contado }).eq('id', c.producto_id);
        if (error) throw error;
      }
      await supabase.from('conteos').insert({ fecha: today(), contados, cambios: cambios.length, items: cambios, ceros, usuario_nombre: perfil?.nombre || '' });
      notifyChange('productos', 'conteos');
      toast({ title: `Conteo guardado: ${cambios.length} producto${cambios.length === 1 ? '' : 's'} ajustado${cambios.length === 1 ? '' : 's'}`, status: 'success' });
      onClose();
    } catch (e) {
      toast({ title: errorMessage(e), status: 'error' });
    }
    setBusy(false);
  };

  const ultimo = conteos.data?.[0];
  return (
    <Modal isOpen onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>
          Conteo inicial de inventario
          <Text fontSize="sm" fontWeight="400" color="secondaryGray.600">
            Escribe cuánto hay de verdad en la tienda. Si la casilla queda vacía, se deja lo que dice el sistema.
            {ultimo ? ` Último conteo: ${fdate(ultimo.fecha)}${ultimo.usuario_nombre ? ' por ' + ultimo.usuario_nombre : ''}.` : ''}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px" mb="12px" alignItems="end">
            <Field label="Categoría"><Sel value={cat} onChange={(e) => setCat(e.target.value)} options={[['', `Todas (${propios.length})`], ...cats.map((c) => [c, `${c} (${propios.filter((p) => p.categoria === c).length})`])]} /></Field>
            <Field label="Buscar"><TextIn type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del producto" /></Field>
            <Checkbox colorScheme="red" isChecked={ceros} onChange={(e) => setCeros(e.target.checked)} h="44px">Lo que no cuente queda en 0</Checkbox>
          </SimpleGrid>
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead position="sticky" top="0" bg={head} zIndex={1}>
                <Tr><Th>Producto</Th><Th isNumeric>En sistema</Th><Th isNumeric w="150px">Contado</Th><Th isNumeric>Diferencia</Th></Tr>
              </Thead>
              <Tbody>
                {lista.map((p) => {
                  const v = cuenta[p.id] ?? '';
                  const contado = v === '' ? (ceros ? 0 : null) : toNum(v);
                  const dif = contado == null ? null : contado - toNum(p.stock);
                  return (
                    <Tr key={p.id}>
                      <Td><Text fontWeight="600" fontSize="sm">{p.nombre}</Text><Text fontSize="xs" color="secondaryGray.600">{p.categoria}</Text></Td>
                      <Td isNumeric whiteSpace="nowrap">{cantf(p.stock)} {p.unidad}</Td>
                      <Td isNumeric><NumIn size="sm" h="36px" min={0} step="any" value={v} placeholder={cantf(p.stock)} onChange={(e) => setCuenta({ ...cuenta, [p.id]: e.target.value })} /></Td>
                      <Td isNumeric>{dif == null ? '—' : Math.abs(dif) < 0.001 ? <Badge colorScheme="green">Igual</Badge> : <Badge colorScheme={dif > 0 ? 'blue' : 'red'}>{dif > 0 ? '+' : ''}{cantf(dif)}</Badge>}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </ModalBody>
        <ModalFooter gap="10px" flexWrap="wrap">
          <Text fontSize="sm" me="auto">Contados: <b>{contados}</b> · Se ajustan: <b>{cambios.length}</b>{ceros ? ' (los no contados quedan en 0)' : ''}</Text>
          <Button variant="light" onClick={onClose}>Cancelar</Button>
          <Button variant="brand" onClick={guardar} isLoading={busy} isDisabled={!cambios.length}>Guardar conteo</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
