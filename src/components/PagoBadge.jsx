import { Badge } from '@chakra-ui/react';
import { money, PAGOS } from '../lib/format';

export default function PagoBadge({ v }) {
  if (Number(v.saldo) > 0) return <Badge colorScheme="orange">Debe {money(v.saldo)}</Badge>;
  return <Badge colorScheme={v.pago === 'credito' ? 'green' : 'gray'}>{v.pago === 'credito' ? 'Crédito pagado' : PAGOS[v.pago]}</Badge>;
}
