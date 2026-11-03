import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import LOGO from '../assets/logo-publiinsumos.png';

export default function AuthLayout({ children }) {
  const panelText = 'white';
  const logoBg = useColorModeValue('transparent', 'white');
  return (
    <Flex minH="100vh" bg={useColorModeValue('white', 'navy.900')}>
      <Flex flex="1" align="center" justify="center" px={{ base: '25px', md: '60px' }} py="40px">
        <Box w="100%" maxW="420px">
          <Box display={{ base: 'block', lg: 'none' }} mb="28px" bg={logoBg} borderRadius="16px" px="12px" py="8px" w="fit-content">
            <Box as="img" src={LOGO} alt="Publiinsumos" h="64px" maxW="100%" objectFit="contain" />
          </Box>
          {children}
        </Box>
      </Flex>
      <Flex
        display={{ base: 'none', lg: 'flex' }} w="44vw" minH="100vh" direction="column" justify="center" px="60px"
        bgGradient="linear(135deg, brand.400 0%, brand.900 100%)" borderBottomLeftRadius="200px" color={panelText}
      >
        <Box bg="white" borderRadius="24px" px="28px" py="20px" mb="32px" alignSelf="flex-start" boxShadow="0 18px 40px rgba(0,0,0,0.18)">
          <Box as="img" src={LOGO} alt="Publiinsumos" h="110px" maxW="100%" objectFit="contain" />
        </Box>
        <Text fontSize="44px" fontWeight="800" lineHeight="1.05" letterSpacing="-1.5px">Ventas, impresiones e inventario en un solo lugar.</Text>
        <Text mt="16px" fontSize="lg" opacity={0.85} maxW="420px">Precios por escala, cotizador personalizado, recibos por WhatsApp, cartera, cierre de caja y cuadre del contador a color y blanco y negro.</Text>
      </Flex>
    </Flex>
  );
}
