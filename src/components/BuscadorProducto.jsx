import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Flex, Input, InputGroup, InputLeftElement, Popover, PopoverBody, PopoverContent, PopoverTrigger, Portal, Select, Text,
  useColorModeValue, useDisclosure,
} from '@chakra-ui/react';
import { MdAdd, MdArrowDropDown, MdSearch } from 'react-icons/md';
import { cantf, money } from '../lib/format';

const MAX = 60;
export const sinTilde = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Every word must appear, ignoring accents. A number like "3" must match the whole
// number, so it does not match the 3 inside 130x190.
export function coincide(texto, busca) {
  const t = sinTilde(texto);
  return sinTilde(busca).split(/\s+/).filter(Boolean).every((w) => (/^[\d.,]+$/.test(w)
    ? new RegExp(`(^|[^\\d.,])${w.replace(/[.,]/g, '[.,]')}($|[^\\d.,])`).test(t)
    : t.includes(w)));
}

// A dropdown with its own search box. With onCrear it also offers to use what was
// typed as a new item (the quote uses it for concepts that are not in the store).
export default function BuscadorProducto({
  productos = [], value, label, onSelect, onCrear, extras = [], placeholder = 'Elige un producto', isDisabled, bg, mostrarPrecio = true,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [activo, setActivo] = useState(0);
  const input = useRef(null);
  const lista = useRef(null);
  const hover = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const color = useColorModeValue('secondaryGray.900', 'white');
  const borde = useColorModeValue('secondaryGray.100', 'whiteAlpha.100');
  const fondo = useColorModeValue('white', 'navy.800');

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(), [productos]);
  const filtrados = useMemo(() => productos.filter((p) => (!cat || p.categoria === cat) && coincide(`${p.nombre} ${p.categoria || ''} ${p.unidad || ''}`, q)), [productos, q, cat]);
  const extrasVer = useMemo(() => (cat ? [] : extras.filter((e) => coincide(e, q)).slice(0, 8)), [extras, q, cat]);
  const exacto = q.trim() && (productos.some((p) => sinTilde(p.nombre) === sinTilde(q.trim())) || extras.some((e) => sinTilde(e) === sinTilde(q.trim())));
  const opciones = [
    ...filtrados.slice(0, MAX).map((p) => ({ k: 'p' + p.id, p })),
    ...extrasVer.map((e) => ({ k: 'e' + e, e })),
    ...(onCrear && q.trim() && !exacto ? [{ k: 'nuevo', nuevo: q.trim() }] : []),
  ];

  useEffect(() => { setActivo(0); }, [q, cat]);
  useEffect(() => { lista.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' }); }, [activo]);

  const elegir = (o) => {
    if (!o) return;
    if (o.p) onSelect?.(o.p);
    else onCrear?.(o.e ?? o.nuevo);
    setQ(''); onClose();
  };
  const tecla = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(opciones[activo]); }
  };

  return (
    <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} initialFocusRef={input} placement="bottom-start" matchWidth isLazy>
      <PopoverTrigger>
        <Button variant="unstyled" h="auto" minH="44px" py="6px" w="100%" px="16px" display="flex" justifyContent="space-between" alignItems="center" fontWeight="400" fontSize="sm"
          border="1px solid" borderColor={borde} borderRadius="16px" bg={bg || 'transparent'} _dark={{ bg: bg ? 'navy.800' : 'transparent' }} isDisabled={isDisabled} textAlign="left">
          <Text as="span" noOfLines={2} whiteSpace="normal" lineHeight="1.3" fontSize={label && label.length > 34 ? 'xs' : 'sm'} color={label ? color : 'secondaryGray.600'}>{label || placeholder}</Text>
          <Box as={MdArrowDropDown} flexShrink={0} boxSize="22px" color="secondaryGray.600" />
        </Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent w={{ base: 'calc(100vw - 32px)', md: 'max(100%, 440px)' }} maxW="560px" borderRadius="16px" bg={fondo} boxShadow="lg" _focus={{ boxShadow: 'lg' }}>
          <PopoverBody p="10px">
            <Flex gap="8px" mb="8px" direction={{ base: 'column', sm: 'row' }}>
              <InputGroup flex="1">
                <InputLeftElement h="40px" pointerEvents="none"><MdSearch color="gray" /></InputLeftElement>
                <Input ref={input} h="40px" fontSize="sm" borderRadius="12px" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={tecla}
                  placeholder={onCrear ? 'Busca en la tienda o escribe uno nuevo' : 'Buscar (ej. media 3 mm cristal)'} />
              </InputGroup>
              {categorias.length > 1 && (
                <Select h="40px" fontSize="sm" borderRadius="12px" w={{ base: '100%', sm: '170px' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
                  <option value="">Todas</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              )}
            </Flex>
            <Box ref={lista} maxH="300px" overflowY="auto">
              {opciones.map((o, i) => (
                <Flex key={o.k} data-i={i} px="10px" py="7px" borderRadius="10px" cursor="pointer" gap="10px" align="center"
                  bg={i === activo ? hover : undefined} onMouseEnter={() => setActivo(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}>
                  {o.p && (
                    <>
                      <Box flex="1" minW={0}>
                        <Text fontSize="sm" fontWeight={o.p.id === value ? '700' : '500'} color={color} noOfLines={2}>{o.p.nombre}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">{o.p.categoria}{o.p.categoria ? ' · ' : ''}{cantf(o.p.stock)} {o.p.unidad}</Text>
                      </Box>
                      {mostrarPrecio && <Text fontSize="sm" fontWeight="700" whiteSpace="nowrap" color={color}>{money(o.p.precio)}</Text>}
                    </>
                  )}
                  {o.e && <Text fontSize="sm" color={color}>{o.e} <Text as="span" fontSize="xs" color="secondaryGray.600">· concepto</Text></Text>}
                  {o.nuevo && <Flex align="center" gap="6px" color="brand.500" fontWeight="700" fontSize="sm"><MdAdd />Crear «{o.nuevo}»</Flex>}
                </Flex>
              ))}
              {!opciones.length && <Text fontSize="sm" color="secondaryGray.600" p="10px">{onCrear ? 'Escribe el nombre para crearlo.' : 'No hay productos con esa búsqueda.'}</Text>}
              {filtrados.length > MAX && <Text fontSize="xs" color="secondaryGray.600" p="8px 10px">Se muestran {MAX} de {filtrados.length}. Escribe más para afinar.</Text>}
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
