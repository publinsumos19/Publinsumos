import { Box, Code, ListItem, OrderedList, Text } from '@chakra-ui/react';
import AuthLayout from '../../layouts/AuthLayout';

export default function Setup() {
  return (
    <AuthLayout>
      <Text fontSize="30px" fontWeight="700" mb="10px">Falta conectar la base de datos</Text>
      <Text color="gray.500" mb="16px">Esta instalación todavía no tiene los datos de Supabase.</Text>
      <OrderedList spacing="8px" fontSize="sm">
        <ListItem>Crea un proyecto en Supabase y ejecuta <Code>supabase/schema.sql</Code>.</ListItem>
        <ListItem>En Vercel, agrega las variables <Code>VITE_SUPABASE_URL</Code> y <Code>VITE_SUPABASE_ANON_KEY</Code>.</ListItem>
        <ListItem>Vuelve a desplegar. La guía completa está en el archivo <Code>README.md</Code>.</ListItem>
      </OrderedList>
      <Box h="20px" />
    </AuthLayout>
  );
}
