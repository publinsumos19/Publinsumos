import { createClient } from '@supabase/supabase-js';
import { demoClient } from './demo/client';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The demo build (npm run build:demo) runs on sample data saved in the browser, with no server.
export const isDemo = import.meta.env.VITE_DEMO === '1';
export const supabaseConfigured = isDemo || Boolean(url && key);
export const supabase = isDemo ? demoClient : supabaseConfigured ? createClient(url, key) : null;

// Supabase errors come back in English; show the user something they can act on.
export function errorMessage(error) {
  const m = String(error?.message || error || '');
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.';
  if (/Signups not allowed|signup_disabled/i.test(m)) return 'El registro de cuentas nuevas está cerrado. Pídele al administrador que lo abra en Ajustes.';
  if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese correo.';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/sin acceso/i.test(m)) return 'Tu usuario todavía no está activo. Pídele al administrador que lo active.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer este cambio.';
  return m || 'Ocurrió un error. Intenta de nuevo.';
}
