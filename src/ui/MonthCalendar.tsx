import { monthGrid } from '../domain/dates';
import type { AvailabilityEntry, ISODate } from '../domain/types';
import { fmt, t } from '../i18n';

/** A month of availability. Read-only unless `onPick` is given. */
export function MonthCalendar({
  year,
  month,
  availability,
  today,
  highlight,
  selected,
  onPick,
  size = 'sm',
  showTitle = true,
}: {
  year: number;
  month: number;
  availability: Record<ISODate, AvailabilityEntry>;
  today: ISODate;
  highlight?: ISODate;
  selected?: ISODate[];
  onPick?: (date: ISODate) => void;
  size?: 'sm' | 'lg';
  showTitle?: boolean;
}) {
  const weeks = monthGrid(year, month);
  return (
    <div className={`cal cal--${size}`}>
      {showTitle && <div className="cal__title">{fmt.month(year, month)}</div>}
      <div className="cal__grid" role="grid" aria-label={fmt.month(year, month)}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="cal__dow" role="columnheader">
            {fmt.weekdayNarrow(d).slice(0, size === 'lg' ? 3 : 1)}
          </div>
        ))}
        {weeks.flat().map((date, k) => {
          if (!date) return <div key={k} className="cal__cell cal__cell--blank" />;
          const entry = availability[date];
          const past = date < today;
          const status = (past ? 'past' : (entry?.status ?? 'free')) as 'past' | 'free' | 'busy' | 'tentative';
          const cls = `cal__cell cal__cell--${status}${date === today ? ' is-today' : ''}${date === highlight ? ' is-highlight' : ''}${selected?.includes(date) ? ' is-selected' : ''}`;
          const label = `${fmt.long(date)} — ${past ? t('past') : status === 'free' ? t('free') : status === 'busy' ? t('busy') : t('pencilled')}${entry?.note ? `: ${entry.note}` : ''}`;
          const inner = (
            <>
              <span className="cal__num num">{Number(date.slice(8))}</span>
              {size === 'lg' && entry?.note && !past && <span className="cal__note">{entry.note}</span>}
            </>
          );
          return onPick && !past ? (
            <button key={k} type="button" className={cls} data-date={date} onClick={() => onPick(date)} aria-label={label} title={entry?.note} role="gridcell">
              {inner}
            </button>
          ) : (
            <div key={k} className={cls} aria-label={label} title={entry?.note} role="gridcell">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div className="cal-legend">
      <span><i className="cal-key cal-key--free" />{t('Free')}</span>
      <span><i className="cal-key cal-key--tentative" />{t('Pencilled')}</span>
      <span><i className="cal-key cal-key--busy" />{t('Busy')}</span>
    </div>
  );
}
