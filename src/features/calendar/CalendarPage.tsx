import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useViewer } from '../../app/session';
import { api } from '../../data/client';
import { useApiMutation } from '../../data/hooks';
import { addMonths, datesBetween, today } from '../../domain/dates';
import type { ISODate } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { EmptyState, Field, SkeletonList } from '../../ui/basics';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';

/** The musician's availability: tap days, then say what they are. */
export function CalendarPage() {
  const viewer = useViewer();
  const m = viewer.musician;
  const now = today();
  const [cursor, setCursor] = useState(now.slice(0, 7) + '-01');
  const [selected, setSelected] = useState<ISODate[]>([]);
  const [note, setNote] = useState('');
  const save = useApiMutation((status: 'free' | 'busy' | 'tentative') => api.setAvailability(viewer.id, selected, status, note), {
    success: (_r, status) => (status === 'free' ? plural(selected.length, '{n} day marked free.', '{n} days marked free.') : status === 'busy' ? plural(selected.length, '{n} day marked busy.', '{n} days marked busy.') : plural(selected.length, '{n} day pencilled.', '{n} days pencilled.')),
    onDone: () => {
      setSelected([]);
      setNote('');
    },
  });

  if (viewer.account && !m) {
    return (
      <div className="wrap wrap--narrow page">
        <EmptyState title={t('No calendar for this account')} text={t('Availability belongs to a musician profile. Switch to a musician persona to manage a calendar.')} action={<Link to="/demo" className="btn btn--primary btn--sm">{t('Choose a persona')}</Link>} />
      </div>
    );
  }
  if (!m) return <div className="wrap page"><SkeletonList rows={2} height={280} /></div>;

  const toggle = (d: ISODate, shift = false) => {
    setSelected((sel) => {
      if (shift && sel.length) {
        const last = sel[sel.length - 1];
        const range = datesBetween(last < d ? last : d, last < d ? d : last);
        return [...new Set([...sel, ...range])];
      }
      return sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d];
    });
  };
  const months = [cursor, addMonths(cursor, 1)];
  const upcoming = Object.entries(m.availability)
    .filter(([d]) => d >= now)
    .sort(([a], [b]) => a.localeCompare(b));
  // Group consecutive days with the same note into one line.
  const blocks: { from: ISODate; to: ISODate; status: string; note?: string; engagement: boolean }[] = [];
  for (const [d, e] of upcoming) {
    const last = blocks[blocks.length - 1];
    if (last && last.status === e.status && last.note === e.note && datesBetween(last.to, d).length === 2) last.to = d;
    else blocks.push({ from: d, to: d, status: e.status, note: e.note, engagement: !!e.opportunityId });
  }

  return (
    <div className="wrap page">
      <div className="page__head">
        <div>
          <div className="label">{t('My calendar')}</div>
          <h1 className="h-page">{t('When are you free?')}</h1>
          <p className="page__sub">{t('Hirers search by date. Select days, then mark them busy, pencilled or free. Engagements you confirm on Leggio are added for you.')}</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn--ghost btn--icon" disabled={cursor <= now.slice(0, 7) + '-01'} onClick={() => setCursor(addMonths(cursor, -1))} aria-label={t('Previous month')}><ChevronLeft size={18} aria-hidden /></button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCursor(now.slice(0, 7) + '-01')}>{t('Today')}</button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label={t('Next month')}><ChevronRight size={18} aria-hidden /></button>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="calpage__months" onClickCapture={(e) => {
            // Shift-click extends the selection to a range.
            const cell = (e.target as HTMLElement).closest<HTMLElement>('button.cal__cell');
            if (cell && e.shiftKey && cell.dataset.date) {
              e.stopPropagation();
              toggle(cell.dataset.date, true);
            }
          }}>
            {months.map((c) => {
              const [y, mo] = c.split('-').map(Number);
              return <MonthCalendar key={c} year={y} month={mo} availability={m.availability} today={now} selected={selected} onPick={(d) => toggle(d)} size="lg" />;
            })}
          </div>
          <div className="row row--between row--wrap" style={{ marginTop: 16 }}>
            <CalendarLegend />
            <span className="tiny muted">{t('Tip: select several days to change them together.')}</span>
          </div>
        </div>

        <aside className="stack stack--lg">
          <section className={`card card--pad calpage__panel${selected.length ? ' is-active' : ''}`}>
            <div className="label">{selected.length ? plural(selected.length, '{n} day selected', '{n} days selected') : t('Nothing selected')}</div>
            {selected.length ? (
              <>
                <p className="small soft" style={{ margin: '6px 0 14px' }}>{[...selected].sort().slice(0, 4).map((d) => fmt.day(d)).join(' · ')}{selected.length > 4 ? ` +${selected.length - 4}` : ''}</p>
                <Field label={t('Note (only you see the detail)')}>
                  <input className="input input--sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. Opera run, teaching, holiday')} />
                </Field>
                <div className="stack stack--sm" style={{ marginTop: 14 }}>
                  <button type="button" className="btn btn--primary btn--block" disabled={save.isPending} onClick={() => save.mutate('busy')}>{t('Mark busy')}</button>
                  <button type="button" className="btn btn--ghost btn--block" disabled={save.isPending} onClick={() => save.mutate('tentative')}>{t('Pencil in (not confirmed)')}</button>
                  <button type="button" className="btn btn--ghost btn--block" disabled={save.isPending} onClick={() => save.mutate('free')}>{t('Mark free')}</button>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSelected([])}>{t('Clear selection')}</button>
                </div>
              </>
            ) : (
              <p className="small soft" style={{ marginTop: 6 }}>{t('Tap one or more days in the calendar to change them.')}</p>
            )}
          </section>
          <section>
            <div className="label" style={{ marginBottom: 10 }}>{t('Coming up')}</div>
            {blocks.length === 0 ? (
              <p className="small muted">{t('Your calendar is completely free.')}</p>
            ) : (
              <ul className="stack stack--sm">
                {blocks.slice(0, 12).map((b) => (
                  <li key={b.from} className="icon-line">
                    <span className={`dot ${b.status === 'busy' ? 'dot--busy' : 'dot--warn'}`} style={{ marginTop: 6 }} />
                    <span>
                      <b className="num">{b.from === b.to ? fmt.day(b.from) : `${fmt.day(b.from)} – ${fmt.day(b.to)}`}</b>
                      <span className="soft"> · {b.note ?? (b.status === 'busy' ? t('Busy') : t('Pencilled'))}</span>
                      {b.engagement && <span className="tag tag--ok" style={{ marginLeft: 6 }}>{t('confirmed on Leggio')}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
