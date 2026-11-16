import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, type OpportunityInput } from '../src/data/api';
import { MockApi, memoryStore, type Store } from '../src/data/mock/mockApi';
import { PERSONA_IDS as P } from '../src/data/mock/seed';
import { placeByName } from '../src/domain/cities';
import { EMPTY_OPPORTUNITY_QUERY } from '../src/domain/search/opportunities';
import { parseQuery } from '../src/domain/search/parse';
import { EMPTY_QUERY } from '../src/domain/search/query';

let clock: Date;
let store: Store;
let api: MockApi;
const make = (s: Store, simulation: false | { urgent: [number, number]; normal: [number, number] } = false) =>
  new MockApi({ store: s, now: () => clock, simulation });

beforeEach(() => {
  clock = new Date(2026, 10, 16, 10, 0, 0);
  store = memoryStore();
  api = make(store);
});

const input = (over: Partial<OpportunityInput> = {}): OpportunityInput => ({
  type: 'engagement',
  title: 'Accordionist for a Piazzolla evening',
  instruments: ['accordion'],
  place: placeByName('Bologna', 'Oratorio di San Filippo Neri'),
  dates: [{ date: '2027-04-10', kind: 'performance', time: '21:00' }],
  fee: { amount: 300, unit: 'total' },
  travel: 'travel',
  repertoire: [{ composer: 'Piazzolla', work: 'Las cuatro estaciones porteñas' }],
  description: 'Test posting',
  urgent: false,
  ...over,
});

describe('mock API — search', () => {
  it('runs the headline search for a hirer and explains each hit', async () => {
    const { patch } = parseQuery('accordionist within 50 km of Bologna, free on 14 March, budget €250', '2026-11-16');
    const res = await api.searchMusicians({ ...EMPTY_QUERY, ...patch }, P.lorenzo);
    const nicolo = res.hits.find((h) => h.musician.name === 'Nicolò Baldini')!;
    expect(nicolo).toBeDefined();
    expect(nicolo.availability).toBe('free');
    expect(nicolo.feeFit).toBe('within');
    expect(nicolo.distanceKm).toBeLessThan(50);
    expect(nicolo.network?.connected).toBe(true);
    expect(nicolo.network?.sharedConcerts).toBeGreaterThan(0); // he played at Lorenzo's festival
    expect(res.relaxations.length).toBeGreaterThan(0);
  });

  it('never returns the person who is searching', async () => {
    const res = await api.searchMusicians({ ...EMPTY_QUERY, instruments: ['accordion'] }, P.nicolo);
    expect(res.hits.some((h) => h.musician.id === P.nicolo)).toBe(false);
  });

  it('keeps a shortlist per account', async () => {
    expect(await api.toggleShortlist(P.lorenzo, P.nicolo)).toBe(true);
    expect((await api.getShortlist(P.lorenzo)).map((c) => c.id)).toContain(P.nicolo);
    const res = await api.searchMusicians({ ...EMPTY_QUERY, text: 'Baldini' }, P.lorenzo);
    expect(res.hits[0].shortlisted).toBe(true);
    expect(await api.toggleShortlist(P.lorenzo, P.nicolo)).toBe(false);
  });
});

