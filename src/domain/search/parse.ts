import type { ISODate, RoleId } from '../types';
import { ALL_WORKS, COMPOSER_TERMS } from '../catalogue';
import { CITY_TERMS } from '../cities';
import { addDays, isISODate, nextOccurrence, weekday, ymd } from '../dates';
import { INSTRUMENT_TERMS, normalise } from '../taxonomy';
import { DEFAULT_RADIUS_KM, type MusicianQuery } from './query';

/**
 * Turns a sentence such as
 *   "accordionist within 50 km of Bologna, free on 14 March, budget €250"
 * into structured filters. Rule-based and deterministic: every recognised
 * fragment is reported back so the UI can show exactly what was understood.
 */

export type UnderstoodKind =
  | 'instrument'
  | 'place'
  | 'date'
  | 'budget'
  | 'repertoire'
  | 'role'
  | 'flag'
  | 'text';

export interface ParsedQuery {
  patch: Partial<MusicianQuery>;
  /** Which kinds of constraint were recognised, in reading order of importance. */
  understood: UnderstoodKind[];
  /** Words that were not understood as a filter (treated as a name search). */
  leftover: string;
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, gennaio: 1,
  february: 2, feb: 2, febbraio: 2,
  march: 3, mar: 3, marzo: 3,
  april: 4, apr: 4, aprile: 4,
  may: 5, maggio: 5,
  june: 6, jun: 6, giugno: 6,
  july: 7, jul: 7, luglio: 7,
  august: 8, aug: 8, agosto: 8,
  september: 9, sep: 9, sept: 9, settembre: 9,
  october: 10, oct: 10, ottobre: 10,
  november: 11, nov: 11, novembre: 11,
  december: 12, dec: 12, dicembre: 12,
};
const MONTH_RE = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const WEEKDAYS: Record<string, number> = {
  monday: 0, lunedi: 0,
  tuesday: 1, martedi: 1,
  wednesday: 2, mercoledi: 2,
  thursday: 3, giovedi: 3,
  friday: 4, venerdi: 4,
  saturday: 5, sabato: 5,
  sunday: 6, domenica: 6,
};
const WEEKDAY_RE = Object.keys(WEEKDAYS).join('|');

const ROLE_WORDS: [RegExp, RoleId][] = [
  [/\bsoloists?\b|\bsolista\b/, 'soloist'],
  [/\b(basso )?continuo( players?)?\b/, 'continuo'],
  [/\baccompanists?\b|\brepetiteurs?\b|\bcollaborative pianists?\b/, 'accompanist'],
  [/\bteachers?\b|\btutors?\b|\binsegnante\b/, 'teacher'],
  [/\bconductors?\b|\bdirettore\b/, 'conductor'],
  [/\bcomposers?\b|\bcompositore\b/, 'composer'],
  [/\borchestral( players?| musicians?)?\b/, 'orchestral'],
  [/\bchamber (musicians?|players?)\b/, 'chamber'],
];

/** Composer surnames that are also common first names or words: need a work to count. */
const AMBIGUOUS_COMPOSERS = new Set(
  ['David', 'Martin', 'Abel', 'Arnold', 'Carter', 'Clarke', 'Cage', 'Reich', 'Angelis', 'Plog', 'Ewald', 'Sor', 'Rota', 'Berg', 'Wolf', 'Weiss', 'Tosti', 'Barber', 'Glass', 'Weber', 'Franck', 'Adès', 'Castello', 'Fontana', 'Marcello', 'Bellini', 'Gregson', 'Marais'],
);

const STOPWORDS = new Set(
  `a an the who is are be free available availability on for with within of near in and or has have had
   played plays play knows know looking need needs needed wanted want find me i we to that which can
   budget euro euros eur max maximum up under below km from around at by musician musicians player
   players singer singers someone somebody anyone per day date fee about approximately close reach
   already performed perform it this next my our us please
   il lo la le un una uno libero libera disponibile entro vicino di da con cerco cerchiamo che ha per`
    .split(/\s+/)
    .filter(Boolean),
);

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Finds `term` as whole words; returns the match index or -1. */
function findWords(text: string, term: string): number {
  const m = new RegExp(`(^|[^a-z0-9])${esc(term)}(?=$|[^a-z0-9])`).exec(text);
  return m ? m.index + m[1].length : -1;
}

