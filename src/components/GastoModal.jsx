import { useEffect, useState } from 'react';
import {
  Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, useToast,
} from '@chakra-ui/react';
import Segmented from './Segmented';
import { Field, NumIn, Sel, TextIn } from './Field';
import { notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { CAJAS_GASTO, CATEGORIAS_GASTO, PAGOS_GASTO } from '../lib/gastos';

// Register an expense. Cash ones say which drawer the money came out of.
export default function GastoModal({ isOpen, onClose, fecha = today() }) {
  const toast = useToast();
  const vacio = { fecha, concepto: '', categoria: 'Domicilio', monto: '', pago: 'efectivo', caja: 'insumos', nota: '' };
  const [g, setG] = useState(vacio);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isOpen) setG((x) => ({ ...x, fecha })); }, [isOpen, fecha]);
  const guardar = async () => {
    if (!g.concepto.trim()) return toast({ title: 'Escribe en qué se gastó', status: 'warning' });
    if (toNum(g.monto) <= 0) return toast({ title: 'Escribe el valor del gasto', status: 'warning' });
    setBusy(true);
    const { error } = await supabase.from('gastos').insert({ ...g, concepto: g.concepto.trim(), nota: g.nota.trim(), monto: toNum(g.monto), caja: g.pago === 'efectivo' ? g.caja : null });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('gastos');
    toast({ title: 'Gasto registrado', status: 'success' });
    setG({ ...vacio, fecha: g.fecha });
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>Registrar gasto</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex direction="column" gap="14px">
            <Field label="¿En qué se gastó?"><TextIn value={g.concepto} onChange={(e) => setG({ ...g, concepto: e.target.value })} placeholder="Ej. domicilio de pendones al centro" autoFocus /></Field>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap="12px">
              <Field label="Categoría"><Sel value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })} options={CATEGORIAS_GASTO.map((c) => [c, c])} /></Field>
              <Field label="Valor"><NumIn min={0} value={g.monto} onChange={(e) => setG({ ...g, monto: e.target.value })} placeholder="0" /></Field>
              <Field label="Fecha"><TextIn type="date" value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value || today() })} /></Field>
            </SimpleGrid>
            <Field label="Se pagó con"><Segmented value={g.pago} onChange={(pago) => setG({ ...g, pago })} options={PAGOS_GASTO} /></Field>
            {g.pago === 'efectivo' && <Field label="Salió de"><Segmented value={g.caja} onChange={(caja) => setG({ ...g, caja })} options={CAJAS_GASTO} /></Field>}
            <Field label="Nota (opcional)"><TextIn value={g.nota} onChange={(e) => setG({ ...g, nota: e.target.value })} placeholder="Ej. factura en la carpeta" /></Field>
          </Flex>
        </ModalBody>
        <ModalFooter gap="10px">
          <Button variant="light" onClick={onClose}>Cancelar</Button>
          <Button variant="brand" onClick={guardar} isLoading={busy}>Guardar gasto</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
