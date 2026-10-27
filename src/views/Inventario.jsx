import { useMemo, useState } from 'react';
import {
  Badge, Box, Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Text, useColorModeValue, useToast,
} from '@chakra-ui/react';
import Card from '../components/card/Card';
import DataTable from '../components/DataTable';
import Segmented from '../components/Segmented';
import { Field, NumIn, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { cantf, intf, money, normalize } from '../lib/format';
import ConteoInicial from '../components/ConteoInicial';
import { Sel } from '../components/Field';
import { toNum } from '../lib/pricing';
import { margenDe, precioConMargen } from '../lib/margen';

const nuevo = { nombre: '', categoria: '', tipo: 'propio', proveedor: '', costo: '', precio: '', stock: 0, stock_min: 0, unidad: 'und' };

function ProductoModal({ producto, costo, categorias, onClose }) {
  const toast = useToast();
  const [p, setP] = useState(() => ({ ...nuevo, ...producto, costo: costo ?? '' }));
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ter = p.tipo === 'tercerizado';
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const margen = toNum(p.precio) - toNum(p.costo);
  const [pct, setPct] = useState(() => margenDe(costo, producto?.precio));

  const guardar = async () => {
    if (!p.nombre.trim()) return toast({ title: 'Escribe el nombre del producto', status: 'warning' });
    setBusy(true);
    const row = {
      nombre: p.nombre.trim(), categoria: p.categoria.trim(), tipo: p.tipo, proveedor: ter ? p.proveedor.trim() : '',
      precio: toNum(p.precio), stock: ter ? null : toNum(p.stock), stock_min: ter ? 0 : toNum(p.stock_min), unidad: p.unidad.trim() || 'und',
    };
    const res = p.id ? await supabase.from('productos').update(row).eq('id', p.id).select().single() : await supabase.from('productos').insert(row).select().single();
    if (!res.error) {
      const c = await supabase.from('producto_costos').upsert({ producto_id: res.data.id, costo: toNum(p.costo) });
      res.error = c.error;
    }
    setBusy(false);
    if (res.error) return toast({ title: errorMessage(res.error), status: 'error' });
    notifyChange('productos');
    toast({ title: 'Producto guardado', status: 'success' });
    onClose();
  };
  const borrar = async () => {
    if (!armed) return setArmed(true);
    const { error } = await supabase.from('productos').delete().eq('id', p.id);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('productos');
    toast({ title: 'Producto borrado', status: 'success' });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>{p.id ? 'Editar producto' : 'Nuevo producto'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex direction="column" gap="14px">
            <Segmented value={p.tipo} onChange={(t) => setP({ ...p, tipo: t })} options={[['propio', 'Propio (con stock)'], ['tercerizado', 'Tercerizado']]} />
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
              <Field label="Nombre"><TextIn value={p.nombre} onChange={set('nombre')} /></Field>
              <Field label="Categoría">
                <TextIn list="dl-cat" value={p.categoria} onChange={set('categoria')} placeholder="Ej. Insumos, Gran formato" />
                <datalist id="dl-cat">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              {ter ? <Field label="Proveedor"><TextIn value={p.proveedor} onChange={set('proveedor')} /></Field>
                : <Field label="Unidad"><TextIn value={p.unidad} onChange={set('unidad')} placeholder="und, m, rollo" /></Field>}
              <Field label="Costo"><NumIn min={0} value={p.costo} onChange={(e) => setP({ ...p, costo: e.target.value, ...(pct !== '' ? { precio: precioConMargen(e.target.value, pct) } : {}) })} /></Field>
              <Field label="% de margen sobre el costo"><NumIn min={0} value={pct} placeholder="Ej. 40" onChange={(e) => { setPct(e.target.value); setP({ ...p, precio: precioConMargen(p.costo, e.target.value) || p.precio }); }} /></Field>
              <Field label="Precio de venta"><NumIn min={0} value={p.precio} onChange={(e) => { setP({ ...p, precio: e.target.value }); setPct(margenDe(p.costo, e.target.value)); }} /></Field>
              {!ter && <>
                <Field label="Stock actual"><NumIn value={p.stock ?? 0} onChange={set('stock')} /></Field>
                <Field label="Avisar cuando queden"><NumIn value={p.stock_min} onChange={set('stock_min')} /></Field>
              </>}
            </SimpleGrid>
            {toNum(p.precio) > 0 && <Text fontSize="sm">Margen: <b>{money(margen)}</b> ({Math.round((margen / toNum(p.precio)) * 100)}% sobre el precio de venta)</Text>}
          </Flex>
        </ModalBody>
        <ModalFooter gap="10px">
          {p.id && <Button variant="outline" colorScheme="red" onClick={borrar}>{armed ? 'Sí, borrar' : 'Borrar'}</Button>}
          <Button ms="auto" variant="brand" onClick={guardar} isLoading={busy}>Guardar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function EntradaModal({ producto, onClose }) {
  const toast = useToast();
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState('');
  const guardar = async () => {
    if (toNum(cant) <= 0) return toast({ title: 'Escribe la cantidad', status: 'warning' });
    const { error } = await supabase.rpc('entrada_stock', { p_producto: producto.id, p_cant: toNum(cant), p_costo: costo === '' ? null : toNum(costo) });
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('productos');
    toast({ title: `Stock actualizado: ${intf(toNum(producto.stock) + toNum(cant))}`, status: 'success' });
    onClose();
  };
  return (
    <Modal isOpen onClose={onClose}>
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>Entrada de stock</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb="12px">{producto.nombre} · hay {intf(producto.stock)} {producto.unidad}</Text>
          <Flex direction="column" gap="12px">
            <Field label="Cantidad que entra"><NumIn value={cant} onChange={(e) => setCant(e.target.value)} /></Field>
            <Field label="Nuevo costo unitario (opcional)"><NumIn min={0} value={costo} onChange={(e) => setCosto(e.target.value)} /></Field>
          </Flex>
        </ModalBody>
        <ModalFooter><Button variant="brand" onClick={guardar}>Sumar al stock</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function Inventario() {
  const { isAdmin } = useAuth();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [entrada, setEntrada] = useState(null);
  const [conteo, setConteo] = useState(false);
  const [cat, setCat] = useState('');
  const productos = useLive(() => supabase.from('productos').select('*').order('nombre'), ['productos']);
  const costos = useLive(() => (isAdmin ? supabase.from('producto_costos').select('*') : Promise.resolve({ data: [] })), ['productos'], [isAdmin]);
  const costoDe = useMemo(() => Object.fromEntries((costos.data || []).map((c) => [c.producto_id, c.costo])), [costos.data]);
  const all = productos.data || [];
  const list = all.filter((p) => (!cat || p.categoria === cat) && (!q || normalize(`${p.nombre} ${p.categoria} ${p.proveedor}`).includes(normalize(q))));
  const bajo = (p) => p.tipo === 'propio' && toNum(p.stock) <= toNum(p.stock_min);
  const nBajos = all.filter(bajo).length;
  const categorias = [...new Set(all.map((p) => p.categoria).filter(Boolean))];

  const columns = [
    { key: 'nombre', label: 'Producto', render: (p) => <><Text fontWeight="700">{p.nombre}</Text><Text fontSize="xs" color="secondaryGray.600">{p.categoria}{p.tipo === 'tercerizado' && p.proveedor ? ` · ${p.proveedor}` : ''}</Text></> },
    { key: 'tipo', label: 'Tipo', render: (p) => <Badge colorScheme={p.tipo === 'propio' ? 'green' : 'purple'}>{p.tipo === 'propio' ? 'Propio' : 'Tercerizado'}</Badge> },
    ...(isAdmin ? [{ key: 'costo', label: 'Costo', num: true, render: (p) => money(costoDe[p.id]) }] : []),
    { key: 'precio', label: 'Precio', num: true, render: (p) => money(p.precio) },
    { key: 'stock', label: 'Stock', num: true, render: (p) => (p.tipo === 'tercerizado' ? '—' : (
      <Flex gap="6px" justify="flex-end" align="center">{cantf(p.stock)} {p.unidad}{bajo(p) && <Badge colorScheme={toNum(p.stock) <= 0 ? 'red' : 'orange'}>{toNum(p.stock) <= 0 ? 'Agotado' : 'Bajo'}</Badge>}</Flex>
    )) },
    ...(isAdmin ? [{ key: 'acc', label: '', num: true, render: (p) => (
      <Flex gap="6px" justify="flex-end">
        {p.tipo === 'propio' && <Button size="xs" variant="light" onClick={() => setEntrada(p)}>+ Entrada</Button>}
        <Button size="xs" variant="lightBrand" onClick={() => setEdit(p)}>Editar</Button>
      </Flex>
    ) }] : []),
  ];

  return (
    <Card>
      <Flex gap="12px" wrap="wrap" align="center" mb="14px">
        <Text fontSize="22px" fontWeight="700" color={textColor}>Inventario</Text>
        {nBajos > 0 && <Badge colorScheme="orange">{nBajos} con poco stock</Badge>}
        <Text fontSize="sm" color="secondaryGray.600">{all.length} productos</Text>
        <Flex ms="auto" gap="8px">{isAdmin && <><Button variant="lightBrand" onClick={() => setConteo(true)}>Conteo inicial</Button><Button variant="brand" onClick={() => setEdit({})}>Nuevo producto</Button></>}</Flex>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px" mb="14px">
        <Box gridColumn={{ md: 'span 2' }}><TextIn type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, categoría o proveedor" /></Box>
        <Sel value={cat} onChange={(e) => setCat(e.target.value)} options={[['', 'Todas las categorías'], ...categorias.sort().map((c) => [c, c])]} />
      </SimpleGrid>
      <DataTable rows={list} columns={columns} empty={all.length ? 'Ningún producto coincide.' : 'Aún no hay productos. Agrega tus insumos y los servicios que tercerizas.'} />
      {edit && <ProductoModal producto={edit} costo={edit.id ? costoDe[edit.id] : ''} categorias={categorias} onClose={() => setEdit(null)} />}
      {conteo && <ConteoInicial productos={all} onClose={() => setConteo(false)} />}
      {entrada && <EntradaModal producto={entrada} onClose={() => setEntrada(null)} />}
    </Card>
  );
}
