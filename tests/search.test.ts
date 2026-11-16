import { describe, expect, it } from 'vitest';
import { findCity } from '../src/domain/cities';
import { availabilityOn, matchRepertoire, searchMusicians, type SearchContext } from '../src/domain/search/engine';
import { EMPTY_QUERY, type MusicianQuery } from '../src/domain/search/query';
import type { RepertoireItem } from '../src/domain/types';
import { musician } from './helpers';

const TODAY = '2026-11-16';
const DAY = '2027-03-14';
const bologna = (() => {
  const c = findCity('Bologna')!;
  return { name: c.name, lat: c.lat, lng: c.lng, cityId: c.id };
})();
const rep = (composer: string, work: string, status: RepertoireItem['status'] = 'ready', part?: string): RepertoireItem => ({
  id: `${composer}-${work}`,
  composer,
  work,
  part,
  genre: 'chamber',
  status,
  lastPerformed: 2025,
});
const acc = { instrumentId: 'accordion', level: 'primary' as const };

const people = [
  musician({ id: 'modena', city: 'Modena', instruments: [acc], fee: { min: 180, max: 280 }, repertoire: [rep('Piazzolla', 'Las cuatro estaciones porteñas')] }),
  musician({ id: 'ferrara', city: 'Ferrara', instruments: [acc], fee: { min: 150, max: 250 }, repertoire: [rep('Piazzolla', 'Histoire du tango', 'performed')] }),
  musician({ id: 'bologna-dear', city: 'Bologna', instruments: [acc], fee: { min: 300, max: 450 } }),
  musician({ id: 'imola-busy', city: 'Imola', instruments: [acc], fee: { min: 130, max: 220 }, availability: { [DAY]: { status: 'busy' } } }),
  musician({ id: 'reggio-tentative', city: 'Reggio Emilia', instruments: [acc], fee: { min: 160, max: 260 }, availability: { [DAY]: { status: 'tentative' } } }),
  musician({ id: 'firenze', city: 'Firenze', instruments: [acc], fee: { min: 200, max: 320 } }),
  musician({ id: 'helsinki', city: 'Helsinki', instruments: [acc], fee: { min: 350, max: 600 }, travelsInternationally: true }),
  musician({ id: 'pianist-doubling', city: 'Bologna', instruments: [{ instrumentId: 'piano', level: 'primary' }, { instrumentId: 'accordion', level: 'secondary' }] }),
  musician({ id: 'violinist', city: 'Bologna' }),
];
const ctx: SearchContext = { musicians: people, today: TODAY };
const q = (over: Partial<MusicianQuery>): MusicianQuery => ({ ...EMPTY_QUERY, ...over });
const ids = (query: MusicianQuery, c = ctx) => searchMusicians(query, c).matches.map((m) => m.musician.id);

