import { Box, Flex, Text } from '@chakra-ui/react';

const TONO = { green: ['green.400', 'green.50', 'green.700'], yellow: ['yellow.400', 'yellow.50', 'yellow.800'], red: ['red.500', 'red.50', 'red.700'] };

export default function Semaforo({ s, small }) {
  if (!s) return <Text fontSize="sm" color="secondaryGray.600">—</Text>;
  const [dot, bg, fg] = TONO[s.color];
  return (
    <Flex as="span" display="inline-flex" align="center" gap="6px" bg={bg} color={fg} _dark={{ bg: 'whiteAlpha.100', color: 'white' }}
      borderRadius="999px" px={small ? '8px' : '10px'} py="3px" fontSize={small ? '11px' : '12px'} fontWeight="700" whiteSpace="nowrap">
      <Box w="9px" h="9px" borderRadius="50%" bg={dot} boxShadow={s.color === 'red' ? '0 0 0 3px rgba(229,62,62,.25)' : undefined} />
      {s.label}
    </Flex>
  );
}
