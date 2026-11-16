import { describe, expect, it } from 'vitest';
import { buildSeed, PERSONA_IDS } from '../src/data/mock/seed';
import { findCity } from '../src/domain/cities';
import { parseQuery } from '../src/domain/search/parse';
import { searchMusicians } from '../src/domain/search/engine';
import { EMPTY_QUERY } from '../src/domain/search/query';
import { instrument } from '../src/domain/taxonomy';

const ANCHOR = '2026-11-16';
const db = buildSeed(ANCHOR);

describe('seed data', () => {
  it('is deterministic for a given day', () => {
    const again = buildSeed(ANCHOR);
    expect(again.musicians).toEqual(db.musicians);
    expect(again.concerts).toEqual(db.concerts);
    expect(again.connections).toEqual(db.connections);
  });

  it('has the breadth the demo needs', () => {
    expect(db.musicians.length).toBeGreaterThanOrEqual(120);
    expect(db.organisations.length).toBeGreaterThanOrEqual(25);
    expect(db.opportunities.length).toBeGreaterThanOrEqual(40);
    const instruments = new Set(db.musicians.map((m) => m.instruments[0].instrumentId));
    expect(instruments.size).toBeGreaterThanOrEqual(35);
    const countries = new Set(db.musicians.map((m) => m.base.country));
    expect(countries.size).toBeGreaterThanOrEqual(12);
    expect(new Set(db.opportunities.map((o) => o.type)).size).toBe(5);
  });

  it('gives every musician a complete, coherent profile', () => {
    for (const m of db.musicians) {
      expect(m.bio.length, m.name).toBeGreaterThan(120);
      expect(m.headline, m.name).not.toBe('');
      expect(m.training.length, m.name).toBeGreaterThan(0);
      expect(m.repertoire.length, m.name).toBeGreaterThanOrEqual(8);
      expect(m.fee.min, m.name).toBeLessThanOrEqual(m.fee.max);
      expect(findCity(m.base.name), m.name).toBeDefined();
      for (const p of m.instruments) expect(instrument(p.instrumentId), `${m.name}: ${p.instrumentId}`).toBeDefined();
      const concerts = db.concerts.filter((c) => c.participants.some((p) => p.musicianId === m.id));
      expect(concerts.length, m.name).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(db.musicians.map((m) => m.slug)).size).toBe(db.musicians.length);
  });

  it('keeps references intact', () => {
    const accounts = new Set(db.accounts.map((a) => a.id));
    const musicians = new Set(db.musicians.map((m) => m.id));
    const concerts = new Map(db.concerts.map((c) => [c.id, c]));
    const opps = new Set(db.opportunities.map((o) => o.id));
    for (const c of db.concerts) for (const p of c.participants) expect(musicians.has(p.musicianId)).toBe(true);
    for (const o of db.organisations) {
      for (const a of o.admins) expect(accounts.has(a), o.name).toBe(true);
      for (const m of o.members) expect(musicians.has(m.musicianId), o.name).toBe(true);
    }
    for (const o of db.opportunities) {
      expect(accounts.has(o.postedBy), o.id).toBe(true);
      expect(o.fee.amount, o.id).toBeGreaterThan(0);
      expect(o.dates.length, o.id).toBeGreaterThan(0);
      for (const i of o.instruments) expect(instrument(i), `${o.id}: ${i}`).toBeDefined();
    }
    for (const a of db.applications) {
      expect(opps.has(a.opportunityId)).toBe(true);
      expect(musicians.has(a.musicianId)).toBe(true);
    }
    for (const c of db.connections) {
      expect(accounts.has(c.from) && accounts.has(c.to)).toBe(true);
      expect(c.from).not.toBe(c.to);
    }
    for (const t of db.threads) for (const p of t.participants) expect(accounts.has(p)).toBe(true);
    for (const id of db.meta.personas) expect(accounts.has(id)).toBe(true);
    // every endorsement cites a past concert that both people took part in
    for (const e of db.endorsements) {
      const c = concerts.get(e.concertId)!;
      expect(c, e.id).toBeDefined();
      expect(c.date < ANCHOR, e.id).toBe(true);
      expect(c.participants.some((p) => p.musicianId === e.toId), e.id).toBe(true);
      const org = db.organisations.find((o) => o.id === c.orgId);
      expect(c.participants.some((p) => p.musicianId === e.fromId) || !!org?.admins.includes(e.fromId), e.id).toBe(true);
    }
  });

  it('has no duplicate connections or applications', () => {
    const pairs = db.connections.map((c) => [c.from, c.to].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
    const apps = db.applications.map((a) => `${a.opportunityId}|${a.musicianId}`);
    expect(new Set(apps).size).toBe(apps.length);
  });

  it('does not credit musicians with pieces their instrument does not play', () => {
    const nicolo = db.musicians.find((m) => m.id === PERSONA_IDS.nicolo)!;
    expect(nicolo.repertoire.some((r) => /String Quartet|Arcadiana|Symphony No/.test(r.work))).toBe(false);
    expect(nicolo.repertoire.some((r) => r.composer === 'Piazzolla' && r.status === 'ready')).toBe(true);
  });

  it('answers the headline search with a real shortlist and useful near misses', () => {
    const { patch } = parseQuery('accordionist within 50 km of Bologna, free on 14 March, budget €250', ANCHOR);
    const res = searchMusicians({ ...EMPTY_QUERY, ...patch }, { musicians: db.musicians, today: ANCHOR });
    const names = res.matches.map((m) => m.musician.name);
    expect(names).toContain('Nicolò Baldini');
    expect(names).toContain('Marta Ghidoni');
    expect(names).not.toContain('Agnese Tibaldi'); // over budget
    expect(names).not.toContain('Ruggero Fabbri'); // busy that day
    expect(res.matches.every((m) => (m.distanceKm ?? 99) <= 50)).toBe(true);
    const kinds = res.relaxations.map((r) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(['radius', 'budget', 'date']));
  });
});
