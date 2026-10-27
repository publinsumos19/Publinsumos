import { useEffect, useRef, useState } from 'react';
import { Button, Flex, SimpleGrid, Text, useToast } from '@chakra-ui/react';
import { MdLockOpen } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { notifyChange, useLive } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { fdate, money, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { Field, NumIn } from './Field';

// Opening the drawers for a day: the cash base each one starts with.
export default function AperturaCaja({ fecha = today(), apertura, onDone, compact }) {
  const { cfg } = useAuth();
  const toast = useToast();
  const [ins, setIns] = useState(apertura ? String(apertura.base_insumos) : String(cfg?.baseInsumos ?? ''));
  const [imp, setImp] = useState(apertura ? String(apertura.base_impresion) : String(cfg?.baseImpresion ?? ''));
  const [busy, setBusy] = useState(false);
  // A new opening starts with the bases used last time, until someone types.
  const ultima = useLive(() => supabase.from('aperturas').select('*').lt('fecha', fecha).order('fecha', { ascending: false }).limit(1), ['aperturas'], [fecha]);
  const tocado = useRef(false);
  useEffect(() => {
    const u = ultima.data?.[0];
    if (apertura || tocado.current || !u) return;
    if (ins === '' || ins === 'undefined') setIns(String(u.base_insumos));
    if (imp === '' || imp === 'undefined') setImp(String(u.base_impresion));
  }, [ultima.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrir = async () => {
    setBusy(true);
    const row = { fecha, base_insumos: toNum(ins), base_impresion: toNum(imp) };
    const { error } = apertura ? await supabase.from('aperturas').update(row).eq('id', apertura.id) : await supabase.from('aperturas').insert(row);
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('aperturas');
    toast({ title: apertura ? 'Bases actualizadas' : `Caja abierta con ${money(toNum(ins) + toNum(imp))}`, status: 'success' });
    onDone?.();
  };
  return (
    <Flex direction="column" gap="12px">
      {!compact && <Text fontSize="sm" color="secondaryGray.600">Cuenta la plata con la que empieza cada caja el {fdate(fecha)}.</Text>}
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap="12px">
        <Field label="Base caja impresión láser"><NumIn min={0} value={imp} onChange={(e) => { tocado.current = true; setImp(e.target.value); }} placeholder="0" /></Field>
        <Field label="Base caja insumos"><NumIn min={0} value={ins} onChange={(e) => { tocado.current = true; setIns(e.target.value); }} placeholder="0" /></Field>
      </SimpleGrid>
      <Flex align="center" gap="12px" wrap="wrap">
        <Button variant="brand" leftIcon={<MdLockOpen />} onClick={abrir} isLoading={busy}>{apertura ? 'Guardar bases' : 'Abrir caja'}</Button>
        <Text fontSize="sm">Total en caja: <b>{money(toNum(ins) + toNum(imp))}</b></Text>
      </Flex>
    </Flex>
  );
}
