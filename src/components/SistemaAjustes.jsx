import { useEffect, useState } from 'react';
import {
  Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text, useColorModeValue, useToast,
} from '@chakra-ui/react';
import { MdDownload, MdRestartAlt, MdBackup } from 'react-icons/md';
import Card from './card/Card';
import { TextIn } from './Field';
import { notifyChange } from '../hooks/useLive';
import { supabase, errorMessage, isDemo } from '../lib/supabase';
import { saveFile } from '../lib/export';

const NOMBRES = { diario: 'Copia diaria', antes_reinicio: 'Copia antes de reiniciar' };
const fechaHora = (s) => new Date(s).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
const tam = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

// Backups (one per kind, overwritten each night) and the reset to zero.
export default function SistemaAjustes() {
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [lista, setLista] = useState([]);
  const [busy, setBusy] = useState('');
  const [reinicio, setReinicio] = useState(false);
  const [texto, setTexto] = useState('');

  const cargar = async () => {
    if (isDemo) return;
    const { data } = await supabase.rpc('respaldos_info');
    setLista(data || []);
  };
  useEffect(() => { cargar(); }, []);

  const descargar = async (tipo) => {
    setBusy(tipo);
    const { data, error } = await supabase.rpc('descargar_respaldo', { p_tipo: tipo });
    setBusy('');
    if (error || !data) return toast({ title: error ? errorMessage(error) : 'No hay copia todavía', status: 'error' });
    const dia = new Date(data.creado).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    try {
      await saveFile(`ecoglobal-copia-${tipo === 'diario' ? '' : 'antes-reinicio-'}${dia}.json`, JSON.stringify(data), 'application/json');
    } catch (e) { toast({ title: e.message, status: 'error' }); }
  };
  const copiarAhora = async () => {
    setBusy('ahora');
    const { error } = await supabase.rpc('hacer_respaldo', { p_tipo: 'diario' });
    setBusy('');
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    toast({ title: 'Copia de seguridad actualizada', status: 'success' });
    cargar();
  };
  const reiniciar = async () => {
    setBusy('reinicio');
    const { error } = await supabase.rpc('reiniciar_sistema', { p_confirma: texto.trim().toUpperCase() });
    setBusy('');
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    setReinicio(false); setTexto('');
    notifyChange('ventas', 'abonos', 'trabajos', 'trabajo_abonos', 'cierres', 'aperturas', 'gastos', 'contador', 'config_publica', 'productos', 'clientes');
    toast({ title: 'Sistema reiniciado en ceros', description: 'Clientes, inventario y ajustes se conservaron.', status: 'success', duration: 6000 });
    cargar();
  };

  if (isDemo) return null;
  return (
    <Card>
      <Text fontSize="lg" fontWeight="700" color={textColor}>Copia de seguridad</Text>
      <Text fontSize="sm" color="secondaryGray.600" mb="12px">
        Todas las noches a las 11:30 p. m. el sistema guarda una copia completa y reemplaza la del día anterior, así siempre hay una sola y no se llena el servidor.
        Descárgala cuando quieras (por ejemplo cada fin de semana) y guárdala en tu computador o en Drive.
      </Text>
      <Flex direction="column" gap="8px" mb="12px">
        {!lista.length && <Text fontSize="sm" color="secondaryGray.600">Todavía no hay copias. La primera se hace sola en unos minutos, o presiona «Hacer copia ahora».</Text>}
        {lista.map((r) => (
          <Flex key={r.tipo} align="center" gap="10px" wrap="wrap" p="10px 12px" borderRadius="12px" border="1px solid" borderColor="secondaryGray.100">
            <MdBackup />
            <Text fontSize="sm" fontWeight="700" me="auto">{NOMBRES[r.tipo] || r.tipo} <Text as="span" fontWeight="400" color="secondaryGray.600">· {fechaHora(r.creado)} · {tam(r.bytes)}</Text></Text>
            <Button size="sm" variant="lightBrand" leftIcon={<MdDownload />} isLoading={busy === r.tipo} onClick={() => descargar(r.tipo)}>Descargar</Button>
          </Flex>
        ))}
      </Flex>
      <Flex gap="10px" wrap="wrap">
        <Button variant="light" leftIcon={<MdBackup />} isLoading={busy === 'ahora'} onClick={copiarAhora}>Hacer copia ahora</Button>
        <Button variant="outline" colorScheme="red" leftIcon={<MdRestartAlt />} onClick={() => setReinicio(true)}>Reiniciar sistema en ceros</Button>
      </Flex>

      <Modal isOpen={reinicio} onClose={() => setReinicio(false)} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="20px" mx="12px">
          <ModalHeader>Reiniciar sistema en ceros</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" mb="8px"><b>Se borran:</b> ventas, abonos y cartera, cotizaciones y trabajos, aperturas y cierres de caja, gastos y lecturas del contador. La numeración vuelve a empezar.</Text>
            <Text fontSize="sm" mb="8px"><b>Se conservan:</b> usuarios, ajustes y precios, clientes, productos con su stock y los conteos de inventario.</Text>
            <Text fontSize="sm" mb="12px">Antes de borrar se guarda una copia «antes de reiniciar» que puedes descargar aquí mismo.</Text>
            <Text fontSize="sm" fontWeight="700" mb="6px">Escribe REINICIAR para confirmar</Text>
            <TextIn value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="REINICIAR" autoFocus />
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="light" onClick={() => setReinicio(false)}>Cancelar</Button>
            <Button colorScheme="red" isDisabled={texto.trim().toUpperCase() !== 'REINICIAR'} isLoading={busy === 'reinicio'} onClick={reiniciar}>Reiniciar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
