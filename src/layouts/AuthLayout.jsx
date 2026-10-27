import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';

export default function AuthLayout({ children }) {
  const panelText = 'white';
  return (
    <Flex minH="100vh" bg={useColorModeValue('white', 'navy.900')}>
      <Flex flex="1" align="center" justify="center" px={{ base: '25px', md: '60px' }} py="40px">
        <Box w="100%" maxW="420px">{children}</Box>
      </Flex>
      <Flex
        display={{ base: 'none', lg: 'flex' }} w="44vw" minH="100vh" direction="column" justify="center" px="60px"
        bgGradient="linear(135deg, brand.400 0%, brand.900 100%)" borderBottomLeftRadius="200px" color={panelText}
      >
        <Box display="grid" gridTemplateColumns="repeat(2, 16px)" gap="6px" mb="24px" aria-hidden>
          {['#00A3D9', '#E0307C', '#F2B705', 'white'].map((c) => <Box key={c} w="16px" h="16px" borderRadius="50%" bg={c} />)}
        </Box>
        <Text fontSize="44px" fontWeight="800" lineHeight="1.05" letterSpacing="-1.5px">Ventas, impresiones e inventario en un solo lugar.</Text>
        <Text mt="16px" fontSize="lg" opacity={0.85} maxW="420px">Precios por escala, cotizador personalizado, recibos por WhatsApp, cartera, cierre de caja y cuadre del contador a color y blanco y negro.</Text>
      </Flex>
    </Flex>
  );
}