describe('mock API — persistence', () => {
  it('keeps profile edits across a reload', async () => {
    await api.updateMusician(P.nicolo, { headline: 'Accordionist — new headline', fee: { min: 200, max: 320 }, travelRadiusKm: 220 });
    const reloaded = make(store);
    const { musician } = await reloaded.getProfile('nicolo-baldini');
    expect(musician.headline).toBe('Accordionist — new headline');
    expect(musician.fee).toEqual({ min: 200, max: 320 });
    expect(musician.travelRadiusKm).toBe(220);
    expect((await reloaded.getSession(P.nicolo)).account.title).toBe('Accordionist — new headline');
  });

  it('makes calendar changes affect search immediately', async () => {
    const q = { ...EMPTY_QUERY, text: 'Baldini', date: '2027-03-14' };
    expect((await api.searchMusicians(q, P.lorenzo)).hits).toHaveLength(1);
    await api.setAvailability(P.nicolo, ['2027-03-14'], 'busy', 'Family');
    expect((await api.searchMusicians(q, P.lorenzo)).hits).toHaveLength(0);
    await api.setAvailability(P.nicolo, ['2027-03-14'], 'free');
    expect((await api.searchMusicians(q, P.lorenzo)).hits).toHaveLength(1);
  });

  it('rejects an invalid fee range', async () => {
    await expect(api.updateMusician(P.nicolo, { fee: { min: 300, max: 100 } })).rejects.toBeInstanceOf(ApiError);
  });

  it('can be reset to the original demo data', async () => {
    await api.updateMusician(P.nicolo, { headline: 'changed' });
    await api.resetDemo();
    expect((await api.getProfile(P.nicolo)).musician.headline).not.toBe('changed');
  });
});

describe('mock API — posting, applying, reviewing', () => {
  it('refuses a posting without a fee', async () => {
    await expect(api.createOpportunity(input({ fee: { amount: 0, unit: 'total' } }), P.lorenzo)).rejects.toThrow(/fee/i);
  });

  it('runs the whole journey: post → apply → shortlist → offer → confirm', async () => {
    const opp = await api.createOpportunity(input({ orgId: 'org-crinale' }), P.lorenzo);

    // it appears on the board for an accordionist, with what they need to know
    const board = await api.listOpportunities({ ...EMPTY_OPPORTUNITY_QUERY, instruments: ['accordion'] }, P.nicolo);
    const seen = board.find((v) => v.opportunity.id === opp.id)!;
    expect(seen).toBeDefined();
    expect(seen.organisation?.name).toBe('Festival Note sul Crinale');
    expect(seen.fit?.known).toHaveLength(1); // he has the Estaciones in repertoire
    expect(seen.fit?.clashes).toEqual([]);

    // the musician applies; the hirer sees it
    const app = await api.apply(opp.id, P.nicolo, 'Free that day, and I know the piece.');
    await expect(api.apply(opp.id, P.nicolo, 'again')).rejects.toThrow(/already/);
    const applicants = await api.listApplicants(opp.id, P.lorenzo);
    expect(applicants.map((a) => a.musician.id)).toEqual([P.nicolo]);
    expect(applicants[0].application.message).toMatch(/know the piece/);
    expect((await api.listNotifications(P.lorenzo))[0].notification).toMatchObject({ kind: 'application', opportunityId: opp.id });
    expect((await api.listPostings(P.lorenzo)).find((p) => p.opportunity.id === opp.id)?.counts.applied).toBe(1);

    // only the poster may review
    await expect(api.listApplicants(opp.id, P.giulia)).rejects.toBeInstanceOf(ApiError);
    await expect(api.setApplicationStatus(app.id, 'shortlisted', P.giulia)).rejects.toBeInstanceOf(ApiError);
    // a normal engagement cannot be confirmed without the musician
    await expect(api.setApplicationStatus(app.id, 'confirmed', P.lorenzo)).rejects.toThrow(/offer/i);

    await api.setApplicationStatus(app.id, 'shortlisted', P.lorenzo);
    await api.setApplicationStatus(app.id, 'offered', P.lorenzo);
    const mine = await api.listMyApplications(P.nicolo);
    expect(mine.find((v) => v.opportunity.id === opp.id)?.application.status).toBe('offered');
    expect((await api.getHome(P.nicolo)).actions.offers.map((v) => v.opportunity.id)).toContain(opp.id);

    // the musician confirms: the date is blocked in the calendar and search respects it
    await api.respond(app.id, P.nicolo, true);
    const { musician } = await api.getProfile(P.nicolo);
    expect(musician.availability['2027-04-10']).toMatchObject({ status: 'busy', opportunityId: opp.id });
    const search = await api.searchMusicians({ ...EMPTY_QUERY, text: 'Baldini', date: '2027-04-10' }, P.beatrice);
    expect(search.hits).toHaveLength(0);

    // withdrawing frees the date again
    await api.withdraw(app.id, P.nicolo);
    expect((await api.getProfile(P.nicolo)).musician.availability['2027-04-10']).toBeUndefined();
  });

  it('lets a hirer invite from search, and the musician accept or decline', async () => {
    const opp = await api.createOpportunity(input(), P.beatrice);
    const [a, b] = await api.invite(opp.id, [P.nicolo, 'm-marta-ghidoni'], 'Would you be free?', P.beatrice);
    expect(await api.invite(opp.id, [P.nicolo], 'again', P.beatrice)).toEqual([]); // no duplicates
    await expect(api.invite(opp.id, [P.giulia], 'x', P.lorenzo)).rejects.toBeInstanceOf(ApiError);

    const home = await api.getHome(P.nicolo);
    expect(home.actions.invitations.map((v) => v.opportunity.id)).toContain(opp.id);
    await api.respond(a.id, P.nicolo, true, 'Yes — free that evening.');
    await api.respond(b.id, 'm-marta-ghidoni', false);
    const applicants = await api.listApplicants(opp.id, P.beatrice);
    expect(applicants.find((x) => x.musician.id === P.nicolo)?.application).toMatchObject({ status: 'applied', origin: 'invited' });
    expect(applicants.find((x) => x.musician.id === 'm-marta-ghidoni')?.application.status).toBe('unavailable');
    await expect(api.respond(a.id, P.giulia, true)).rejects.toBeInstanceOf(ApiError);
  });

  it('suggests musicians for a posting, leaving out those already in the process', async () => {
    const opp = await api.createOpportunity(input({ dates: [{ date: '2027-03-14', kind: 'performance' }], fee: { amount: 250, unit: 'total' } }), P.lorenzo);
    const before = await api.suggestForOpportunity(opp.id, P.lorenzo);
    expect(before.hits.map((h) => h.musician.id)).toContain(P.nicolo);
    expect(before.hits.every((h) => h.instrumentMatch?.instrumentId === 'accordion')).toBe(true);
    await api.invite(opp.id, [P.nicolo], '', P.lorenzo);
    const after = await api.suggestForOpportunity(opp.id, P.lorenzo);
    expect(after.hits.map((h) => h.musician.id)).not.toContain(P.nicolo);
  });
});

