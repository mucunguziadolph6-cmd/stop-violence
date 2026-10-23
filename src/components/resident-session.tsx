import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ResidentContext = createContext<{ user: User | null; ready: boolean }>({ user: null, ready: false });
export const useResident = () => useContext(ResidentContext);

export function ResidentSession({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
      setUser(session?.user ?? null);
      setReady(true);
      void router.invalidate();
      if (event !== 'SIGNED_OUT') void queryClient.invalidateQueries();
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); setReady(true); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [router, queryClient]);
  return <ResidentContext.Provider value={{ user, ready }}>{children}</ResidentContext.Provider>;
}