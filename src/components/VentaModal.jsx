import { useEffect, useState } from 'react';
import {
  Badge, Box, Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Text,
  useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';
import { supabase, errorMessage } from '../lib/supabase';
import { notifyChange } from '../hooks/useLive';
import { fdate, intf, money, PAGOS, PAGOS_ABONO, recibo, today } from '../lib/format';
import { receiptText } from '../lib/receipt';
import { toNum } from '../lib/pricing';
import PagoBadge from './PagoBadge';
import ShareModal from './ShareModal';
import { Field, NumIn, Sel } from './Field';

export default function VentaModal({ ventaId, onClose }) {
  const { cfg, isAdmin } = useAuth();
  const toast = useToast();
  const share = useDisclosure();
  const [v, setV] = useState(null);
  const [abonos, setAbonos] = useState([]);
  const [costo, setCosto] = useState(null);
  const [vendedor, setVendedor] = useState('');
  const [monto, setMonto] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

  const load = async () => {
    const { data } = await supabase.from('ventas').select('*').eq('id', ventaId).maybeSingle();
    setV(data);
    const { data: ab } = await supabase.from('abonos').select('*').eq('venta_id', ventaId).order('creado');
    setAbonos(ab || []);
    if (data?.vendedor_id) {
      const { data: p } = await supabase.from('perfiles').select('nombre').eq('id', data.vendedor_id).maybeSingle();
      setVendedor(p?.nombre || '');
    }
    if (isAdmin) {
      const { data: c } = await supabase.from('venta_costos').select('costo').eq('venta_id', ventaId).maybeSingle();
      setCosto(c?.costo ?? null);
    }
  };
  useEffect(() => {
    if (ventaId) { setArmed(false); setMonto(''); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaId]);

  const abonar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('registrar_abono', { p_venta: v.id, p_monto: toNum(monto), p_pago: pago, p_fecha: today() });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('ventas', 'abonos');
    toast({ title: 'Abono registrado', status: 'success' });
    setMonto('');
    load();
  };
  const anular = async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    const { error } = await supabase.rpc('anular_venta', { p_venta: v.id });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('ventas', 'abonos', 'productos');
    toast({ title: 'Venta anulada y stock devuelto', status: 'success' });
    onClose();
  };

  return (
    <Modal isOpen={!!ventaId} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>
          {v ? `Recibo ${recibo(v)}` : 'Venta'}
          {v && <Text fontSize="sm" fontWeight="400" color="secondaryGray.600">{fdate(v.fecha)} · {v.cliente}{vendedor ? ` · vendió ${vendedor}` : ''}</Text>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!v ? <Text color="secondaryGray.600">Cargando…</Text> : (
            <Flex direction="column" gap="14px">
              <Box>
                {v.items.map((i, k) => (
                  <Flex key={k} justify="space-between" gap="12px" py="8px" borderBottom="1px solid" borderColor="gray.100">
                    <Box minW={0}>
                      <Text fontSize="sm" fontWeight="600">{i.desc}</Text>
                      <Text fontSize="xs" color="secondaryGray.600">{intf(i.cant)} × {money(i.pu)}{i.extra ? ` + plastificado ${money(i.extra)}` : ''}{i.clics ? ` · ${intf(i.clics)} clics` : ''}</Text>
                    </Box>
                    <Text fontSize="sm" fontWeight="700" whiteSpace="nowrap">{money(i.total)}</Text>
                  </Flex>
                ))}
                <Flex justify="space-between" align="center" pt="10px">
                  <Flex gap="8px" align="center" wrap="wrap"><Text fontWeight="700">Total</Text><PagoBadge v={v} /><Badge colorScheme={v.fe ? 'blue' : 'gray'}>F-E: {v.fe ? 'Sí' : 'No'}</Badge></Flex>
                  <Text fontWeight="700" fontSize="lg">{money(v.total)}</Text>
                </Flex>
                {isAdmin && costo != null && <Text fontSize="xs" color="secondaryGray.600" textAlign="right">Ganancia estimada {money(v.total - costo)}</Text>}
              </Box>
              {v.nota && <Text fontSize="sm" color="secondaryGray.600">Nota: {v.nota}</Text>}
              {abonos.length > 0 && (
                <Box>
                  <Text fontWeight="700" mb="4px">Pagos</Text>
                  {abonos.map((a) => (
                    <Flex key={a.id} justify="space-between" fontSize="sm"><Text>{fdate(a.fecha)} · {PAGOS[a.pago]}</Text><Text>{money(a.monto)}</Text></Flex>
                  ))}
                </Box>
              )}
              {Number(v.saldo) > 0 && (
                <Box bg={panel} p="14px" borderRadius="16px">
                  <Flex justify="space-between" mb="10px"><Text fontWeight="600">Saldo pendiente</Text><Text fontWeight="700">{money(v.saldo)}</Text></Flex>
                  <SimpleGrid columns={{ base: 1, sm: 3 }} gap="10px" alignItems="end">
                    <Field label="Abono"><NumIn min={0} value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
                    <Field label="Forma de pago"><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={PAGOS_ABONO} /></Field>
                    <Button variant="brand" h="44px" onClick={abonar} isLoading={busy} isDisabled={toNum(monto) <= 0}>Registrar abono</Button>
                  </SimpleGrid>
                </Box>
              )}
            </Flex>
          )}
        </ModalBody>
        <ModalFooter gap="10px" flexWrap="wrap">
          {v && isAdmin && (
            <Button variant="outline" colorScheme="red" onClick={anular} isLoading={busy}>{armed ? 'Sí, anular y devolver stock' : 'Anular venta'}</Button>
          )}
          {v && <Button ms="auto" variant="brand" onClick={share.onOpen}>Enviar recibo</Button>}
        </ModalFooter>
      </ModalContent>
      {v && <ShareModal isOpen={share.isOpen} onClose={share.onClose} title={`Recibo ${recibo(v)}`} text={receiptText(cfg?.negocio, v, 'sale')} tel={v.telefono} />}
    </Modal>
  );
}
