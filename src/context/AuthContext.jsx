import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setFormatoNumero } from '../lib/trabajo';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [costos, setCostos] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  const loadPerfil = useCallback(async () => {
    if (!uid) return setPerfil(null);
    // Right after sign-up the first request can still go out without the new session; retry briefly.
    for (let i = 0; i < 4; i++) {
      const { data } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle();
      if (data) return setPerfil(data);
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    setPerfil({ id: uid, activo: false, rol: 'vendedor', nombre: '', email: session?.user?.email || '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const isAdmin = perfil?.activo && perfil?.rol === 'admin';
  const activo = !!perfil?.activo;

  const loadCfg = useCallback(async () => {
    if (!activo) return;
    const { data } = await supabase.from('config_publica').select('datos').eq('id', 1).maybeSingle();
    setFormatoNumero(data?.datos?.cotizacion?.formatoNumero);
    setCfg(data?.datos || null);
    if (isAdmin) {
      const { data: c } = await supabase.from('config_costos').select('datos').eq('id', 1).maybeSingle();
      setCostos(c?.datos || null);
    } else setCostos(null);
  }, [activo, isAdmin]);

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  useEffect(() => {
    loadCfg();
    if (!uid) return;
    const ch = supabase
      .channel('auth-cfg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config_publica' }, loadCfg)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles', filter: `id=eq.${uid}` }, loadPerfil)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [uid, loadCfg, loadPerfil]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      perfil,
      activo,
      isAdmin,
      cfg,
      costos,
      reloadCfg: loadCfg,
      reloadPerfil: loadPerfil,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, perfil, activo, isAdmin, cfg, costos, loadCfg, loadPerfil],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
