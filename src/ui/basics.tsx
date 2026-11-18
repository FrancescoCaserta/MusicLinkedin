import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CircleAlert, RefreshCw, X } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fmt, t } from '../i18n';
import type { Availability } from '../domain/search/engine';
import { instrumentName } from '../domain/taxonomy';
import type { Fee, PlayedInstrument } from '../domain/types';

// ── Avatar ───────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.replace(/[“”"’']/g, '').split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p));
  const pick = parts.filter((p) => /^[A-ZÀ-Ý]/.test(p));
  const use = pick.length >= 2 ? pick : parts;
  return ((use[0]?.[0] ?? '') + (use.length > 1 ? use[use.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, tint = 30, size, org = false }: { name: string; tint?: number; size?: 'sm' | 'lg' | 'xl'; org?: boolean }) {
  return (
    <span className={`avatar${size ? ` avatar--${size}` : ''}${org ? ' avatar--org' : ''}`} style={{ ['--tint' as string]: tint }} aria-hidden>
      {initials(name)}
    </span>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────

export function Modal({ title, kicker, onClose, children, footer, wide = false, full = false }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; /** full screen on phones (filters) */ full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field, or the dialog itself.
    // A full-screen sheet of filters opens on its title, not inside the first field.
    const first = full ? null : ref.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), textarea, select');
    (first ?? ref.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal--wide' : ''}${full ? ' modal--full' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="modal__head">
          <div>
            {kicker && <div className="label" style={{ marginBottom: 6 }}>{kicker}</div>}
            <h2 className="h-section" id={id}>{title}</h2>
          </div>
          <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={onClose} aria-label={t('Close')}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// ── Form field ───────────────────────────────────────────────────────────

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label
      className={`field ${className}`}
      // A label forwards clicks to its first control. For composite widgets (pickers with
      // chips and option lists) that would press an unrelated button, so stop it there.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="listbox"]')) e.preventDefault();
      }}
    >
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

// ── States ───────────────────────────────────────────────────────────────

export function Skeleton({ w = '100%', h = 14, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width: w, height: h, ...style }} aria-hidden />;
}

export function SkeletonList({ rows = 4, height = 92 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label={t('Loading')}>
      {Array.from({ length: rows }, (_, k) => (
        <Skeleton key={k} h={height} style={{ borderRadius: 6, opacity: 1 - k * 0.16 }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action, compact = false }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`state${compact ? ' state--compact' : ''}`}>
      {icon && <div className="state__mark">{icon}</div>}
      <div className="state__title">{title}</div>
      {text && <p className="state__text">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const message = error instanceof Error ? error.message : t('Something went wrong.');
  return (
    <div className={`state state--error${compact ? ' state--compact' : ''}`} role="alert">
      <div className="state__mark">
        <CircleAlert size={22} aria-hidden />
      </div>
      <div className="state__title">{t('That did not load')}</div>
      <p className="state__text">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden /> {t('Try again')}
        </button>
      )}
    </div>
  );
}

/** Renders the loading, error or loaded state of a query. */
export function Async<T>({ query, children, loading, compact, page }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; loading?: ReactNode; compact?: boolean; /** wrap the loading and error states in page margins */ page?: boolean }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  const frame = (node: ReactNode) => (page ? <div className="wrap wrap--narrow page">{node}</div> : <>{node}</>);
  if (query.isError) return frame(<ErrorState error={query.error} onRetry={() => void query.refetch()} compact={compact} />);
  return loading ? <>{loading}</> : frame(<SkeletonList />);
}

// ── Domain display helpers ───────────────────────────────────────────────

const LEVEL_SUFFIX: Record<PlayedInstrument['level'], string> = { primary: '', secondary: '', doubling: '', period: '' };

export function instrumentsLine(instruments: PlayedInstrument[], max = 3): string {
  const names = instruments.slice(0, max).map((p) => t(instrumentName(p.instrumentId)) + LEVEL_SUFFIX[p.level]);
  const more = instruments.length - max;
  return names.join(' · ') + (more > 0 ? ` +${more}` : '');
}

export function feeRange(fee: { min: number; max: number }): string {
  return fee.min === fee.max ? fmt.money(fee.min) : `${fmt.money(fee.min)}–${fmt.number(fee.max)}`;
}

const UNIT: Record<Fee['unit'], string> = {
  total: '',
  'per-concert': 'per concert',
  'per-service': 'per service',
  'per-hour': 'per hour',
  'per-month': 'per month',
  'per-year': 'per year',
};

export function feeUnit(fee: Fee): string {
  return UNIT[fee.unit] ? t(UNIT[fee.unit]) : '';
}

export function feeAmount(fee: Fee): string {
  return fee.max ? `${fmt.money(fee.amount)}–${fmt.number(fee.max)}` : fmt.money(fee.amount);
}

/** The fee, stated the way musicians read it: big number, small unit. */
export function FeeBlock({ fee, size = 'md' }: { fee: Fee; size?: 'md' | 'lg' }) {
  return (
    <span className={`fee fee--${size}`}>
      <span className="fee__amount num">{feeAmount(fee)}</span>
      {feeUnit(fee) && <span className="fee__unit">{feeUnit(fee)}</span>}
    </span>
  );
}

export function AvailabilityTag({ value, date }: { value: Availability; date?: string }) {
  const on = date ? ` ${fmt.day(date)}` : '';
  if (value === 'free') return <span className="tag tag--ok"><span className="dot dot--ok" />{t('Free')}{on}</span>;
  if (value === 'tentative') return <span className="tag tag--warn"><span className="dot dot--warn" />{t('On hold')}{on}</span>;
  return <span className="tag"><span className="dot dot--busy" />{t('Booked')}{on}</span>;
}

export function PersonLink({ slug, name, className }: { slug?: string; name: string; className?: string }) {
  return slug ? <Link to={`/musicians/${slug}`} className={className ?? 'link'}>{name}</Link> : <span className={className}>{name}</span>;
}
