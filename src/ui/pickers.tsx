import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { suggestRepertoire } from '../domain/catalogue';
import { COUNTRY_NAMES, searchCities, type City } from '../domain/cities';
import { FAMILY_LABELS, FAMILY_ORDER, INSTRUMENTS, instrumentName, normalise, type Instrument } from '../domain/taxonomy';
import { t } from '../i18n';

export interface Option<T> {
  key: string;
  label: string;
  hint?: string;
  group?: string;
  value: T;
}

/**
 * An accessible type-ahead: arrow keys, Enter, Escape, click-outside.
 * `options(text)` decides what to offer; choosing calls `onPick`.
 */
export function Combobox<T>({
  value,
  onChange,
  options,
  onPick,
  placeholder,
  id,
  small = false,
  clearOnPick = false,
  ariaLabel,
  leading,
  onEnterFreeText,
}: {
  value: string;
  onChange: (text: string) => void;
  options: (text: string) => Option<T>[];
  onPick: (opt: Option<T>) => void;
  placeholder?: string;
  id?: string;
  small?: boolean;
  clearOnPick?: boolean;
  ariaLabel?: string;
  leading?: ReactNode;
  /** Called when Enter is pressed with no option highlighted. */
  onEnterFreeText?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const opts = useMemo(() => (open ? options(value) : []), [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (o: Option<T>) => {
    onPick(o);
    if (clearOnPick) onChange('');
    setOpen(false);
    setActive(-1);
  };

  let lastGroup: string | undefined;
  return (
    <div className="combo" ref={root}>
      {leading}
      <input
        id={id}
        className={`input${small ? ' input--sm' : ''}`}
        role="combobox"
        aria-expanded={open && opts.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          // On a phone the list opens below the field, where the keyboard and the
          // bottom bars are: bring the field up so the options are reachable.
          if (window.innerWidth < 700) e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, opts.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && opts[active]) {
              e.preventDefault();
              pick(opts[active]);
            } else if (open && opts.length === 1 && !onEnterFreeText) {
              e.preventDefault();
              pick(opts[0]);
            } else if (onEnterFreeText) {
              e.preventDefault();
              onEnterFreeText(value);
              setOpen(false);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && opts.length > 0 && (
        <div className="combo__list" role="listbox" id={listId}>
          {opts.map((o, k) => {
            const header = o.group && o.group !== lastGroup ? <div className="combo__group label">{o.group}</div> : null;
            lastGroup = o.group;
            return (
              <div key={o.key}>
                {header}
                <button type="button" role="option" aria-selected={k === active} className="combo__opt" onMouseEnter={() => setActive(k)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                  <span>{o.label}</span>
                  {o.hint && <small>{o.hint}</small>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Instruments ──────────────────────────────────────────────────────────

function instrumentOptions(text: string, exclude: string[]): Option<Instrument>[] {
  const q = normalise(text);
  const list = INSTRUMENTS.filter((i) => !exclude.includes(i.id)).filter((i) => !q || [i.name, i.player, ...i.aliases].some((a) => normalise(a).includes(q)));
  const starts = (i: Instrument) => (q && normalise(i.name).startsWith(q) ? 0 : 1);
  return list
    .sort((a, b) => (q ? starts(a) - starts(b) : 0) || FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family))
    .map((i) => ({ key: i.id, label: t(i.name), group: q ? undefined : t(FAMILY_LABELS[i.family]), value: i }));
}

export function InstrumentPicker({ value, onChange, placeholder, small, id }: { value: string[]; onChange: (ids: string[]) => void; placeholder?: string; small?: boolean; id?: string }) {
  const [text, setText] = useState('');
  return (
    <div className="stack stack--sm">
      {value.length > 0 && (
        <div className="row row--wrap" style={{ gap: 6 }}>
          {value.map((v) => (
            <span key={v} className="chip chip--filter">
              {t(instrumentName(v))}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={t('Remove {name}', { name: instrumentName(v) })}>
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <Combobox
        id={id}
        small={small}
        value={text}
        onChange={setText}
        clearOnPick
        placeholder={placeholder ?? (value.length ? t('Add another…') : t('Instrument or voice'))}
        options={(x) => instrumentOptions(x, value)}
        onPick={(o) => onChange([...value, o.value.id])}
      />
    </div>
  );
}

export function InstrumentSelect({ value, onChange, id, small }: { value: string; onChange: (id: string) => void; id?: string; small?: boolean }) {
  return (
    <select id={id} className={`select${small ? ' select--sm' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {FAMILY_ORDER.map((f) => (
        <optgroup key={f} label={t(FAMILY_LABELS[f])}>
          {INSTRUMENTS.filter((i) => i.family === f).map((i) => (
            <option key={i.id} value={i.id}>
              {t(i.name)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Places ───────────────────────────────────────────────────────────────

export function CityPicker({ value, onPick, placeholder, small, id }: { value: string; onPick: (city: City | undefined) => void; placeholder?: string; small?: boolean; id?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Combobox
      id={id}
      small={small}
      value={text}
      onChange={(x) => {
        setText(x);
        if (!x.trim()) onPick(undefined);
      }}
      placeholder={placeholder ?? t('City')}
      options={(x) => searchCities(x === value ? '' : x, 8).map((c) => ({ key: c.id, label: c.name, hint: COUNTRY_NAMES[c.country] ?? c.country, value: c }))}
      onPick={(o) => {
        setText(o.value.name);
        onPick(o.value);
      }}
    />
  );
}

// ── Repertoire ───────────────────────────────────────────────────────────

export function RepertoireInput({ value, onChange, placeholder, small, id }: { value: string; onChange: (text: string) => void; placeholder?: string; small?: boolean; id?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Combobox
      id={id}
      small={small}
      value={text}
      onChange={(x) => {
        setText(x);
        if (!x.trim()) onChange('');
      }}
      placeholder={placeholder ?? t('Composer or work')}
      options={(x) => suggestRepertoire(x).map((s) => ({ key: s.label, label: s.label, value: s }))}
      onPick={(o) => {
        const next = o.value.work ? `${o.value.composer} ${o.value.work}` : o.value.composer;
        setText(next);
        onChange(next);
      }}
      onEnterFreeText={(x) => onChange(x.trim())}
    />
  );
}
