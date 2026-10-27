import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

let channelSeq = 0;

// Tell every live query on this device that `tables` changed, so screens refresh
// right after our own writes even if the realtime connection is slow or down.
export function notifyChange(...tables) {
  window.dispatchEvent(new CustomEvent('db-change', { detail: tables }));
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
    return () => {
      clearTimeout(timer);
      window.removeEventListener('db-change', onLocal);
      supabase.removeChannel(ch);
    };
  }, [tablesKey, reload]);

  return { data, error, reload, loading: data === null && !error };
}