describe('musician search — filters', () => {
  it('returns everyone for an empty query', () => {
    expect(ids(q({}))).toHaveLength(people.length);
  });

  it('filters by instrument, including secondary instruments by default', () => {
    expect(ids(q({ instruments: ['accordion'] }))).toHaveLength(8);
    expect(ids(q({ instruments: ['accordion'], includeSecondary: false }))).not.toContain('pianist-doubling');
  });

  it('ranks a primary instrument above a secondary one', () => {
    const res = searchMusicians(q({ instruments: ['accordion'], place: bologna, radiusKm: 10 }), ctx).matches;
    expect(res.map((m) => m.musician.id)).toEqual(['bologna-dear', 'pianist-doubling']);
    expect(res[1].instrumentMatch?.level).toBe('secondary');
  });

  it('filters by real distance', () => {
    const within50 = ids(q({ instruments: ['accordion'], place: bologna, radiusKm: 50 }));
    expect(within50).toEqual(expect.arrayContaining(['modena', 'ferrara', 'bologna-dear', 'imola-busy', 'pianist-doubling']));
    expect(within50).not.toContain('reggio-tentative'); // ~60 km
    expect(within50).not.toContain('firenze'); // ~80 km
    expect(ids(q({ instruments: ['accordion'], place: bologna, radiusKm: 100 }))).toEqual(expect.arrayContaining(['reggio-tentative', 'firenze']));
  });

  it('reports distance and whether the place is inside the musician’s travel radius', () => {
    const far = searchMusicians(q({ place: bologna, radiusKm: 3000, text: 'helsinki' }), ctx).matches[0];
    expect(far.distanceKm).toBeGreaterThan(1500);
    expect(far.withinTravelRadius).toBe(true); // travels internationally
    const near = searchMusicians(q({ place: bologna, radiusKm: 100, text: 'firenze' }), ctx).matches[0];
    expect(near.withinTravelRadius).toBe(true);
    const outside = searchMusicians(q({ place: bologna, radiusKm: 100 }), { ...ctx, musicians: [musician({ id: 'x', city: 'Firenze', travelRadiusKm: 30 })] }).matches[0];
    expect(outside.withinTravelRadius).toBe(false);
  });

  it('excludes musicians who are busy on the date and flags tentative ones', () => {
    const res = searchMusicians(q({ instruments: ['accordion'], date: DAY }), ctx).matches;
    expect(res.map((m) => m.musician.id)).not.toContain('imola-busy');
    expect(res.find((m) => m.musician.id === 'reggio-tentative')?.availability).toBe('tentative');
    expect(res.find((m) => m.musician.id === 'modena')?.availability).toBe('free');
  });

  it('checks every day of a date range', () => {
    const m = musician({ id: 'r', availability: { '2027-03-13': { status: 'tentative' }, '2027-03-15': { status: 'busy' } } });
    expect(availabilityOn(m, '2027-03-12')).toBe('free');
    expect(availabilityOn(m, '2027-03-12', '2027-03-14')).toBe('tentative');
    expect(availabilityOn(m, '2027-03-12', '2027-03-15')).toBe('busy');
  });

  it('filters by budget against the lower end of the fee range', () => {
    const res = searchMusicians(q({ instruments: ['accordion'], budget: 250 }), ctx).matches;
    const got = res.map((m) => m.musician.id);
    expect(got).toEqual(expect.arrayContaining(['modena', 'ferrara', 'imola-busy', 'reggio-tentative', 'firenze']));
    expect(got).not.toContain('bologna-dear');
    expect(got).not.toContain('helsinki');
    expect(res.find((m) => m.musician.id === 'ferrara')?.feeFit).toBe('comfortable');
    expect(res.find((m) => m.musician.id === 'modena')?.feeFit).toBe('within');
  });

  it('filters by repertoire and prefers performance-ready', () => {
    const res = searchMusicians(q({ repertoire: 'Piazzolla' }), ctx).matches;
    expect(res.map((m) => m.musician.id)).toEqual(['modena', 'ferrara']);
    expect(res[0].repertoire[0].status).toBe('ready');
  });

  it('combines everything: the headline query', () => {
    const res = searchMusicians(q({ instruments: ['accordion'], place: bologna, radiusKm: 50, date: DAY, budget: 250 }), ctx);
    expect(res.matches.map((m) => m.musician.id).sort()).toEqual(['ferrara', 'modena', 'pianist-doubling']);
  });

  it('filters by name text, role and flags', () => {
    const extra = [
      musician({ id: 'a', name: 'Anna Bedeschi', roles: ['continuo'], instruments: [{ instrumentId: 'viola-da-gamba', level: 'primary' }] }),
      musician({ id: 'b', name: 'Bruno Neri', practical: { ownTransport: true, canInvoice: false, urgentCalls: false } }),
    ];
    const c = { ...ctx, musicians: extra };
    expect(ids(q({ text: 'bedeschi' }), c)).toEqual(['a']);
    expect(ids(q({ roles: ['continuo'] }), c)).toEqual(['a']);
    expect(ids(q({ periodOnly: true }), c)).toEqual(['a']);
    expect(ids(q({ urgentOnly: true }), c)).toEqual(['a']);
    expect(ids(q({ invoiceOnly: true }), c)).toEqual(['a']);
  });

  it('leaves the searcher out of their own results', () => {
    expect(ids(q({}), { ...ctx, excludeId: 'modena' })).not.toContain('modena');
  });
});

