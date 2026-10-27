import { Box, useStyleConfig } from '@chakra-ui/react';

export default function Card({ variant, children, ...rest }) {
  const styles = useStyleConfig('Card', { variant });
  return (
    <Box __css={styles} {...rest}>
      {children}
    </Box>
  );
}
