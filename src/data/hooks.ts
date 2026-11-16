import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useToast } from '../app/toast';
import { t } from '../i18n';

/**
 * Thin helpers over TanStack Query. Queries are keyed by what they read;
 * after any successful mutation everything is refetched — simple, and right
 * for a data set this size. A real backend would invalidate more precisely.
 */

export function useApiQuery<T>(key: unknown[], fn: () => Promise<T>, options?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({ queryKey: key, queryFn: fn, ...options });
}

export function useApiMutation<A, R>(fn: (args: A) => Promise<R>, opts: { success?: string | ((result: R, args: A) => string | undefined); onDone?: (result: R, args: A) => void } = {}) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation<R, Error, A>({
    mutationFn: fn,
    onSuccess: async (result, args) => {
      await client.invalidateQueries();
      const msg = typeof opts.success === 'function' ? opts.success(result, args) : opts.success;
      if (msg) toast.ok(msg);
      opts.onDone?.(result, args);
    },
    onError: (e) => toast.error(e.message || t('Something went wrong. Please try again.')),
  });
}
