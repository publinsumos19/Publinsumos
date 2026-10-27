import {
  Avatar, Box, Button, Flex, Icon, Menu, MenuButton, MenuItem, MenuList, Text, useColorMode, useColorModeValue,
} from '@chakra-ui/react';
import { IoMdMoon, IoMdNotificationsOutline, IoMdSunny } from 'react-icons/io';
import { abrirRecordatorios } from '../Recordatorios';
import { SidebarResponsive } from '../sidebar/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { isDemo } from '../../lib/supabase';
import { demo } from '../../lib/demo/client';

export default function Navbar({ title, routes }) {
  const { perfil, isAdmin, signOut } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const mainText = useColorModeValue('navy.700', 'white');
  const secondaryText = useColorModeValue('gray.700', 'white');
  const navbarBg = useColorModeValue('rgba(244, 247, 254, 0.2)', 'rgba(11,20,55,0.5)');
  const menuBg = useColorModeValue('white', 'navy.800');
  const shadow = useColorModeValue('14px 17px 40px 4px rgba(112, 144, 176, 0.18)', '14px 17px 40px 4px rgba(112, 144, 176, 0.06)');
  const iconColor = useColorModeValue('gray.400', 'white');
  return (
    <Box
      position="fixed" bg={navbarBg} backdropFilter="blur(20px)" borderRadius="16px" zIndex={10}
      minH="75px" px={{ base: '15px', md: '10px' }} ps={{ xl: '12px' }} py="8px"
      right={{ base: '12px', md: '30px' }} top={{ base: '12px', md: '16px', xl: '20px' }}
      w={{ base: 'calc(100vw - 24px)', md: 'calc(100vw - 60px)', xl: 'calc(100vw - 350px)', '2xl': 'calc(100vw - 365px)' }}
    >
      <Flex w="100%" alignItems="center" gap="10px">
        <Box minW={0}>
          <Text color={secondaryText} fontSize="sm" mb="2px">
            {isAdmin ? 'Administración' : 'Punto de venta'}
          </Text>
          <Text color={mainText} fontWeight="bold" fontSize={{ base: '24px', md: '34px' }} lineHeight="1.1" noOfLines={1}>
            {title}
          </Text>
        </Box>
        <Flex
          ms="auto" alignItems="center" bg={menuBg} p="10px" borderRadius="30px" boxShadow={shadow} gap="6px" flex="none"
        >
          <SidebarResponsive routes={routes} />
          <Button variant="no-hover" bg="transparent" p="0" minW="unset" h="18px" w="max-content" onClick={abrirRecordatorios} aria-label="Recordatorios">
            <Icon me="10px" h="20px" w="20px" color={iconColor} as={IoMdNotificationsOutline} />
          </Button>
          <Button variant="no-hover" bg="transparent" p="0" minW="unset" h="18px" w="max-content" onClick={toggleColorMode}
            aria-label={colorMode === 'light' ? 'Modo oscuro' : 'Modo claro'}>
            <Icon me="10px" h="18px" w="18px" color={iconColor} as={colorMode === 'light' ? IoMdMoon : IoMdSunny} />
          </Button>
          <Menu>
            <MenuButton p="0px" aria-label="Mi cuenta">
              <Avatar _hover={{ cursor: 'pointer' }} color="white" name={perfil?.nombre || perfil?.email || 'Usuario'} bg="brand.500" size="sm" w="40px" h="40px" />
            </MenuButton>
            <MenuList boxShadow={shadow} p="0px" mt="10px" borderRadius="20px" bg={menuBg} border="none">
              <Flex w="100%" mb="0px" direction="column" px="20px" pt="16px" pb="10px">
                <Text fontSize="sm" fontWeight="700" color={mainText}>{perfil?.nombre || 'Usuario'}</Text>
                <Text fontSize="xs" color="secondaryGray.600">{perfil?.email} · {isAdmin ? 'Administrador' : 'Vendedor'}</Text>
              </Flex>
              <Flex flexDirection="column" p="10px">
                {isDemo ? (
                  <>
                    <MenuItem bg="transparent" borderRadius="8px" px="14px" onClick={() => demo.setRol(isAdmin ? 'vendedor' : 'admin')}>
                      <Text fontSize="sm">{isAdmin ? 'Ver como vendedor' : 'Ver como administrador'}</Text>
                    </MenuItem>
                    <MenuItem bg="transparent" borderRadius="8px" px="14px" onClick={demo.reset}>
                      <Text fontSize="sm">Reiniciar datos de ejemplo</Text>
                    </MenuItem>
                    <MenuItem bg="transparent" borderRadius="8px" px="14px" color="red.400" onClick={signOut}>
                      <Text fontSize="sm">Cerrar sesión</Text>
                    </MenuItem>
                  </>
                ) : (
                  <MenuItem bg="transparent" _hover={{ bg: 'none' }} _focus={{ bg: 'none' }} color="red.400" borderRadius="8px" px="14px" onClick={signOut}>
                    <Text fontSize="sm">Cerrar sesión</Text>
                  </MenuItem>
                )}
              </Flex>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
    </Box>
  );
}
