import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Flex, IconButton, Image, Input, Select, SimpleGrid, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useColorModeValue, useToast } from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';
import Card from '../components/card/Card';
import { Field, NumIn, Sel, TextIn } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { supabase, errorMessage, isDemo } from '../lib/supabase';
import { ESCALAS, toNum } from '../lib/pricing';
import { semaforoCfg } from '../lib/semaforo';
import { cotizacionCfg } from '../lib/trabajo';
import SistemaAjustes from '../components/SistemaAjustes';

// The signature is scaled down so it stays light inside the settings.
function leerFirma(file) {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.onload = () => {
      const k = Math.min(1, 480 / img.width, 180 / img.height);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      res(cv.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('No se pudo leer la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const Cell = (props) => <Input size="sm" borderRadius="10px" {...props} />;

// Where the quote and delivery-note numbers continue from (for example after the shop's last paper quote).
function Consecutivos() {
  const toast = useToast();
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!isDemo) supabase.rpc('consecutivos').then(({ data }) => setV(data ? { cotizacion: String(data.cotizacion), remision: String(data.remision), orig: data } : null)); }, []);
  if (!v) return null;
  const guardar = async () => {
    setBusy(true);
    const c = toNum(v.cotizacion) !== v.orig.cotizacion ? toNum(v.cotizacion) : null;
    const r = toNum(v.remision) !== v.orig.remision ? toNum(v.remision) : null;
    const { error } = await supabase.rpc('fijar_consecutivos', { p_cotizacion: c, p_remision: r });
    setBusy(false);
    if (error) return toast({ title: errorMessage(error), status: 'error' });
    setV({ ...v, orig: { cotizacion: toNum(v.cotizacion), remision: toNum(v.remision) } });
    toast({ title: 'Numeración actualizada', status: 'success' });
  };
  return (
    <Box>
      <SimpleGrid columns={2} gap="12px">
        <Field label="Siguiente número de cotización"><NumIn min={1} value={v.cotizacion} onChange={(e) => setV({ ...v, cotizacion: e.target.value })} /></Field>
        <Field label="Siguiente número de remisión"><NumIn min={1} value={v.remision} onChange={(e) => setV({ ...v, remision: e.target.value })} /></Field>
      </SimpleGrid>
      <Button mt="8px" size="sm" variant="light" onClick={guardar} isLoading={busy}>Cambiar numeración</Button>
    </Box>
  );
}

export default function Ajustes() {
  const { cfg, costos, reloadCfg } = useAuth();
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [a, setA] = useState(null);
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setA(clone(cfg));
    setC({ costoClic: 0, plastificadoCosto: 0, gramajes: {}, sustratos: {}, ...clone(costos) });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (cfg) reset(); }, [cfg, costos]);
  if (!a || !c) return <Text color="secondaryGray.600">Cargando…</Text>;

  const upd = (fn) => setA((x) => { const y = clone(x); fn(y); return y; });
  const updC = (fn) => setC((x) => { const y = clone(x); fn(y); return y; });

  const guardar = async () => {
    setBusy(true);
    const pub = clone(a);
    pub.tolerancia = toNum(pub.tolerancia);
    pub.ultimoContador = toNum(pub.ultimoContador);
    pub.plastificado = { precio: toNum(pub.plastificado?.precio) };
    pub.sustratos.forEach((s) => { s.precios = s.precios.map(toNum); });
    pub.tamanos.forEach((t) => { t.clics = toNum(t.clics) || 1; t.piezas = toNum(t.piezas) || 1; });
    pub.cierreDia = toNum(pub.cierreDia ?? 6);
    const q = cotizacionCfg(pub);
    pub.cotizacion = { ...q, diasSin: toNum(q.diasSin), diasCon: toNum(q.diasCon), retenciones: q.retenciones.filter((r) => String(r.label).trim()).map((r) => ({ ...r, label: String(r.label).trim(), pct: toNum(r.pct) })) };
    pub.semaforo = Object.fromEntries(Object.entries(semaforoCfg(pub)).map(([k, v]) => [k, toNum(v)]));
    pub.conceptos = String(pub.conceptosTxt ?? (pub.conceptos || []).join(', ')).split(',').map((x) => x.trim()).filter(Boolean);
    delete pub.conceptosTxt;
    const cost = {
      costoClic: toNum(c.costoClic),
      costoClicColor: toNum(c.costoClicColor),
      costoClicBN: toNum(c.costoClicBN),
      plastificadoCosto: toNum(c.plastificadoCosto),
      gramajes: Object.fromEntries(pub.gramajes.map((g) => [g.id, toNum(c.gramajes?.[g.id])])),
      sustratos: Object.fromEntries(pub.sustratos.filter((s) => !s.corriente).map((s) => [s.id, toNum(c.sustratos?.[s.id])])),
    };
    const r1 = await supabase.from('config_publica').upsert({ id: 1, datos: pub, actualizado: new Date().toISOString() });
    const r2 = r1.error ? r1 : await supabase.from('config_costos').upsert({ id: 1, datos: cost, actualizado: new Date().toISOString() });
    setBusy(false);
    if (r2.error) return toast({ title: errorMessage(r2.error), status: 'error' });
    toast({ title: 'Ajustes guardados', status: 'success' });
    reloadCfg();
  };

  return (
    <Flex direction="column" gap="20px">
      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor} mb="14px">Negocio y recibos</Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
          <Field label="Nombre del negocio"><TextIn value={a.negocio?.nombre || ''} onChange={(e) => upd((y) => { y.negocio.nombre = e.target.value; })} /></Field>
          <Field label="Teléfono del negocio"><TextIn value={a.negocio?.telefono || ''} onChange={(e) => upd((y) => { y.negocio.telefono = e.target.value; })} /></Field>
          <Field label="Mensaje al final del recibo"><TextIn value={a.negocio?.pie || ''} onChange={(e) => upd((y) => { y.negocio.pie = e.target.value; })} /></Field>
          <Field label="Indicativo de país para WhatsApp"><TextIn value={a.negocio?.indicativo || ''} onChange={(e) => upd((y) => { y.negocio.indicativo = e.target.value; })} /></Field>
          <Field label="Dirección (sale en cotizaciones y remisiones)"><TextIn value={a.negocio?.direccion || ''} onChange={(e) => upd((y) => { y.negocio.direccion = e.target.value; })} placeholder="Calle 26 # 19 - 52" /></Field>
          <Field label="Ciudad"><TextIn value={a.negocio?.ciudad || ''} onChange={(e) => upd((y) => { y.negocio.ciudad = e.target.value; })} placeholder="Manizales" /></Field>
          <Field label="Correo"><TextIn value={a.negocio?.correo || ''} onChange={(e) => upd((y) => { y.negocio.correo = e.target.value; })} type="email" /></Field>
          <Field label="Logo (dirección de la imagen, opcional)"><TextIn value={a.negocio?.logo || ''} onChange={(e) => upd((y) => { y.negocio.logo = e.target.value; })} placeholder="https://…/logo.png" /></Field>
        </SimpleGrid>
      </Card>

      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Precios de impresión</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="12px">Precio por impresión según la cantidad. El costo del pliego de los papeles especiales solo lo ves tú y se usa para la ganancia estimada.</Text>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead><Tr><Th>Papel</Th><Th>Tamaño</Th>{ESCALAS.map((e) => <Th key={e} isNumeric>{e}</Th>)}<Th isNumeric>Costo pliego</Th><Th /></Tr></Thead>
            <Tbody>
              {a.sustratos.map((s, i) => (
                <Tr key={s.id}>
                  <Td minW="220px"><Cell value={s.nombre} onChange={(e) => upd((y) => { y.sustratos[i].nombre = e.target.value; })} /></Td>
                  <Td minW="170px"><Select size="sm" borderRadius="10px" value={s.tamano} onChange={(e) => upd((y) => { y.sustratos[i].tamano = e.target.value; })}>{a.tamanos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</Select></Td>
                  {s.precios.map((p, j) => <Td key={j}><Cell type="number" w="90px" value={p} onChange={(e) => upd((y) => { y.sustratos[i].precios[j] = e.target.value; })} /></Td>)}
                  <Td>{s.corriente ? <Text fontSize="xs" color="secondaryGray.600">según gramaje</Text> : <Cell type="number" w="90px" value={c.sustratos?.[s.id] ?? 0} onChange={(e) => updC((y) => { y.sustratos[s.id] = e.target.value; })} />}</Td>
                  <Td><IconButton size="xs" variant="ghost" aria-label="Quitar" icon={<MdClose />} onClick={() => upd((y) => { y.sustratos.splice(i, 1); })} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Flex gap="10px" mt="12px" wrap="wrap">
          <Button size="sm" variant="light" onClick={() => upd((y) => { y.sustratos.push({ id: gid(), nombre: 'Corriente nuevo', tamano: y.tamanos[0].id, corriente: true, precios: [0, 0, 0, 0] }); })}>+ Papel corriente</Button>
          <Button size="sm" variant="light" onClick={() => upd((y) => { y.sustratos.push({ id: gid(), nombre: 'Especial nuevo', tamano: y.tamanos[0].id, corriente: false, precios: [0, 0, 0, 0] }); })}>+ Papel especial</Button>
        </Flex>
      </Card>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px">
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="10px">Tamaños</Text>
          <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th>Tamaño</Th><Th isNumeric>Clics por hoja</Th><Th isNumeric>Hojas por pliego</Th></Tr></Thead><Tbody>
            {a.tamanos.map((t, i) => (
              <Tr key={t.id}>
                <Td minW="160px"><Cell value={t.nombre} onChange={(e) => upd((y) => { y.tamanos[i].nombre = e.target.value; })} /></Td>
                <Td><Cell type="number" w="70px" value={t.clics} onChange={(e) => upd((y) => { y.tamanos[i].clics = e.target.value; })} /></Td>
                <Td><Cell type="number" w="70px" value={t.piezas} onChange={(e) => upd((y) => { y.tamanos[i].piezas = e.target.value; })} /></Td>
              </Tr>
            ))}
          </Tbody></Table></Box>
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="10px">Gramajes (papel corriente)</Text>
          <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th>Papel</Th><Th isNumeric>Costo por pliego</Th></Tr></Thead><Tbody>
            {a.gramajes.map((g, i) => (
              <Tr key={g.id}>
                <Td minW="160px"><Cell value={g.nombre} onChange={(e) => upd((y) => { y.gramajes[i].nombre = e.target.value; })} /></Td>
                <Td><Cell type="number" w="100px" value={c.gramajes?.[g.id] ?? 0} onChange={(e) => updC((y) => { y.gramajes[g.id] = e.target.value; })} /></Td>
              </Tr>
            ))}
          </Tbody></Table></Box>
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="10px">Costos y cuadre</Text>
          <Flex direction="column" gap="12px">
            <Field label="Costo por clic"><NumIn value={c.costoClic} onChange={(e) => updC((y) => { y.costoClic = e.target.value; })} /></Field>
            <SimpleGrid columns={2} gap="10px">
              <Field label="Costo clic color"><NumIn value={c.costoClicColor || ''} placeholder="Igual al general" onChange={(e) => updC((y) => { y.costoClicColor = e.target.value; })} /></Field>
              <Field label="Costo clic B/N"><NumIn value={c.costoClicBN || ''} placeholder="Igual al general" onChange={(e) => updC((y) => { y.costoClicBN = e.target.value; })} /></Field>
            </SimpleGrid>
            <Field label="Precio plastificado (unidad)"><NumIn value={a.plastificado?.precio ?? 0} onChange={(e) => upd((y) => { y.plastificado = { precio: e.target.value }; })} /></Field>
            <Field label="Costo plastificado (unidad)"><NumIn value={c.plastificadoCosto} onChange={(e) => updC((y) => { y.plastificadoCosto = e.target.value; })} /></Field>
            <Field label="Diferencia aceptada en el cuadre (%)"><NumIn value={a.tolerancia ?? 5} onChange={(e) => upd((y) => { y.tolerancia = e.target.value; })} /></Field>
            <Field label="Día del cierre semanal">
              <Sel value={String(a.cierreDia ?? 6)} onChange={(e) => upd((y) => { y.cierreDia = e.target.value; })} options={[['5', 'Viernes'], ['6', 'Sábado'], ['0', 'Domingo']]} />
            </Field>
          </Flex>
        </Card>
      </SimpleGrid>

      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Semáforo y recordatorios</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="12px">Los colores de las entregas del cotizador y de la cartera atrasada. Lo que esté en amarillo o rojo aparece en el recordatorio al abrir la app.</Text>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="14px">
          <Field label="Entrega: amarillo cuando pasó este % del tiempo"><NumIn value={semaforoCfg(a).entregaAmarilloPct} onChange={(e) => upd((y) => { y.semaforo = { ...semaforoCfg(y), entregaAmarilloPct: e.target.value }; })} /></Field>
          <Field label="Entrega: rojo cuando faltan estos días o menos"><NumIn value={semaforoCfg(a).entregaRojoDias} onChange={(e) => upd((y) => { y.semaforo = { ...semaforoCfg(y), entregaRojoDias: e.target.value }; })} /></Field>
          <Field label="Cartera: amarillo desde estos días de deuda"><NumIn value={semaforoCfg(a).carteraAmarilloDias} onChange={(e) => upd((y) => { y.semaforo = { ...semaforoCfg(y), carteraAmarilloDias: e.target.value }; })} /></Field>
          <Field label="Cartera: rojo desde estos días de deuda"><NumIn value={semaforoCfg(a).carteraRojoDias} onChange={(e) => upd((y) => { y.semaforo = { ...semaforoCfg(y), carteraRojoDias: e.target.value }; })} /></Field>
        </SimpleGrid>
      </Card>

      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Formato de cotizaciones</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="12px">Lo que trae cada cotización nueva. En cada cotización se puede cambiar.</Text>
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="18px" alignItems="start">
          <Flex direction="column" gap="12px">
            <Field label="Condiciones predeterminadas">
              <Textarea variant="main" fontSize="sm" rows={7} value={cotizacionCfg(a).condiciones} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), condiciones: e.target.value }; })} />
            </Field>
            <SimpleGrid columns={2} gap="12px">
              <Field label="Días hábiles de entrega sin instalación"><NumIn min={0} value={cotizacionCfg(a).diasSin} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), diasSin: e.target.value }; })} /></Field>
              <Field label="Días hábiles de entrega con instalación"><NumIn min={0} value={cotizacionCfg(a).diasCon} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), diasCon: e.target.value }; })} /></Field>
            </SimpleGrid>
            <Text fontWeight="700" fontSize="sm" mt="4px">Retenciones para cotizaciones privadas (% sobre el total)</Text>
            {cotizacionCfg(a).retenciones.map((r, i) => (
              <Flex key={r.id || i} gap="8px" align="center">
                <TextIn value={r.label} onChange={(e) => upd((y) => { const q = cotizacionCfg(y); q.retenciones = q.retenciones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)); y.cotizacion = q; })} />
                <Box w="110px" flex="none"><NumIn value={r.pct} onChange={(e) => upd((y) => { const q = cotizacionCfg(y); q.retenciones = q.retenciones.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)); y.cotizacion = q; })} /></Box>
                <Text fontSize="sm">%</Text>
                <IconButton size="sm" variant="ghost" aria-label="Quitar retención" icon={<MdClose />} onClick={() => upd((y) => { const q = cotizacionCfg(y); q.retenciones = q.retenciones.filter((_, j) => j !== i); y.cotizacion = q; })} />
              </Flex>
            ))}
            <Button size="sm" variant="light" alignSelf="flex-start" onClick={() => upd((y) => { const q = cotizacionCfg(y); q.retenciones = [...q.retenciones, { id: 'r' + Date.now(), label: 'Nueva retención', pct: 1 }]; y.cotizacion = q; })}>+ Agregar retención</Button>
          </Flex>
          <Flex direction="column" gap="12px">
            <Text fontWeight="700" fontSize="sm">Firma del administrador</Text>
            <Box border="1px dashed" borderColor="secondaryGray.500" borderRadius="16px" p="14px" minH="120px" display="flex" alignItems="center" justifyContent="center" bg="white" _dark={{ bg: 'whiteAlpha.100' }}>
              {cotizacionCfg(a).firma ? <Image src={cotizacionCfg(a).firma} alt="Firma" maxH="110px" /> : <Text fontSize="sm" color="secondaryGray.600">Sin firma cargada</Text>}
            </Box>
            <Flex gap="8px" wrap="wrap">
              <Button as="label" size="sm" variant="lightBrand" cursor="pointer">
                {cotizacionCfg(a).firma ? 'Cambiar firma' : 'Cargar firma'}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const url = await leerFirma(f); upd((y) => { y.cotizacion = { ...cotizacionCfg(y), firma: url }; }); } catch (err) { toast({ title: err.message, status: 'error' }); } }} />
              </Button>
              {cotizacionCfg(a).firma && <Button size="sm" variant="ghost" onClick={() => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), firma: '' }; })}>Quitar firma</Button>}
            </Flex>
            <Text fontSize="xs" color="secondaryGray.600">Una foto o escaneo de la firma, mejor con fondo blanco. Solo el administrador la puede cambiar.</Text>
            <SimpleGrid columns={2} gap="12px">
              <Field label="Nombre de quien firma"><TextIn value={cotizacionCfg(a).firmaNombre} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), firmaNombre: e.target.value }; })} /></Field>
              <Field label="Cargo"><TextIn value={cotizacionCfg(a).firmaCargo} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), firmaCargo: e.target.value }; })} placeholder="Ej. Gerente" /></Field>
            </SimpleGrid>
            <Field label="Número de las cotizaciones">
              <Sel value={cotizacionCfg(a).formatoNumero || 'cot'} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), formatoNumero: e.target.value }; })}
                options={[['cot', 'COT-0012'], ['anio', 'Año + consecutivo (ej. 2026012)']]} />
            </Field>
            <Consecutivos />
            <Checkbox colorScheme="green" isChecked={cotizacionCfg(a).mostrarFirma !== false} onChange={(e) => upd((y) => { y.cotizacion = { ...cotizacionCfg(y), mostrarFirma: e.target.checked }; })}>Poner la firma en las cotizaciones impresas</Checkbox>
          </Flex>
        </SimpleGrid>
      </Card>

      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Cotizador personalizado</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="10px">Conceptos que aparecen como sugerencia al armar una cotización, separados por coma. Igual se puede escribir cualquier otro.</Text>
        <TextIn value={a.conceptosTxt ?? (a.conceptos || []).join(', ')} onChange={(e) => upd((y) => { y.conceptosTxt = e.target.value; })} placeholder="Ej. Acrílico, Servicio de corte, Instalación" />
      </Card>

      <Card>
        <Text fontSize="lg" fontWeight="700" color={textColor}>Acceso y ayuda</Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="10px">Se aplican al presionar «Guardar ajustes».</Text>
        <Flex direction="column" gap="10px">
          {!isDemo && (
            <Checkbox colorScheme="green" isChecked={!!a.registroCerrado} onChange={(e) => upd((y) => { y.registroCerrado = e.target.checked; })}>
              Cerrar el registro: ocultar «Crear cuenta» en la pantalla de inicio (nadie más puede registrarse)
            </Checkbox>
          )}
          <Checkbox colorScheme="green" isChecked={a.tourActivo !== false} onChange={(e) => upd((y) => { y.tourActivo = e.target.checked; })}>
            Tour guiado activo: se muestra la primera vez que cada usuario entra y con el botón de ayuda
          </Checkbox>
          <Text fontSize="sm" color="secondaryGray.600">La guía de uso está siempre en <b>{window.location.origin}/guia</b>.</Text>
        </Flex>
      </Card>

      <Card>
        <Flex gap="10px" wrap="wrap">
          <Button variant="brand" onClick={guardar} isLoading={busy}>Guardar ajustes</Button>
          <Button variant="light" onClick={reset}>Descartar cambios</Button>
        </Flex>
      </Card>

      <SistemaAjustes />
    </Flex>
  );
}
