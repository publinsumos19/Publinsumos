import { useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Checkbox, Divider, Flex, Grid, IconButton, SimpleGrid, Text, useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';
import Card from '../components/card/Card';
import Segmented from '../components/Segmented';
import ShareModal from '../components/ShareModal';
import { Field, NumIn, Sel, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useLive, notifyChange } from '../hooks/useLive';
import { supabase, errorMessage } from '../lib/supabase';
import { calcImpresion, cartTotal, ESCALAS, itemImpresion, toNum } from '../lib/pricing';
import { cantf, fdate, intf, money, PAGOS_ABONO, PAGOS_VENTA, today } from '../lib/format';
import { receiptText } from '../lib/receipt';
import { margenDe, precioConMargen } from '../lib/margen';
import { abrirRecordatorios } from '../components/Recordatorios';
import BuscadorProducto from '../components/BuscadorProducto';

const emptyServ = { id: '', desc: '', cant: 1, pu: '', costo: '' };

export default function Vender() {
  const { cfg, costos, isAdmin } = useAuth();
  const toast = useToast();
  const share = useDisclosure();
  const [shareData, setShareData] = useState(null);
  const productos = useLive(() => supabase.from('productos').select('*').order('nombre'), ['productos']);
  const clientes = useLive(() => supabase.from('clientes').select('nombre, telefono').order('nombre'), ['clientes']);
  const pCostos = useLive(
    () => (isAdmin ? supabase.from('producto_costos').select('*') : Promise.resolve({ data: [] })),
    ['productos'], [isAdmin],
  );
  const costoDe = useMemo(() => Object.fromEntries((pCostos.data || []).map((c) => [c.producto_id, c.costo])), [pCostos.data]);

  const [modo, setModo] = useState('venta');
  const [cliente, setCliente] = useState('');
  const [verFalta, setVerFalta] = useState(false);
  const apertura = useLive(() => supabase.from('aperturas').select('id').eq('fecha', today()), ['aperturas']);
  const [tel, setTel] = useState('');
  const [tipo, setTipo] = useState('imp');
  const [imp, setImp] = useState(() => ({ sus: cfg?.sustratos?.[0]?.id || '', gram: cfg?.gramajes?.[2]?.id || cfg?.gramajes?.[0]?.id || '', color: true, cant: 1, plast: 0 }));
  const [prod, setProd] = useState({ id: '', cant: 1, pu: '' });
  const [serv, setServ] = useState(emptyServ);
  const [cart, setCart] = useState([]);
  const [pago, setPago] = useState('efectivo');
  const [abono, setAbono] = useState('');
  const [pagoAbono, setPagoAbono] = useState('efectivo');
  const [nota, setNota] = useState('');
  const [fe, setFe] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfg && !cfg.sustratos.some((x) => x.id === imp.sus)) {
      setImp((f) => ({ ...f, sus: cfg.sustratos[0]?.id || '', gram: f.gram || cfg.gramajes?.[0]?.id || '' }));
    }
  }, [cfg, imp.sus]);

  const panel = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  if (!cfg) return <Alert status="warning" borderRadius="16px"><AlertIcon />La lista de precios no está cargada. El administrador debe ejecutar el archivo de configuración de la base de datos.</Alert>;

  const propios = (productos.data || []).filter((p) => p.tipo === 'propio');
  const tercerizados = (productos.data || []).filter((p) => p.tipo === 'tercerizado');
  const prodSel = propios.find((p) => p.id === prod.id) || null;
  const total = cartTotal(cart);
  const r = calcImpresion(cfg, imp, costos);
  const sus = cfg.sustratos.find((s) => s.id === imp.sus);

  const add = (it) => {
    setCart((c) => [...c, it]);
    toast({ title: 'Agregado al ticket', status: 'success', duration: 1200, position: 'bottom' });
  };
  const addImp = () => {
    const it = itemImpresion(cfg, imp);
    if (!it) return;
    add({ ...it, costoPrev: r.costo });
    setImp((f) => ({ ...f, cant: 1, plast: 0 }));
  };
  const addProd = () => {
    const cant = toNum(prod.cant);
    if (!prodSel || cant <= 0) return;
    add({ tipo: 'prod', productoId: prodSel.id, desc: prodSel.nombre, cant, pu: toNum(prod.pu), total: cant * toNum(prod.pu), costoPrev: cant * toNum(costoDe[prodSel.id]) });
    setProd((f) => ({ ...f, cant: 1 }));
  };
  const addServ = () => {
    const cant = toNum(serv.cant);
    const p = tercerizados.find((x) => x.id === serv.id);
    if (cant <= 0 || (!p && !serv.desc.trim())) return;
    const it = { tipo: 'serv', productoId: p?.id || null, desc: p ? p.nombre : serv.desc.trim(), proveedor: p?.proveedor || '', cant, pu: toNum(serv.pu), total: cant * toNum(serv.pu) };
    if (!p && isAdmin && serv.costo !== '') it.costoManual = toNum(serv.costo);
    it.costoPrev = p ? cant * toNum(costoDe[p.id]) : cant * toNum(serv.costo);
    add(it);
    setServ(emptyServ);
  };

  const pickCliente = (v) => {
    setCliente(v);
    const c = (clientes.data || []).find((x) => x.nombre === v);
    if (c?.telefono && !tel) setTel(c.telefono);
  };

  // The seller must always say who the sale is for: name and phone.
  const telDigits = String(tel || '').replace(/\D/g, '').length;
  const faltaNombre = !isAdmin && !cliente.trim();
  const faltaTel = !isAdmin && telDigits < 7;
  const faltaCliente = modo === 'venta' && (faltaNombre || faltaTel);

  const registrar = async () => {
    if (faltaCliente) { setVerFalta(true); return toast({ title: 'Escribe el nombre y el teléfono del cliente', status: 'warning' }); }
    setSaving(true);
    const items = cart.map(({ costoPrev, ...it }) => it);
    const { data, error } = await supabase.rpc('registrar_venta', {
      p: { fecha: today(), cliente, telefono: tel, items, pago, abono: pago === 'credito' ? toNum(abono) : null, pagoAbono, nota, fe },
    });
    setSaving(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    notifyChange('ventas', 'productos', 'clientes', 'abonos');
    setShareData({ title: `Venta registrada · ${data.numero ? 'N° ' + String(data.numero).padStart(5, '0') : ''}`, text: receiptText(cfg.negocio, data, 'sale'), tel: data.telefono });
    share.onOpen();
    setCart([]); setCliente(''); setTel(''); setAbono(''); setNota(''); setPago('efectivo'); setFe(false); setVerFalta(false);
  };
  const cotizar = () => {
    setShareData({
      title: 'Cotización',
      text: receiptText(cfg.negocio, { cliente, items: cart, total, nota }, 'quote'),
      tel,
      extra: <Button variant="lightBrand" onClick={() => { setModo('venta'); share.onClose(); }}>Convertir en venta</Button>,
    });
    share.onOpen();
  };

  const enCarro = (id) => cart.filter((i) => i.productoId === id).reduce((a, i) => a + i.cant, 0);
  const sinStock = prodSel && toNum(prodSel.stock) - enCarro(prodSel.id) - toNum(prod.cant) < 0;

  return (
    <Grid templateColumns={{ base: '1fr', lg: '1.4fr 1fr' }} gap="20px" alignItems="start">
      <Flex direction="column" gap="20px" minW={0}>
        {apertura.data && !apertura.data.length && (
          <Alert status="warning" borderRadius="16px" gap="10px" flexWrap="wrap">
            <AlertIcon />
            <Text flex="1" minW="200px" fontSize="sm">La caja de hoy no se ha abierto. Escribe las bases de la caja de impresión láser y de insumos.</Text>
            <Button size="sm" variant="brand" onClick={abrirRecordatorios}>Abrir caja</Button>
          </Alert>
        )}
        <Card>
          <Flex align="center" mb="16px" gap="10px" wrap="wrap">
            <Text fontSize="22px" fontWeight="700" color={textColor}>{modo === 'venta' ? 'Nueva venta' : 'Nueva cotización'}</Text>
            <Box ms="auto"><Segmented value={modo} onChange={setModo} options={[['venta', 'Venta'], ['cotizacion', 'Cotización']]} /></Box>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
            <Field label={isAdmin ? 'Cliente' : 'Cliente (obligatorio)'}>
              <TextIn list="dl-clientes" isInvalid={verFalta && faltaNombre} value={cliente} onChange={(e) => pickCliente(e.target.value)} placeholder="Nombre del cliente" autoComplete="off" />
              <datalist id="dl-clientes">{(clientes.data || []).map((c) => <option key={c.nombre} value={c.nombre} />)}</datalist>
            </Field>
            <Field label={isAdmin ? 'WhatsApp (opcional)' : 'Teléfono / WhatsApp (obligatorio)'}>
              <TextIn isInvalid={verFalta && faltaTel} value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="300 123 4567" />
            </Field>
          </SimpleGrid>
          {verFalta && faltaCliente && <Text fontSize="sm" color="red.500" mt="8px">Para registrar la venta escribe {faltaNombre && faltaTel ? 'el nombre y el teléfono' : faltaNombre ? 'el nombre' : 'un teléfono válido'} del cliente.</Text>}
        </Card>

        <Card>
          <Flex align="center" mb="16px" gap="10px" wrap="wrap">
            <Text fontSize="lg" fontWeight="700" color={textColor}>Agregar</Text>
            <Box ms="auto"><Segmented value={tipo} onChange={setTipo} options={[['imp', 'Impresión'], ['prod', 'Producto'], ['serv', 'Servicio / tercerizado']]} /></Box>
          </Flex>

          {tipo === 'imp' && (
            <Flex direction="column" gap="14px">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
                <Field label="Papel y tamaño"><Sel value={imp.sus} onChange={(e) => setImp({ ...imp, sus: e.target.value })} options={cfg.sustratos.map((s) => [s.id, s.nombre])} /></Field>
                {sus?.corriente ? (
                  <Field label="Gramaje"><Sel value={imp.gram} onChange={(e) => setImp({ ...imp, gram: e.target.value })} options={cfg.gramajes.map((g) => [g.id, g.nombre])} /></Field>
                ) : <Box />}
                <Field label="Cantidad de impresiones"><NumIn min={1} value={imp.cant} onChange={(e) => setImp({ ...imp, cant: e.target.value })} /></Field>
                <Field label="Unidades a plastificar"><NumIn min={0} value={imp.plast} onChange={(e) => setImp({ ...imp, plast: e.target.value })} /></Field>
              </SimpleGrid>
              <Flex align="center" gap="10px">
                <Text fontSize="sm" color="secondaryGray.600">Impresión</Text>
                <Segmented value={imp.color ? '1' : '0'} onChange={(v) => setImp({ ...imp, color: v === '1' })} options={[['1', 'Color'], ['0', 'Blanco y negro']]} />
              </Flex>
              <Box bg={panel} borderRadius="16px" p="16px">
                {r && r.cant ? (
                  <Flex direction="column" gap="6px">
                    <Flex justify="space-between" fontSize="sm"><Text>Escala {ESCALAS[r.escala]} · {money(r.pu)} c/u</Text><Text fontWeight="700">{money(r.sub)}</Text></Flex>
                    {r.plast > 0 && <Flex justify="space-between" fontSize="sm"><Text>Plastificado {r.plast} × {money(cfg.plastificado?.precio)}</Text><Text fontWeight="700">{money(r.extra)}</Text></Flex>}
                    <Text fontSize="xs" color="secondaryGray.600">{r.tamano.nombre} · {r.tamano.clics} clic{r.tamano.clics > 1 ? 's' : ''} por hoja · {intf(r.clics)} clics en total{isAdmin && r.costo != null ? ` · costo aprox. ${money(r.costo)}` : ''}</Text>
                    <Flex justify="space-between" align="center" mt="6px">
                      <Text fontSize="28px" fontWeight="700" color={textColor}>{money(r.total)}</Text>
                      <Button variant="brand" onClick={addImp}>Agregar</Button>
                    </Flex>
                    {r.next && r.next.faltan > 0 && r.next.faltan <= 15 && (
                      <Text fontSize="sm" color="brand.500" fontWeight="600">Con {r.next.faltan} más pasa a la escala {r.next.escala} y cada una queda a {money(r.next.pu)}.</Text>
                    )}
                  </Flex>
                ) : <Text fontSize="sm" color="secondaryGray.600">Escribe la cantidad para ver el precio.</Text>}
              </Box>
            </Flex>
          )}

          {tipo === 'prod' && (propios.length ? (
            <Flex direction="column" gap="14px">
              <Grid templateColumns={{ base: '1fr', md: '2fr 1fr 1fr' }} gap="14px">
                <Field label="Producto">
                  <BuscadorProducto productos={propios} value={prod.id} label={prodSel ? `${prodSel.nombre} (${cantf(prodSel.stock)} ${prodSel.unidad})` : ''}
                    onSelect={(p) => setProd({ ...prod, id: p.id, pu: p.precio ?? '' })} />
                </Field>
                <Field label="Cantidad"><NumIn min={1} value={prod.cant} onChange={(e) => setProd({ ...prod, cant: e.target.value })} /></Field>
                <Field label="Precio unitario"><NumIn min={0} value={prod.pu} onChange={(e) => setProd({ ...prod, pu: e.target.value })} /></Field>
              </Grid>
              {sinStock && <Text fontSize="sm" color="orange.500" fontWeight="600">Solo hay {intf(prodSel.stock)} {prodSel.unidad} en inventario. Puedes venderlo igual, pero revisa el stock.</Text>}
              <Flex justify="space-between" align="center" bg={panel} borderRadius="16px" p="16px">
                <Text fontSize="28px" fontWeight="700" color={textColor}>{money(toNum(prod.cant) * toNum(prod.pu))}</Text>
                <Button variant="brand" onClick={addProd} isDisabled={!prodSel || toNum(prod.cant) <= 0}>Agregar</Button>
              </Flex>
            </Flex>
          ) : <Text color="secondaryGray.600" fontSize="sm" py="12px">Todavía no hay productos en el inventario.{isAdmin ? ' Agrégalos en Inventario.' : ''}</Text>)}

          {tipo === 'serv' && (
            <Flex direction="column" gap="14px">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
                <Field label="Servicio">
                  <Sel value={serv.id} onChange={(e) => { const p = tercerizados.find((x) => x.id === e.target.value); setServ({ ...serv, id: e.target.value, pu: p?.precio ?? '', costo: '' }); }}
                    options={[['', 'Otro (escribir)'], ...tercerizados.map((p) => [p.id, p.nombre])]} />
                </Field>
                {!serv.id ? <Field label="Descripción"><TextIn value={serv.desc} onChange={(e) => setServ({ ...serv, desc: e.target.value })} placeholder="Ej. Diseño de logo" /></Field> : <Box />}
                <Field label="Cantidad"><NumIn min={1} value={serv.cant} onChange={(e) => setServ({ ...serv, cant: e.target.value })} /></Field>
                {isAdmin && !serv.id && <Field label="Costo unitario (proveedor)"><NumIn min={0} value={serv.costo} onChange={(e) => setServ({ ...serv, costo: e.target.value, ...(serv.pct ? { pu: precioConMargen(e.target.value, serv.pct) } : {}) })} /></Field>}
                {isAdmin && !serv.id && <Field label="% de margen"><NumIn min={0} value={serv.pct ?? ''} placeholder="Ej. 40" onChange={(e) => setServ({ ...serv, pct: e.target.value, pu: precioConMargen(serv.costo, e.target.value) || serv.pu })} /></Field>}
                <Field label="Precio unitario"><NumIn min={0} value={serv.pu} onChange={(e) => setServ({ ...serv, pu: e.target.value, pct: isAdmin && !serv.id ? margenDe(serv.costo, e.target.value) : serv.pct })} /></Field>
              </SimpleGrid>
              <Flex justify="space-between" align="center" bg={panel} borderRadius="16px" p="16px">
                <Text fontSize="28px" fontWeight="700" color={textColor}>{money(toNum(serv.cant) * toNum(serv.pu))}</Text>
                <Button variant="brand" onClick={addServ} isDisabled={toNum(serv.cant) <= 0 || (!serv.id && !serv.desc.trim())}>Agregar</Button>
              </Flex>
            </Flex>
          )}
        </Card>
      </Flex>

      <Card position={{ lg: 'sticky' }} top={{ lg: '130px' }}>
        <Flex justify="space-between" align="baseline" mb="6px">
          <Text fontSize="22px" fontWeight="700" color={textColor}>{modo === 'venta' ? 'Ticket' : 'Cotización'}</Text>
          <Text fontSize="sm" color="secondaryGray.600">{fdate(today())}</Text>
        </Flex>
        {cliente && <Text fontSize="sm" color="secondaryGray.600" mb="6px">Cliente: <b>{cliente}</b></Text>}
        <Divider my="8px" />
        {cart.length ? cart.map((it, i) => (
          <Flex key={i} gap="10px" py="10px" borderBottom="1px dashed" borderColor="gray.200" align="start">
            <Box flex="1" minW={0}>
              <Text fontWeight="600" fontSize="sm" color={textColor}>{it.desc}</Text>
              <Text fontSize="xs" color="secondaryGray.600">{intf(it.cant)} × {money(it.pu)}{it.extra ? ` + plastificado ${money(it.extra)}` : ''}</Text>
            </Box>
            <Text fontWeight="700" fontSize="sm" sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(it.total)}</Text>
            <IconButton size="xs" variant="ghost" aria-label="Quitar" icon={<MdClose />} onClick={() => setCart(cart.filter((_, j) => j !== i))} />
          </Flex>
        )) : <Text color="secondaryGray.600" fontSize="sm" textAlign="center" py="20px">Agrega impresiones, productos o servicios.</Text>}
        <Flex justify="space-between" align="baseline" mt="14px" pt="12px" borderTop="2px solid" borderColor={textColor}>
          <Text fontWeight="600">Total</Text>
          <Text fontSize="32px" fontWeight="700" color={textColor} sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</Text>
        </Flex>
        {isAdmin && cart.length > 0 && <Text fontSize="xs" color="secondaryGray.600" textAlign="right">Ganancia aprox. {money(total - cart.reduce((a, i) => a + (i.costoPrev || 0), 0))}</Text>}
        {modo === 'venta' ? (
          <Flex direction="column" gap="12px" mt="14px">
            <Segmented value={pago} onChange={setPago} options={PAGOS_VENTA} />
            {pago === 'credito' && (
              <SimpleGrid columns={2} gap="10px">
                <Field label="Abono inicial"><NumIn min={0} value={abono} onChange={(e) => setAbono(e.target.value)} placeholder="0" /></Field>
                <Field label="Abono en"><Sel value={pagoAbono} onChange={(e) => setPagoAbono(e.target.value)} options={PAGOS_ABONO} /></Field>
                <Text gridColumn="span 2" fontSize="sm">Queda debiendo <b>{money(total - Math.min(toNum(abono), total))}</b></Text>
              </SimpleGrid>
            )}
            <Field label="Nota (opcional)"><TextIn value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. entrega el viernes" /></Field>
            <Flex align="center" gap="16px" wrap="wrap">
              <Text fontSize="sm" fontWeight="700" color={textColor}>F-E</Text>
              <Checkbox colorScheme="green" isChecked={fe} onChange={() => setFe(true)}>Sí</Checkbox>
              <Checkbox colorScheme="green" isChecked={!fe} onChange={() => setFe(false)}>No</Checkbox>
            </Flex>
            <Button variant="brand" size="lg" h="54px" onClick={registrar} isDisabled={!cart.length} isLoading={saving}>Registrar venta</Button>
          </Flex>
        ) : (
          <Button mt="14px" variant="brand" size="lg" h="54px" onClick={cotizar} isDisabled={!cart.length}>Ver cotización para enviar</Button>
        )}
        {cart.length > 0 && <Button mt="8px" variant="ghost" size="sm" onClick={() => setCart([])}>Vaciar ticket</Button>}
      </Card>
      {shareData && <ShareModal isOpen={share.isOpen} onClose={share.onClose} {...shareData} />}
    </Grid>
  );
}
