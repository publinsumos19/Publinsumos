import { Flex, Spinner } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import SignIn from './views/auth/SignIn';
import Pendiente from './views/auth/Pendiente';
import Setup from './views/auth/Setup';
import { supabaseConfigured } from './lib/supabase';
import Guia from './views/Guia';

function Gate() {
  const { session, perfil, activo } = useAuth();
  if (session === undefined || (session && !perfil)) return <Flex minH="100vh" align="center" justify="center"><Spinner color="brand.500" size="xl" /></Flex>;
  if (!session) return <SignIn />;
  if (!activo) return <Pendiente />;
  return <AdminLayout />;
}

export default function App() {
  const { pathname } = useLocation();
  // The guide is public: it opens without signing in.
  if (pathname.replace(/\/$/, '') === '/guia') return <Guia />;
  if (!supabaseConfigured) return <Setup />;
  return <AuthProvider><Gate /></AuthProvider>;
}
