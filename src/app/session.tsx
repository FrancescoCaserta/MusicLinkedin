import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '../data/api';
import { api } from '../data/client';
import type { ID } from '../domain/types';

/**
 * "Login" in the prototype is choosing a demo persona. The chosen account id
 * is all that is remembered; everything else comes from the data layer.
 */

const KEY = 'leggio:persona';

interface SessionState {
  accountId: ID | null;
  session?: Session;
  loading: boolean;
  signIn: (id: ID) => void;
  signOut: () => void;
}

const Ctx = createContext<SessionState>({ accountId: null, loading: false, signIn: () => {}, signOut: () => {} });

function stored(): ID | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<ID | null>(stored);
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ['session', accountId],
    queryFn: () => api.getSession(accountId!),
    enabled: !!accountId,
    retry: false,
  });

  const signIn = useCallback(
    (id: ID) => {
      try {
        window.localStorage.setItem(KEY, id);
      } catch {
        // the session then lasts until the tab is closed
      }
      setAccountId(id);
      void client.invalidateQueries();
    },
    [client],
  );
  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    setAccountId(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ accountId, session: q.data, loading: !!accountId && q.isLoading, signIn, signOut }),
    [accountId, q.data, q.isLoading, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** For screens inside the app shell, where a persona is guaranteed. */
export function useViewer() {
  const { accountId, session } = useSession();
  if (!accountId) throw new Error('useViewer used outside the signed-in shell');
  return {
    id: accountId,
    account: session?.account,
    musician: session?.musician,
    organisations: session?.organisations ?? [],
    isMusician: !!session?.account.musicianId,
  };
}
