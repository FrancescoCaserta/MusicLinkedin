import type { ID, ISODate, InstrumentLevel, Musician, RepertoireItem } from '../types';
import { datesBetween, diffDays } from '../dates';
import { distanceKm, RADIUS_STEPS } from '../geo';
import { instrument, instrumentName, normalise } from '../taxonomy';
import type { MusicianQuery } from './query';

/**
 * The musician search engine: pure functions over plain data.
 * `searchMusicians` filters, explains and ranks; when few people match it
 * also reports "near misses" — what would match if one constraint moved.
 */

export type Availability = 'free' | 'tentative' | 'busy';
export type FeeFit = 'comfortable' | 'within' | 'over';

export interface NetworkInfo {
  connected: boolean;
  /** Concerts the viewer and this musician both played. */
  sharedConcerts: number;
  /** People connected to both. */
  mutuals: number;
}

export interface SearchContext {
  musicians: Musician[];
  today: ISODate;
  network?: Map<ID, NetworkInfo>;
  endorsements?: Map<ID, number>;
  /** Musician to leave out (the person searching). */
  excludeId?: ID;
}

export interface MusicianMatch {
  musician: Musician;
  score: number;
  distanceKm?: number;
  /** Whether the searched place is inside the musician's own travel radius. */
  withinTravelRadius?: boolean;
  instrumentMatch?: { instrumentId: string; level: InstrumentLevel };
  availability?: Availability;
  feeFit?: FeeFit;
  /** Repertoire entries matching the repertoire filter, best first. */
  repertoire: RepertoireItem[];
  network?: NetworkInfo;
  endorsements: number;
}

export type Constraint = 'text' | 'instrument' | 'role' | 'radius' | 'date' | 'budget' | 'repertoire' | 'flags';

export interface Relaxation {
  kind: 'radius' | 'date' | 'budget' | 'repertoire';
  /** How many more musicians would match. */
  count: number;
  /** The change to apply to the query. */
  patch: Partial<MusicianQuery>;
  /** Value for the label: new radius in km, or new budget in euros. */
  value?: number;
}

export interface SearchResult {
  matches: MusicianMatch[];
  relaxations: Relaxation[];
  /** How many musicians satisfied everything except availability on the date. */
  total: number;
}

// ── Building blocks ──────────────────────────────────────────────────────

export function availabilityOn(m: Pick<Musician, 'availability'>, from: ISODate, to?: ISODate): Availability {
  let worst: Availability = 'free';
  for (const d of to && to > from ? datesBetween(from, to) : [from]) {
    const e = m.availability[d];
    if (!e) continue;
    if (e.status === 'busy') return 'busy';
    worst = 'tentative';
  }
  return worst;
}

const LEVEL_RANK: Record<InstrumentLevel, number> = { primary: 0, period: 1, secondary: 2, doubling: 3 };

export function matchInstrument(
  m: Pick<Musician, 'instruments'>,
  wanted: string[],
  includeSecondary: boolean,
): { instrumentId: string; level: InstrumentLevel } | undefined {
  let best: { instrumentId: string; level: InstrumentLevel } | undefined;
  for (const p of m.instruments) {
    if (!wanted.includes(p.instrumentId)) continue;
    if (!includeSecondary && p.level !== 'primary') continue;
    if (!best || LEVEL_RANK[p.level] < LEVEL_RANK[best.level]) best = { instrumentId: p.instrumentId, level: p.level };
  }
  return best;
}

const SPELLINGS: Record<string, string> = {
  cajkovskij: 'tchaikovsky',
  ciaikovskij: 'tchaikovsky',
  tschaikowsky: 'tchaikovsky',
  rachmaninoff: 'rachmaninov',
  sostakovic: 'shostakovich',
  schostakowitsch: 'shostakovich',
  haendel: 'handel',
  schonberg: 'schoenberg',
  matthew: 'matthaus',
  john: 'johannes',
  four: 'quattro',
  seasons: 'stagioni',
};

const REP_STOP = new Set(['the', 'in', 'of', 'for', 'and', 'by', 'no', 'no.', 'di', 'il', 'la', 'le', 'a', 'st', 'st.']);

/** Query words for repertoire matching: normalised, without filler words. */
export function repertoireWords(text: string): string[] {
  return normalise(text)
    .replace(/[./]/g, ' ')
    .split(' ')
    .filter((w) => w && !REP_STOP.has(w));
}

const STATUS_RANK = { ready: 0, performed: 1, learning: 2 } as const;

export function matchRepertoire(m: Pick<Musician, 'repertoire'>, text: string): RepertoireItem[] {
  const words = repertoireWords(text);
  if (!words.length) return [];
  return m.repertoire
    .filter((r) => {
      const hay = ` ${normalise(`${r.composer} ${r.work} ${r.part ?? ''}`).replace(/[./]/g, ' ')} `;
      return words.every((w) => {
        if (/^\d+$/.test(w)) return hay.includes(` ${w} `);
        const variant = SPELLINGS[w];
        return hay.includes(w) || (!!variant && hay.includes(variant));
      });
    })
    .sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.lastPerformed ?? 0) - (a.lastPerformed ?? 0),
    );
}

function matchText(m: Musician, text: string): boolean {
  const words = normalise(text).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = normalise(
    [
      m.name,
      m.headline,
      m.base.name,
      m.voiceDescription ?? '',
      ...m.instruments.map((p) => instrumentName(p.instrumentId)),
      ...m.positions.map((p) => p.organisation),
    ].join(' '),
  );
  return words.every((w) => hay.includes(w));
}

function playsPeriod(m: Musician): boolean {
  return m.instruments.some((p) => p.level === 'period' || instrument(p.instrumentId)?.family === 'early');
}

// ── Evaluation ───────────────────────────────────────────────────────────

