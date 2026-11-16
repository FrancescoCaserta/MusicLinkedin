import type { MusicianQuery } from '../../domain/search/query';
import { instrumentName, roleLabel } from '../../domain/taxonomy';
import { fmt, t } from '../../i18n';

export interface QueryChip {
  key: string;
  label: string;
  /** Applying this patch removes the constraint. */
  clear: Partial<MusicianQuery>;
}

/** The active constraints of a search, in the order a hirer would say them. */
export function queryChips(q: MusicianQuery): QueryChip[] {
  const out: QueryChip[] = [];
  for (const id of q.instruments) out.push({ key: `i:${id}`, label: t(instrumentName(id)), clear: { instruments: q.instruments.filter((x) => x !== id) } });
  if (!q.includeSecondary && q.instruments.length) out.push({ key: 'primary', label: t('Main instrument only'), clear: { includeSecondary: true } });
  for (const r of q.roles) out.push({ key: `r:${r}`, label: t(roleLabel(r)), clear: { roles: q.roles.filter((x) => x !== r) } });
  if (q.place) out.push({ key: 'place', label: t('Within {km} of {place}', { km: fmt.km(q.radiusKm), place: q.place.name }), clear: { place: undefined } });
  if (q.date) {
    const label = q.dateTo ? t('Free {from} – {to}', { from: fmt.day(q.date), to: fmt.day(q.dateTo) }) : t('Free on {date}', { date: fmt.day(q.date) });
    out.push({ key: 'date', label, clear: { date: undefined, dateTo: undefined } });
  }
  if (q.budget != null) out.push({ key: 'budget', label: t('Budget {amount}', { amount: fmt.money(q.budget) }), clear: { budget: undefined } });
  if (q.repertoire.trim()) out.push({ key: 'rep', label: t('Has played: {work}', { work: q.repertoire.trim() }), clear: { repertoire: '' } });
  if (q.periodOnly) out.push({ key: 'period', label: t('Period instruments'), clear: { periodOnly: false } });
  if (q.urgentOnly) out.push({ key: 'urgent', label: t('Takes last-minute calls'), clear: { urgentOnly: false } });
  if (q.networkOnly) out.push({ key: 'network', label: t('In my network'), clear: { networkOnly: false } });
  if (q.invoiceOnly) out.push({ key: 'invoice', label: t('Can invoice'), clear: { invoiceOnly: false } });
  if (q.text.trim()) out.push({ key: 'text', label: t('Name or keyword: {text}', { text: q.text.trim() }), clear: { text: '' } });
  return out;
}

export function relaxationLabel(r: { kind: string; count: number; value?: number }, q: MusicianQuery): string {
  const n = r.count;
  switch (r.kind) {
    case 'radius':
      return n === 1 ? t('1 more within {km}', { km: fmt.km(r.value ?? 0) }) : t('{n} more within {km}', { n, km: fmt.km(r.value ?? 0) });
    case 'budget':
      return n === 1 ? t('1 more from {amount}', { amount: fmt.money(r.value ?? 0) }) : t('{n} more from {amount}', { n, amount: fmt.money(r.value ?? 0) });
    case 'date':
      return n === 1 ? t('1 is busy on {date} — search any date', { date: q.date ? fmt.dayMonth(q.date) : '' }) : t('{n} are busy on {date} — search any date', { n, date: q.date ? fmt.dayMonth(q.date) : '' });
    default:
      return n === 1 ? t('1 more without the repertoire filter') : t('{n} more without the repertoire filter', { n });
  }
}
