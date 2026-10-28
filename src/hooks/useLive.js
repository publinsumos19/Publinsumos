import { useCallback, useEffect, useRef, useState } from 'react';
import { isDemo, supabase } from '../lib/supabase';

let channelSeq = 0;

// Tell every live query on this device that `tables` changed, so screens refresh
// right after our own writes even if the realtime connection is slow or down.
export function notifyChange(...tables) {
  window.dispatchEvent(new CustomEvent('db-change', { detail: tables }));
}

// Without realtime (the Railway server), one tiny query every few seconds reads a
// per-table change counter, and only screens whose tables changed reload.
const CADA = 4000;
let vistos = null;
let usuarios = 0;
let reloj = null;
async function revisar() {
  if (document.hidden) return;
  const { data, error } = await supabase.from('cambios').select('tabla, n');
  if (error || !data) return;
  const ahora = Object.fromEntries(data.map((r) => [r.tabla, r.n]));
  if (vistos) {
    const cambiaron = Object.keys(ahora).filter((t) => ahora[t] !== vistos[t]);
    if (cambiaron.length) notifyChange(...cambiaron);
  }
  vistos = ahora;
}
function vigilar() {
  if (isDemo) return () => {};
  usuarios += 1;
  if (!reloj) {
    revisar();
    reloj = setInterval(revisar, CADA);
    document.addEventListener('visibilitychange', revisar);
  }
  return () => {
    usuarios -= 1;
    if (!usuarios) { clearInterval(reloj); reloj = null; document.removeEventListener('visibilitychange', revisar); }
  };
}

// Runs `fetcher` and runs it again whenever any of `tables` changes in the database.
export function useLive(fetcher, tables, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const reload = useCallback(async () => {
    const { data: d, error: e } = await fetchRef.current();
    if (e) setError(e);
    else {
      setError(null);
      setData(d);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const tablesKey = tables.join(',');
  useEffect(() => {
    let timer;
    const ch = supabase.channel('live-' + tablesKey + '-' + ++channelSeq);
    for (const t of tablesKey.split(',')) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        clearTimeout(timer);
        timer = setTimeout(reload, 250);
      });
    }
    ch.subscribe();
    const onLocal = (e) => {
      if (e.detail.some((t) => tablesKey.split(',').includes(t))) reload();
    };
    window.addEventListener('db-change', onLocal);
    const dejar = vigilar();
    return () => {
      dejar();
      clearTimeout(timer);
      window.removeEventListener('db-change', onLocal);
      supabase.removeChannel(ch);
    };
  }, [tablesKey, reload]);

  return { data, error, reload, loading: data === null && !error };
}
