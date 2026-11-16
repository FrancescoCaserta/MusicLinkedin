/**
 * Internationalisation, kept deliberately small.
 *
 * English strings in the source are the message ids (gettext style):
 *   t('Find musicians')
 *   t('{n} km away', { n: 37 })
 *   plural(count, '{n} musician', '{n} musicians')
 * To add a language, register a dictionary that maps each English string to
 * its translation (see locales/it.sample.ts) and call setLocale(). Dates,
 * numbers and money always go through Intl with the active locale.
 */

export type Vars = Record<string, string | number>;
export type Dictionary = Record<string, string>;

let locale = 'en-GB';
let dictionary: Dictionary = {};

export function setLocale(code: string, dict: Dictionary = {}): void {
  locale = code;
  dictionary = dict;
}

export function getLocale(): string {
  return locale;
}

function fill(s: string, vars?: Vars): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

export function t(source: string, vars?: Vars): string {
  return fill(dictionary[source] ?? source, vars);
}

export function plural(n: number, one: string, other: string, vars?: Vars): string {
  const rule = new Intl.PluralRules(locale).select(n);
  return t(rule === 'one' ? one : other, { n, ...vars });
}

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const fmt = {
  /** 14 Mar 2027 */
  date: (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parse(iso)),
  /** Sun 14 Mar */
  day: (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(iso)),
  /** Sunday 14 March 2027 */
  long: (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parse(iso)),
  /** 14 March */
  dayMonth: (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(parse(iso)),
  /** March 2027 */
  month: (year: number, month: number) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)),
  monthShort: (iso: string) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(parse(iso)),
  weekdayNarrow: (index: number) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
  time: (isoDateTime: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(isoDateTime)),
  money: (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
  number: (n: number) => new Intl.NumberFormat(locale).format(n),
  km: (n: number) => (n < 1 ? t('under 1 km') : t('{n} km', { n: new Intl.NumberFormat(locale).format(Math.round(n)) })),
  duration: (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`,
  /** "3 hours ago", "in 2 days" */
  ago: (isoDateTime: string, now = Date.now()) => {
    const diff = (new Date(isoDateTime).getTime() - now) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return t('just now');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
    return rtf.format(Math.round(diff / (86400 * 365)), 'year');
  },
  list: (items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') => new Intl.ListFormat(locale, { style: 'long', type }).format(items),
};
