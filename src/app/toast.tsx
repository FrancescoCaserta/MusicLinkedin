import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';
import { t } from '../i18n';

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

interface ToastApi {
  ok: (text: string) => void;
  error: (text: string) => void;
}

const Ctx = createContext<ToastApi>({ ok: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo<ToastApi>(() => ({ ok: (text) => push('ok', text), error: (text) => push('error', text) }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast--${x.kind}`}>
            {x.kind === 'ok' ? <Check size={16} aria-hidden /> : <CircleAlert size={16} aria-hidden />}
            <span>{x.text}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(x.id)} aria-label={t('Dismiss')}>
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
