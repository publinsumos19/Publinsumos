import {
  Box, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerOverlay, Flex, HStack, Icon, Text,
  useColorModeValue, useDisclosure,
} from '@chakra-ui/react';
import { NavLink, useLocation } from 'react-router-dom';
import { IoMenuOutline } from 'react-icons/io5';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

function Brand() {
  const { cfg } = useAuth();
  const logoColor = useColorModeValue('navy.700', 'white');
  const name = cfg?.negocio?.nombre || 'Ecoglobal';
  return (
    <Flex align="center" direction="column">
      <Flex align="center" gap="10px" my="32px">
        {cfg?.negocio?.logo ? (
          <Box as="img" src={cfg.negocio.logo} alt="" h="34px" maxW="160px" objectFit="contain" />
        ) : (
          <Box display="grid" gridTemplateColumns="repeat(2, 9px)" gap="3px" aria-hidden>
            {['#00A3D9', '#E0307C', '#F2B705', 'navy.700'].map((c) => (
              <Box key={c} w="9px" h="9px" borderRadius="50%" bg={c} />
            ))}
          </Box>
        )}
        <Text fontSize="26px" fontWeight="800" color={logoColor} letterSpacing="-1px" noOfLines={1}>
          {name}
        </Text>
      </Flex>
      <Box h="1px" w="100%" bg="rgba(135, 140, 189, 0.3)" mb="20px" />
    </Flex>
  );
}

function Links({ routes, onNavigate }) {
  const location = useLocation();
  const activeColor = useColorModeValue('gray.700', 'white');
  const textColor = useColorModeValue('secondaryGray.500', 'white');
  const activeIcon = useColorModeValue('brand.500', 'white');
  const brandColor = useColorModeValue('brand.500', 'brand.400');
  return routes.map((r) => {
    const active = location.pathname === r.path || location.pathname.startsWith(r.path + '/');
    return (
      <NavLink key={r.path} to={r.path} onClick={onNavigate} data-tour={'nav' + r.path}>
        <HStack spacing={active ? '22px' : '26px'} py="5px" ps="10px">
          <Flex w="100%" alignItems="center">
            <Box color={active ? activeIcon : textColor} me="18px">
              <Icon as={r.icon} w="20px" h="20px" />
            </Box>
            <Text me="auto" color={active ? activeColor : textColor} fontWeight={active ? 'bold' : 'normal'}>
              {r.name}
            </Text>
          </Flex>
          <Box h="36px" w="4px" bg={active ? brandColor : 'transparent'} borderRadius="5px" />
        </HStack>
      </NavLink>
    );
  });
}

function Content({ routes, onNavigate }) {
  return (
    <Flex direction="column" height="100%" pt="25px" px="16px">
      <Brand />
      <Box ps="20px" pe={{ md: '16px', '2xl': '1px' }} mb="auto" mt="8px">
        <Links routes={routes} onNavigate={onNavigate} />
      </Box>
    </Flex>
  );
}

export default function Sidebar({ routes }) {
  const shadow = useColorModeValue('14px 17px 40px 4px rgba(112, 144, 176, 0.08)', 'unset');
  const bg = useColorModeValue('white', 'navy.800');
  return (
    <Box display={{ base: 'none', xl: 'block' }} position="fixed" minH="100%">
      <Box bg={bg} w="300px" h="100vh" overflowX="hidden" overflowY="auto" boxShadow={shadow}>
        <Content routes={routes} />
      </Box>
    </Box>
  );
}

export function SidebarResponsive({ routes }) {
  const bg = useColorModeValue('white', 'navy.800');
  const menuColor = useColorModeValue('gray.400', 'white');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const location = useLocation();
  useEffect(onClose, [location.pathname, onClose]);
  return (
    <Flex display={{ base: 'flex', xl: 'none' }} alignItems="center">
      <Flex as="button" aria-label="Abrir menú" onClick={onOpen} w="max-content" h="max-content">
        <Icon as={IoMenuOutline} color={menuColor} w="22px" h="22px" me="10px" />
      </Flex>
      <Drawer isOpen={isOpen} onClose={onClose} placement="left">
        <DrawerOverlay />
        <DrawerContent w="285px" maxW="285px" bg={bg}>
          <DrawerCloseButton zIndex="3" />
          <DrawerBody maxW="285px" px="0rem" pb="0">
            <Content routes={routes} onNavigate={onClose} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