describe('musician search — ranking and sorting', () => {
  it('uses network proximity and endorsements to break ties', () => {
    const twins = [musician({ id: 'stranger' }), musician({ id: 'colleague' })];
    const network = new Map([['colleague', { connected: true, sharedConcerts: 2, mutuals: 3 }]]);
    expect(ids(q({}), { musicians: twins, today: TODAY, network })).toEqual(['colleague', 'stranger']);
    expect(ids(q({ networkOnly: true }), { musicians: twins, today: TODAY, network })).toEqual(['colleague']);
    const endorsements = new Map([['stranger', 5]]);
    expect(ids(q({}), { musicians: twins, today: TODAY, endorsements })).toEqual(['stranger', 'colleague']);
  });

  it('sorts by distance and by fee on request', () => {
    const base = q({ instruments: ['accordion'], place: bologna, radiusKm: 100, includeSecondary: false });
    expect(ids({ ...base, sort: 'distance' })[0]).toBe('bologna-dear');
    expect(ids({ ...base, sort: 'fee' })[0]).toBe('imola-busy');
  });
});

describe('musician search — near misses', () => {
  const strict = q({ instruments: ['accordion'], includeSecondary: false, place: bologna, radiusKm: 50, date: DAY, budget: 250 });

  it('says what a wider radius, a higher budget or another date would add', () => {
    const { matches, relaxations } = searchMusicians(strict, ctx);
    expect(matches.map((m) => m.musician.id).sort()).toEqual(['ferrara', 'modena']);
    const by = Object.fromEntries(relaxations.map((r) => [r.kind, r]));
    expect(by.radius).toMatchObject({ count: 2, value: 100 }); // Reggio Emilia and Florence
    expect(by.budget).toMatchObject({ count: 1, value: 300 }); // the Bologna player
    expect(by.date).toMatchObject({ count: 1 }); // the Imola player is busy
  });

  it('applying a suggestion yields exactly the promised extra matches', () => {
    const { matches, relaxations } = searchMusicians(strict, ctx);
    for (const r of relaxations) {
      const wider = searchMusicians({ ...strict, ...r.patch }, ctx).matches;
      expect(wider.length).toBe(matches.length + r.count);
    }
  });

  it('stays quiet when there are plenty of results', () => {
    expect(searchMusicians(q({ instruments: ['accordion'], budget: 400 }), ctx).relaxations).toEqual([]);
  });
});

describe('repertoire matching', () => {
  const m = musician({
    id: 'm',
    repertoire: [
      rep('Bach', 'Johannes-Passion BWV 245', 'performed', 'Evangelist'),
      rep('Bach', 'Matthäus-Passion BWV 244', 'ready', 'Evangelist'),
      rep('Vivaldi', 'Le quattro stagioni Op. 8'),
      rep('Dvořák', 'String Quartet No. 12 “American” Op. 96'),
      rep('Tchaikovsky', 'Serenade for Strings Op. 48', 'learning'),
    ],
  });
  const works = (text: string) => matchRepertoire(m, text).map((r) => r.work);

  it('matches composer, title words, catalogue numbers and parts', () => {
    expect(works('Bach')).toHaveLength(2);
    expect(works('bach passion')[0]).toBe('Matthäus-Passion BWV 244'); // ready before performed
    expect(works('BWV 245')).toEqual(['Johannes-Passion BWV 245']);
    expect(works('evangelist')).toHaveLength(2);
  });

  it('ignores accents and understands common English titles and spellings', () => {
    expect(works('dvorak american')).toHaveLength(1);
    expect(works('St John Passion')).toEqual(['Johannes-Passion BWV 245']);
    expect(works('Four Seasons')).toEqual(['Le quattro stagioni Op. 8']);
    expect(works('Cajkovskij')).toHaveLength(1);
  });

  it('does not match a number inside another number', () => {
    expect(works('No. 1')).toEqual([]);
    expect(works('quartet 12')).toHaveLength(1);
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(works('')).toEqual([]);
    expect(works('Stockhausen')).toEqual([]);
  });
});
