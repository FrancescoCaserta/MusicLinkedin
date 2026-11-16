import { describe, expect, it } from 'vitest';
import { findCity, searchCities } from '../src/domain/cities';
import { addDays, addMonths, diffDays, isISODate, monthGrid, nextOccurrence, weekday } from '../src/domain/dates';
import { distanceKm, nextRadius } from '../src/domain/geo';

describe('geo', () => {
  const city = (n: string) => findCity(n)!;

  it('measures real distances between cities', () => {
    expect(distanceKm(city('Bologna'), city('Modena'))).toBeGreaterThan(34);
    expect(distanceKm(city('Bologna'), city('Modena'))).toBeLessThan(40);
    expect(distanceKm(city('Bologna'), city('Firenze'))).toBeGreaterThan(75);
    expect(distanceKm(city('Bologna'), city('Firenze'))).toBeLessThan(90);
    expect(Math.round(distanceKm(city('Milano'), city('Roma')))).toBeGreaterThan(460);
    expect(Math.round(distanceKm(city('Milano'), city('Roma')))).toBeLessThan(490);
    expect(distanceKm(city('Wien'), city('Wien'))).toBe(0);
  });

  it('is symmetric', () => {
    expect(distanceKm(city('Paris'), city('London'))).toBeCloseTo(distanceKm(city('London'), city('Paris')), 6);
  });

  it('finds cities by local name, English name and without accents', () => {
    expect(findCity('Florence')?.name).toBe('Firenze');
    expect(findCity('firenze')?.name).toBe('Firenze');
    expect(findCity('Munich')?.name).toBe('München');
    expect(findCity('Koln')?.name).toBe('Köln');
    expect(findCity('forli')?.name).toBe('Forlì');
    expect(findCity('Atlantis')).toBeUndefined();
  });

  it('suggests cities by prefix', () => {
    expect(searchCities('bol').map((c) => c.name)).toEqual(expect.arrayContaining(['Bologna', 'Bolzano']));
    expect(searchCities('vien')[0].name).toBe('Wien');
  });

  it('steps the radius outward', () => {
    expect(nextRadius(50)).toBe(100);
    expect(nextRadius(500)).toBeUndefined();
  });
});

describe('dates', () => {
  it('adds days and months across boundaries', () => {
    expect(addDays('2027-02-27', 2)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(diffDays('2027-03-14', '2027-03-01')).toBe(13);
  });

  it('validates ISO dates', () => {
    expect(isISODate('2027-03-14')).toBe(true);
    expect(isISODate('2027-02-30')).toBe(false);
    expect(isISODate('14/03/2027')).toBe(false);
  });

  it('knows weekdays (Monday = 0)', () => {
    expect(weekday('2026-11-16')).toBe(0);
    expect(weekday('2027-03-14')).toBe(6);
  });

  it('finds the next occurrence of a day', () => {
    expect(nextOccurrence(3, 14, '2026-11-16')).toBe('2027-03-14');
    expect(nextOccurrence(3, 14, '2027-03-14')).toBe('2027-03-14');
    expect(nextOccurrence(3, 14, '2027-03-15')).toBe('2028-03-14');
  });

  it('builds a Monday-first month grid', () => {
    const grid = monthGrid(2027, 3);
    expect(grid[0][0]).toBe('2027-03-01');
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});
