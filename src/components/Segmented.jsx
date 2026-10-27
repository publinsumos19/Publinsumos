import { Button, ButtonGroup, useColorModeValue } from '@chakra-ui/react';

export default function Segmented({ value, onChange, options, size = 'sm', nowrap = false }) {
  const bg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const activeBg = useColorModeValue('white', 'navy.700');
  return (
    <ButtonGroup isAttached bg={bg} p="4px" borderRadius="14px" flexWrap={nowrap ? 'nowrap' : 'wrap'} role="group">
      {options.map(([v, label]) => (
        <Button
          key={v} size={size} borderRadius="10px" fontWeight="600"
          bg={value === v ? activeBg : 'transparent'} boxShadow={value === v ? 'md' : 'none'}
          color={value === v ? undefined : 'secondaryGray.600'}
          _hover={{ bg: value === v ? activeBg : 'blackAlpha.50' }}
          aria-pressed={value === v} onClick={() => onChange(v)}
        >
          {label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
