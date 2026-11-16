import type { ISODate, Musician, Opportunity, OpportunityType, ProgrammeItem, RepertoireItem } from '../types';
import { distanceKm } from '../geo';
import { instrumentName, normalise } from '../taxonomy';
import { availabilityOn, matchInstrument, repertoireWords } from './engine';
import type { QueryPlace } from './query';

/** Filters for the opportunity board, and "how well does this fit me". */

export interface OpportunityQuery {
  text: string;
  types: OpportunityType[];
  /** Instrument / voice ids; empty = any. */
  instruments: string[];
  place?: QueryPlace;
  radiusKm: number;
  /** Minimum stated fee in euros. */
  minFee?: number;
  /** Only postings with travel (or travel and accommodation) covered. */
  travelCovered: boolean;
  urgentOnly: boolean;
  sort: 'recent' | 'date' | 'fee' | 'distance';
}

export const EMPTY_OPPORTUNITY_QUERY: OpportunityQuery = {
  text: '',
  types: [],
  instruments: [],
  place: undefined,
  radiusKm: 100,
  minFee: undefined,
  travelCovered: false,
  urgentOnly: false,
  sort: 'recent',
};

export interface OpportunityFit {
  /** Whether the musician plays one of the instruments sought. */
  instrumentMatch: boolean;
  distanceKm: number;
  withinTravelRadius: boolean;
  /** Dates of the posting on which the musician is busy or tentative. */
  clashes: { date: ISODate; status: 'busy' | 'tentative' }[];
  /** Programme items the musician already has in repertoire. */
  known: { item: ProgrammeItem; repertoire: RepertoireItem }[];
}

/** First date that matters for sorting: the first performance, else the first date. */
export function keyDate(o: Opportunity): ISODate | undefined {
  const perf = o.dates.filter((d) => d.kind === 'performance' || d.kind === 'audition' || d.kind === 'start');
  const pool = perf.length ? perf : o.dates;
  return pool.map((d) => d.date).sort()[0];
}

/** Is this the same piece? Tolerant of catalogue numbers and subtitles. */
export function sameWork(a: ProgrammeItem, b: { composer: string; work: string }): boolean {
  const ca = normalise(a.composer);
  const cb = normalise(b.composer);
  if (!(ca === cb || ca.includes(cb) || cb.includes(ca))) return false;
  const strip = (s: string) => repertoireWords(s.replace(/\(.*?\)/g, ' ').replace(/[“”"«»]/g, ' '));
  const wa = strip(a.work);
  const wb = strip(b.work);
  if (!wa.length || !wb.length) return false;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const hits = short.filter((w) => long.includes(w)).length;
  // A lone generic word ("sonata", "requiem") is enough only when the titles are that short.
  return hits === short.length && (short.length >= 2 || long.length <= 3);
}

export function opportunityFit(o: Opportunity, m: Musician): OpportunityFit {
  const d = distanceKm(o.place, m.base);
  const clashes: OpportunityFit['clashes'] = [];
  for (const od of o.dates) {
    if (od.kind === 'start') continue;
    const a = availabilityOn(m, od.date);
    if (a !== 'free' && m.availability[od.date]?.opportunityId !== o.id) clashes.push({ date: od.date, status: a });
  }
  const known: OpportunityFit['known'] = [];
  for (const item of o.repertoire) {
    const rep = m.repertoire.find((r) => sameWork(item, r));
    if (rep) known.push({ item, repertoire: rep });
  }
  return {
    instrumentMatch: !o.instruments.length || !!matchInstrument(m, o.instruments, true),
    distanceKm: d,
    withinTravelRadius: m.travelsInternationally || d <= m.travelRadiusKm,
    clashes,
    known,
  };
}

export function filterOpportunities(list: Opportunity[], q: OpportunityQuery): Opportunity[] {
  const words = normalise(q.text).split(' ').filter(Boolean);
  const out = list.filter((o) => {
    if (q.types.length && !q.types.includes(o.type)) return false;
    if (q.urgentOnly && !o.urgent) return false;
    if (q.instruments.length && o.instruments.length && !o.instruments.some((i) => q.instruments.includes(i))) {
      return false;
    }
    if (q.place && distanceKm(q.place, o.place) > q.radiusKm) return false;
    if (q.minFee != null && (o.fee.max ?? o.fee.amount) < q.minFee) return false;
    if (q.travelCovered && o.travel === 'none') return false;
    if (words.length) {
      const hay = normalise(
        [
          o.title,
          o.description,
          o.roleLabel ?? '',
          o.place.name,
          o.place.venue ?? '',
          ...o.instruments.map(instrumentName),
          ...o.repertoire.map((r) => `${r.composer} ${r.work}`),
        ].join(' '),
      );
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const dist = (o: Opportunity) => (q.place ? distanceKm(q.place, o.place) : 0);
  const sorters: Record<OpportunityQuery['sort'], (a: Opportunity, b: Opportunity) => number> = {
    recent: (a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt),
    date: (a, b) => (keyDate(a) ?? '9999').localeCompare(keyDate(b) ?? '9999'),
    fee: (a, b) => (b.fee.max ?? b.fee.amount) - (a.fee.max ?? a.fee.amount),
    distance: (a, b) => dist(a) - dist(b),
  };
  return out.sort(sorters[q.sort]);
}
