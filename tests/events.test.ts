import { beforeEach, describe, expect, it } from 'vitest';
import type { EventInput } from '../src/data/api';
import { MockApi, memoryStore } from '../src/data/mock/mockApi';
import { PERSONA_IDS as P } from '../src/data/mock/seed';
import { placeByName } from '../src/domain/cities';

let clock: Date;
let api: MockApi;

beforeEach(() => {
  clock = new Date(2026, 10, 16, 10, 0, 0);
  api = new MockApi({ store: memoryStore(), now: () => clock, simulation: false });
});

const event = (over: Partial<EventInput> = {}): EventInput => ({
  format: 'concert',
  title: 'Late quartets & a tango',
  venue: 'Oratorio di San Filippo Neri',
  city: 'Bologna',
  country: 'IT',
  visibility: 'public',
  sessions: [
    { date: '2027-03-13', time: '15:00', kind: 'rehearsal' },
    { date: '2027-03-14', time: '20:30', kind: 'performance' },
  ],
  programme: [{ composer: 'Astor Piazzolla', work: 'Histoire du Tango' }],
  myRole: 'Violin I',
  invite: [{ musicianId: P.nicolo, role: 'Accordion' }],
  openSeats: [{ role: 'Double bass' }],
  ...over,
});

describe('events', () => {
  it('rule 1: an invited musician appears on the lineup only after confirming', async () => {
    const c = await api.createEvent(event(), P.giulia);
    let v = await api.getEvent(c.id, P.lorenzo);
    expect(v.lineup.filter((l) => l.status === 'confirmed').map((l) => l.person?.id)).toEqual([P.giulia]);
    expect(v.lineup.some((l) => l.person?.id === P.nicolo)).toBe(false);
    expect(v.event.verified).toBe(false);

    const notes = await api.listNotifications(P.nicolo);
    expect(notes[0].notification.kind).toBe('lineup-invite');
    expect((await api.listLineupInvites(P.nicolo))[0].role).toBe('Accordion');

    await api.respondToLineup(c.id, P.nicolo, true);
    v = await api.getEvent(c.id, P.lorenzo);
    expect(v.lineup.filter((l) => l.status === 'confirmed').map((l) => l.person?.id)).toContain(P.nicolo);
    expect(v.event.verified).toBe(true);
    expect(await api.listLineupInvites(P.nicolo)).toHaveLength(0);
    // Confirmed events mark the days booked.
    const profile = await api.getProfile(P.nicolo);
    expect(profile.musician.availability['2027-03-14']?.status).toBe('busy');
  });

  it('"That’s not me" keeps them off the lineup and tells the organiser', async () => {
    const c = await api.createEvent(event(), P.giulia);
    await api.respondToLineup(c.id, P.nicolo, false);
    const v = await api.getEvent(c.id, P.giulia);
    expect(v.lineup.find((l) => l.person?.id === P.nicolo)?.status).toBe('declined');
    expect((await api.listNotifications(P.giulia))[0].notification).toMatchObject({ kind: 'lineup-response', accepted: false });
  });

  it('private events are hidden from people outside the lineup', async () => {
    const c = await api.createEvent(event({ visibility: 'private' }), P.giulia);
    await expect(api.getEvent(c.id, P.lorenzo)).rejects.toThrow(/private/i);
    await expect(api.getEvent(c.id, P.nicolo)).resolves.toBeTruthy();
  });

  it('a linked opportunity takes the event’s details, and a hire fills the seat (rule 2)', async () => {
    const c = await api.createEvent(event({ invite: [] }), P.giulia);
    const seat = c.openSeats![0];
    const opp = await api.createOpportunity(
      {
        type: 'engagement',
        title: 'Double bass for a tango',
        instruments: ['double-bass'],
        place: placeByName('Milano'),
        dates: [{ date: '2030-01-01', kind: 'performance' }],
        fee: { amount: 240, unit: 'total' },
        travel: 'none',
        repertoire: [],
        description: 'Linked to the event',
        urgent: true,
        eventId: c.id,
        seatId: seat.id,
      },
      P.giulia,
    );
    expect(opp.place.name).toBe('Bologna');
    expect(opp.dates.map((d) => d.date)).toEqual(['2027-03-13', '2027-03-14']);
    expect(opp.repertoire[0].work).toBe('Histoire du Tango');

    let v = await api.getEvent(c.id, P.lorenzo);
    expect(v.lineup.find((l) => l.status === 'open')?.opportunityId).toBe(opp.id);
    // The fee is never on the event.
    expect(JSON.stringify(v)).not.toContain('240');

    const [app] = await api.invite(opp.id, [P.nicolo], 'Can you?', P.giulia);
    await api.respond(app.id, P.nicolo, true);
    await api.setApplicationStatus(app.id, 'confirmed', P.giulia);
    v = await api.getEvent(c.id, P.lorenzo);
    expect(v.lineup.some((l) => l.status === 'open')).toBe(false);
    expect(v.lineup.find((l) => l.person?.id === P.nicolo)).toMatchObject({ status: 'confirmed', role: 'Double bass' });
  });

  it('concerts added alone invite the others instead of listing them', async () => {
    const c = await api.addConcert(
      { date: '2026-10-01', venue: 'Teatro', city: 'Modena', country: 'IT', programme: [{ composer: 'Bach', work: 'Goldberg' }], participants: [{ musicianId: P.nicolo, role: 'Accordion' }, { musicianId: P.giulia, role: 'Violin' }] },
      P.nicolo,
    );
    expect(c.participants.map((p) => p.musicianId)).toEqual([P.nicolo]);
    expect(c.invites?.[0].musicianId).toBe(P.giulia);
  });
});
