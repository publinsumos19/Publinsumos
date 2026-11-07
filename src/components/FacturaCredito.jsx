// Invoice of a credit sale or job: number, date and agreed days. The due date (and the cartera light)
// counts from the invoice date, because the client is often invoiced days after the sale.
import { useEffect, useState } from 'react';
import { Box, Button, Flex, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import { Field, NumIn, TextIn } from './Field';
import Semaforo from './Semaforo';
import { useAuth } from '../context/AuthContext';
import { addDays, fdate, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { semaforoCredito } from '../lib/semaforo';

export default function FacturaCredito({ x, plazo, onSave }) {
  const { cfg } = useAuth();
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const inicial = () => ({ factura: x?.factura || '', fecha: x?.factura_fecha || today(), dias: String(x?.dias_credito ?? plazo ?? 30) });
  const [f, setF] = useState(inicial);
  const [editando, setEditando] = useState(!x?.factura_fecha);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(inicial()); setEditando(!x?.factura_fecha); }, [x?.id, x?.factura_fecha, x?.factura, x?.dias_credito, plazo]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async (borrar = false) => {
    setBusy(true);
    const ok = await onSave(borrar ? { factura: null, factura_fecha: null, dias_credito: null } : { factura: f.factura.trim() || null, factura_fecha: f.fecha || today(), dias_credito: Math.max(0, Math.round(toNum(f.dias))) });
    setBusy(false);
    if (ok !== false) setEditando(borrar);
  };

  if (!editando && x?.factura_fecha) {
    return (
      <Box bg={panel} p="14px" borderRadius="16px">
        <Flex justify="space-between" align="center" gap="10px" wrap="wrap">
          <Box>
            <Text fontWeight="600">Factura {x.factura || ''}</Text>
            <Text fontSize="sm" color="secondaryGray.600">Facturada el {fdate(x.factura_fecha)} · {x.dias_credito} días · vence el {fdate(addDays(x.factura_fecha, toNum(x.dias_credito)))}</Text>
          </Box>
          <Flex gap="8px" align="center"><Semaforo s={semaforoCredito(x, cfg)} small /><Button size="sm" variant="light" onClick={() => setEditando(true)}>Cambiar</Button></Flex>
        </Flex>
      </Box>
    );
  }
  const vence = f.fecha ? addDays(f.fecha, Math.round(toNum(f.dias))) : null;
  return (
    <Box bg={panel} p="14px" borderRadius="16px">
      <Text fontWeight="600" mb="4px">Factura</Text>
      <Text fontSize="sm" color="secondaryGray.600" mb="10px">Cuando le facturen al cliente, escribe la factura y su fecha. El plazo empieza a contar desde ese día.</Text>
      <SimpleGrid columns={{ base: 1, sm: 3 }} gap="10px" alignItems="end">
        <Field label="N° de factura"><TextIn value={f.factura} onChange={(e) => setF({ ...f, factura: e.target.value })} placeholder="Ej. FE-1234" /></Field>
        <Field label="Fecha de la factura"><TextIn type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
        <Field label="Plazo (días)"><NumIn min={0} value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} /></Field>
      </SimpleGrid>
      <Flex mt="10px" gap="10px" align="center" wrap="wrap">
        {vence && <Text fontSize="sm">Vence el <b>{fdate(vence)}</b></Text>}
        <Button ms="auto" size="sm" variant="brand" onClick={() => guardar()} isLoading={busy} isDisabled={!f.fecha}>Guardar factura</Button>
        {x?.factura_fecha && <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>}
        {x?.factura_fecha && <Button size="sm" variant="ghost" colorScheme="red" onClick={() => guardar(true)} isLoading={busy}>Quitar factura</Button>}
      </Flex>
    </Box>
  );
}
