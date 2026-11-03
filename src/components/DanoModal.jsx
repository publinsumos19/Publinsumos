// Prints that came out wrong: they are not charged, but they used clics (and the shop's paper).
// Recording them keeps the counter reconciliation honest and shows the loss in reports.
import { useState } from 'react';
import {
  Box, Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Text, useColorModeValue, useToast,
} from '@chakra-ui/react';
import Segmented from './Segmented';
import DataTable from './DataTable';
import { Field, NumIn, Sel, TextIn } from './Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { calcImpresion, costoDano } from '../lib/pricing';
import { intf, money, today } from '../lib/format';

export const MOTIVOS_DANO = ['Atasco de papel', 'Salió manchada o rayada', 'Colores o tamaño mal', 'Error en el archivo', 'Prueba de impresión', 'Otro'];


export default function DanoModal({ onClose }) {
  const { cfg, costos, isAdmin, user } = useAuth();
  const toast = useToast();
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const grupo = (cli) => (cfg?.sustratos || []).filter((x) => !!x.servicio === cli);
  const [cli, setCli] = useState(false);
  const [f, setF] = useState(() => ({ sus: grupo(false)[0]?.id || '', gram: cfg?.gramajes?.[2]?.id || cfg?.gramajes?.[0]?.id || '', color: true, cant: 1 }));
  const [motivo, setMotivo] = useState(MOTIVOS_DANO[0]);
  const [detalle, setDetalle] = useState('');
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(null);
  const hoy = useLive(() => supabase.from('impresiones_danadas').select('*').eq('fecha', today()).order('creado', { ascending: false }), ['impresiones_danadas']);

  const r = calcImpresion(cfg, { ...f, plast: 0 }, costos);
  const sus = cfg?.sustratos?.find((s) => s.id === f.sus);
  const cambiarGrupo = (v) => {
    const c = v === 'cli';
    setCli(c);
    setF((x) => ({ ...x, sus: grupo(c)[0]?.id || '' }));
  };

  const guardar = async () => {
    if (!r || r.cant <= 0) return toast({ title: 'Escribe la cantidad', status: 'warning' });
    setBusy(true);
    const { error } = await supabase.from('impresiones_danadas').insert({
      sus: f.sus, gram: sus?.corriente ? f.gram : null, color: !!f.color, cant: r.cant, clics: r.clics, descripcion: r.desc,
      motivo: detalle.trim() ? `${motivo}: ${detalle.trim()}` : motivo,
    });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('impresiones_danadas');
    toast({ title: 'Impresión dañada registrada', status: 'success' });
    setF((x) => ({ ...x, cant: 1 }));
    setDetalle('');
  };
  const borrar = async (id) => {
    if (armed !== id) return setArmed(id);
    const { error } = await supabase.from('impresiones_danadas').delete().eq('id', id);
    if (error) toast({ title: errorMessage(error), status: 'error' });
    notifyChange('impresiones_danadas');
    setArmed(null);
  };

  return (
    <Modal isOpen onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>Registrar impresión dañada</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize="sm" color="secondaryGray.600" mb="14px">
            Para las hojas que salieron malas y no se cobran. Así el cuadre del contador no las cuenta como clics sin cobrar.
          </Text>
          <Flex direction="column" gap="14px">
            {grupo(true).length > 0 && (
              <Flex align="center" gap="10px" wrap="wrap">
                <Text fontSize="sm" color="secondaryGray.600">¿Quién puso el papel?</Text>
                <Segmented value={cli ? 'cli' : 'neg'} onChange={cambiarGrupo} options={[['neg', 'El negocio'], ['cli', 'El cliente']]} />
              </Flex>
            )}
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
              <Field label="Papel y tamaño"><Sel value={f.sus} onChange={(e) => setF({ ...f, sus: e.target.value })} options={grupo(cli).map((s) => [s.id, s.nombre])} /></Field>
              {sus?.corriente ? <Field label="Gramaje"><Sel value={f.gram} onChange={(e) => setF({ ...f, gram: e.target.value })} options={cfg.gramajes.map((g) => [g.id, g.nombre])} /></Field> : <Box />}
              <Field label="Hojas dañadas"><NumIn min={1} value={f.cant} onChange={(e) => setF({ ...f, cant: e.target.value })} /></Field>
              <Field label="Motivo"><Sel value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS_DANO.map((m) => [m, m])} /></Field>
            </SimpleGrid>
            <Flex align="center" gap="10px">
              <Text fontSize="sm" color="secondaryGray.600">Impresión</Text>
              <Segmented value={f.color ? '1' : '0'} onChange={(v) => setF({ ...f, color: v === '1' })} options={[['1', 'Color'], ['0', 'Blanco y negro']]} />
            </Flex>
            <Field label="Detalle (opcional)"><TextIn value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. trabajo de tarjetas de Juan" /></Field>
            <Flex bg={panel} borderRadius="16px" p="14px" justify="space-between" align="center" gap="10px" wrap="wrap">
              <Text fontSize="sm">{r ? `${intf(r.clics)} clic${r.clics === 1 ? '' : 's'}` : '—'}{isAdmin && r?.costo != null ? ` · pérdida aprox. ${money(r.costo)}` : ''} · no se cobra</Text>
              <Button variant="brand" onClick={guardar} isLoading={busy}>Registrar</Button>
            </Flex>
          </Flex>
          <Text fontWeight="700" mt="20px" mb="8px">Dañadas hoy</Text>
          <DataTable rows={hoy.data} empty="Hoy no hay impresiones dañadas." columns={[
            { key: 'd', label: 'Impresión', render: (x) => <><Text fontWeight="700">{x.descripcion}</Text><Text fontSize="xs" color="secondaryGray.600">{x.motivo}</Text></> },
            { key: 'c', label: 'Hojas', num: true, render: (x) => intf(x.cant) },
            { key: 'k', label: 'Clics', num: true, render: (x) => intf(x.clics) },
            ...(isAdmin ? [{ key: 'p', label: 'Pérdida', num: true, render: (x) => money(costoDano(cfg, costos, x)) }] : []),
            { key: 'x', label: '', num: true, render: (x) => ((isAdmin || x.usuario_id === user?.id) ? (
              <Button size="xs" variant="outline" colorScheme="red" onClick={() => borrar(x.id)}>{armed === x.id ? '¿Borrar?' : 'Borrar'}</Button>
            ) : null) },
          ]} />
        </ModalBody>
        <ModalFooter />
      </ModalContent>
    </Modal>
  );
}
