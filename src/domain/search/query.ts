import type { ISODate, RoleId } from '../types';
import { cityById, findCity, placeOf } from '../cities';
import { isISODate } from '../dates';
import { instrument, ROLES } from '../taxonomy';

export type SortKey = 'best' | 'distance' | 'fee' | 'endorsements';

export interface QueryPlace {
  name: string;
  lat: number;
  lng: number;
  cityId?: string;
}

/** Everything a hirer can ask of the musician search. */
export interface MusicianQuery {
  /** Free text: a name or keyword. */
  text: string;
  /** Instrument / voice ids; a musician matches if they play any of them. */
  instruments: string[];
  /** When false, only musicians whose primary instrument matches. */
  includeSecondary: boolean;
  roles: RoleId[];
  place?: QueryPlace;
  radiusKm: number;
  date?: ISODate;
  dateTo?: ISODate;
  /** Total budget for the engagement, in euros. */
  budget?: number;
  /** Composer and/or work the musician should already have played. */
  repertoire: string;
  periodOnly: boolean;
  urgentOnly: boolean;
  networkOnly: boolean;
  invoiceOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_RADIUS_KM = 50;

export const EMPTY_QUERY: MusicianQuery = {
  text: '',
  instruments: [],
  includeSecondary: true,
  roles: [],
  place: undefined,
  radiusKm: DEFAULT_RADIUS_KM,
  date: undefined,
  dateTo: undefined,
  budget: undefined,
  repertoire: '',
  periodOnly: false,
  urgentOnly: false,
  networkOnly: false,
  invoiceOnly: false,
  sort: 'best',
};

export function isEmptyQuery(q: MusicianQuery): boolean {
  return (
    !q.text.trim() &&
    !q.instruments.length &&
    !q.roles.length &&
    !q.place &&
    !q.date &&
    q.budget == null &&
    !q.repertoire.trim() &&
    !q.periodOnly &&
    !q.urgentOnly &&
    !q.networkOnly &&
    !q.invoiceOnly
  );
}

/** Number of active constraints — shown on the mobile "Filters" button. */
export function countFilters(q: MusicianQuery): number {
  return (
    (q.text.trim() ? 1 : 0) +
    (q.instruments.length ? 1 : 0) +
    (q.roles.length ? 1 : 0) +
    (q.place ? 1 : 0) +
    (q.date ? 1 : 0) +
    (q.budget != null ? 1 : 0) +
    (q.repertoire.trim() ? 1 : 0) +
    (q.periodOnly ? 1 : 0) +
    (q.urgentOnly ? 1 : 0) +
    (q.networkOnly ? 1 : 0) +
    (q.invoiceOnly ? 1 : 0)
  );
}

// ── URL codec: a search is a shareable link ───────────────────────────────

const ROLE_IDS = new Set(ROLES.map((r) => r.id));
const SORTS: SortKey[] = ['best', 'distance', 'fee', 'endorsements'];

export function queryToParams(q: MusicianQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.text.trim()) p.set('q', q.text.trim());
  if (q.instruments.length) p.set('i', q.instruments.join(','));
  if (!q.includeSecondary) p.set('primary', '1');
  if (q.roles.length) p.set('role', q.roles.join(','));
  if (q.place) {
    if (q.place.cityId) p.set('near', q.place.cityId);
    else p.set('near', `${q.place.lat.toFixed(4)},${q.place.lng.toFixed(4)},${q.place.name}`);
    p.set('r', String(q.radiusKm));
  }
  if (q.date) p.set('d', q.date);
  if (q.date && q.dateTo && q.dateTo > q.date) p.set('to', q.dateTo);
  if (q.budget != null) p.set('b', String(q.budget));
  if (q.repertoire.trim()) p.set('rep', q.repertoire.trim());
  if (q.periodOnly) p.set('period', '1');
  if (q.urgentOnly) p.set('urgent', '1');
  if (q.networkOnly) p.set('network', '1');
  if (q.invoiceOnly) p.set('invoice', '1');
  if (q.sort !== 'best') p.set('sort', q.sort);
  return p;
}

export function paramsToQuery(p: URLSearchParams): MusicianQuery {
  const q: MusicianQuery = { ...EMPTY_QUERY };
  q.text = p.get('q') ?? '';
  q.instruments = (p.get('i') ?? '').split(',').filter((id) => !!instrument(id));
  q.includeSecondary = p.get('primary') !== '1';
  q.roles = (p.get('role') ?? '').split(',').filter((r): r is RoleId => ROLE_IDS.has(r as RoleId));
  const near = p.get('near');
  if (near) {
    const city = cityById(near) ?? findCity(near);
    if (city) {
      const pl = placeOf(city);
      q.place = { name: pl.name, lat: pl.lat, lng: pl.lng, cityId: pl.cityId };
    } else {
      const [lat, lng, ...rest] = near.split(',');
      if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && rest.length) {
        q.place = { name: rest.join(','), lat: Number(lat), lng: Number(lng) };
      }
    }
    const r = Number(p.get('r'));
    q.radiusKm = Number.isFinite(r) && r > 0 ? Math.min(r, 3000) : DEFAULT_RADIUS_KM;
  }
  const d = p.get('d');
  if (d && isISODate(d)) q.date = d;
  const to = p.get('to');
  if (q.date && to && isISODate(to) && to > q.date) q.dateTo = to;
  const b = Number(p.get('b'));
  if (p.get('b') && Number.isFinite(b) && b > 0) q.budget = b;
  q.repertoire = p.get('rep') ?? '';
  q.periodOnly = p.get('period') === '1';
  q.urgentOnly = p.get('urgent') === '1';
  q.networkOnly = p.get('network') === '1';
  q.invoiceOnly = p.get('invoice') === '1';
  const sort = p.get('sort') as SortKey | null;
  q.sort = sort && SORTS.includes(sort) ? sort : 'best';
  return q;
}
