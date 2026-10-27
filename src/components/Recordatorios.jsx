import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Divider, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { supabase } from '../lib/supabase';
import { fdate, money, today } from '../lib/format';
import { toNum } from '../lib/pricing';
import { ORDEN, semaforoCartera, semaforoEntrega } from '../lib/semaforo';
import { numeroT } from '../lib/trabajo';
import AperturaCaja from './AperturaCaja';
import Semaforo from './Semaforo';

// The navbar bell fires this event to open the reminders again.
export const abrirRecordatorios = () => window.dispatchEvent(new Event('abrir-recordatorios'));

function Grupo({ titulo, children, n }) {
  return (
    <Box>
      <Flex align="center" gap="8px" mb="8px"><Text fontWeight="700">{titulo}</Text>{n != null && <Badge colorScheme="gray">{n}</Badge>}</Flex>
      <Flex direction="column" gap="6px">{children}</Flex>
    </Box>
  );
}

function Fila({ izq, sub, der, onClick }) {
  return (
    <Flex align="center" gap="10px" p="8px 10px" borderRadius="12px" bg="secondaryGray.300" _dark={{ bg: 'whiteAlpha.100' }} cursor={onClick ? 'pointer' : undefined} onClick={onClick}>
      <Box flex="1" minW={0}><Text fontSize="sm" fontWeight="600" noOfLines={1}>{izq}</Text>{sub && <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>{sub}</Text>}</Box>
      {der}
    </Flex>
  );
}