function resolveYear(year: string | undefined, month: number, day: number, today: ISODate): ISODate | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  let iso: ISODate;
  if (year) {
    const y = year.length === 2 ? 2000 + Number(year) : Number(year);
    iso = ymd(y, month, day);
  } else {
    iso = nextOccurrence(month, day, today);
  }
  return isISODate(iso) ? iso : undefined;
}

export function parseQuery(input: string, today: ISODate): ParsedQuery {
  const patch: Partial<MusicianQuery> = {};
  const understood: UnderstoodKind[] = [];
  let text = ` ${normalise(input)} `;

  /** Replace a recognised span with a separator so it is not matched twice. */
  const consume = (re: RegExp, onMatch: (m: RegExpExecArray) => boolean | void): boolean => {
    const m = re.exec(text);
    if (!m) return false;
    if (onMatch(m) === false) return false;
    text = `${text.slice(0, m.index)} | ${text.slice(m.index + m[0].length)}`;
    return true;
  };

  // ── Budget ──────────────────────────────────────────────────────────────
  const setBudget = (m: RegExpExecArray) => {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return false;
    patch.budget = n;
    understood.push('budget');
  };
  consume(/\b(?:budget|max(?:imum)?|up to|under|below|fino a|entro)\s*(?:of\s*)?(?:is\s*)?€?\s*(\d{2,5})(?!\s*km)\s*(?:€|euros?\b|eur\b)?/, setBudget) ||
    consume(/€\s*(\d{2,5})\b/, setBudget) ||
    consume(/\b(\d{2,5})\s*(?:€|euros?\b|eur\b)/, setBudget);

  // ── Radius ──────────────────────────────────────────────────────────────
  let radius: number | undefined;
  consume(/\b(?:within|entro|raggio di)?\s*(\d{1,4})\s*km\b/, (m) => {
    radius = Math.max(1, Math.min(3000, Number(m[1])));
  });

  // ── Dates ───────────────────────────────────────────────────────────────
  const setDate = (from: ISODate | undefined, to?: ISODate) => {
    if (!from) return false;
    patch.date = from;
    if (to && to > from) patch.dateTo = to;
    understood.push('date');
  };
  const dateFound =
    consume(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => setDate(isISODate(m[0]) ? m[0] : undefined)) ||
    consume(
      new RegExp(
        `\\b(\\d{1,2})(?:\\s*-\\s*|\\s+(?:to|and|al|e)\\s+|\\s+)(\\d{1,2})\\s+(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`,
      ),
      (m) => {
        const month = MONTHS[m[3]];
        const from = resolveYear(m[4], month, Number(m[1]), today);
        if (!from) return false;
        return setDate(from, ymd(Number(from.slice(0, 4)), month, Number(m[2])));
      },
    ) ||
    consume(
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`),
      (m) => setDate(resolveYear(m[3], MONTHS[m[2]], Number(m[1]), today)),
    ) ||
    consume(
      new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`),
      (m) => setDate(resolveYear(m[3], MONTHS[m[1]], Number(m[2]), today)),
    ) ||
    consume(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/, (m) =>
      setDate(resolveYear(m[3], Number(m[2]), Number(m[1]), today)),
    ) ||
    consume(/\b(?:day after tomorrow|dopodomani)\b/, () => setDate(addDays(today, 2))) ||
    consume(/\b(?:tomorrow|domani)\b/, () => setDate(addDays(today, 1))) ||
    consume(/\b(?:today|tonight|this evening|oggi|stasera)\b/, (m) => {
      if (/tonight|evening|stasera/.test(m[0])) patch.urgentOnly = true;
      return setDate(today);
    }) ||
    consume(new RegExp(`\\b(?:(next|this)\\s+)?(${WEEKDAY_RE})\\b`), (m) => {
      const target = WEEKDAYS[m[2]];
      let delta = (target - weekday(today) + 7) % 7;
      if (delta === 0 && m[1] !== 'this') delta = 7;
      return setDate(addDays(today, delta));
    });
  void dateFound;

  // ── Flags ───────────────────────────────────────────────────────────────
  if (consume(/\b(?:urgent(?:ly)?|last[- ]minute|short notice|asap|urgente)\b/, () => {})) {
    patch.urgentOnly = true;
  }
  if (patch.urgentOnly) understood.push('flag');
  if (
    consume(/\b(?:on )?period instruments?\b|\bhistorically informed\b|\bhip\b|\ba\s*=?\s*415\b|\b415\s*hz\b/, () => {})
  ) {
    patch.periodOnly = true;
    understood.push('flag');
  }
  if (consume(/\b(?:in )?my (?:network|connections)\b|\bpeople i know\b/, () => {})) {
    patch.networkOnly = true;
    understood.push('flag');
  }

  // ── Instruments and voices (longest phrase first) ───────────────────────
  const instruments: string[] = [];
  for (const { term, instrumentId } of INSTRUMENT_TERMS) {
    for (;;) {
      const at = findWords(text, term);
      if (at < 0) break;
      text = `${text.slice(0, at)} | ${text.slice(at + term.length)}`;
      if (!instruments.includes(instrumentId)) instruments.push(instrumentId);
    }
  }
  if (instruments.length) {
    patch.instruments = instruments;
    understood.unshift('instrument');
  }

  // ── Place ───────────────────────────────────────────────────────────────
  for (const { term, city } of CITY_TERMS) {
    const at = findWords(text, term);
    if (at < 0) continue;
    const before = text.slice(0, at);
    const exact = /\b(?:in|a)\s*$/.test(before) && radius == null;
    text = `${before.replace(/\b(?:near|in|around|at|from|of|a|da|di|vicino a|close to)\s*$/, '')} | ${text.slice(at + term.length)}`;
    patch.place = { name: city.name, lat: city.lat, lng: city.lng, cityId: city.id };
    patch.radiusKm = radius ?? (exact ? 25 : DEFAULT_RADIUS_KM);
    understood.push('place');
    break;
  }

  // ── Roles ───────────────────────────────────────────────────────────────
  const roles: RoleId[] = [];
  for (const [re, id] of ROLE_WORDS) {
    if (consume(re, () => {})) roles.push(id);
  }
  if (roles.length) {
    patch.roles = roles;
    understood.push('role');
  }

  // ── Repertoire: a composer, optionally followed by a work ───────────────
  let repertoire = '';
  for (const { term, composer } of COMPOSER_TERMS) {
    const at = findWords(text, term);
    if (at < 0) continue;
    // Words directly after the composer, up to the next recognised fragment.
    const after = text.slice(at + term.length).split('|')[0];
    const words = after
      .replace(/[,']/g, ' ')
      .split(' ')
      .filter((w) => w && !STOPWORDS.has(w));
    const works = ALL_WORKS.filter((w) => w.composer === composer).map((w) => normalise(w.work));
    let taken = 0;
    for (let n = Math.min(words.length, 6); n > 0; n--) {
      const probe = words.slice(0, n);
      if (works.some((w) => probe.every((p) => w.includes(p)))) {
        taken = n;
        break;
      }
    }
    if (!taken && AMBIGUOUS_COMPOSERS.has(composer)) continue;
    const workText = words.slice(0, taken).join(' ');
    repertoire = workText ? `${composer} ${workText}` : composer;
    let rest = text.slice(at + term.length);
    for (const w of words.slice(0, taken)) rest = rest.replace(new RegExp(`(^|[^a-z0-9])${esc(w)}(?=$|[^a-z0-9])`), '$1');
    text = `${text.slice(0, at)} | ${rest}`;
    break;
  }
  if (!repertoire) {
    // A well-known title on its own: "Messiah", "Winterreise", "quattro stagioni".
    const phrase = text
      .split('|')
      .map((seg) =>
        seg
          .replace(/[,']/g, ' ')
          .split(' ')
          .filter((w) => w && !STOPWORDS.has(w))
          .join(' '),
      )
      .find((seg) => seg.length >= 5);
    if (phrase) {
      const hit = ALL_WORKS.some((w) => findWords(normalise(w.work), phrase) >= 0);
      if (hit) {
        repertoire = phrase;
        for (const w of phrase.split(' ')) text = text.replace(new RegExp(`(^|[^a-z0-9])${esc(w)}(?=$|[^a-z0-9])`), '$1');
      }
    }
  }
  if (repertoire) {
    patch.repertoire = repertoire;
    understood.push('repertoire');
  }

  // ── Whatever is left is a name / keyword search ─────────────────────────
  const leftover = text
    .replace(/[|,]/g, ' ')
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w) && w !== '€' && w !== '-')
    .join(' ')
    .trim();
  if (leftover) {
    patch.text = leftover;
    understood.push('text');
  }

  return { patch, understood: [...new Set(understood)], leftover };
}
