import { Flex, Icon, Stat, StatLabel, StatNumber, Text, useColorModeValue } from '@chakra-ui/react';
import Card from './Card';

export default function MiniStatistics({ icon, name, value, help, tone = 'brand' }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const iconColor = useColorModeValue(tone === 'brand' ? 'brand.500' : `${tone}.500`, 'white');
  return (
    <Card py="15px">
      <Flex my="auto" h="100%" align="center">
        {icon && (
          <Flex align="center" justify="center" borderRadius="50%" w="56px" h="56px" bg={boxBg} flex="none">
            <Icon as={icon} w="28px" h="28px" color={iconColor} />
          </Flex>
        )}
        <Stat my="auto" ms={icon ? '18px' : '0px'} minW={0}>
          <StatLabel lineHeight="100%" color="secondaryGray.600" fontSize="sm">
            {name}
          </StatLabel>
          <StatNumber color={textColor} fontSize="2xl" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </StatNumber>
          {help && (
            <Text color="secondaryGray.600" fontSize="xs" fontWeight="500">
              {help}
            </Text>
          )}
        </Stat>
      </Flex>
    </Card>
  );
}
