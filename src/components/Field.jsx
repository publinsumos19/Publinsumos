import { FormControl, FormLabel, Input, Select, useColorModeValue } from '@chakra-ui/react';

export function Field({ label, children, ...rest }) {
  return (
    <FormControl {...rest}>
      <FormLabel fontSize="sm" fontWeight="600" color="secondaryGray.600" mb="6px">{label}</FormLabel>
      {children}
    </FormControl>
  );
}

const ph = { color: 'secondaryGray.600' };
export const TextIn = (props) => <Input variant="main" h="44px" fontSize="sm" _placeholder={ph} {...props} />;
export const NumIn = (props) => <Input variant="main" h="44px" fontSize="sm" type="number" inputMode="decimal" _placeholder={ph} {...props} />;
export const Sel = ({ options, ...props }) => (
  <Select variant="main" h="44px" fontSize="sm" color={useColorModeValue('secondaryGray.900', 'white')} {...props}>
    {options.map(([v, l]) => (
      <option key={v} value={v}>{l}</option>
    ))}
  </Select>
);
