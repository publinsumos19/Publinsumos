import { Flex, Icon, Stat, StatLabel, StatNumber, Text, useColorModeValue } from '@chakra-ui/react';
import Card from './Card';

export default function MiniStatistics({ icon, name, value, help, tone = 'brand', compact }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const iconColor = useColorModeValue(tone === 'brand' ? 'brand.500' : `${tone}.500`, 'white');
  return (
    <Card py={compact ? '10px' : '15px'} px={compact ? { base: '12px', md: '14px' } : undefined} borderRadius={compact ? '16px' : undefined}>
      <Flex my="auto" h="100%" align="center">
        {icon && (
          <Flex align="center" justify="center" borderRadius="50%" w={compact ? '40px' : '56px'} h={compact ? '40px' : '56px'} bg={boxBg} flex="none" display={compact ? { base: 'none', md: 'flex' } : 'flex'}>
            <Icon as={icon} w={compact ? '20px' : '28px'} h={compact ? '20px' : '28px'} color={iconColor} />
          </Flex>
        )}
        <Stat my="auto" ms={icon ? (compact ? { base: 0, md: '12px' } : '18px') : '0px'} minW={0}>
          <StatLabel lineHeight="100%" color="secondaryGray.600" fontSize={compact ? 'xs' : 'sm'} noOfLines={compact ? 1 : undefined}>
            {name}
          </StatLabel>
          <StatNumber color={textColor} fontSize={compact ? { base: 'md', md: 'xl' } : '2xl'} whiteSpace={compact ? 'nowrap' : undefined} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </StatNumber>
          {help && (
            <Text color="secondaryGray.600" fontSize="xs" fontWeight="500" noOfLines={compact ? 1 : undefined}>
              {help}
            </Text>
          )}
        </Stat>
      </Flex>
    </Card>
  );
}
