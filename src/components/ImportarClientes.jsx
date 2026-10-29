import { useRef, useState } from 'react';
import {
  Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Progress, Text, useToast,
} from '@chakra-ui/react';
import { MdUploadFile } from 'react-icons/md';
import { notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';

const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const sinTilde = (x) => norm(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Which column is which, by its header (NIT Receptor, Nombre Receptor, Celular, Email…).
const COLUMNAS = {
  nit: /nit|c[eé]dula|documento|identificaci/,
  nombre: /nombre|raz[oó]n|receptor|cliente|empresa/,
  telefono: /tel[eé]fono|celular|whatsapp|m[oó]vil/,
  correo: /correo|e-?mail/,
  direccion: /direcci[oó]n/,
};

// Reads an Excel or CSV list of clients and adds the ones that are not in the system yet.
// Repeated rows with the same NIT become one client (the name written most often wins).
export default function ImportarClientes({ existentes = [] }) {
  const toast = useToast();
  const input = useRef(null);
  const [plan, setPlan] = useState(null);
  const [avance, setAvance] = useState(null);

  const leer = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer());
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const head = filas.findIndex((r) => r.some((c) => COLUMNAS.nombre.test(sinTilde(c))));
      if (head < 0) throw new Error('No encontré una columna de nombre en la primera hoja.');
      const col = {};
      filas[head].forEach((c, i) => {
        const h = sinTilde(c);
        for (const [k, re] of Object.entries(COLUMNAS)) if (col[k] == null && re.test(h) && !(k === 'nombre' && COLUMNAS.nit.test(h))) { col[k] = i; break; }
      });
      const datos = filas.slice(head + 1).map((r) => Object.fromEntries(Object.entries(col).map(([k, i]) => [k, norm(r[i])]))).filter((r) => r.nombre);
      // One client per NIT; rows without NIT are grouped by name.
      const grupos = new Map();
      for (const r of datos) {
        const k = r.nit ? 'n' + r.nit.replace(/[^\dkK]/g, '') : 'x' + r.nombre.toLowerCase();
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(r);
      }
      const unicos = [...grupos.values()].map((rs) => {
        const cuenta = {};
        rs.forEach((r) => { cuenta[r.nombre] = (cuenta[r.nombre] || 0) + 1; });
        const nombre = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0];
        const primero = (k) => rs.map((r) => r[k]).find(Boolean) || '';
        return { nombre, nit: primero('nit'), telefono: primero('telefono'), correo: primero('correo'), direccion: primero('direccion') };
      });
      const nombres = new Set(existentes.map((c) => c.nombre.trim().toLowerCase()));
      const nits = new Set(existentes.map((c) => (c.nit || '').replace(/[^\dkK]/g, '')).filter(Boolean));
      const vistos = new Set();
      const nuevos = unicos.filter((c) => {
        const k = c.nombre.toLowerCase();
        if (nombres.has(k) || vistos.has(k) || (c.nit && nits.has(c.nit.replace(/[^\dkK]/g, '')))) return false;
        vistos.add(k);
        return true;
      });
      setPlan({ archivo: f.name, filas: datos.length, unicos: unicos.length, nuevos, columnas: Object.keys(col) });
    } catch (err) {
      toast({ title: err.message || 'No se pudo leer el archivo', status: 'error' });
    }
  };

  const importar = async () => {
    const lista = plan.nuevos;
    setAvance(0);
    for (let i = 0; i < lista.length; i += 200) {
      const lote = lista.slice(i, i + 200).map((c) => ({ ...c, forma_pago: null, saldo_a: '' }));
      const { error } = await supabase.from('clientes').upsert(lote, { onConflict: 'nombre_key', ignoreDuplicates: true });
      if (error) { setAvance(null); return toast({ title: errorMessage(error), status: 'error' }); }
      setAvance(Math.min(lista.length, i + 200));
    }
    notifyChange('clientes');
    toast({ title: `${lista.length} clientes importados`, status: 'success' });
    setPlan(null); setAvance(null);
  };

  return (
    <>
      <Button variant="light" leftIcon={<MdUploadFile />} onClick={() => input.current?.click()}>Importar desde Excel</Button>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={leer} />
      <Modal isOpen={!!plan} onClose={() => avance == null && setPlan(null)} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="20px" mx="12px">
          <ModalHeader>Importar clientes</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {plan && (
              <>
                <Text fontSize="sm" mb="8px"><b>{plan.archivo}</b> · columnas encontradas: {plan.columnas.join(', ')}</Text>
                <Text fontSize="sm" mb="4px">{plan.filas} filas leídas → {plan.unicos} clientes distintos (las filas repetidas con el mismo NIT quedan como uno solo).</Text>
                <Text fontSize="sm" mb="12px"><b>{plan.nuevos.length} clientes nuevos</b> para agregar. {plan.unicos - plan.nuevos.length > 0 ? `${plan.unicos - plan.nuevos.length} ya estaban en el sistema y no se tocan.` : ''}</Text>
                {plan.nuevos.slice(0, 5).map((c) => <Text key={c.nombre} fontSize="xs" color="secondaryGray.600">{c.nombre}{c.nit ? ` · NIT ${c.nit}` : ''}</Text>)}
                {plan.nuevos.length > 5 && <Text fontSize="xs" color="secondaryGray.600">… y {plan.nuevos.length - 5} más</Text>}
                {avance != null && <Progress mt="12px" value={(avance / Math.max(1, plan.nuevos.length)) * 100} colorScheme="green" borderRadius="8px" />}
              </>
            )}
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="light" onClick={() => setPlan(null)} isDisabled={avance != null}>Cancelar</Button>
            <Button variant="brand" onClick={importar} isLoading={avance != null} isDisabled={!plan?.nuevos.length}>Importar {plan?.nuevos.length || ''}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
