import { useEffect, useState } from 'react';
import { Box, Button, Flex, FormControl, FormLabel, Icon, Input, InputGroup, InputRightElement, Link, Text, useColorModeValue } from '@chakra-ui/react';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import AuthLayout from '../../layouts/AuthLayout';
import { supabase, errorMessage, isDemo } from '../../lib/supabase';
import { DEMO_PASS } from '../../lib/demo/client';
import { USUARIOS } from '../../lib/demo/seed';

export default function SignIn() {
  const [modo, setModo] = useState('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const textColor = useColorModeValue('navy.700', 'white');
  const textColorSecondary = 'gray.400';
  const brandStars = useColorModeValue('brand.500', 'brand.400');
  const registro = modo === 'crear';
  // Once the admin closes sign-ups in Ajustes, the "Crear cuenta" link goes away.
  const [abierto, setAbierto] = useState(true);
  useEffect(() => {
    if (isDemo) return;
    supabase.rpc('registro_abierto').then(({ data, error }) => { if (!error && data === false) { setAbierto(false); setModo((m) => (m === 'crear' ? 'entrar' : m)); } });
  }, []);

  const demoPanel = useColorModeValue('brand.100', 'whiteAlpha.100');
  const entrarDemo = async (u) => {
    setEmail(u.email);
    setPass(DEMO_PASS);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: u.email, password: DEMO_PASS });
    setBusy(false);
    if (error) setMsg({ t: errorMessage(error), err: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (modo === 'olvido') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setBusy(false);
      return setMsg(error ? { t: errorMessage(error), err: true } : { t: 'Te enviamos un correo para cambiar la contraseña.' });
    }
    const { data, error } = registro
      ? await supabase.auth.signUp({ email, password: pass, options: { data: { nombre } } })
      : await supabase.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) return setMsg({ t: errorMessage(error), err: true });
    if (registro && !data.session) setMsg({ t: 'Cuenta creada. Revisa tu correo para confirmarla y luego entra.' });
  };

  return (
    <AuthLayout>
      <Box as="form" onSubmit={submit}>
        <Text color={textColor} fontSize="36px" fontWeight="700" mb="10px">
          {registro ? 'Crear cuenta' : modo === 'olvido' ? 'Recuperar contraseña' : 'Iniciar sesión'}
        </Text>
        <Text mb="32px" color={textColorSecondary} fontWeight="400" fontSize="md">
          {registro ? 'El administrador activará tu acceso.' : modo === 'olvido' ? 'Escribe tu correo. Si no llega un enlace, el administrador te puede poner una contraseña nueva en Usuarios.' : 'Escribe tu correo y contraseña para entrar.'}
        </Text>
        {registro && (
          <FormControl mb="20px">
            <FormLabel fontSize="sm" fontWeight="500" color={textColor}>Nombre<Text as="span" color={brandStars}>*</Text></FormLabel>
            <Input isRequired variant="auth" fontSize="sm" placeholder="Tu nombre" size="lg" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </FormControl>
        )}
        <FormControl mb="20px">
          <FormLabel fontSize="sm" fontWeight="500" color={textColor}>Correo<Text as="span" color={brandStars}>*</Text></FormLabel>
          <Input isRequired variant="auth" fontSize="sm" type="email" placeholder="tucorreo@ejemplo.com" size="lg" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </FormControl>
        {modo !== 'olvido' && (
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500" color={textColor}>Contraseña<Text as="span" color={brandStars}>*</Text></FormLabel>
            <InputGroup size="md">
              <Input isRequired fontSize="sm" placeholder="Mínimo 6 caracteres" size="lg" type={show ? 'text' : 'password'} variant="auth" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={registro ? 'new-password' : 'current-password'} />
              <InputRightElement display="flex" alignItems="center" mt="4px">
                <Icon color={textColorSecondary} _hover={{ cursor: 'pointer' }} as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye} onClick={() => setShow(!show)} aria-label="Mostrar contraseña" />
              </InputRightElement>
            </InputGroup>
          </FormControl>
        )}
        {modo === 'entrar' && !isDemo && <Flex justify="flex-end" mb="20px"><Link color={brandStars} fontSize="sm" fontWeight="500" onClick={() => setModo('olvido')}>¿Olvidaste tu contraseña?</Link></Flex>}
        {msg && <Text mb="16px" fontSize="sm" color={msg.err ? 'red.500' : 'green.500'} fontWeight="600">{msg.t}</Text>}
        <Button type="submit" fontSize="sm" variant="brand" fontWeight="500" w="100%" h="50px" mb="24px" isLoading={busy}>
          {registro ? 'Crear cuenta' : modo === 'olvido' ? 'Enviar enlace' : 'Entrar'}
        </Button>
        {isDemo && modo === 'entrar' && (
          <Box bg={demoPanel} borderRadius="16px" p="16px" mb="20px">
            <Text fontWeight="700" fontSize="sm" mb="4px" color={textColor}>Demo: entra con una cuenta de ejemplo</Text>
            <Text fontSize="xs" color="secondaryGray.600" mb="10px">Contraseña de las dos cuentas: <b>{DEMO_PASS}</b></Text>
            <Flex direction="column" gap="8px">
              {Object.values(USUARIOS).map((u) => (
                <Button key={u.id} variant="light" justifyContent="space-between" h="auto" py="10px" onClick={() => entrarDemo(u)} isDisabled={busy}>
                  <Box textAlign="left"><Text fontSize="sm" fontWeight="700">{u.rol === 'admin' ? 'Administrador' : 'Vendedor'}</Text><Text fontSize="xs" fontWeight="400" color="secondaryGray.600">{u.email}</Text></Box>
                  <Text fontSize="sm" color="brand.500">Entrar</Text>
                </Button>
              ))}
            </Flex>
          </Box>
        )}
        {!isDemo && (abierto || modo !== 'entrar') && <Text color={textColorSecondary} fontWeight="400" fontSize="14px">
          {modo === 'entrar' ? '¿Eres nuevo? ' : '¿Ya tienes cuenta? '}
          <Link color={brandStars} fontWeight="500" onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setMsg(null); }}>
            {modo === 'entrar' ? 'Crear cuenta' : 'Iniciar sesión'}
          </Link>
        </Text>}
      </Box>
    </AuthLayout>
  );
}
