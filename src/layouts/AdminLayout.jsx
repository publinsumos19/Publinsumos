import { Box, Button, Flex, Spinner, Text } from '@chakra-ui/react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';
import Navbar from '../components/navbar/Navbar';
import { useAuth } from '../context/AuthContext';
import allRoutes from '../routes';
import { isDemo } from '../lib/supabase';
import { demo } from '../lib/demo/client';
import Recordatorios from '../components/Recordatorios';

export default function AdminLayout() {
  const { isAdmin, cfg } = useAuth();
  const location = useLocation();
  const routes = allRoutes.filter((r) => !r.admin || isAdmin);
  const current = routes.find((r) => location.pathname === r.path || location.pathname.startsWith(r.path + '/'));
  return (
    <Box>
      <Sidebar routes={routes} />
      <Box
        float="right" minH="100vh" position="relative"
        w={{ base: '100%', xl: 'calc( 100% - 290px )' }} maxW={{ base: '100%', xl: 'calc( 100% - 290px )' }}
      >
        <Navbar title={current?.name || ''} routes={routes} />
        <Box mx="auto" p={{ base: '12px', md: '30px' }} pe={{ base: '12px', md: '20px' }} minH="100vh" pt={{ base: '110px', md: '130px' }}>
          {isDemo && (
            <Flex bg="brand.100" color="brand.900" _dark={{ bg: 'whiteAlpha.100', color: 'white' }} borderRadius="16px" px="16px" py="10px" mb="20px" align="center" gap="10px" wrap="wrap">
              <Text fontSize="sm" flex="1" minW="200px">
                <b>Demo con datos de ejemplo.</b> Estás viendo la app como <b>{isAdmin ? 'administrador' : 'vendedor'}</b>. Puedes vender, abonar y cambiar todo; nada sale de este navegador.
              </Text>
              <Button size="sm" variant="brand" onClick={() => demo.setRol(isAdmin ? 'vendedor' : 'admin')}>
                {isAdmin ? 'Ver como vendedor' : 'Ver como administrador'}
              </Button>
            </Flex>
          )}
          {cfg === null ? (
            <Flex justify="center" py="80px"><Spinner color="brand.500" size="lg" /></Flex>
          ) : (
            <>
            <Recordatorios />
            <Routes>
              {routes.map((r) => <Route key={r.path} path={r.path + '/*'} element={r.element} />)}
              <Route path="*" element={<Navigate to={isAdmin ? '/dashboard' : '/vender'} replace />} />
            </Routes>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