interface Evaluation {
  match: MusicianMatch;
  failed: Constraint[];
}

function evaluate(m: Musician, q: MusicianQuery, ctx: SearchContext): Evaluation {
  const failed: Constraint[] = [];
  const match: MusicianMatch = {
    musician: m,
    score: 40,
    repertoire: [],
    network: ctx.network?.get(m.id),
    endorsements: ctx.endorsements?.get(m.id) ?? 0,
  };

  if (!matchText(m, q.text)) failed.push('text');

  if (q.instruments.length) {
    match.instrumentMatch = matchInstrument(m, q.instruments, q.includeSecondary);
    if (!match.instrumentMatch) failed.push('instrument');
    else match.score += { primary: 20, period: 14, secondary: 11, doubling: 7 }[match.instrumentMatch.level];
  }

  if (q.roles.length && !q.roles.some((r) => m.roles.includes(r))) failed.push('role');

  if (q.place) {
    const d = distanceKm(q.place, m.base);
    match.distanceKm = d;
    match.withinTravelRadius = m.travelsInternationally || d <= m.travelRadiusKm;
    if (d > q.radiusKm) failed.push('radius');
    else match.score += 14 * (1 - d / Math.max(q.radiusKm, 1));
    match.score += match.withinTravelRadius ? 5 : -6;
  }

  if (q.date) {
    match.availability = availabilityOn(m, q.date, q.dateTo);
    if (match.availability === 'busy') failed.push('date');
    else match.score += match.availability === 'free' ? 12 : 3;
    if (m.practical.urgentCalls && diffDays(q.date, ctx.today) <= 3) match.score += 5;
  }

  if (q.budget != null) {
    match.feeFit = q.budget >= m.fee.max ? 'comfortable' : q.budget >= m.fee.min ? 'within' : 'over';
    if (match.feeFit === 'over') failed.push('budget');
    else match.score += match.feeFit === 'comfortable' ? 8 : 5;
  }

  if (q.repertoire.trim()) {
    match.repertoire = matchRepertoire(m, q.repertoire);
    if (!match.repertoire.length) failed.push('repertoire');
    else {
      match.score += { ready: 14, performed: 8, learning: 3 }[match.repertoire[0].status];
      match.score += Math.min(3, match.repertoire.length - 1);
    }
  }

  if (
    (q.periodOnly && !playsPeriod(m)) ||
    (q.urgentOnly && !m.practical.urgentCalls) ||
    (q.invoiceOnly && !m.practical.canInvoice) ||
    (q.networkOnly && !match.network?.connected)
  ) {
    failed.push('flags');
  }

  if (match.network) {
    if (match.network.connected) match.score += 6;
    match.score += Math.min(6, 2 * match.network.sharedConcerts);
    match.score += Math.min(2, match.network.mutuals * 0.5);
  }
  match.score += Math.min(6, match.endorsements);
  if (m.recordings.length) match.score += 1;

  match.score = Math.round(match.score * 10) / 10;
  return { match, failed };
}

function sortMatches(matches: MusicianMatch[], q: MusicianQuery): MusicianMatch[] {
  const byName = (a: MusicianMatch, b: MusicianMatch) => a.musician.lastName.localeCompare(b.musician.lastName);
  const cmp: Record<MusicianQuery['sort'], (a: MusicianMatch, b: MusicianMatch) => number> = {
    best: (a, b) => b.score - a.score || (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || byName(a, b),
    distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || b.score - a.score,
    fee: (a, b) => a.musician.fee.min - b.musician.fee.min || b.score - a.score,
    endorsements: (a, b) => b.endorsements - a.endorsements || b.score - a.score,
  };
  return [...matches].sort(cmp[q.sort]);
}

// ── Near misses ──────────────────────────────────────────────────────────

/** Only suggest alternatives when the shortlist is thin. */
const RELAX_BELOW = 6;

function relaxations(evals: Evaluation[], q: MusicianQuery, matched: number): Relaxation[] {
  if (matched >= RELAX_BELOW) return [];
  const only = (c: Constraint) => evals.filter((e) => e.failed.length === 1 && e.failed[0] === c);
  const out: Relaxation[] = [];

  const far = only('radius');
  if (far.length && q.place) {
    const nearest = Math.min(...far.map((e) => e.match.distanceKm ?? Infinity));
    const step = RADIUS_STEPS.find((r) => r >= nearest && r > q.radiusKm) ?? Math.ceil(nearest / 100) * 100;
    const count = far.filter((e) => (e.match.distanceKm ?? Infinity) <= step).length;
    out.push({ kind: 'radius', count, value: step, patch: { radiusKm: step } });
  }

  const dear = only('budget');
  if (dear.length && q.budget != null) {
    const cheapest = Math.min(...dear.map((e) => e.match.musician.fee.min));
    const budget = Math.ceil(cheapest / 10) * 10;
    const count = dear.filter((e) => e.match.musician.fee.min <= budget).length;
    out.push({ kind: 'budget', count, value: budget, patch: { budget } });
  }

  const busy = only('date');
  if (busy.length) out.push({ kind: 'date', count: busy.length, patch: { date: undefined, dateTo: undefined } });

  const noRep = only('repertoire');
  if (noRep.length) out.push({ kind: 'repertoire', count: noRep.length, patch: { repertoire: '' } });

  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function searchMusicians(q: MusicianQuery, ctx: SearchContext): SearchResult {
  const evals = ctx.musicians.filter((m) => m.id !== ctx.excludeId).map((m) => evaluate(m, q, ctx));
  const matches = sortMatches(
    evals.filter((e) => !e.failed.length).map((e) => e.match),
    q,
  );
  return {
    matches,
    relaxations: relaxations(evals, q, matches.length),
    total: matches.length,
  };
}
