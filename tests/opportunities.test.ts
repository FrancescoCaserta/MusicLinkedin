import { describe, expect, it } from 'vitest';
import { findCity, placeByName } from '../src/domain/cities';
import { EMPTY_OPPORTUNITY_QUERY, filterOpportunities, keyDate, opportunityFit, sameWork } from '../src/domain/search/opportunities';
import type { Opportunity } from '../src/domain/types';
import { musician } from './helpers';

const opp = (over: Partial<Opportunity> & { id: string }): Opportunity => ({
  type: 'engagement',
  title: over.id,
  postedBy: 'someone',
  instruments: ['violin'],
  place: placeByName('Bologna'),
  dates: [{ date: '2027-03-14', kind: 'performance' }],
  fee: { amount: 250, unit: 'total' },
  travel: 'none',
  repertoire: [],
  description: '',
  urgent: false,
  status: 'open',
  createdAt: '2026-11-10T10:00:00.000Z',
  ...over,
});

const board = [
  opp({ id: 'violin-bologna' }),
  opp({ id: 'urgent-cello', instruments: ['cello'], urgent: true, type: 'substitution', createdAt: '2026-11-01T10:00:00.000Z' }),
  opp({ id: 'audition-rome', type: 'audition', place: placeByName('Roma'), fee: { amount: 29000, unit: 'per-year' } }),
  opp({ id: 'teaching-imola', type: 'teaching', place: placeByName('Imola'), fee: { amount: 27, unit: 'per-hour' }, title: 'Violin teacher' }),
  opp({ id: 'paris-covered', place: placeByName('Paris'), travel: 'travel-accommodation', fee: { amount: 700, max: 900, unit: 'total' }, dates: [{ date: '2027-01-10', kind: 'rehearsal' }, { date: '2027-01-12', kind: 'performance' }] }),
  opp({ id: 'any-instrument', instruments: [], title: 'Chorus master' }),
];
const ids = (over: Partial<typeof EMPTY_OPPORTUNITY_QUERY>) => filterOpportunities(board, { ...EMPTY_OPPORTUNITY_QUERY, ...over }).map((o) => o.id);

describe('opportunity board filters', () => {
  it('shows urgent postings first by default', () => {
    expect(ids({})[0]).toBe('urgent-cello');
  });

  it('filters by type, urgency and instrument', () => {
    expect(ids({ types: ['audition', 'teaching'] }).sort()).toEqual(['audition-rome', 'teaching-imola']);
    expect(ids({ urgentOnly: true })).toEqual(['urgent-cello']);
    // Postings open to any instrument stay visible when filtering by instrument.
    expect(ids({ instruments: ['cello'] }).sort()).toEqual(['any-instrument', 'urgent-cello']);
  });

  it('filters by distance from a place', () => {
    const c = findCity('Bologna')!;
    const near = ids({ place: { name: c.name, lat: c.lat, lng: c.lng }, radiusKm: 50 });
    expect(near).toContain('teaching-imola');
    expect(near).not.toContain('audition-rome');
    expect(near).not.toContain('paris-covered');
  });

  it('filters by minimum fee (using the top of a range) and travel cover', () => {
    expect(ids({ minFee: 800 }).sort()).toEqual(['audition-rome', 'paris-covered']);
    expect(ids({ travelCovered: true })).toEqual(['paris-covered']);
  });

  it('searches titles, places and repertoire', () => {
    expect(ids({ text: 'teacher' })).toEqual(['teaching-imola']);
    expect(ids({ text: 'roma' })).toEqual(['audition-rome']);
  });

  it('sorts by date and by fee', () => {
    expect(ids({ sort: 'date' })[0]).toBe('paris-covered');
    expect(ids({ sort: 'fee' })[0]).toBe('audition-rome');
  });

  it('uses the first performance as the key date', () => {
    expect(keyDate(board[4])).toBe('2027-01-12');
  });
});

describe('how well an opportunity fits a musician', () => {
  const o = opp({
    id: 'passion',
    instruments: ['viola-da-gamba'],
    dates: [
      { date: '2027-03-22', kind: 'rehearsal' },
      { date: '2027-03-25', kind: 'performance' },
      { date: '2027-09-01', kind: 'start' },
    ],
    repertoire: [
      { composer: 'Bach', work: 'Johannes-Passion BWV 245' },
      { composer: 'Buxtehude', work: 'Membra Jesu nostri' },
    ],
  });
  const m = musician({
    id: 'gambist',
    city: 'Faenza',
    instruments: [{ instrumentId: 'viola-da-gamba', level: 'primary' }],
    travelRadiusKm: 100,
    availability: { '2027-03-22': { status: 'busy' }, '2027-09-01': { status: 'busy' } },
    repertoire: [{ id: 'r', composer: 'Bach', work: 'Johannes-Passion BWV 245', part: 'continuo', genre: 'sacred', status: 'ready' }],
  });

  it('checks instrument, distance, calendar clashes and known repertoire', () => {
    const fit = opportunityFit(o, m);
    expect(fit.instrumentMatch).toBe(true);
    expect(fit.distanceKm).toBeGreaterThan(40);
    expect(fit.withinTravelRadius).toBe(true);
    expect(fit.clashes).toEqual([{ date: '2027-03-22', status: 'busy' }]); // a start date is not a clash
    expect(fit.known.map((k) => k.item.work)).toEqual(['Johannes-Passion BWV 245']);
  });

  it('does not count the engagement’s own calendar entry as a clash', () => {
    const booked = { ...m, availability: { '2027-03-22': { status: 'busy' as const, opportunityId: 'passion' } } };
    expect(opportunityFit(o, booked).clashes).toEqual([]);
  });

  it('recognises the same work written differently', () => {
    expect(sameWork({ composer: 'Bach', work: 'Johannes-Passion BWV 245' }, { composer: 'Bach', work: 'Johannes-Passion' })).toBe(true);
    expect(sameWork({ composer: 'Piazzolla', work: 'Las cuatro estaciones porteñas' }, { composer: 'Piazzolla', work: 'Las cuatro estaciones porteñas (accordion and strings)' })).toBe(true);
    expect(sameWork({ composer: 'Mozart', work: 'Requiem K. 626' }, { composer: 'Verdi', work: 'Messa da Requiem' })).toBe(false);
    expect(sameWork({ composer: 'Beethoven', work: 'Symphony No. 5 in C minor Op. 67' }, { composer: 'Beethoven', work: 'Symphony No. 7 in A Op. 92' })).toBe(false);
    expect(sameWork({ composer: 'Brahms', work: 'Violin Sonata No. 1 in G Op. 78' }, { composer: 'Brahms', work: 'Cello Sonata No. 1 in E minor Op. 38' })).toBe(false);
  });
});