// Shown when the app opens: today's cash opening, days left without a closing,
// deliveries that are close and debts that are getting old, each with its traffic light.
export default function Recordatorios() {
  const { isAdmin, cfg, perfil } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const hoy = today();
  const aperturas = useLive(() => supabase.from('aperturas').select('*').order('fecha', { ascending: false }).limit(30), ['aperturas']);
  const cierres = useLive(() => supabase.from('cierres').select('desde, tipo').eq('tipo', 'diario'), ['cierres']);
  const trabajos = useLive(() => supabase.from('trabajos').select('*'), ['trabajos']);
  const deudas = useLive(() => supabase.from('ventas').select('id, fecha, cliente, cliente_id, telefono, saldo').gt('saldo', 0).order('fecha'), ['ventas']);

  const listo = [aperturas, cierres, trabajos, deudas].every((q) => q.data);
  const r = useMemo(() => {
    if (!listo) return null;
    const aperturaHoy = aperturas.data.find((a) => a.fecha === hoy);
    const cerrados = new Set(cierres.data.map((c) => c.desde));
    const sinCierre = aperturas.data.filter((a) => a.fecha < hoy && !cerrados.has(a.fecha));
    const entregas = trabajos.data.map((t) => ({ t, s: semaforoEntrega(t, cfg) })).filter((x) => x.s && x.s.color !== 'green')
      .sort((a, b) => ORDEN[a.s.color] - ORDEN[b.s.color] || a.s.dias - b.s.dias);
    const g = {};
    for (const v of deudas.data) {
      const k = v.cliente_id || v.cliente || 'sin';
      (g[k] ||= { cliente: v.cliente || 'Sin nombre', tel: v.telefono, saldo: 0, desde: v.fecha, n: 0 });
      g[k].saldo += toNum(v.saldo); g[k].n += 1;
    }
    const cartera = Object.values(g).map((x) => ({ ...x, s: semaforoCartera(x.desde, cfg) })).filter((x) => x.s.color !== 'green')
      .sort((a, b) => ORDEN[a.s.color] - ORDEN[b.s.color] || b.saldo - a.saldo);
    const privada = isAdmin ? trabajos.data.filter((t) => t.privado && toNum(t.saldo) > 0 && !['cotizacion', 'anulado'].includes(t.estado))
      .map((t) => ({ t, s: semaforoCartera(t.fecha, cfg) })).filter((x) => x.s.color !== 'green')
      .sort((a, b) => ORDEN[a.s.color] - ORDEN[b.s.color] || toNum(b.t.saldo) - toNum(a.t.saldo)) : [];
    const total = (aperturaHoy ? 0 : 1) + sinCierre.length + entregas.length + cartera.length + privada.length;
    return { aperturaHoy, sinCierre, entregas, cartera, privada, total };
  }, [listo, aperturas.data, cierres.data, trabajos.data, deudas.data, cfg, isAdmin, hoy]);

  // Opens by itself once per session and user, when there is something to show.
  useEffect(() => {
    if (!r || !perfil?.id) return;
    const key = `recordatorios-${perfil.id}-${hoy}`;
    let visto = false;
    try { visto = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch { /* private window */ }
    if (!visto && r.total) setOpen(true);
  }, [!!r, perfil?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('abrir-recordatorios', h);
    return () => window.removeEventListener('abrir-recordatorios', h);
  }, []);

  const ir = (to) => { setOpen(false); navigate(to); };

  return (
    <Modal isOpen={open && !!r} onClose={() => setOpen(false)} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>Recordatorios de hoy</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {r && (
            <Flex direction="column" gap="18px">
              {!r.total && <Text color="secondaryGray.600">Todo al día: caja abierta, sin entregas críticas ni cartera atrasada.</Text>}
              {!r.aperturaHoy ? (
                <Grupo titulo={`Abrir la caja de hoy (${fdate(hoy)})`}>
                  <AperturaCaja fecha={hoy} compact />
                </Grupo>
              ) : (
                <Text fontSize="sm">Caja abierta hoy con <b>{money(toNum(r.aperturaHoy.base_impresion) + toNum(r.aperturaHoy.base_insumos))}</b> (láser {money(r.aperturaHoy.base_impresion)} · insumos {money(r.aperturaHoy.base_insumos)}).</Text>
              )}
              {!!r.sinCierre.length && (
                <Grupo titulo="Días sin cierre de caja" n={r.sinCierre.length}>
                  {r.sinCierre.map((a) => (
                    <Fila key={a.id} izq={fdate(a.fecha)} sub="La caja se abrió pero no se cerró"
                      der={<Button size="xs" variant="brand" onClick={() => ir(`/cierre?dia=${a.fecha}`)}>Hacer cierre</Button>} />
                  ))}
                </Grupo>
              )}
              {!!r.entregas.length && (
                <Grupo titulo="Entregas del cotizador" n={r.entregas.length}>
                  {r.entregas.map(({ t, s }) => (
                    <Fila key={t.id} izq={`${numeroT(t)} · ${t.titulo || 'Trabajo'}`} sub={`${t.cliente || 'Sin cliente'} · entrega ${fdate(t.entrega)}`}
                      der={<Semaforo s={s} small />} onClick={() => ir('/cotizador')} />
                  ))}
                </Grupo>
              )}
              {!!r.cartera.length && (
                <Grupo titulo="Cartera atrasada" n={r.cartera.length}>
                  {r.cartera.map((c) => (
                    <Fila key={c.cliente + c.desde} izq={`${c.cliente} · ${money(c.saldo)}`} sub={`${c.n} venta${c.n === 1 ? '' : 's'} a crédito desde ${fdate(c.desde)}${c.tel ? ' · ' + c.tel : ''}`}
                      der={<Semaforo s={c.s} small />} onClick={() => ir('/cartera')} />
                  ))}
                </Grupo>
              )}
              {!!r.privada.length && (
                <Grupo titulo="Cartera privada atrasada" n={r.privada.length}>
                  {r.privada.map(({ t, s }) => (
                    <Fila key={t.id} izq={`${t.cliente || 'Sin cliente'} · ${money(t.saldo)}`} sub={`${numeroT(t)} · ${t.titulo || ''}`}
                      der={<Semaforo s={s} small />} onClick={() => ir('/cartera-privada')} />
                  ))}
                </Grupo>
              )}
              <Divider />
              <Text fontSize="xs" color="secondaryGray.600">
                Verde: hay tiempo. Amarillo: ya pasó buena parte del plazo. Rojo: entrega cercana o vencida, o deuda muy atrasada.{isAdmin ? ' Los días se ajustan en Ajustes.' : ''}
              </Text>
            </Flex>
          )}
        </ModalBody>
        <ModalFooter><Button variant="lightBrand" onClick={() => setOpen(false)}>Entendido</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}
