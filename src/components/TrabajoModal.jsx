import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Flex, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Checkbox, SimpleGrid, Switch, Text, Textarea, Wrap, WrapItem, useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { MdAdd, MdClose, MdDownload, MdPrint, MdAccountTree, MdLocalShipping } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { fdate, money, PAGOS, PAGOS_ABONO, PAGOS_VENTA, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import {
  CONCEPTOS_BASE, ESTADOS, cotizacionCfg, lineaTotal, netoTrabajo, numeroT, numeroR, retencionValor, subtotal, sumarHabiles, contarHabiles, totalTrabajo, trabajoHtml, trabajoText,
  esCompuesto, precioComponentes, costoComponentes, nombreArchivo, remisionHtml,
} from '../lib/trabajo';
import { margenDe, precioConMargen } from '../lib/margen';
import Segmented from './Segmented';
import { FormaPagoPicker } from './ClienteModal';
import { canPrint, printHtml, saveFile, savePdf } from '../lib/export';
import { Field, NumIn, Sel, TextIn } from './Field';
import ShareModal from './ShareModal';
import BuscadorProducto from './BuscadorProducto';

const nueva = () => ({ concepto: '', detalle: '', cant: 1, pu: '' });
const nuevoComp = () => ({ concepto: '', cant: 1, pu: '' });

export function EstadoBadge({ t }) {
  const [label, color] = ESTADOS[t.estado] || [t.estado, 'gray'];
  return <Badge colorScheme={color}>{label}</Badge>;
}

export default function TrabajoModal({ trabajo, onClose, conceptos = [] }) {
  const { cfg, isAdmin } = useAuth();
  const toast = useToast();
  const share = useDisclosure();
  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const q = cotizacionCfg(cfg);
  const [t, setT] = useState(() => ({
    cliente: '', telefono: '', titulo: '', entrega: '', nota: '', descuento: 0, estado: 'cotizacion', privado: isAdmin, abonado: 0,
    nit: '', forma_pago: '', saldo_a: '', instalacion: 'sin', dias_entrega: trabajo?.id ? '' : q.diasSin, entrega: trabajo?.id ? '' : sumarHabiles(today(), q.diasSin), retenciones: [], enviada: null, sucursal: '',
    contacto: '', cargo: '', ciudad: '', descripcion: '', orden_compra: '', entrada_almacen: '', entrada_fecha: '',
    ...trabajo,
    condiciones: trabajo?.condiciones ?? q.condiciones,
    lineas: trabajo?.lineas?.length ? trabajo.lineas.map((l) => ({ ...l, ...(l.componentes ? { componentes: l.componentes.map((c) => ({ ...c })) } : {}) })) : [nueva()],
  }));
  const [costos, setCostos] = useState([]);
  const [margenes, setMargenes] = useState([]);
  // Admin only: cost of each part of a composite product, one list per line.
  const [compCostos, setCompCostos] = useState([]);
  const [compMargenes, setCompMargenes] = useState([]);
  const [abiertos, setAbiertos] = useState({});
  const [oc, setOc] = useState('');
  const productos = useLive(() => supabase.from('productos').select('*').order('nombre'), ['productos']);
  const pCostos = useLive(() => (isAdmin ? supabase.from('producto_costos').select('*') : Promise.resolve({ data: [] })), ['productos', 'producto_costos'], [isAdmin]);
  const clientes = useLive(() => supabase.from('clientes').select('*').order('nombre'), ['clientes']);
  const [accion, setAccion] = useState(null);
  const [monto, setMonto] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [fe, setFe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const abonos = useLive(() => (t.id ? supabase.from('trabajo_abonos').select('*').eq('trabajo_id', t.id).order('creado') : Promise.resolve({ data: [] })), ['trabajo_abonos'], [t.id]);

  useEffect(() => {
    if (!isAdmin || !trabajo?.id) return;
    supabase.from('trabajo_costos').select('*').eq('trabajo_id', trabajo.id).maybeSingle().then(({ data }) => {
      const c = data?.costos || [];
      setCostos(c);
      setCompCostos(data?.componentes || []);
      setCompMargenes((trabajo.lineas || []).map((l, i) => (l.componentes || []).map((x, k) => margenDe(data?.componentes?.[i]?.[k], x.pu))));
      setMargenes((trabajo.lineas || []).map((l, i) => margenDe(c[i], l.pu)));
    });
  }, [isAdmin, trabajo?.id]);

  const editable = !t.id || ['cotizacion', 'aprobado'].includes(t.estado);
  const total = totalTrabajo(t);
  const neto = isAdmin && t.privado ? netoTrabajo(t) : total;
  const costoTotal = t.lineas.reduce((a, l, i) => a + toNum(l.cant) * toNum(costos[i]), 0);
  const sugerencias = useMemo(() => [...new Set([...CONCEPTOS_BASE, ...(cfg?.conceptos || []), ...conceptos])], [cfg, conceptos]);

  const setL = (i, k, v) => setT({ ...t, lineas: t.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const addL = (concepto = '') => { setT({ ...t, lineas: [...t.lineas, { ...nueva(), concepto }] }); setCostos([...costos, '']); setMargenes([...margenes, '']); };
  const delL = (i) => { setT({ ...t, lineas: t.lineas.filter((_, j) => j !== i) }); setCostos(costos.filter((_, j) => j !== i)); setMargenes(margenes.filter((_, j) => j !== i)); setCompCostos(compCostos.filter((_, j) => j !== i)); setCompMargenes(compMargenes.filter((_, j) => j !== i)); };

  // Composite product: its unit price is the sum of its parts; for the admin, its unit cost too.
  const recalcular = (i, comps, cc) => {
    const l = { ...t.lineas[i], componentes: comps };
    const pu = comps.length ? precioComponentes(l) : t.lineas[i].pu;
    setT({ ...t, lineas: t.lineas.map((x, j) => (j === i ? { ...l, pu: comps.length ? pu : x.pu, producto_id: comps.length ? null : x.producto_id } : x)) });
    if (isAdmin) {
      const lista = [...compCostos]; lista[i] = cc; setCompCostos(lista);
      if (comps.length) {
        const c = costoComponentes(l, cc);
        const cs = [...costos]; cs[i] = c || ''; setCostos(cs);
        const m = [...margenes]; m[i] = c ? margenDe(c, pu) : ''; setMargenes(m);
      }
    }
  };
  const compDe = (i) => t.lineas[i].componentes || [];
  const ccDe = (i) => compCostos[i] || [];
  // Each part works like a line: cost, then % margin, gives its price; typing the price recalculates the %.
  const mDe = (i) => compMargenes[i] || [];
  const setMs = (i, ms) => { const lista = [...compMargenes]; lista[i] = ms; setCompMargenes(lista); };
  const setComp = (i, k, campo, v) => {
    recalcular(i, compDe(i).map((c, j) => (j === k ? { ...c, [campo]: v } : c)), ccDe(i));
    if (campo === 'pu') { const ms = [...mDe(i)]; ms[k] = margenDe(ccDe(i)[k], v); setMs(i, ms); }
  };
  const setCompCosto = (i, k, v) => {
    const cc = [...ccDe(i)]; cc[k] = v;
    const m = mDe(i)[k];
    const comps = m !== '' && m != null ? compDe(i).map((c, j) => (j === k ? { ...c, pu: precioConMargen(v, m) } : c)) : compDe(i);
    recalcular(i, comps, cc);
  };
  const setCompMargen = (i, k, v) => {
    const ms = [...mDe(i)]; ms[k] = v; setMs(i, ms);
    const pu = precioConMargen(ccDe(i)[k], v);
    if (pu !== '') recalcular(i, compDe(i).map((c, j) => (j === k ? { ...c, pu } : c)), ccDe(i));
  };
  const addComp = (i) => { recalcular(i, [...compDe(i), nuevoComp()], [...ccDe(i), '']); setMs(i, [...mDe(i), '']); setAbiertos({ ...abiertos, [i]: true }); };
  const delComp = (i, k) => { recalcular(i, compDe(i).filter((_, j) => j !== k), ccDe(i).filter((_, j) => j !== k)); setMs(i, mDe(i).filter((_, j) => j !== k)); };
  const elegirComp = (i, k, p) => {
    const c = toNum((pCostos.data || []).find((x) => x.producto_id === p.id)?.costo);
    const cc = [...ccDe(i)]; cc[k] = c || '';
    const ms = [...mDe(i)]; ms[k] = c ? margenDe(c, p.precio) : ''; setMs(i, ms);
    recalcular(i, compDe(i).map((x, j) => (j === k ? { ...x, concepto: p.nombre, pu: p.precio ?? '', producto_id: p.id } : x)), cc);
  };
  // Cost first, then the margin: the sale price comes out of both. Typing a price recalculates the margin.
  const setCosto = (i, v) => {
    const c = [...costos]; c[i] = v; setCostos(c);
    if (margenes[i] !== '' && margenes[i] != null) setL(i, 'pu', precioConMargen(v, margenes[i]));
  };
  const setMargen = (i, v) => {
    const m = [...margenes]; m[i] = v; setMargenes(m);
    const pu = precioConMargen(costos[i], v);
    if (pu !== '') setL(i, 'pu', pu);
  };
  // Picking a store product fills its name, price and (for the admin) its cost.
  const elegirProducto = (i, p) => {
    const c = toNum((pCostos.data || []).find((x) => x.producto_id === p.id)?.costo);
    setT({ ...t, lineas: t.lineas.map((l, j) => (j === i ? { ...l, concepto: p.nombre, pu: p.precio ?? '', producto_id: p.id } : l)) });
    if (isAdmin) {
      const cs = [...costos]; cs[i] = c || ''; setCostos(cs);
      const m = [...margenes]; m[i] = c ? margenDe(c, p.precio) : ''; setMargenes(m);
    }
  };
  const setConcepto = (i, v) => setT({ ...t, lineas: t.lineas.map((l, j) => (j === i ? { ...l, concepto: v, producto_id: null } : l)) });
  const setPu = (i, v) => { setL(i, 'pu', v); const m = [...margenes]; m[i] = margenDe(costos[i], v); setMargenes(m); };

  const sucursales = (clientes.data || []).find((x) => x.nombre === t.cliente)?.sucursales || [];
  const pickCliente = (nombre) => {
    const c = (clientes.data || []).find((x) => x.nombre === nombre);
    if (!c) return setT({ ...t, cliente: nombre, sucursal: '' });
    setT({ ...t, cliente: nombre, sucursal: '', telefono: t.telefono || c.telefono || '', nit: c.nit || t.nit || '', forma_pago: c.forma_pago || t.forma_pago, saldo_a: c.saldo_a || t.saldo_a });
  };
  // Installation changes the usual delivery time; the delivery date follows the working days.
  const setEntregaDias = (dias, extra = {}) => {
    const desde = t.fecha || today();
    setT({ ...t, ...extra, dias_entrega: dias, entrega: toNum(dias) > 0 ? sumarHabiles(desde, dias) : t.entrega });
  };
  const setInstalacion = (v) => {
    const lineas = v === 'con' && !t.lineas.some((l) => /instalaci/i.test(l.concepto)) ? [...t.lineas, { ...nueva(), concepto: 'Instalación' }] : t.lineas;
    if (lineas !== t.lineas) { setCostos([...costos, '']); setMargenes([...margenes, '']); }
    setEntregaDias(v === 'con' ? q.diasCon : q.diasSin, { instalacion: v, lineas });
  };
  const toggleRet = (r) => {
    const on = (t.retenciones || []).some((x) => x.id === r.id);
    setT({ ...t, retenciones: on ? t.retenciones.filter((x) => x.id !== r.id) : [...(t.retenciones || []), { id: r.id, label: r.label, pct: r.pct }] });
  };

  const limpio = () => {
    const lineas = t.lineas.filter((l) => l.concepto.trim() || toNum(l.pu)).map((l) => ({ concepto: l.concepto.trim() || 'Sin nombre', detalle: (l.detalle || '').trim(), ...(l.producto_id ? { producto_id: l.producto_id } : {}), cant: toNum(l.cant) || 1, pu: toNum(l.pu), total: lineaTotal(l),
      ...(esCompuesto(l) ? { componentes: l.componentes.filter((c) => (c.concepto || '').trim() || toNum(c.pu)).map((c) => ({ concepto: (c.concepto || '').trim() || 'Sin nombre', cant: toNum(c.cant) || 1, pu: toNum(c.pu), ...(c.producto_id ? { producto_id: c.producto_id } : {}) })) } : {}) }));
    const tot = Math.max(0, subtotal(lineas) - toNum(t.descuento));
    const vivo = ['aprobado', 'entregado'].includes(t.estado);
    const privado = isAdmin ? !!t.privado : false;
    const retenciones = privado ? (t.retenciones || []) : [];
    const retencion = retencionValor({ lineas, descuento: t.descuento, retenciones });
    return {
      cliente: t.cliente.trim(), telefono: (t.telefono || '').trim(), titulo: t.titulo.trim(), entrega: t.entrega || null, nota: (t.nota || '').trim(),
      descuento: toNum(t.descuento), lineas, total: tot, saldo: vivo ? tot - retencion - toNum(t.abonado) : 0, privado,
      nit: (t.nit || '').trim(), forma_pago: t.forma_pago || null, saldo_a: t.forma_pago === 'anticipo50' ? (t.saldo_a || '').trim() : '',
      instalacion: t.instalacion || 'sin', dias_entrega: toNum(t.dias_entrega) || null, condiciones: (t.condiciones || '').trim(),
      retenciones, retencion, enviada: t.enviada || null, sucursal: t.sucursal || '',
      contacto: (t.contacto || '').trim(), cargo: (t.cargo || '').trim(), ciudad: (t.ciudad || '').trim(), descripcion: (t.descripcion || '').trim(),
      orden_compra: (t.orden_compra || '').trim(), entrada_almacen: (t.entrada_almacen || '').trim(), entrada_fecha: t.entrada_fecha || null,
    };
  };

  const guardar = async (cambios = {}) => {
    const row = { ...limpio(), ...cambios };
    if (!row.lineas.length) { toast({ title: 'Agrega al menos un concepto con su valor', status: 'warning' }); return null; }
    if (!row.cliente) { toast({ title: 'Escribe el nombre del cliente', status: 'warning' }); return null; }
    if (!isAdmin && row.telefono.replace(/\D/g, '').length < 7) { toast({ title: 'Escribe el teléfono del cliente', status: 'warning' }); return null; }
    setBusy(true);
    // A new client typed here is saved with their payment terms for next time.
    if (!(clientes.data || []).some((c) => c.nombre.trim().toLowerCase() === row.cliente.toLowerCase())) {
      await supabase.from('clientes').insert({ nombre: row.cliente, telefono: row.telefono, nit: row.nit, forma_pago: row.forma_pago, saldo_a: row.saldo_a, correo: '', direccion: '' });
      notifyChange('clientes');
    }
    const res = t.id ? await supabase.from('trabajos').update(row).eq('id', t.id).select().single() : await supabase.from('trabajos').insert(row).select().single();
    if (!res.error && isAdmin) {
      const c = await supabase.from('trabajo_costos').upsert({ trabajo_id: res.data.id, costos: t.lineas.map((_, i) => toNum(costos[i])), componentes: t.lineas.map((l, i) => (l.componentes || []).map((_, k) => toNum(compCostos[i]?.[k]))) });
      res.error = c.error;
    }
    setBusy(false);
    if (res.error) { toast({ title: errorMessage(res.error), status: 'error' }); return null; }
    notifyChange('trabajos');
    setT({ ...t, ...res.data, lineas: res.data.lineas.map((l) => ({ ...l, ...(l.componentes ? { componentes: l.componentes.map((c) => ({ ...c })) } : {}) })) });
    return res.data;
  };

  const abonar = async (id, m) => {
    const { error } = await supabase.rpc('abonar_trabajo', { p_trabajo: id, p_monto: m, p_pago: pago, p_fecha: today() });
    if (error) throw error;
  };

  const confirmar = async () => {
    try {
      if (accion === 'aprobar') {
        const saved = await guardar({ estado: 'aprobado', saldo: neto - toNum(t.abonado), orden_compra: oc.trim(), aprobado_fecha: today() });
        if (!saved) return;
        if (toNum(monto) > 0) await abonar(saved.id, toNum(monto));
        toast({ title: 'Trabajo aprobado', status: 'success' });
      } else if (accion === 'abonar') {
        await abonar(t.id, toNum(monto));
        toast({ title: 'Abono registrado', status: 'success' });
      } else if (accion === 'venta') {
        const saved = await guardar();
        if (!saved) return;
        // Store products sold from a quote leave the inventory like a normal sale.
        const propio = (l) => (productos.data || []).some((x) => x.id === l.producto_id && x.tipo === 'propio');
        const items = saved.lineas.map((l, i) => ({
          ...(propio(l) ? { tipo: 'prod', productoId: l.producto_id } : { tipo: 'pers' }), desc: `${saved.titulo || 'Trabajo'}: ${l.concepto}${l.detalle ? ` (${l.detalle})` : ''}`, cant: l.cant, pu: l.pu, total: l.total,
          ...(!propio(l) && isAdmin && toNum(costos[i]) ? { costoManual: toNum(costos[i]) } : {}),
        }));
        if (saved.descuento) items.push({ tipo: 'pers', desc: `${saved.titulo || 'Trabajo'}: descuento`, cant: 1, pu: -saved.descuento, total: -saved.descuento });
        const { data, error } = await supabase.rpc('registrar_venta', {
          p: { fecha: today(), cliente: saved.cliente, telefono: saved.telefono, items, pago, abono: pago === 'credito' ? toNum(monto) : null, pagoAbono: 'efectivo', nota: `${numeroT(saved)} ${saved.titulo}`, fe },
        });
        if (error) throw error;
        await supabase.from('trabajos').update({ estado: 'vendido', venta_id: data.id, saldo: 0 }).eq('id', saved.id);
        notifyChange('ventas', 'abonos', 'clientes');
        toast({ title: `Venta registrada N° ${String(data.numero).padStart(5, '0')}`, status: 'success' });
      }
      notifyChange('trabajos', 'trabajo_abonos');
      onClose();
    } catch (e) {
      toast({ title: errorMessage(e), status: 'error' });
    }
  };

  const cambiarEstado = async (estado) => {
    const saved = await guardar({ estado, saldo: estado === 'anulado' ? 0 : neto - toNum(t.abonado) });
    if (!saved) return;
    // Finishing a job hands out its delivery note.
    if (estado === 'entregado') { await remision(saved); return; }
    toast({ title: 'Trabajo anulado', status: 'success' }); onClose();
  };

  // Delivery note: numbered once, then downloaded as PDF.
  const remision = async (base = t) => {
    setBusy(true);
    const { data: n, error } = await supabase.rpc('asignar_remision', { p_trabajo: base.id });
    if (error) { setBusy(false); return toast({ title: errorMessage(error), status: 'error' }); }
    const r = { ...base, remision: n, remision_fecha: base.remision_fecha || today() };
    setT((x) => ({ ...x, remision: n, remision_fecha: r.remision_fecha }));
    notifyChange('trabajos');
    try { await savePdf(nombreArchivo(r, 'Remisión'), remisionHtml(cfg?.negocio, r, q)); toast({ title: `Remisión ${numeroR(n)} generada`, status: 'success' }); }
    catch (e) { toast({ title: e.message, status: 'error' }); }
    setBusy(false);
  };
  // Purchase order, client's warehouse entry: can be filled in at any time after approval.
  const guardarEntrega = async () => {
    setBusy(true);
    const row = { orden_compra: (t.orden_compra || '').trim(), entrada_almacen: (t.entrada_almacen || '').trim(), entrada_fecha: t.entrada_fecha || null };
    const { error } = await supabase.from('trabajos').update(row).eq('id', t.id);
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('trabajos');
    toast({ title: 'Datos guardados', status: 'success' });
  };

  const doc = () => trabajoHtml(cfg?.negocio, { ...t, ...limpio(), fecha: t.fecha || today(), numero: t.numero }, q);
  const validarEnvio = async () => {
    const enviada = t.enviada ? null : today();
    const saved = await guardar({ enviada });
    if (saved) toast({ title: enviada ? 'Cotización marcada como enviada' : 'Se quitó la marca de enviada', status: 'success' });
  };
  const imprimir = async () => {
    if (canPrint()) return printHtml(doc());
    try { if (await saveFile(`${nombreArchivo({ ...t, ...limpio() })}.html`, doc())) toast({ title: 'Abre el archivo y usa Imprimir o Guardar como PDF.', status: 'info' }); } catch (e) { toast({ title: e.message, status: 'error' }); }
  };
  // PDF named "Cotización <número> - <cliente> - <producto>".
  const descargar = async () => {
    setBusy(true);
    try { await savePdf(nombreArchivo({ ...t, ...limpio(), fecha: t.fecha || today() }), doc()); } catch (e) { toast({ title: e.message, status: 'error' }); }
    setBusy(false);
  };

  const saldo = neto - toNum(t.abonado);

  return (
    <Modal isOpen onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>
          <Flex align="center" gap="10px" wrap="wrap">
            <Text>{t.id ? `${numeroT(t)} · ${t.cliente}` : 'Nueva cotización personalizada'}</Text>
            {t.id && <EstadoBadge t={t} />}
            {isAdmin && t.privado && <Badge colorScheme="purple">Privado</Badge>}
            {t.enviada && <Badge colorScheme="teal">Enviada {fdate(t.enviada)}</Badge>}
          </Flex>
          {t.id && <Text fontSize="sm" fontWeight="400" color="secondaryGray.600">{fdate(t.fecha)}</Text>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex direction="column" gap="14px">
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="12px">
              <Field label="Cliente">
                <TextIn list="dl-tclientes" value={t.cliente} onChange={(e) => pickCliente(e.target.value)} isDisabled={!editable} placeholder="Nombre del cliente" autoComplete="off" />
                <datalist id="dl-tclientes">{(clientes.data || []).map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
              </Field>
              <Field label={isAdmin ? 'WhatsApp' : 'Teléfono / WhatsApp (obligatorio)'}><TextIn value={t.telefono || ''} onChange={(e) => setT({ ...t, telefono: e.target.value })} isDisabled={!editable} inputMode="tel" placeholder="300 123 4567" /></Field>
              <Field label="Trabajo"><TextIn value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} isDisabled={!editable} placeholder="Ej. Aviso en acrílico" /></Field>
              <Field label="NIT o cédula (opcional)"><TextIn value={t.nit || ''} onChange={(e) => setT({ ...t, nit: e.target.value })} isDisabled={!editable} /></Field>
            </SimpleGrid>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px">
              <Field label="Dirigida a (contacto, opcional)"><TextIn value={t.contacto || ''} onChange={(e) => setT({ ...t, contacto: e.target.value })} isDisabled={!editable} placeholder="Ej. Johana Castiblanco" /></Field>
              <Field label="Cargo o área (opcional)"><TextIn value={t.cargo || ''} onChange={(e) => setT({ ...t, cargo: e.target.value })} isDisabled={!editable} placeholder="Ej. Comunicaciones" /></Field>
              <Field label="Ciudad (opcional)"><TextIn value={t.ciudad || ''} onChange={(e) => setT({ ...t, ciudad: e.target.value })} isDisabled={!editable} placeholder="Ej. Honda - Tolima" /></Field>
            </SimpleGrid>
            <Field label="Descripción para el cliente (materiales, impresión, acabados; opcional)">
              <Textarea variant="main" fontSize="sm" rows={3} value={t.descripcion || ''} onChange={(e) => setT({ ...t, descripcion: e.target.value })} isDisabled={!editable}
                placeholder="Ej. Materiales: vinilo blanco respaldo blackout, vinilo reflectivo 3M grado 11. Impresión full color." />
            </Field>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px" alignItems="end">
              <Field label="Instalación">
                <Segmented value={t.instalacion || 'sin'} onChange={(v) => editable && setInstalacion(v)} options={[['sin', 'Sin instalación'], ['con', 'Con instalación']]} />
              </Field>
              <Field label="Fecha de entrega">
                <TextIn type="date" value={t.entrega || ''} onChange={(e) => setT({ ...t, entrega: e.target.value, dias_entrega: contarHabiles(t.fecha || today(), e.target.value) })} isDisabled={!editable} />
              </Field>
              {!!sucursales.length && (
                <Field label="Sucursal">
                  <Sel value={t.sucursal || ''} onChange={(e) => setT({ ...t, sucursal: e.target.value })} isDisabled={!editable}
                    options={[['', 'Sede principal'], ...sucursales.map((x) => [x.nombre, x.nombre])]} />
                </Field>
              )}
            </SimpleGrid>
            <Field label="Forma de pago del cliente">
              <FormaPagoPicker forma={t.forma_pago} saldoA={t.saldo_a} isDisabled={!editable} onChange={({ forma, saldoA }) => setT({ ...t, forma_pago: forma, saldo_a: saldoA })} />
            </Field>

            <Box>
              <Text fontWeight="700" color={textColor} mb="6px">Desglose</Text>
              <datalist id="dl-conceptos">{sugerencias.map((c) => <option key={c} value={c} />)}</datalist>
              <Flex direction="column" gap="8px">
                {t.lineas.map((l, i) => (
                  <Box key={i} bg={panel} p="10px" borderRadius="14px">
                  <SimpleGrid columns={{ base: 2, md: isAdmin ? 12 : 10 }} gap="8px" alignItems="end">
                    <Field label={esCompuesto(l) ? 'Producto terminado' : l.producto_id ? 'Producto de la tienda' : 'Concepto'} gridColumn={{ base: 'span 2', md: 'span 3' }}>
                      <BuscadorProducto productos={productos.data || []} value={l.producto_id} label={l.concepto} placeholder="Busca o crea un concepto" extras={sugerencias}
                        onSelect={(p) => elegirProducto(i, p)} onCrear={(v) => setConcepto(i, v)} isDisabled={!editable} bg="white" />
                    </Field>
                    <Field label="Medidas o detalle" gridColumn={{ base: 'span 2', md: isAdmin ? 'span 2' : 'span 3' }}><TextIn value={l.detalle} onChange={(e) => setL(i, 'detalle', e.target.value)} isDisabled={!editable} placeholder="Ej. 60 x 40 cm, 3 mm" bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                    <Field label="Cant." gridColumn={{ md: 'span 1' }}><NumIn min={0} value={l.cant} onChange={(e) => setL(i, 'cant', e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                    {isAdmin && <Field label="Costo unit." gridColumn={{ md: 'span 2' }}><NumIn min={0} value={costos[i] ?? ''} onChange={(e) => setCosto(i, e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>}
                    {isAdmin && <Field label="%" gridColumn={{ md: 'span 1' }}><NumIn min={0} value={margenes[i] ?? ''} onChange={(e) => setMargen(i, e.target.value)} isDisabled={!editable} placeholder="%" bg="white" _dark={{ bg: 'navy.800' }} /></Field>}
                    <Field label={isAdmin ? 'Precio venta unit.' : 'Valor unitario'} gridColumn={{ md: 'span 2' }}><NumIn min={0} value={l.pu} onChange={(e) => setPu(i, e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                    <Flex gridColumn={{ base: 'span 2', md: 'span 1' }} align="center" justify="space-between" h="44px">
                      <Text fontWeight="700" fontSize="sm" sx={{ fontVariantNumeric: 'tabular-nums' }} whiteSpace="nowrap">{money(lineaTotal(l))}</Text>
                      {editable && <IconButton size="xs" variant="ghost" aria-label="Quitar" icon={<MdClose />} onClick={() => delL(i)} />}
                    </Flex>
                  </SimpleGrid>
                  <Flex mt="8px" align="center" gap="8px" wrap="wrap">
                    <Button size="xs" variant={esCompuesto(l) ? 'lightBrand' : 'ghost'} leftIcon={<MdAccountTree />}
                      onClick={() => (esCompuesto(l) ? setAbiertos({ ...abiertos, [i]: !abiertos[i] }) : editable && addComp(i))} isDisabled={!editable && !esCompuesto(l)}>
                      {esCompuesto(l) ? `Componentes (${l.componentes.length}) ${abiertos[i] ? '▲' : '▼'}` : 'Convertir en producto compuesto'}
                    </Button>
                    {esCompuesto(l) && <Text fontSize="xs" color="secondaryGray.600">Por unidad: precio {money(precioComponentes(l))}{isAdmin ? ` · costo ${money(costoComponentes(l, ccDe(i)))}` : ''}. El cliente no ve los componentes.</Text>}
                  </Flex>
                  {esCompuesto(l) && abiertos[i] && (
                    <Box mt="8px" ps={{ md: '18px' }} borderLeft={{ md: '3px solid' }} borderColor="brand.200">
                      {l.componentes.map((c, k) => (
                        <SimpleGrid key={k} columns={{ base: 2, md: isAdmin ? 11 : 8 }} gap="8px" alignItems="end" mb="6px">
                          <Field label="Componente" gridColumn={{ base: 'span 2', md: 'span 4' }}>
                            <BuscadorProducto productos={productos.data || []} value={c.producto_id} label={c.concepto} placeholder="Busca un insumo o escribe uno" extras={sugerencias}
                              onSelect={(p) => elegirComp(i, k, p)} onCrear={(v) => setComp(i, k, 'concepto', v)} isDisabled={!editable} bg="white" />
                          </Field>
                          <Field label="Cant. por unidad"><NumIn min={0} value={c.cant} onChange={(e) => setComp(i, k, 'cant', e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                          {isAdmin && <Field label="Costo unit." gridColumn={{ md: 'span 2' }}><NumIn min={0} value={ccDe(i)[k] ?? ''} onChange={(e) => setCompCosto(i, k, e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>}
                          {isAdmin && <Field label="%"><NumIn min={0} value={mDe(i)[k] ?? ''} onChange={(e) => setCompMargen(i, k, e.target.value)} isDisabled={!editable} placeholder="%" bg="white" _dark={{ bg: 'navy.800' }} /></Field>}
                          <Field label="Precio unit." gridColumn={{ md: 'span 2' }}><NumIn min={0} value={c.pu} onChange={(e) => setComp(i, k, 'pu', e.target.value)} isDisabled={!editable} bg="white" _dark={{ bg: 'navy.800' }} /></Field>
                          <Flex align="center" justify="space-between" h="44px">
                            <Text fontSize="sm" fontWeight="600" whiteSpace="nowrap">{money(toNum(c.cant) * toNum(c.pu))}</Text>
                            {editable && <IconButton size="xs" variant="ghost" aria-label="Quitar componente" icon={<MdClose />} onClick={() => delComp(i, k)} />}
                          </Flex>
                        </SimpleGrid>
                      ))}
                      {editable && <Button size="xs" variant="light" leftIcon={<MdAdd />} onClick={() => addComp(i)}>Agregar componente</Button>}
                    </Box>
                  )}
                  </Box>
                ))}
              </Flex>
              {editable && (
                <>
                  <Wrap mt="10px" spacing="6px">
                    {sugerencias.slice(0, 12).map((c) => <WrapItem key={c}><Button size="xs" variant="light" onClick={() => addL(c)}>+ {c}</Button></WrapItem>)}
                  </Wrap>
                  <Button mt="10px" size="sm" variant="lightBrand" leftIcon={<MdAdd />} onClick={() => addL('')}>Agregar concepto nuevo</Button>
                </>
              )}
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px" alignItems="start">
              <Flex direction="column" gap="12px">
                <Field label="Nota o condiciones (sale en la cotización)"><TextIn value={t.nota || ''} onChange={(e) => setT({ ...t, nota: e.target.value })} isDisabled={!editable} placeholder="Ej. 50% de anticipo para empezar" /></Field>
                <Field label="Condiciones de la cotización">
                  <Textarea variant="main" fontSize="sm" rows={5} value={t.condiciones || ''} onChange={(e) => setT({ ...t, condiciones: e.target.value })} isDisabled={!editable} />
                </Field>
                {editable && t.condiciones !== q.condiciones && <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => setT({ ...t, condiciones: q.condiciones })}>Volver a las condiciones predeterminadas</Button>}
                {isAdmin && t.privado && (
                  <Box>
                    <Text fontSize="sm" fontWeight="700" mb="6px">Restar retención (% sobre el total)</Text>
                    <Flex direction="column" gap="4px">
                      {q.retenciones.map((r) => (
                        <Checkbox key={r.id} colorScheme="purple" isDisabled={!editable} isChecked={(t.retenciones || []).some((x) => x.id === r.id)} onChange={() => toggleRet(r)}>
                          <Text fontSize="sm">{r.label} · {r.pct}%</Text>
                        </Checkbox>
                      ))}
                    </Flex>
                  </Box>
                )}
                {isAdmin && (
                  <Flex align="center" gap="10px">
                    <Switch colorScheme="purple" id="sw-privado" isChecked={!!t.privado} onChange={(e) => setT({ ...t, privado: e.target.checked })} isDisabled={!editable || (t.id && t.estado !== 'cotizacion')} />
                    <Text as="label" htmlFor="sw-privado" fontSize="sm">Privado: va a mi Cartera privada y el vendedor no lo ve</Text>
                  </Flex>
                )}
              </Flex>
              <Box bg={panel} p="14px" borderRadius="16px" fontSize="sm">
                <Flex justify="space-between"><Text>Subtotal</Text><Text fontWeight="700">{money(subtotal(t.lineas))}</Text></Flex>
                <Flex justify="space-between" align="center" mt="6px"><Text>Descuento</Text><Box w="140px"><NumIn size="sm" h="36px" min={0} value={t.descuento || ''} onChange={(e) => setT({ ...t, descuento: e.target.value })} isDisabled={!editable} placeholder="0" bg="white" _dark={{ bg: 'navy.800' }} /></Box></Flex>
                <Flex justify="space-between" align="baseline" mt="8px" pt="8px" borderTop="2px solid" borderColor={textColor}><Text fontWeight="700">Total</Text><Text fontSize="26px" fontWeight="700" color={textColor}>{money(total)}</Text></Flex>
                {isAdmin && t.privado && (t.retenciones || []).map((r) => (
                  <Flex key={r.id} justify="space-between" mt="4px"><Text>{r.label} ({r.pct}%)</Text><Text fontWeight="700" color="red.500">-{money(total * (toNum(r.pct) / 100))}</Text></Flex>
                ))}
                {neto !== total && <Flex justify="space-between" align="baseline" mt="6px"><Text fontWeight="700">Neto a recibir</Text><Text fontSize="20px" fontWeight="700" color={textColor}>{money(neto)}</Text></Flex>}
                {isAdmin && costoTotal > 0 && <Text fontSize="xs" color="secondaryGray.600" textAlign="right">Costo {money(costoTotal)} · ganancia {money(neto - costoTotal)}</Text>}
                {toNum(t.abonado) > 0 && <><Flex justify="space-between" mt="6px"><Text>Abonado</Text><Text fontWeight="700">{money(t.abonado)}</Text></Flex><Flex justify="space-between"><Text>Saldo</Text><Text fontWeight="700" color="orange.500">{money(saldo)}</Text></Flex></>}
              </Box>
            </SimpleGrid>

            {(abonos.data || []).length > 0 && (
              <Box>
                <Text fontWeight="700" mb="4px">Abonos</Text>
                {abonos.data.map((a) => <Flex key={a.id} justify="space-between" fontSize="sm"><Text>{fdate(a.fecha)} · {PAGOS[a.pago]}</Text><Text>{money(a.monto)}</Text></Flex>)}
              </Box>
            )}

            {t.id && ['aprobado', 'entregado', 'vendido'].includes(t.estado) && (
              <Box border="1px solid" borderColor="secondaryGray.100" p="14px" borderRadius="16px">
                <Flex align="center" gap="8px" mb="10px"><MdLocalShipping /><Text fontWeight="700">Orden de compra, remisión y entrada de almacén</Text></Flex>
                <SimpleGrid columns={{ base: 1, md: 4 }} gap="10px" alignItems="end">
                  <Field label="Orden de compra del cliente"><TextIn value={t.orden_compra || ''} onChange={(e) => setT({ ...t, orden_compra: e.target.value })} placeholder="Opcional" /></Field>
                  <Field label="Remisión">
                    <Flex h="44px" align="center" gap="8px">
                      {t.remision ? <Text fontWeight="700">{numeroR(t.remision)} <Text as="span" fontSize="xs" fontWeight="400" color="secondaryGray.600">{fdate(t.remision_fecha)}</Text></Text> : <Text fontSize="sm" color="secondaryGray.600">Sale al terminar</Text>}
                    </Flex>
                  </Field>
                  <Field label="N° de entrada de almacén del cliente"><TextIn value={t.entrada_almacen || ''} onChange={(e) => setT({ ...t, entrada_almacen: e.target.value })} placeholder="Cuando el cliente la reciba" /></Field>
                  <Field label="Fecha de la entrada"><TextIn type="date" value={t.entrada_fecha || ''} onChange={(e) => setT({ ...t, entrada_fecha: e.target.value })} /></Field>
                </SimpleGrid>
                <Flex gap="8px" mt="10px" wrap="wrap">
                  <Button size="sm" variant="lightBrand" onClick={guardarEntrega} isLoading={busy}>Guardar estos datos</Button>
                  {t.remision && <Button size="sm" variant="light" leftIcon={<MdDownload />} onClick={() => remision()} isLoading={busy}>Descargar remisión</Button>}
                  {!t.remision && t.estado === 'vendido' && <Button size="sm" variant="light" leftIcon={<MdLocalShipping />} onClick={() => remision()} isLoading={busy}>Generar remisión</Button>}
                </Flex>
              </Box>
            )}

            {accion && accion !== 'aprobar' && (
              <Box bg={panel} p="14px" borderRadius="16px">
                <Text fontWeight="700" mb="10px">{accion === 'aprobar' ? 'Aprobar trabajo y recibir anticipo' : accion === 'abonar' ? 'Registrar abono' : 'Pasar a venta'}</Text>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap="10px" alignItems="end">
                  {accion === 'aprobar' && <Field label="Orden de compra (opcional)"><TextIn value={oc} onChange={(e) => setOc(e.target.value)} placeholder="N° de la orden del cliente" /></Field>}
                  {accion === 'venta' && <Field label="Forma de pago"><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={PAGOS_VENTA} /></Field>}
                  {(accion !== 'venta' || pago === 'credito') && <Field label={accion === 'aprobar' ? 'Anticipo (opcional)' : accion === 'venta' ? 'Abono inicial' : 'Abono'}><NumIn min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" /></Field>}
                  {(accion !== 'venta' || pago === 'credito') && accion !== 'venta' && <Field label="Recibido en"><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={PAGOS_ABONO} /></Field>}
                  {accion === 'venta' && (
                    <Flex gap="14px" align="center" h="44px"><Text fontSize="sm" fontWeight="600">F-E</Text>
                      <Switch colorScheme="green" isChecked={fe} onChange={(e) => setFe(e.target.checked)} /><Text fontSize="sm">{fe ? 'Sí' : 'No'}</Text>
                    </Flex>
                  )}
                </SimpleGrid>
                {accion === 'venta' && <Text fontSize="sm" color="secondaryGray.600" mt="8px">Se registra como venta del negocio. Si es a crédito, el saldo va a la Cartera del negocio.</Text>}
                <Flex gap="10px" mt="12px"><Button variant="brand" onClick={confirmar} isLoading={busy} isDisabled={accion === 'abonar' && toNum(monto) <= 0}>Confirmar</Button><Button variant="ghost" onClick={() => setAccion(null)}>Cancelar</Button></Flex>
              </Box>
            )}
          </Flex>
        </ModalBody>
        <ModalFooter gap="8px" flexWrap="wrap">
          {t.id && !['anulado', 'vendido'].includes(t.estado) && (
            <Button size="sm" variant="outline" colorScheme="red" onClick={() => (armed ? cambiarEstado('anulado') : setArmed(true))}>{armed ? 'Sí, anular' : 'Anular'}</Button>
          )}
          <Flex gap="8px" ms="auto" wrap="wrap" justify="flex-end">
            <Button size="sm" leftIcon={<FaWhatsapp />} bg="#25D366" color="white" _hover={{ bg: '#1ebe5b' }} onClick={share.onOpen}>Enviar</Button>
            <Button size="sm" variant="light" leftIcon={<MdPrint />} onClick={imprimir}>Imprimir</Button>
            <Button size="sm" variant="light" leftIcon={<MdDownload />} onClick={descargar}>Descargar</Button>
            {t.estado === 'cotizacion' && <Button size="sm" variant={t.enviada ? 'outline' : 'light'} colorScheme={t.enviada ? 'teal' : undefined} onClick={validarEnvio} isLoading={busy}>{t.enviada ? '✓ Enviada' : 'Validar envío'}</Button>}
            {editable && <Button size="sm" variant="lightBrand" onClick={async () => { if (await guardar()) toast({ title: 'Guardado', status: 'success' }); }} isLoading={busy}>Guardar</Button>}
            {t.estado === 'cotizacion' && (t.privado
              ? <Button size="sm" variant="brand" onClick={() => { setAccion('aprobar'); setOc(t.orden_compra || ''); setMonto(String(Math.round(neto / 2))); }}>Aprobar</Button>
              : <Button size="sm" variant="brand" onClick={() => { setAccion('venta'); setMonto(String(Math.round(total / 2))); setPago('credito'); }}>Pasar a venta</Button>)}
            {['aprobado', 'entregado'].includes(t.estado) && saldo > 0 && <Button size="sm" variant="brand" onClick={() => { setAccion('abonar'); setMonto(String(saldo)); }}>Abonar</Button>}
            {t.estado === 'aprobado' && <Button size="sm" variant="light" leftIcon={<MdLocalShipping />} onClick={() => cambiarEstado('entregado')} isLoading={busy}>Terminar y generar remisión</Button>}
          </Flex>
        </ModalFooter>
      </ModalContent>
      <Modal isOpen={accion === 'aprobar'} onClose={() => setAccion(null)} isCentered size="2xl">
        <ModalOverlay />
        <ModalContent borderRadius="20px" mx="12px">
          <ModalCloseButton />
          <ModalBody pt="20px" pb="16px">
              <Box>
                <Text fontWeight="700" mb="10px">{accion === 'aprobar' ? 'Aprobar trabajo y recibir anticipo' : accion === 'abonar' ? 'Registrar abono' : 'Pasar a venta'}</Text>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap="10px" alignItems="end">
                  {accion === 'aprobar' && <Field label="Orden de compra (opcional)"><TextIn value={oc} onChange={(e) => setOc(e.target.value)} placeholder="N° de la orden del cliente" /></Field>}
                  {accion === 'venta' && <Field label="Forma de pago"><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={PAGOS_VENTA} /></Field>}
                  {(accion !== 'venta' || pago === 'credito') && <Field label={accion === 'aprobar' ? 'Anticipo (opcional)' : accion === 'venta' ? 'Abono inicial' : 'Abono'}><NumIn min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" /></Field>}
                  {(accion !== 'venta' || pago === 'credito') && accion !== 'venta' && <Field label="Recibido en"><Sel value={pago} onChange={(e) => setPago(e.target.value)} options={PAGOS_ABONO} /></Field>}
                  {accion === 'venta' && (
                    <Flex gap="14px" align="center" h="44px"><Text fontSize="sm" fontWeight="600">F-E</Text>
                      <Switch colorScheme="green" isChecked={fe} onChange={(e) => setFe(e.target.checked)} /><Text fontSize="sm">{fe ? 'Sí' : 'No'}</Text>
                    </Flex>
                  )}
                </SimpleGrid>
                {accion === 'venta' && <Text fontSize="sm" color="secondaryGray.600" mt="8px">Se registra como venta del negocio. Si es a crédito, el saldo va a la Cartera del negocio.</Text>}
                <Flex gap="10px" mt="12px"><Button variant="brand" onClick={confirmar} isLoading={busy} isDisabled={accion === 'abonar' && toNum(monto) <= 0}>Confirmar</Button><Button variant="ghost" onClick={() => setAccion(null)}>Cancelar</Button></Flex>
              </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
      <ShareModal isOpen={share.isOpen} onClose={share.onClose} title={t.estado === 'cotizacion' ? 'Cotización' : 'Trabajo'} text={trabajoText(cfg?.negocio, { ...t, ...limpio(), fecha: t.fecha || today() })} tel={t.telefono} />
    </Modal>
  );
}
