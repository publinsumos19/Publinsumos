import { useEffect } from 'react';
import { Button, Text, useColorModeValue } from '@chakra-ui/react';
import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export default function Pendiente() {
  const { perfil, signOut, reloadPerfil } = useAuth();
  const textColor = useColorModeValue('navy.700', 'white');
  useEffect(() => {
    const t = setInterval(reloadPerfil, 5000);
    return () => clearInterval(t);
  }, [reloadPerfil]);
  return (
    <AuthLayout>
      <Text color={textColor} fontSize="32px" fontWeight="700" mb="10px">Tu cuenta está pendiente</Text>
      <Text color="gray.400" mb="28px">
        Hola{perfil?.nombre ? ` ${perfil.nombre}` : ''}. El administrador debe activar tu acceso en la sección Usuarios. Cuando lo haga, esta pantalla cambiará sola.
      </Text>
      <Button variant="brand" w="100%" h="50px" mb="12px" onClick={reloadPerfil}>Ya me activaron</Button>
      <Button variant="light" w="100%" h="50px" onClick={signOut}>Cerrar sesión</Button>
    </AuthLayout>
  );
}
