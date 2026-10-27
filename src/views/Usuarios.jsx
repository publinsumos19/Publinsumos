import { useState } from 'react';
import {
  Badge, Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text, useColorModeValue, useToast,
} from '@chakra-ui/react';
import Card from '../components/card/Card';
import DataTable from '../components/DataTable';
import { Field, Sel, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase, errorMessage, isDemo } from '../lib/supabase';
import { fdate } from '../lib/format';

export default function Usuarios() {
  const { user } = useAuth();
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const perfiles = useLive(() => supabase.from('perfiles').select('*').order('creado'), ['perfiles']);
  const [clave, setClave] = useState(null);
  const [busy, setBusy] = useState(false);

  // There is no recovery email: the admin sets a new password for whoever forgot it.
  const guardarClave = async () => {
    if (clave.valor.length < 6) return toast({ title: 'La contraseña debe tener al menos 6 caracteres.', status: 'warning' });
    setBusy(true);
    const { error } = await supabase.rpc('cambiar_clave', { p_usuario: clave.p.id, p_clave: clave.valor });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    toast({ title: `Contraseña nueva para ${clave.p.nombre || clave.p.email}`, status: 'success' });
    setClave(null);
  };

  const cambiar = async (p, cambios) => {
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', p.id);
    if (error) toast({ title: errorMessage(error), status: 'error' });
    else { toast({ title: 'Usuario actualizado', status: 'success' }); perfiles.reload(); }
  };

  return (
    <Card>
      <Text fontSize="22px" fontWeight="700" color={textColor}>Usuarios</Text>
      <Text fontSize="sm" color="secondaryGray.600" mb="14px">
        Para dar acceso al vendedor, pídele que cree su cuenta en la pantalla de inicio con “Crear cuenta”. Aparecerá aquí como pendiente y tú lo activas.
      </Text>
      <DataTable
        rows={perfiles.data}
        empty="Cargando…"
        columns={[
          { key: 'nombre', label: 'Usuario', render: (p) => <><Text fontWeight="700">{p.nombre || 'Sin nombre'}</Text><Text fontSize="xs" color="secondaryGray.600">{p.email} · desde {fdate(p.creado.slice(0, 10))}</Text></> },
          { key: 'estado', label: 'Estado', render: (p) => <Badge colorScheme={p.activo ? 'green' : 'orange'}>{p.activo ? 'Activo' : 'Pendiente'}</Badge> },
          { key: 'rol', label: 'Rol', render: (p) => (
            p.id === user.id ? <Text>Administrador (tú)</Text>
              : <Sel w="170px" value={p.rol} onChange={(e) => cambiar(p, { rol: e.target.value })} options={[['vendedor', 'Vendedor'], ['admin', 'Administrador']]} />
          ) },
          { key: 'acc', label: '', num: true, render: (p) => (p.id === user.id ? null : (
            <Flex justify="flex-end" gap="8px" wrap="wrap">
              {!isDemo && <Button size="sm" variant="light" onClick={() => setClave({ p, valor: '' })}>Cambiar contraseña</Button>}
              <Button size="sm" variant={p.activo ? 'outline' : 'brand'} colorScheme={p.activo ? 'red' : undefined} onClick={() => cambiar(p, { activo: !p.activo })}>
                {p.activo ? 'Quitar acceso' : 'Activar'}
              </Button>
            </Flex>
          )) },
        ]}
      />
      <Modal isOpen={!!clave} onClose={() => setClave(null)} size="sm">
        <ModalOverlay />
        <ModalContent borderRadius="20px" mx="12px">
          <ModalHeader>Contraseña nueva</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="secondaryGray.600" mb="12px">Para {clave?.p.nombre || clave?.p.email}. Dásela a la persona para que entre con ella.</Text>
            <Field label="Contraseña (mínimo 6 caracteres)"><TextIn value={clave?.valor || ''} onChange={(e) => setClave({ ...clave, valor: e.target.value })} /></Field>
          </ModalBody>
          <ModalFooter gap="8px"><Button variant="ghost" onClick={() => setClave(null)}>Cancelar</Button><Button variant="brand" onClick={guardarClave} isLoading={busy}>Guardar</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
