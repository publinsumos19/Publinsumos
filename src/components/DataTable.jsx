import { Box, Table, Tbody, Td, Th, Thead, Tr, Text, useColorModeValue } from '@chakra-ui/react';

// columns: [{ key, label, num, render(row) }]
export default function DataTable({ columns, rows, onRowClick, empty = 'Sin datos.', footer }) {
  const border = useColorModeValue('gray.200', 'whiteAlpha.100');
  const hover = useColorModeValue('secondaryGray.300', 'whiteAlpha.50');
  if (!rows?.length) return <Text color="secondaryGray.600" py="24px" textAlign="center" fontSize="sm">{empty}</Text>;
  return (
    <Box overflowX="auto">
      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            {columns.map((c) => (
              <Th key={c.key} borderColor={border} isNumeric={c.num} color="gray.400" fontSize={{ base: '10px', lg: '12px' }} py="12px">
                {c.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r, i) => (
            <Tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} cursor={onRowClick ? 'pointer' : undefined} _hover={onRowClick ? { bg: hover } : undefined}>
              {columns.map((c) => (
                <Td key={c.key} borderColor={border} isNumeric={c.num} fontSize="sm" py="12px" sx={c.num ? { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } : undefined}>
                  {c.render ? c.render(r) : r[c.key]}
                </Td>
              ))}
            </Tr>
          ))}
          {footer}
        </Tbody>
      </Table>
    </Box>
  );
}