describe('mock API — urgent substitutions', () => {
  it('first confirmed musician fills the call and the others are told', async () => {
    const opp = await api.createOpportunity(input({ type: 'substitution', urgent: true, dates: [{ date: '2026-11-17', kind: 'performance', time: '20:30' }] }), P.giulia);
    expect(opp.urgent).toBe(true);
    const [a, b] = await api.invite(opp.id, [P.nicolo, 'm-marta-ghidoni'], 'Can you step in tomorrow?', P.giulia);
    expect((await api.getBadges(P.nicolo)).urgentCalls.map((v) => v.opportunity.id)).toContain(opp.id);

    await api.respond(a.id, P.nicolo, true, 'I can do it.');
    await api.setApplicationStatus(a.id, 'confirmed', P.giulia); // urgent calls are confirmed directly
    expect((await api.getOpportunity(opp.id)).opportunity.status).toBe('filled');
    expect((await api.getProfile(P.nicolo)).musician.availability['2026-11-17']?.status).toBe('busy');
    expect((await api.listApplicants(opp.id, P.giulia)).find((x) => x.application.id === b.id)?.application.status).toBe('declined');
    expect((await api.getBadges(P.nicolo)).urgentCalls.map((v) => v.opportunity.id)).not.toContain(opp.id);
    await expect(api.respond(b.id, 'm-marta-ghidoni', true)).rejects.toBeInstanceOf(ApiError);
    // filled postings leave the public board
    expect((await api.listOpportunities(EMPTY_OPPORTUNITY_QUERY)).some((v) => v.opportunity.id === opp.id)).toBe(false);
  });

  it('simulates answers from musicians who are not demo personas', async () => {
    api = make(store, { urgent: [5, 10], normal: [5, 10] });
    const opp = await api.createOpportunity(input({ type: 'substitution', urgent: true, instruments: ['cello'], dates: [{ date: '2026-11-18', kind: 'performance' }] }), P.giulia);
    const suggested = await api.suggestForOpportunity(opp.id, P.giulia);
    expect(suggested.hits.length).toBeGreaterThan(2);
    await api.invite(opp.id, suggested.hits.map((h) => h.musician.id), 'Urgent — can you play tomorrow?', P.giulia);
    expect(await api.poll()).toBe(false); // nobody has answered yet
    clock = new Date(clock.getTime() + 60_000);
    expect(await api.poll()).toBe(true);
    const statuses = (await api.listApplicants(opp.id, P.giulia)).map((a) => a.application.status);
    expect(statuses.some((s) => s === 'applied' || s === 'unavailable')).toBe(true);
  });
});

