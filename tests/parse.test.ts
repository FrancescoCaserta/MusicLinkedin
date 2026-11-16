import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/domain/search/parse';
import { EMPTY_QUERY, paramsToQuery, queryToParams } from '../src/domain/search/query';

const TODAY = '2026-11-16'; // a Monday

describe('natural-language query parser', () => {
  it('understands the headline example', () => {
    const { patch, leftover } = parseQuery('accordionist within 50 km of Bologna, free on 14 March, budget €250', TODAY);
    expect(patch.instruments).toEqual(['accordion']);
    expect(patch.place?.name).toBe('Bologna');
    expect(patch.radiusKm).toBe(50);
    expect(patch.date).toBe('2027-03-14');
    expect(patch.budget).toBe(250);
    expect(leftover).toBe('');
  });

  it('understands Italian instrument names and cities', () => {
    const { patch } = parseQuery('fisarmonicista vicino a Firenze 20 marzo 300 euro', TODAY);
    expect(patch.instruments).toEqual(['accordion']);
    expect(patch.place?.name).toBe('Firenze');
    expect(patch.date).toBe('2027-03-20');
    expect(patch.budget).toBe(300);
  });

  it('prefers the longest instrument phrase', () => {
    expect(parseQuery('viola da gamba in Venice', TODAY).patch.instruments).toEqual(['viola-da-gamba']);
    expect(parseQuery('mezzo-soprano', TODAY).patch.instruments).toEqual(['mezzo-soprano']);
    expect(parseQuery('double bass', TODAY).patch.instruments).toEqual(['double-bass']);
    expect(parseQuery('baroque violin', TODAY).patch.instruments).toEqual(['baroque-violin']);
    expect(parseQuery('cor anglais', TODAY).patch.instruments).toEqual(['cor-anglais']);
  });

  it('accepts several instruments', () => {
    expect(parseQuery('violin or viola near Modena', TODAY).patch.instruments).toEqual(['violin', 'viola']);
  });

  it('reads many date formats', () => {
    expect(parseQuery('cellist 2027-01-09', TODAY).patch.date).toBe('2027-01-09');
    expect(parseQuery('cellist on 9/1', TODAY).patch.date).toBe('2027-01-09');
    expect(parseQuery('cellist 09.01.2027', TODAY).patch.date).toBe('2027-01-09');
    expect(parseQuery('cellist March 3rd', TODAY).patch.date).toBe('2027-03-03');
    expect(parseQuery('cellist on the 3rd of March 2028', TODAY).patch.date).toBe('2028-03-03');
    expect(parseQuery('cellist tomorrow', TODAY).patch.date).toBe('2026-11-17');
    expect(parseQuery('cellist next Saturday', TODAY).patch.date).toBe('2026-11-21');
    expect(parseQuery('cellist 20 december', TODAY).patch.date).toBe('2026-12-20');
  });

  it('reads a date range', () => {
    const { patch } = parseQuery('oboist 12-14 March in Milan', TODAY);
    expect(patch.date).toBe('2027-03-12');
    expect(patch.dateTo).toBe('2027-03-14');
  });

  it('does not split a two-digit day into a range', () => {
    const { patch } = parseQuery('harpist 14 March', TODAY);
    expect(patch.date).toBe('2027-03-14');
    expect(patch.dateTo).toBeUndefined();
  });

  it('treats tonight as urgent', () => {
    const { patch } = parseQuery('second horn tonight in Rome', TODAY);
    expect(patch.instruments).toEqual(['horn']);
    expect(patch.date).toBe(TODAY);
    expect(patch.urgentOnly).toBe(true);
    expect(patch.place?.name).toBe('Roma');
  });

  it('reads budgets in several forms', () => {
    expect(parseQuery('harpist under 300', TODAY).patch.budget).toBe(300);
    expect(parseQuery('harpist max €400', TODAY).patch.budget).toBe(400);
    expect(parseQuery('harpist 350€', TODAY).patch.budget).toBe(350);
    expect(parseQuery('harpist up to 500 euros', TODAY).patch.budget).toBe(500);
  });

  it('does not mistake a radius for a budget or a bare number for anything', () => {
    const { patch } = parseQuery('tenor 100 km from Leipzig', TODAY);
    expect(patch.radiusKm).toBe(100);
    expect(patch.budget).toBeUndefined();
    expect(parseQuery('tenor 250', TODAY).patch.budget).toBeUndefined();
  });

  it('uses a tighter radius for "in <city>" and the default for "near"', () => {
    expect(parseQuery('organist in Bologna', TODAY).patch.radiusKm).toBe(25);
    expect(parseQuery('organist near Bologna', TODAY).patch.radiusKm).toBe(50);
  });

  it('recognises composers and works as repertoire', () => {
    expect(parseQuery('soprano Brahms Requiem near Vienna', TODAY).patch.repertoire).toBe('Brahms requiem');
    expect(parseQuery('cellist who has played Gubaidulina', TODAY).patch.repertoire).toBe('Gubaidulina');
    expect(parseQuery('tenor for Messiah in London', TODAY).patch.repertoire).toBe('messiah');
    expect(parseQuery('accordion Piazzolla estaciones', TODAY).patch.repertoire).toBe('Piazzolla estaciones');
  });

  it('keeps ambiguous names as a name search unless a work follows', () => {
    const name = parseQuery('David', TODAY);
    expect(name.patch.repertoire).toBeUndefined();
    expect(name.patch.text).toBe('david');
    expect(parseQuery('trombone David Concertino', TODAY).patch.repertoire).toBe('David concertino');
  });

  it('recognises roles and flags', () => {
    const { patch } = parseQuery('harpsichord continuo player on period instruments, urgent', TODAY);
    expect(patch.instruments).toEqual(['harpsichord']);
    expect(patch.roles).toEqual(['continuo']);
    expect(patch.periodOnly).toBe(true);
    expect(patch.urgentOnly).toBe(true);
  });

  it('leaves unknown words as a name search', () => {
    const { patch } = parseQuery('Baldini', TODAY);
    expect(patch.text).toBe('baldini');
    expect(patch.instruments).toBeUndefined();
  });

  it('returns an empty patch for empty input', () => {
    expect(parseQuery('   ', TODAY).patch).toEqual({});
  });
});

describe('query ↔ URL', () => {
  it('round-trips a full query', () => {
    const { patch } = parseQuery('accordionist within 50 km of Bologna, free on 14 March, budget €250, Piazzolla', TODAY);
    const q = { ...EMPTY_QUERY, ...patch, sort: 'distance' as const, networkOnly: true };
    expect(paramsToQuery(queryToParams(q))).toEqual(q);
  });

  it('ignores junk parameters', () => {
    const q = paramsToQuery(new URLSearchParams('i=kazoo,violin&d=not-a-date&b=abc&near=nowhere&sort=random'));
    expect(q).toEqual({ ...EMPTY_QUERY, instruments: ['violin'] });
  });
});
