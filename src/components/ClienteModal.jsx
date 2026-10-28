import { useState } from 'react';
import { MdAdd, MdClose } from 'react-icons/md';
import {
  Box, Button, Checkbox, Flex, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Text, Wrap, WrapItem, useToast,
} from '@chakra-ui/react';
import { Field, TextIn } from './Field';
import { notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { FORMAS_PAGO } from '../lib/trabajo';

// The client's payment terms: one option, and for the 50% advance, when the rest is paid.
export function FormaPagoPicker({ forma, saldoA, onChange, isDisabled }) {
  return (
    <Flex direction="column" gap="8px">
      <Wrap spacing="14px">
        {FORMAS_PAGO.map(([k, label]) => (
          <WrapItem key={k}>
            <Checkbox colorScheme="green" isChecked={forma === k} isDisabled={isDisabled} onChange={() => onChange({ forma: forma === k ? '' : k, saldoA })}>{label}</Checkbox>
          </WrapItem>
        ))}
      </Wrap>
      {forma === 'anticipo50' && (
        <Field label="Saldo restante a"><TextIn value={saldoA || ''} isDisabled={isDisabled} onChange={(e) => onChange({ forma, saldoA: e.target.value })} placeholder="Ej. contra entrega, 30 días después de instalar" /></Field>
      )}
    </Flex>
  );
}

export default function ClienteModal({ cliente, onClose }) {
  const toast = useToast();
  const [c, setC] = useState(() => ({ nombre: '', telefono: '', nit: '', correo: '', direccion: '', forma_pago: 'convenir', saldo_a: '', ...cliente, sucursales: cliente?.sucursales || [] }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const setSuc = (i, k) => (e) => setC({ ...c, sucursales: c.sucursales.map((s, j) => (j === i ? { ...s, [k]: e.target.value } : s)) });
  const guardar = async () => {
    if (!c.nombre.trim()) return toast({ title: 'Escribe el nombre del cliente', status: 'warning' });
    setBusy(true);
    const row = { nombre: c.nombre.trim(), telefono: c.telefono.trim(), nit: c.nit.trim(), correo: c.correo.trim(), direccion: c.direccion.trim(), forma_pago: c.forma_pago || null, saldo_a: c.forma_pago === 'anticipo50' ? c.saldo_a.trim() : '',
      sucursales: c.sucursales.map((s) => ({ nombre: s.nombre.trim(), direccion: (s.direccion || '').trim(), telefono: (s.telefono || '').trim() })).filter((s) => s.nombre) };
    const { error } = c.id ? await supabase.from('clientes').update(row).eq('id', c.id) : await supabase.from('clientes').insert(row);
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('clientes');
    toast({ title: c.id ? 'Cliente actualizado' : 'Cliente creado', status: 'success' });
    onClose();
  };
  return (
    <Modal isOpen onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>{c.id ? c.nombre : 'Nuevo cliente'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex direction="column" gap="14px">
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px">
              <Field label="Nombre o razón social"><TextIn value={c.nombre} onChange={set('nombre')} autoFocus /></Field>
              <Field label="NIT o cédula (opcional)"><TextIn value={c.nit || ''} onChange={set('nit')} /></Field>
              <Field label="Teléfono / WhatsApp"><TextIn value={c.telefono || ''} onChange={set('telefono')} inputMode="tel" placeholder="300 123 4567" /></Field>
              <Field label="Correo (opcional)"><TextIn value={c.correo || ''} onChange={set('correo')} type="email" /></Field>
              <Field label="Dirección (opcional)" gridColumn={{ md: 'span 2' }}><TextIn value={c.direccion || ''} onChange={set('direccion')} /></Field>
            </SimpleGrid>
            <Box>
              <Text fontSize="sm" fontWeight="700" mb="6px">Sucursales</Text>
              <Flex direction="column" gap="8px">
                {c.sucursales.map((s, i) => (
                  <Flex key={i} gap="8px" align="center" direction={{ base: 'column', md: 'row' }}>
                    <TextIn value={s.nombre} onChange={setSuc(i, 'nombre')} placeholder="Nombre (ej. Sede Norte)" />
                    <TextIn value={s.direccion || ''} onChange={setSuc(i, 'direccion')} placeholder="Dirección" />
                    <TextIn value={s.telefono || ''} onChange={setSuc(i, 'telefono')} placeholder="Teléfono" inputMode="tel" />
                    <IconButton aria-label="Quitar sucursal" icon={<MdClose />} variant="ghost" size="sm" onClick={() => setC({ ...c, sucursales: c.sucursales.filter((_, j) => j !== i) })} />
                  </Flex>
                ))}
                <Button alignSelf="flex-start" size="sm" variant="lightBrand" leftIcon={<MdAdd />} onClick={() => setC({ ...c, sucursales: [...c.sucursales, { nombre: '', direccion: '', telefono: '' }] })}>Agregar sucursal</Button>
              </Flex>
            </Box>
            <Field label="¿Cómo paga este cliente?">
              <FormaPagoPicker forma={c.forma_pago} saldoA={c.saldo_a} onChange={({ forma, saldoA }) => setC({ ...c, forma_pago: forma, saldo_a: saldoA })} />
            </Field>
            <Text fontSize="xs" color="secondaryGray.600">Esta forma de pago se pone sola en sus cotizaciones y se puede cambiar en cada una.</Text>
          </Flex>
        </ModalBody>
        <ModalFooter gap="10px">
          <Button variant="light" onClick={onClose}>Cancelar</Button>
          <Button variant="brand" onClick={guardar} isLoading={busy}>Guardar cliente</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