describe('mock API — messages', () => {
  it('stores messages, counts unread ones, and marks them read', async () => {
    const before = (await api.getBadges(P.beatrice)).unreadMessages;
    const { threadId } = await api.sendMessage({ fromId: P.nicolo, toId: P.beatrice, body: 'Good morning — are you still looking for an accordionist?' });
    expect(await api.findThread(P.beatrice, P.nicolo)).toBe(threadId);
    expect((await api.getBadges(P.beatrice)).unreadMessages).toBe(before + 1);
    const inbox = await api.listThreads(P.beatrice);
    expect(inbox[0]).toMatchObject({ unread: 1, other: { name: 'Nicolò Baldini' } });

    await api.markThreadRead(threadId, P.beatrice);
    await api.sendMessage({ fromId: P.beatrice, toId: P.nicolo, body: 'Yes! Sending details now.' });
    const reloaded = make(store);
    const thread = await reloaded.getThread(threadId, P.nicolo);
    expect(thread.messages.map((m) => m.body)).toEqual(['Good morning — are you still looking for an accordionist?', 'Yes! Sending details now.']);
    expect((await reloaded.getBadges(P.beatrice)).unreadMessages).toBe(before);
    await expect(reloaded.getThread(threadId, P.giulia)).rejects.toBeInstanceOf(ApiError);
    await expect(api.sendMessage({ fromId: P.nicolo, toId: P.beatrice, body: '   ' })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('mock API — network and endorsements', () => {
  it('handles connection requests in both directions', async () => {
    const net = await api.getNetwork(P.nicolo);
    expect(net.incoming.length).toBeGreaterThan(0);
    const req = net.incoming[0];
    await api.respondToConnection(req.connectionId, true, P.nicolo);
    const after = await api.getNetwork(P.nicolo);
    expect(after.connections.map((c) => c.account.id)).toContain(req.account.id);
    expect(after.incoming.map((c) => c.connectionId)).not.toContain(req.connectionId);

    const stranger = after.suggestions[0].account.id;
    await api.requestConnection(P.nicolo, stranger);
    expect((await api.getNetwork(P.nicolo)).outgoing.map((c) => c.account.id)).toContain(stranger);
    expect((await api.getProfile(stranger, P.nicolo)).relation.state).toBe('pending-out');
    // asking back accepts instead of duplicating
    await api.requestConnection(stranger, P.nicolo);
    expect((await api.getProfile(stranger, P.nicolo)).relation.state).toBe('connected');
  });

  it('only allows endorsements tied to a concert both people took part in', async () => {
    const profile = await api.getProfile('pietro-zanarini', P.nicolo);
    const shared = profile.relation.sharedConcerts;
    expect(shared.length).toBeGreaterThan(0);
    const text = 'Played In croce together in Rimini: a cellist who breathes with you.';

    const other = (await api.getProfile(P.hannah)).concerts.find((c) => !c.participants.some((p) => p.musicianId === P.nicolo))!;
    await expect(api.endorse(P.nicolo, 'm-pietro-zanarini', other.id, text)).rejects.toThrow(/concert/);
    await expect(api.endorse(P.nicolo, 'm-pietro-zanarini', shared[0].id, 'Great!')).rejects.toBeInstanceOf(ApiError);

    const before = profile.endorsements.length;
    await api.endorse(P.nicolo, 'm-pietro-zanarini', shared[0].id, text);
    const after = await api.getProfile('pietro-zanarini', P.nicolo);
    expect(after.endorsements).toHaveLength(before + 1);
    expect(after.endorsements[0]).toMatchObject({ text, from: { name: 'Nicolò Baldini' }, concert: { id: shared[0].id } });
    expect(after.relation.endorsed).toBe(true);
    await expect(api.endorse(P.nicolo, 'm-pietro-zanarini', shared[0].id, text)).rejects.toThrow(/already/);
  });

  it('lets an organiser endorse someone who played for their organisation', async () => {
    const profile = await api.getProfile('costanza-bergonzi', P.beatrice);
    const concert = profile.relation.sharedConcerts.find((c) => c.orgId === 'org-naviglio')!;
    expect(concert).toBeDefined();
    if (!profile.relation.endorsed) {
      await api.endorse(P.beatrice, 'm-costanza-bergonzi', concert.id, 'Our continuo player for fifteen years; the ensemble is built around her.');
      expect((await api.getProfile('costanza-bergonzi', P.beatrice)).relation.endorsed).toBe(true);
    }
  });
});

describe('mock API — organisations, home and failures', () => {
  it('shows an organisation with members, concerts and open opportunities', async () => {
    const view = await api.getOrganisation('accademia-del-naviglio', P.beatrice);
    expect(view.isAdmin).toBe(true);
    expect(view.members.length).toBeGreaterThan(5);
    expect(view.past.length).toBeGreaterThan(5);
    expect(view.opportunities.length).toBeGreaterThanOrEqual(3);
    expect((await api.getOrganisation('accademia-del-naviglio', P.nicolo)).isAdmin).toBe(false);
  });

  it('lets only admins edit the page and manage members', async () => {
    await expect(api.updateOrganisation('org-naviglio', { about: 'x' }, P.nicolo)).rejects.toBeInstanceOf(ApiError);
    await api.updateOrganisation('org-naviglio', { about: 'A new description.' }, P.beatrice);
    await api.addMember('org-naviglio', P.nicolo, 'Guest accordion', P.beatrice);
    let view = await api.getOrganisation('org-naviglio');
    expect(view.organisation.about).toBe('A new description.');
    expect(view.members.find((m) => m.musician.id === P.nicolo)?.role).toBe('Guest accordion');
    expect((await api.getProfile(P.nicolo)).musician.positions[0]).toMatchObject({ organisation: 'Accademia del Naviglio' });
    await api.removeMember('org-naviglio', P.nicolo, P.beatrice);
    view = await api.getOrganisation('org-naviglio');
    expect(view.members.some((m) => m.musician.id === P.nicolo)).toBe(false);
  });

  it('builds a home view for each persona', async () => {
    for (const id of Object.values(P)) {
      const home = await api.getHome(id);
      expect(home.activity.length + home.upcomingConcerts.length, id).toBeGreaterThan(0);
    }
    expect((await api.getHome(P.nicolo)).opportunities.every((v) => v.fit?.instrumentMatch)).toBe(true);
    expect((await api.getHome(P.beatrice)).actions.newApplicants.length).toBeGreaterThan(0);
    expect((await api.getBadges(P.nicolo)).urgentCalls).toHaveLength(1);
  });

  it('surfaces failures as errors the UI can show', async () => {
    let down = false;
    const flaky = new MockApi({ store, now: () => clock, simulation: false, failing: () => down });
    await flaky.getMeta();
    down = true;
    await expect(flaky.getMeta()).rejects.toMatchObject({ code: 'network' });
    await expect(flaky.getProfile('nobody')).rejects.toBeInstanceOf(ApiError);
    down = false;
    await expect(flaky.getProfile('nobody')).rejects.toMatchObject({ code: 'not-found' });
  });
});
