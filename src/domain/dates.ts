import type { ISODate } from './types';

/** Calendar-day helpers on 'YYYY-MM-DD' strings — no time zones involved. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(fromISODate(s)) === s;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const d = fromISODate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86400000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(iso: ISODate): number {
  return (fromISODate(iso).getDay() + 6) % 7;
}

export function ymd(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The next occurrence of a month/day on or after `from`. */
export function nextOccurrence(month: number, day: number, from: ISODate): ISODate {
  const y = Number(from.slice(0, 4));
  const thisYear = ymd(y, month, day);
  return thisYear >= from ? thisYear : ymd(y + 1, month, day);
}

export function datesBetween(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to && out.length < 370; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Month grid (weeks starting Monday) for a calendar view. */
export function monthGrid(year: number, month: number): (ISODate | null)[][] {
  const first = ymd(year, month, 1);
  const offset = weekday(first);
  const days = new Date(year, month, 0).getDate();
  const cells: (ISODate | null)[] = [];
  for (let k = 0; k < offset; k++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(ymd(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let k = 0; k < cells.length; k += 7) weeks.push(cells.slice(k, k + 7));
  return weeks;
}
