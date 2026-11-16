import type {
  Account,
  Application,
  ApplicationStatus,
  Concert,
  Endorsement,
  ID,
  ISODate,
  Musician,
  Notification,
  Opportunity,
  Organisation,
} from '../../domain/types';
import { toISODate } from '../../domain/dates';
import { distanceKm } from '../../domain/geo';
import { normalise } from '../../domain/taxonomy';
import { searchMusicians, type MusicianMatch, type NetworkInfo } from '../../domain/search/engine';
import { filterOpportunities, opportunityFit } from '../../domain/search/opportunities';
import { EMPTY_QUERY, type MusicianQuery } from '../../domain/search/query';
import {
  ApiError,
  type AccountSummary,
  type ApplicantView,
  type ConcertView,
  type DataApi,
  type EndorsementView,
  type HomeView,
  type MusicianCard,
  type MyApplicationView,
  type OpportunityView,
  type OrganisationCard,
  type PostingView,
  type SearchHit,
  type SearchResponse,
  type SuggestionView,
} from '../api';
import { DB_VERSION, type Database, type ScheduledEvent } from './db';
import { buildSeed } from './seed';

/** Where the mock keeps its state. The browser uses localStorage; tests use memory. */
export interface Store {
  read(): string | null;
  write(json: string): void;
}

export function memoryStore(): Store {
  let value: string | null = null;
  return { read: () => value, write: (json) => void (value = json) };
}

export interface MockOptions {
  store: Store;
  /** Simulated network latency range in ms. */
  latency?: [number, number];
  now?: () => Date;
  /** When this returns true every call fails — used to demonstrate error states. */
  failing?: () => boolean;
  /** Seconds before simulated musicians answer invitations: [urgent, normal] ranges. */
  simulation?: { urgent: [number, number]; normal: [number, number] } | false;
}

const ACTIVE: ApplicationStatus[] = ['invited', 'applied', 'shortlisted', 'offered', 'confirmed'];

const SIM_YES = [
  'I can do it. Free all day — send me the parts and I will be there.',
  'Yes, count me in. I know the programme.',
  'Available and happy to help. What time is the first call?',
  'I am free. I can leave within the hour if needed.',
];
const SIM_NO = [
  'I am sorry, I am already booked that day.',
  'I would have loved to, but I am away on tour. Good luck finding someone!',
  'Not free this time — please keep me in mind for the next one.',
];

export class MockApi implements DataApi {
  private data: Database | null = null;
  private listeners = new Set<() => void>();
  private seq = 0;
  private rand = mulberry(0x1e9910);

  constructor(private opts: MockOptions) {}

  // ── Infrastructure ─────────────────────────────────────────────────────

  private now(): Date {
    return this.opts.now?.() ?? new Date();
  }

  private today(): ISODate {
    return toISODate(this.now());
  }

  private get db(): Database {
    if (this.data) return this.data;
    const raw = this.opts.store.read();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Database;
        if (parsed.meta?.version === DB_VERSION) return (this.data = parsed);
      } catch {
        // fall through to a fresh seed
      }
    }
    this.data = buildSeed(this.today(), this.now());
    this.save();
    return this.data;
  }

  private save(): void {
    if (!this.data) return;
    try {
      this.opts.store.write(JSON.stringify(this.data));
    } catch (e) {
      // Storage full or unavailable: keep working from memory for this session.
      console.warn('Leggio demo: could not persist data', e);
    }
  }

  /** Drop the in-memory copy so the next call re-reads the store (another tab changed it). */
  reload(): void {
    this.data = null;
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private id(prefix: string): ID {
    return `${prefix}-${this.now().getTime().toString(36)}-${(++this.seq).toString(36)}`;
  }

  /** Every call goes through here: latency, simulated failure, simulated activity. */
  private async call<T>(fn: () => T): Promise<T> {
    const [min, max] = this.opts.latency ?? [0, 0];
    if (max > 0) await new Promise((r) => setTimeout(r, min + this.rand() * (max - min)));
    if (this.opts.failing?.()) throw new ApiError('network', 'The server could not be reached. Check your connection and try again.');
    if (this.tick()) this.emit();
    // Callers get a copy, as they would from a network response.
    return structuredClone(fn());
  }

  private mutate<T>(fn: () => T): Promise<T> {
    return this.call(() => {
      const out = fn();
      this.save();
      return out;
    });
  }

  // ── Lookups ────────────────────────────────────────────────────────────

  private account(id: ID): Account {
    const a = this.db.accounts.find((x) => x.id === id);
    if (!a) throw new ApiError('not-found', 'This account does not exist.');
    return a;
  }

  private musician(id: ID): Musician {
    const m = this.db.musicians.find((x) => x.id === id);
    if (!m) throw new ApiError('not-found', 'This musician could not be found.');
    return m;
  }

  private opportunity(id: ID): Opportunity {
    const o = this.db.opportunities.find((x) => x.id === id);
    if (!o) throw new ApiError('not-found', 'This opportunity no longer exists.');
    return o;
  }

  private application(id: ID): Application {
    const a = this.db.applications.find((x) => x.id === id);
    if (!a) throw new ApiError('not-found', 'This application could not be found.');
    return a;
  }

  private org(id: ID | undefined): Organisation | undefined {
    return id ? this.db.organisations.find((o) => o.id === id) : undefined;
  }

  private summary(id: ID): AccountSummary {
    const a = this.db.accounts.find((x) => x.id === id);
    if (!a) return { id, kind: 'organiser', name: 'Former member', title: '', tint: 0 };
    const m = a.musicianId ? this.db.musicians.find((x) => x.id === a.musicianId) : undefined;
    return { id: a.id, kind: a.kind, name: a.name, title: m?.headline ?? a.title, tint: a.tint, slug: m?.slug };
  }

  private endorsementCounts(): Map<ID, number> {
    const map = new Map<ID, number>();
    for (const e of this.db.endorsements) map.set(e.toId, (map.get(e.toId) ?? 0) + 1);
    return map;
  }

  private card(m: Musician, counts = this.endorsementCounts()): MusicianCard {
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      headline: m.headline,
      instruments: m.instruments,
      roles: m.roles,
      base: m.base,
      travelRadiusKm: m.travelRadiusKm,
      travelsInternationally: m.travelsInternationally,
      fee: { min: m.fee.min, max: m.fee.max },
      urgentCalls: m.practical.urgentCalls,
      tint: m.tint,
      endorsements: counts.get(m.id) ?? 0,
      recordings: m.recordings.length,
    };
  }

  private concertView(c: Concert): ConcertView {
    return {
      ...c,
      orgSlug: this.org(c.orgId)?.slug,
      participants: c.participants.map((p) => {
        const m = this.db.musicians.find((x) => x.id === p.musicianId);
        return { ...p, name: m?.name ?? 'Unknown', slug: m?.slug ?? '' };
      }),
    };
  }

  private endorsementView(e: Endorsement): EndorsementView {
    const c = this.db.concerts.find((x) => x.id === e.concertId);
    return {
      id: e.id,
      text: e.text,
      createdAt: e.createdAt,
      from: this.summary(e.fromId),
      to: this.summary(e.toId),
      concert: c
        ? { id: c.id, date: c.date, venue: c.venue, city: c.city, ensembleName: c.ensembleName, programme: c.programme }
        : { id: e.concertId, date: e.createdAt.slice(0, 10), venue: '', city: '', programme: [] },
    };
  }

  /** Is this account part of the concert — on stage, or as the organisation that presented it? */
  private involved(accountId: ID, c: Concert): boolean {
    if (c.participants.some((p) => p.musicianId === accountId)) return true;
    return !!this.org(c.orgId)?.admins.includes(accountId);
  }

  private sharedConcerts(a: ID, b: ID): Concert[] {
    const today = this.today();
    return this.db.concerts.filter((c) => c.date <= today && this.involved(a, c) && this.involved(b, c));
  }

  private adjacency(): Map<ID, Set<ID>> {
    const adj = new Map<ID, Set<ID>>();
    const link = (a: ID, b: ID) => {
      const s = adj.get(a) ?? new Set<ID>();
      s.add(b);
      adj.set(a, s);
    };
    for (const c of this.db.connections) {
      if (c.status !== 'accepted') continue;
      link(c.from, c.to);
      link(c.to, c.from);
    }
    return adj;
  }

  private networkFor(viewerId: ID | undefined): Map<ID, NetworkInfo> {
    const out = new Map<ID, NetworkInfo>();
    if (!viewerId) return out;
    const adj = this.adjacency();
    const mine = adj.get(viewerId) ?? new Set<ID>();
    const shared = new Map<ID, number>();
    const today = this.today();
    for (const c of this.db.concerts) {
      if (c.date > today || !this.involved(viewerId, c)) continue;
      for (const p of c.participants) if (p.musicianId !== viewerId) shared.set(p.musicianId, (shared.get(p.musicianId) ?? 0) + 1);
    }
    for (const m of this.db.musicians) {
      if (m.id === viewerId) continue;
      const theirs = adj.get(m.id);
      let mutuals = 0;
      if (theirs) for (const x of mine) if (theirs.has(x)) mutuals++;
      const info = { connected: mine.has(m.id), sharedConcerts: shared.get(m.id) ?? 0, mutuals };
      if (info.connected || info.sharedConcerts || info.mutuals) out.set(m.id, info);
    }
    return out;
  }

  private canManage(accountId: ID, o: Opportunity): boolean {
    return o.postedBy === accountId || !!this.org(o.orgId)?.admins.includes(accountId);
  }

  private notify(n: Omit<Notification, 'id' | 'createdAt' | 'read'>): void {
    this.db.notifications.push({ ...n, id: this.id('n'), createdAt: this.now().toISOString(), read: false });
  }

  private orgRef(id: ID | undefined) {
    const o = this.org(id);
    return o ? { id: o.id, slug: o.slug, name: o.name, kind: o.kind } : undefined;
  }

  // ── Simulated activity ─────────────────────────────────────────────────

  /** Apply any simulated responses that have come due. */
  private tick(): boolean {
    const now = this.now().toISOString();
    const due = this.db.scheduled.filter((e) => e.at <= now);
    if (!due.length) return false;
    this.db.scheduled = this.db.scheduled.filter((e) => e.at > now);
    for (const e of due) {
      const app = this.db.applications.find((a) => a.id === e.applicationId);
      if (!app || (app.status !== 'invited' && app.status !== 'offered')) continue;
      this.answer(app, e.outcome === 'applied', e.message);
    }
    this.save();
    return true;
  }

  private schedule(app: Application, o: Opportunity): void {
    const sim = this.opts.simulation;
    if (sim === false || this.db.meta.personas.includes(app.musicianId)) return;
    const m = this.musician(app.musicianId);
    const [min, max] = (o.urgent ? sim?.urgent : sim?.normal) ?? (o.urgent ? [6, 28] : [15, 60]);
    const clash = opportunityFit(o, m).clashes.some((c) => c.status === 'busy');
    let outcome: ScheduledEvent['outcome'] | undefined;
    if (app.status === 'offered') outcome = this.rand() < 0.85 ? 'applied' : 'unavailable';
    else if (clash) outcome = 'unavailable';
    else if (o.urgent) outcome = m.practical.urgentCalls && this.rand() < 0.7 ? 'applied' : this.rand() < 0.6 ? 'unavailable' : undefined;
    else outcome = this.rand() < 0.55 ? 'applied' : this.rand() < 0.4 ? 'unavailable' : undefined;
    if (!outcome) return; // some people simply do not answer
    const pool = outcome === 'applied' ? SIM_YES : SIM_NO;
    this.db.scheduled.push({
      id: this.id('ev'),
      at: new Date(this.now().getTime() + (min + this.rand() * (max - min)) * 1000).toISOString(),
      kind: 'application-response',
      applicationId: app.id,
      outcome,
      message: app.status === 'offered' ? undefined : pool[Math.floor(this.rand() * pool.length)],
    });
  }

  /** A musician says yes or no to an invitation or an offer. */
  private answer(app: Application, accept: boolean, message?: string): void {
    const o = this.opportunity(app.opportunityId);
    const wasOffer = app.status === 'offered';
    if (app.status !== 'invited' && app.status !== 'offered') throw new ApiError('invalid', 'There is nothing to answer on this application.');
    app.status = accept ? (wasOffer ? 'confirmed' : 'applied') : 'unavailable';
    if (message) app.message = message;
    app.updatedAt = this.now().toISOString();
    if (app.status === 'confirmed') this.confirm(app, o);
    this.notify({ accountId: o.postedBy, kind: 'invitation-response', actorId: app.musicianId, opportunityId: o.id, status: app.status });
  }

  /** Engagement confirmed: block the dates in the musician's calendar; an urgent call is thereby filled. */
  private confirm(app: Application, o: Opportunity): void {
    const m = this.musician(app.musicianId);
    for (const d of o.dates) {
      if (d.kind === 'start') continue;
      m.availability[d.date] = { status: 'busy', note: o.title, opportunityId: o.id };
    }
    if (o.urgent) {
      o.status = 'filled';
      for (const other of this.db.applications) {
        if (other.opportunityId !== o.id || other.id === app.id) continue;
        if (!['invited', 'applied', 'shortlisted', 'offered'].includes(other.status)) continue;
        other.status = 'declined';
        other.updatedAt = this.now().toISOString();
        this.notify({ accountId: other.musicianId, kind: 'application-status', actorId: o.postedBy, opportunityId: o.id, status: 'declined' });
      }
      this.db.scheduled = this.db.scheduled.filter((e) => this.db.applications.find((a) => a.id === e.applicationId)?.opportunityId !== o.id);
    }
  }

  // ── Demo and session ───────────────────────────────────────────────────

  getMeta() {
    return this.call(() => ({
      anchor: this.db.meta.anchor,
      demoDate: this.db.meta.demoDate,
      seededAt: this.db.meta.seededAt,
      counts: {
        musicians: this.db.musicians.length,
        organisations: this.db.organisations.length,
        opportunities: this.db.opportunities.length,
        concerts: this.db.concerts.length,
      },
    }));
  }

  listPersonas() {
    return this.call(() => this.db.meta.personas.map((id) => ({ account: this.summary(id), base: this.account(id).base })));
  }

  getSession(accountId: ID) {
    return this.call(() => {
      const account = this.account(accountId);
      return {
        account,
        musician: account.musicianId ? this.musician(account.musicianId) : undefined,
        organisations: this.db.organisations.filter((o) => o.admins.includes(accountId)).map((o) => ({ id: o.id, slug: o.slug, name: o.name, kind: o.kind })),
      };
    });
  }

  async resetDemo() {
    this.data = buildSeed(this.today(), this.now());
    this.save();
    this.emit();
  }

  async poll() {
    if (this.opts.failing?.()) return false;
    const changed = this.tick();
    if (changed) this.emit();
    return changed;
  }

  // ── Finding musicians ──────────────────────────────────────────────────

  private runSearch(query: MusicianQuery, viewerId?: ID, exclude: ID[] = []): SearchResponse {
    const counts = this.endorsementCounts();
    const result = searchMusicians(query, {
      musicians: this.db.musicians.filter((m) => !exclude.includes(m.id)),
      today: this.today(),
      network: this.networkFor(viewerId),
      endorsements: counts,
      excludeId: viewerId,
    });
    const saved = new Set(viewerId ? (this.db.shortlists[viewerId] ?? []) : []);
    const hit = (m: MusicianMatch): SearchHit => ({
      musician: this.card(m.musician, counts),
      score: m.score,
      distanceKm: m.distanceKm,
      withinTravelRadius: m.withinTravelRadius,
      instrumentMatch: m.instrumentMatch,
      availability: m.availability,
      feeFit: m.feeFit,
      repertoire: m.repertoire.slice(0, 3),
      network: m.network,
      shortlisted: saved.has(m.musician.id),
    });
    return { hits: result.matches.map(hit), relaxations: result.relaxations, total: result.total };
  }

  searchMusicians(query: MusicianQuery, viewerId?: ID) {
    return this.call(() => this.runSearch(query, viewerId));
  }

  suggestPeople(text: string, viewerId?: ID, limit = 8) {
    return this.call(() => {
      const q = normalise(text);
      if (!q) return [];
      return this.db.accounts
        .filter((a) => a.id !== viewerId && normalise(a.name).includes(q))
        .sort((a, b) => Number(normalise(b.name).startsWith(q)) - Number(normalise(a.name).startsWith(q)) || a.name.localeCompare(b.name))
        .slice(0, limit)
        .map((a) => this.summary(a.id));
    });
  }

  getShortlist(accountId: ID) {
    return this.call(() => {
      const counts = this.endorsementCounts();
      return (this.db.shortlists[accountId] ?? []).flatMap((id) => {
        const m = this.db.musicians.find((x) => x.id === id);
        return m ? [this.card(m, counts)] : [];
      });
    });
  }

  toggleShortlist(accountId: ID, musicianId: ID) {
    return this.mutate(() => {
      this.musician(musicianId);
      const list = this.db.shortlists[accountId] ?? [];
      const on = !list.includes(musicianId);
      this.db.shortlists[accountId] = on ? [...list, musicianId] : list.filter((x) => x !== musicianId);
      return on;
    });
  }

  // ── Profiles ───────────────────────────────────────────────────────────

  getProfile(slugOrId: string, viewerId?: ID) {
    return this.call(() => {
      const m = this.db.musicians.find((x) => x.slug === slugOrId || x.id === slugOrId);
      if (!m) throw new ApiError('not-found', 'This musician could not be found.');
      const concerts = this.db.concerts.filter((c) => c.participants.some((p) => p.musicianId === m.id)).map((c) => this.concertView(c));
      const endorsements = this.db.endorsements
        .filter((e) => e.toId === m.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((e) => this.endorsementView(e));
      const adj = this.adjacency();
      const theirs = adj.get(m.id) ?? new Set<ID>();
      const self = viewerId === m.id;
      const conn = viewerId ? this.db.connections.find((c) => (c.from === viewerId && c.to === m.id) || (c.to === viewerId && c.from === m.id)) : undefined;
      const mine = viewerId ? (adj.get(viewerId) ?? new Set<ID>()) : new Set<ID>();
      return {
        musician: m,
        concerts,
        endorsements,
        organisations: this.db.organisations.flatMap((o) => {
          const mem = o.members.find((x) => x.musicianId === m.id);
          return mem ? [{ id: o.id, slug: o.slug, name: o.name, kind: o.kind, role: mem.role }] : [];
        }),
        connections: theirs.size,
        relation: {
          state: self ? ('self' as const) : !conn ? ('none' as const) : conn.status === 'accepted' ? ('connected' as const) : conn.from === viewerId ? ('pending-out' as const) : ('pending-in' as const),
          connectionId: conn?.id,
          sharedConcerts: viewerId && !self ? this.sharedConcerts(viewerId, m.id).map((c) => this.concertView(c)) : [],
          mutuals: self ? [] : [...mine].filter((x) => theirs.has(x)).slice(0, 12).map((x) => this.summary(x)),
          endorsed: !!viewerId && this.db.endorsements.some((e) => e.fromId === viewerId && e.toId === m.id),
        },
        shortlisted: !!viewerId && (this.db.shortlists[viewerId] ?? []).includes(m.id),
      };
    });
  }

  updateMusician(id: ID, patch: Parameters<DataApi['updateMusician']>[1]) {
    return this.mutate(() => {
      const m = this.musician(id);
      if (patch.fee && (patch.fee.min < 0 || patch.fee.max < patch.fee.min)) throw new ApiError('invalid', 'The fee range is not valid.');
      Object.assign(m, patch);
      m.updatedAt = this.now().toISOString();
      const a = this.account(id);
      a.title = m.headline;
      a.base = m.base;
      return m;
    });
  }

  setAvailability(id: ID, dates: ISODate[], status: 'free' | 'busy' | 'tentative', note?: string) {
    return this.mutate(() => {
      const m = this.musician(id);
      for (const d of dates) {
        if (status === 'free') delete m.availability[d];
        else m.availability[d] = { status, note: note || undefined };
      }
      m.updatedAt = this.now().toISOString();
      return m.availability;
    });
  }

  addConcert(input: Parameters<DataApi['addConcert']>[0], creatorId: ID) {
    return this.mutate(() => {
      if (!input.venue.trim() || !input.city.trim() || !input.programme.length) throw new ApiError('invalid', 'A concert needs a venue, a city and at least one work.');
      const c: Concert = {
        id: this.id('c'),
        date: input.date,
        venue: input.venue.trim(),
        city: input.city.trim(),
        country: input.country,
        kind: 'chamber',
        orgId: input.orgId,
        ensembleName: input.orgId ? this.org(input.orgId)?.name : input.ensembleName?.trim() || undefined,
        programme: input.programme,
        participants: input.participants,
        createdBy: creatorId,
      };
      this.db.concerts.push(c);
      this.db.concerts.sort((a, b) => b.date.localeCompare(a.date));
      return c;
    });
  }

  deleteConcert(concertId: ID, byId: ID) {
    return this.mutate(() => {
      const c = this.db.concerts.find((x) => x.id === concertId);
      if (!c) throw new ApiError('not-found', 'This concert could not be found.');
      if (c.createdBy !== byId) throw new ApiError('forbidden', 'Only the person who added a concert can remove it.');
      this.db.concerts = this.db.concerts.filter((x) => x.id !== concertId);
      this.db.endorsements = this.db.endorsements.filter((e) => e.concertId !== concertId);
    });
  }

  // ── Opportunities ──────────────────────────────────────────────────────

  private opportunityView(o: Opportunity, viewerId?: ID): OpportunityView {
    const viewer = viewerId ? this.db.musicians.find((m) => m.id === viewerId) : undefined;
    return {
      opportunity: o,
      poster: this.summary(o.postedBy),
      organisation: this.orgRef(o.orgId),
      fit: viewer ? opportunityFit(o, viewer) : undefined,
      myApplication: viewerId ? this.db.applications.find((a) => a.opportunityId === o.id && a.musicianId === viewerId) : undefined,
      applicants: this.db.applications.filter((a) => a.opportunityId === o.id && a.status !== 'invited' && a.status !== 'withdrawn' && a.status !== 'unavailable').length,
      isMine: !!viewerId && this.canManage(viewerId, o),
    };
  }

  listOpportunities(query: Parameters<DataApi['listOpportunities']>[0], viewerId?: ID) {
    return this.call(() => filterOpportunities(this.db.opportunities.filter((o) => o.status === 'open'), query).map((o) => this.opportunityView(o, viewerId)));
  }

  getOpportunity(id: ID, viewerId?: ID) {
    return this.call(() => this.opportunityView(this.opportunity(id), viewerId));
  }

  createOpportunity(input: Parameters<DataApi['createOpportunity']>[0], accountId: ID) {
    return this.mutate(() => {
      this.account(accountId);
      if (!input.title.trim()) throw new ApiError('invalid', 'Give the opportunity a title.');
      if (!(input.fee.amount > 0)) throw new ApiError('invalid', 'Every opportunity on Leggio states its fee.');
      if (input.fee.max != null && input.fee.max < input.fee.amount) throw new ApiError('invalid', 'The upper fee must be higher than the lower one.');
      if (!input.dates.length) throw new ApiError('invalid', 'Add at least one date.');
      if (input.orgId && !this.org(input.orgId)?.admins.includes(accountId)) throw new ApiError('forbidden', 'You cannot post on behalf of this organisation.');
      const o: Opportunity = {
        ...input,
        id: this.id('opp'),
        title: input.title.trim(),
        dates: [...input.dates].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
        postedBy: accountId,
        urgent: input.urgent || input.type === 'substitution',
        status: 'open',
        createdAt: this.now().toISOString(),
      };
      this.db.opportunities.unshift(o);
      return o;
    });
  }

  setOpportunityStatus(id: ID, status: Opportunity['status'], accountId: ID) {
    return this.mutate(() => {
      const o = this.opportunity(id);
      if (!this.canManage(accountId, o)) throw new ApiError('forbidden', 'Only the person who posted this can change it.');
      o.status = status;
      return o;
    });
  }

  apply(opportunityId: ID, musicianId: ID, message: string) {
    return this.mutate(() => {
      const o = this.opportunity(opportunityId);
      this.musician(musicianId);
      if (o.status !== 'open') throw new ApiError('invalid', 'This opportunity is no longer open.');
      if (this.canManage(musicianId, o)) throw new ApiError('invalid', 'You cannot apply to your own posting.');
      const existing = this.db.applications.find((a) => a.opportunityId === opportunityId && a.musicianId === musicianId);
      const now = this.now().toISOString();
      let app: Application;
      if (existing && ACTIVE.includes(existing.status) && existing.status !== 'invited') throw new ApiError('invalid', 'You have already applied.');
      if (existing) {
        existing.status = 'applied';
        existing.message = message.trim() || undefined;
        existing.updatedAt = now;
        app = existing;
      } else {
        app = { id: this.id('ap'), opportunityId, musicianId, origin: 'applied', status: 'applied', message: message.trim() || undefined, createdAt: now, updatedAt: now };
        this.db.applications.push(app);
      }
      this.notify({ accountId: o.postedBy, kind: 'application', actorId: musicianId, opportunityId });
      return app;
    });
  }

  withdraw(applicationId: ID, musicianId: ID) {
    return this.mutate(() => {
      const app = this.application(applicationId);
      if (app.musicianId !== musicianId) throw new ApiError('forbidden', 'This is not your application.');
      const o = this.opportunity(app.opportunityId);
      if (app.status === 'confirmed') {
        const m = this.musician(musicianId);
        for (const [d, e] of Object.entries(m.availability)) if (e.opportunityId === o.id) delete m.availability[d];
      }
      app.status = 'withdrawn';
      app.updatedAt = this.now().toISOString();
      this.notify({ accountId: o.postedBy, kind: 'invitation-response', actorId: musicianId, opportunityId: o.id, status: 'withdrawn' });
      return app;
    });
  }

  invite(opportunityId: ID, musicianIds: ID[], message: string, fromId: ID) {
    return this.mutate(() => {
      const o = this.opportunity(opportunityId);
      if (!this.canManage(fromId, o)) throw new ApiError('forbidden', 'Only the person who posted this can invite musicians.');
      if (o.status !== 'open') throw new ApiError('invalid', 'This opportunity is no longer open.');
      const now = this.now().toISOString();
      const out: Application[] = [];
      for (const musicianId of musicianIds) {
        this.musician(musicianId);
        if (musicianId === fromId) continue;
        if (this.db.applications.some((a) => a.opportunityId === opportunityId && a.musicianId === musicianId && a.status !== 'withdrawn')) continue;
        const app: Application = { id: this.id('ap'), opportunityId, musicianId, origin: 'invited', status: 'invited', inviteMessage: message.trim() || undefined, createdAt: now, updatedAt: now };
        this.db.applications.push(app);
        this.notify({ accountId: musicianId, kind: o.urgent ? 'urgent-call' : 'invitation', actorId: fromId, opportunityId });
        this.schedule(app, o);
        out.push(app);
      }
      return out;
    });
  }

  respond(applicationId: ID, musicianId: ID, accept: boolean, message?: string) {
    return this.mutate(() => {
      const app = this.application(applicationId);
      if (app.musicianId !== musicianId) throw new ApiError('forbidden', 'This is not your invitation.');
      const o = this.opportunity(app.opportunityId);
      if (o.status !== 'open' && accept) throw new ApiError('invalid', 'This opportunity has already been filled.');
      this.answer(app, accept, message?.trim() || undefined);
      return app;
    });
  }

  setApplicationStatus(applicationId: ID, status: Parameters<DataApi['setApplicationStatus']>[1], accountId: ID) {
    return this.mutate(() => {
      const app = this.application(applicationId);
      const o = this.opportunity(app.opportunityId);
      if (!this.canManage(accountId, o)) throw new ApiError('forbidden', 'Only the person who posted this can review applicants.');
      if (!['applied', 'shortlisted', 'offered', 'declined'].includes(app.status)) throw new ApiError('invalid', 'This application can no longer be changed.');
      if (status === 'confirmed' && !o.urgent) throw new ApiError('invalid', 'Make an offer first; the musician confirms it.');
      app.status = status;
      app.updatedAt = this.now().toISOString();
      if (status === 'confirmed') this.confirm(app, o);
      if (status !== 'applied') this.notify({ accountId: app.musicianId, kind: 'application-status', actorId: accountId, opportunityId: o.id, status });
      if (status === 'offered') this.schedule(app, o);
      return app;
    });
  }

  listApplicants(opportunityId: ID, accountId: ID) {
    return this.call(() => {
      const o = this.opportunity(opportunityId);
      if (!this.canManage(accountId, o)) throw new ApiError('forbidden', 'Only the person who posted this can see its applicants.');
      const counts = this.endorsementCounts();
      const network = this.networkFor(accountId);
      const rank: Record<ApplicationStatus, number> = { confirmed: 0, offered: 1, shortlisted: 2, applied: 3, invited: 4, unavailable: 5, declined: 6, withdrawn: 7 };
      return this.db.applications
        .filter((a) => a.opportunityId === opportunityId)
        .sort((a, b) => rank[a.status] - rank[b.status] || b.updatedAt.localeCompare(a.updatedAt))
        .map((a): ApplicantView => {
          const m = this.musician(a.musicianId);
          return { application: a, musician: this.card(m, counts), fit: opportunityFit(o, m), network: network.get(m.id) };
        });
    });
  }

  private posting(o: Opportunity): PostingView {
    const apps = this.db.applications.filter((a) => a.opportunityId === o.id);
    const n = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
    return {
      opportunity: o,
      organisation: this.orgRef(o.orgId),
      counts: { applied: n('applied'), shortlisted: n('shortlisted'), invited: n('invited'), offered: n('offered'), confirmed: n('confirmed'), total: apps.filter((a) => a.status !== 'withdrawn').length },
    };
  }

  listPostings(accountId: ID) {
    return this.call(() =>
      this.db.opportunities
        .filter((o) => this.canManage(accountId, o))
        .sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || b.createdAt.localeCompare(a.createdAt))
        .map((o) => this.posting(o)),
    );
  }

  private myApplication(a: Application): MyApplicationView {
    const o = this.opportunity(a.opportunityId);
    return { application: a, opportunity: o, poster: this.summary(o.postedBy), organisation: this.orgRef(o.orgId) };
  }

  listMyApplications(musicianId: ID) {
    return this.call(() =>
      this.db.applications
        .filter((a) => a.musicianId === musicianId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((a) => this.myApplication(a)),
    );
  }

  suggestForOpportunity(opportunityId: ID, accountId: ID) {
    return this.call(() => {
      const o = this.opportunity(opportunityId);
      if (!this.canManage(accountId, o)) throw new ApiError('forbidden', 'Only the person who posted this can see suggestions.');
      const dates = o.dates.filter((d) => d.kind !== 'start').map((d) => d.date).sort();
      const first = dates[0];
      const last = dates[dates.length - 1];
      const query: MusicianQuery = {
        ...EMPTY_QUERY,
        instruments: o.instruments,
        place: { name: o.place.name, lat: o.place.lat, lng: o.place.lng, cityId: o.place.cityId },
        radiusKm: o.urgent ? 150 : 250,
        date: first && first >= this.today() ? first : undefined,
        dateTo: first && last && last > first && last <= first.slice(0, 8) + '31' ? last : undefined,
        budget: o.fee.unit === 'total' ? (o.fee.max ?? o.fee.amount) : undefined,
        urgentOnly: o.urgent,
      };
      const taken = this.db.applications.filter((a) => a.opportunityId === o.id && a.status !== 'withdrawn').map((a) => a.musicianId);
      const res = this.runSearch(query, accountId, taken);
      // People who already know the programme come first.
      const knows = (id: ID) => opportunityFit(o, this.musician(id)).known.length;
      res.hits = res.hits.map((h) => ({ h, k: knows(h.musician.id) })).sort((a, b) => b.k - a.k || b.h.score - a.h.score).map((x) => x.h).slice(0, 12);
      return res;
    });
  }

  // ── Network ────────────────────────────────────────────────────────────

  getNetwork(accountId: ID) {
    return this.call(() => {
      this.account(accountId);
      const adj = this.adjacency();
      const mine = adj.get(accountId) ?? new Set<ID>();
      const today = this.today();
      const sharedWith = new Map<ID, Concert[]>();
      for (const c of this.db.concerts) {
        if (c.date > today || !this.involved(accountId, c)) continue;
        for (const p of c.participants) {
          if (p.musicianId === accountId) continue;
          const list = sharedWith.get(p.musicianId) ?? [];
          list.push(c);
          sharedWith.set(p.musicianId, list);
        }
      }
      const view = (c: (typeof this.db.connections)[number]) => {
        const other = c.from === accountId ? c.to : c.from;
        return { connectionId: c.id, account: this.summary(other), since: c.createdAt, sharedConcerts: sharedWith.get(other)?.length ?? 0 };
      };
      const all = this.db.connections.filter((c) => c.from === accountId || c.to === accountId);
      const pendingIds = new Set(all.map((c) => (c.from === accountId ? c.to : c.from)));
      const endorsed = new Set(this.db.endorsements.filter((e) => e.fromId === accountId).map((e) => e.toId));
      const suggestion = (id: ID): SuggestionView => {
        const list = sharedWith.get(id) ?? [];
        const last = list[0];
        const theirs = adj.get(id) ?? new Set<ID>();
        let mutuals = 0;
        for (const x of mine) if (theirs.has(x)) mutuals++;
        return {
          account: this.summary(id),
          sharedConcerts: list.length,
          mutuals,
          lastConcert: last ? { id: last.id, date: last.date, venue: last.venue, city: last.city, ensembleName: last.ensembleName } : undefined,
        };
      };
      return {
        connections: all.filter((c) => c.status === 'accepted').map(view).sort((a, b) => a.account.name.localeCompare(b.account.name)),
        incoming: all.filter((c) => c.status === 'pending' && c.to === accountId).map(view),
        outgoing: all.filter((c) => c.status === 'pending' && c.from === accountId).map(view),
        suggestions: [...sharedWith.keys()]
          .filter((id) => !pendingIds.has(id))
          .map(suggestion)
          .sort((a, b) => b.sharedConcerts - a.sharedConcerts || b.mutuals - a.mutuals)
          .slice(0, 12),
        endorsable: [...sharedWith.keys()]
          .filter((id) => mine.has(id) && !endorsed.has(id))
          .map(suggestion)
          .sort((a, b) => (b.lastConcert?.date ?? '').localeCompare(a.lastConcert?.date ?? ''))
          .slice(0, 8),
        received: this.db.endorsements.filter((e) => e.toId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => this.endorsementView(e)),
        given: this.db.endorsements.filter((e) => e.fromId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => this.endorsementView(e)),
      };
    });
  }

  requestConnection(fromId: ID, toId: ID) {
    return this.mutate(() => {
      this.account(fromId);
      this.account(toId);
      if (fromId === toId) throw new ApiError('invalid', 'You cannot connect with yourself.');
      const existing = this.db.connections.find((c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
      if (existing) {
        // They had already asked: accept instead of duplicating.
        if (existing.status === 'pending' && existing.to === fromId) {
          existing.status = 'accepted';
          this.notify({ accountId: toId, kind: 'connection-accepted', actorId: fromId });
        }
        return;
      }
      this.db.connections.push({ id: this.id('cn'), from: fromId, to: toId, status: 'pending', createdAt: this.now().toISOString() });
      this.notify({ accountId: toId, kind: 'connection-request', actorId: fromId });
    });
  }

  respondToConnection(connectionId: ID, accept: boolean, byId: ID) {
    return this.mutate(() => {
      const c = this.db.connections.find((x) => x.id === connectionId);
      if (!c) throw new ApiError('not-found', 'This request no longer exists.');
      if (c.to !== byId) throw new ApiError('forbidden', 'This request was not sent to you.');
      if (accept) {
        c.status = 'accepted';
        c.createdAt = this.now().toISOString();
        this.notify({ accountId: c.from, kind: 'connection-accepted', actorId: byId });
      } else {
        this.db.connections = this.db.connections.filter((x) => x.id !== connectionId);
      }
    });
  }

  removeConnection(connectionId: ID, byId: ID) {
    return this.mutate(() => {
      const c = this.db.connections.find((x) => x.id === connectionId);
      if (!c) return;
      if (c.from !== byId && c.to !== byId) throw new ApiError('forbidden', 'This is not your connection.');
      this.db.connections = this.db.connections.filter((x) => x.id !== connectionId);
    });
  }

  endorse(fromId: ID, toId: ID, concertId: ID, text: string) {
    return this.mutate(() => {
      this.account(fromId);
      this.musician(toId);
      const clean = text.trim();
      if (fromId === toId) throw new ApiError('invalid', 'You cannot endorse yourself.');
      if (clean.length < 20) throw new ApiError('invalid', 'Say a little more — at least a sentence about working together.');
      const c = this.db.concerts.find((x) => x.id === concertId);
      // The rule that makes endorsements worth reading: both people were part of the same concert.
      if (!c || c.date > this.today() || !this.involved(fromId, c) || !c.participants.some((p) => p.musicianId === toId)) {
        throw new ApiError('forbidden', 'Endorsements are tied to a concert you both took part in.');
      }
      if (this.db.endorsements.some((e) => e.fromId === fromId && e.toId === toId)) throw new ApiError('invalid', 'You have already endorsed this musician.');
      this.db.endorsements.push({ id: this.id('en'), fromId, toId, concertId, text: clean, createdAt: this.now().toISOString() });
      this.notify({ accountId: toId, kind: 'endorsement', actorId: fromId });
    });
  }

  // ── Organisations ──────────────────────────────────────────────────────

  listOrganisations(text = '') {
    return this.call(() => {
      const q = normalise(text);
      const today = this.today();
      return this.db.organisations
        .filter((o) => !q || normalise(`${o.name} ${o.base.name} ${o.kind}`).includes(q))
        .map(
          (o): OrganisationCard => ({
            id: o.id,
            slug: o.slug,
            name: o.name,
            kind: o.kind,
            base: o.base,
            founded: o.founded,
            tint: o.tint,
            members: o.members.length,
            concerts: this.db.concerts.filter((c) => c.orgId === o.id && c.date <= today).length,
            openOpportunities: this.db.opportunities.filter((x) => x.orgId === o.id && x.status === 'open').length,
          }),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  getOrganisation(slug: string, viewerId?: ID) {
    return this.call(() => {
      const o = this.db.organisations.find((x) => x.slug === slug || x.id === slug);
      if (!o) throw new ApiError('not-found', 'This organisation could not be found.');
      const counts = this.endorsementCounts();
      const today = this.today();
      const concerts = this.db.concerts.filter((c) => c.orgId === o.id);
      const memberIds = new Set(o.members.map((m) => m.musicianId));
      const guestCounts = new Map<ID, number>();
      for (const c of concerts) for (const p of c.participants) if (!memberIds.has(p.musicianId)) guestCounts.set(p.musicianId, (guestCounts.get(p.musicianId) ?? 0) + 1);
      return {
        organisation: o,
        admins: o.admins.map((id) => this.summary(id)),
        isAdmin: !!viewerId && o.admins.includes(viewerId),
        members: o.members.flatMap((mem) => {
          const m = this.db.musicians.find((x) => x.id === mem.musicianId);
          return m ? [{ musician: this.card(m, counts), role: mem.role, since: mem.since }] : [];
        }),
        guests: [...guestCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .flatMap(([id, n]) => {
            const m = this.db.musicians.find((x) => x.id === id);
            return m ? [{ musician: this.card(m, counts), concerts: n }] : [];
          }),
        upcoming: concerts.filter((c) => c.date > today).sort((a, b) => a.date.localeCompare(b.date)).map((c) => this.concertView(c)),
        past: concerts.filter((c) => c.date <= today).slice(0, 30).map((c) => this.concertView(c)),
        opportunities: this.db.opportunities.filter((x) => x.orgId === o.id && x.status === 'open'),
      };
    });
  }

  private adminOrg(id: ID, byId: ID): Organisation {
    const o = this.org(id);
    if (!o) throw new ApiError('not-found', 'This organisation could not be found.');
    if (!o.admins.includes(byId)) throw new ApiError('forbidden', 'Only an administrator of this page can edit it.');
    return o;
  }

  updateOrganisation(id: ID, patch: { about?: string }, byId: ID) {
    return this.mutate(() => {
      const o = this.adminOrg(id, byId);
      if (patch.about != null) o.about = patch.about.trim();
      return o;
    });
  }

  addMember(orgId: ID, musicianId: ID, role: string, byId: ID) {
    return this.mutate(() => {
      const o = this.adminOrg(orgId, byId);
      const m = this.musician(musicianId);
      if (o.members.some((x) => x.musicianId === musicianId)) throw new ApiError('invalid', `${m.name} is already a member.`);
      const year = this.now().getFullYear();
      o.members.push({ musicianId, role: role.trim() || 'Member', since: year });
      m.positions.unshift({ id: this.id('pos'), title: role.trim() || 'Member', organisation: o.name, orgId: o.id, from: year });
    });
  }

  removeMember(orgId: ID, musicianId: ID, byId: ID) {
    return this.mutate(() => {
      const o = this.adminOrg(orgId, byId);
      o.members = o.members.filter((x) => x.musicianId !== musicianId);
      const m = this.db.musicians.find((x) => x.id === musicianId);
      if (m) m.positions = m.positions.filter((p) => p.orgId !== orgId);
    });
  }

  // ── Messages ───────────────────────────────────────────────────────────

  private oppRef(id: ID | undefined) {
    const o = id ? this.db.opportunities.find((x) => x.id === id) : undefined;
    return o ? { id: o.id, title: o.title } : undefined;
  }

  listThreads(accountId: ID) {
    return this.call(() =>
      this.db.threads
        .filter((t) => t.participants.includes(accountId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .flatMap((t) => {
          const msgs = this.db.messages.filter((m) => m.threadId === t.id);
          if (!msgs.length) return [];
          return [
            {
              thread: t,
              other: this.summary(t.participants.find((p) => p !== accountId) ?? accountId),
              last: msgs[msgs.length - 1],
              unread: msgs.filter((m) => m.fromId !== accountId && !m.readBy.includes(accountId)).length,
              opportunity: this.oppRef(t.opportunityId),
            },
          ];
        }),
    );
  }

  getThread(threadId: ID, accountId: ID) {
    return this.call(() => {
      const t = this.db.threads.find((x) => x.id === threadId);
      if (!t || !t.participants.includes(accountId)) throw new ApiError('not-found', 'This conversation could not be found.');
      return {
        thread: t,
        other: this.summary(t.participants.find((p) => p !== accountId) ?? accountId),
        messages: this.db.messages.filter((m) => m.threadId === t.id),
        opportunity: this.oppRef(t.opportunityId),
      };
    });
  }

  findThread(accountId: ID, otherId: ID) {
    return this.call(() => this.db.threads.find((t) => t.participants.includes(accountId) && t.participants.includes(otherId))?.id);
  }

  sendMessage(input: { fromId: ID; toId: ID; body: string; opportunityId?: ID }) {
    return this.mutate(() => {
      const body = input.body.trim();
      if (!body) throw new ApiError('invalid', 'Write a message first.');
      this.account(input.fromId);
      this.account(input.toId);
      if (input.fromId === input.toId) throw new ApiError('invalid', 'You cannot message yourself.');
      const now = this.now().toISOString();
      let t = this.db.threads.find((x) => x.participants.includes(input.fromId) && x.participants.includes(input.toId));
      if (!t) {
        t = { id: this.id('th'), participants: [input.fromId, input.toId], opportunityId: input.opportunityId, updatedAt: now };
        this.db.threads.push(t);
      }
      t.updatedAt = now;
      if (input.opportunityId) t.opportunityId = input.opportunityId;
      this.db.messages.push({ id: this.id('msg'), threadId: t.id, fromId: input.fromId, body, sentAt: now, readBy: [input.fromId] });
      return { threadId: t.id };
    });
  }

  markThreadRead(threadId: ID, accountId: ID) {
    return this.mutate(() => {
      for (const m of this.db.messages) if (m.threadId === threadId && !m.readBy.includes(accountId)) m.readBy.push(accountId);
    });
  }

  // ── Home and notifications ─────────────────────────────────────────────

  private unreadMessages(accountId: ID): number {
    const mine = new Set(this.db.threads.filter((t) => t.participants.includes(accountId)).map((t) => t.id));
    return this.db.messages.filter((m) => mine.has(m.threadId) && m.fromId !== accountId && !m.readBy.includes(accountId)).length;
  }

  getBadges(accountId: ID) {
    return this.call(() => ({
      unreadMessages: this.unreadMessages(accountId),
      unreadNotifications: this.db.notifications.filter((n) => n.accountId === accountId && !n.read).length,
      urgentCalls: this.db.applications
        .filter((a) => a.musicianId === accountId && a.status === 'invited')
        .map((a) => this.myApplication(a))
        .filter((v) => v.opportunity.urgent && v.opportunity.status === 'open'),
    }));
  }

  getHome(accountId: ID): Promise<HomeView> {
    return this.call(() => {
      const account = this.account(accountId);
      const me = account.musicianId ? this.musician(account.musicianId) : undefined;
      const today = this.today();
      const adj = this.adjacency();
      const mine = adj.get(accountId) ?? new Set<ID>();
      const myApps = this.db.applications.filter((a) => a.musicianId === accountId).map((a) => this.myApplication(a));

      const upcoming = this.db.concerts
        .filter((c) => c.date >= today)
        .map((c) => ({ c, mine: c.participants.some((p) => p.musicianId === accountId) || (!!c.orgId && !!this.org(c.orgId)?.admins.includes(accountId)), people: c.participants.filter((p) => mine.has(p.musicianId)) }))
        .filter((x) => x.mine || x.people.length)
        .sort((a, b) => a.c.date.localeCompare(b.c.date))
        .slice(0, 6)
        .map((x) => ({ concert: this.concertView(x.c), people: x.people.slice(0, 5).map((p) => this.summary(p.musicianId)), mine: x.mine }));

      const open = this.db.opportunities.filter((o) => o.status === 'open' && !this.canManage(accountId, o));
      const forMe = me
        ? open
            .filter((o) => {
              const fit = opportunityFit(o, me);
              return fit.instrumentMatch && o.instruments.length > 0 && (fit.withinTravelRadius || o.travel !== 'none');
            })
            .sort((a, b) => Number(b.urgent) - Number(a.urgent) || distanceKm(a.place, me.base) - distanceKm(b.place, me.base))
            .slice(0, 5)
        : [];

      const activity: HomeView['activity'] = [];
      for (const e of this.db.endorsements) {
        if (e.toId === accountId || e.fromId === accountId) continue;
        if (mine.has(e.toId) || mine.has(e.fromId)) activity.push({ kind: 'endorsement', id: e.id, at: e.createdAt, endorsement: this.endorsementView(e) });
      }
      for (const o of open) {
        const org = this.org(o.orgId);
        const close = mine.has(o.postedBy) || !!org?.members.some((m) => mine.has(m.musicianId) || m.musicianId === accountId);
        if (close) activity.push({ kind: 'opportunity', id: o.id, at: o.createdAt, opportunity: o, poster: this.summary(o.postedBy), organisation: org ? { name: org.name, slug: org.slug } : undefined });
      }
      for (const c of this.db.connections) {
        if (c.status !== 'accepted' || c.from === accountId || c.to === accountId) continue;
        if (mine.has(c.from) && mine.has(c.to)) activity.push({ kind: 'connection', id: c.id, at: c.createdAt, a: this.summary(c.from), b: this.summary(c.to) });
      }
      activity.sort((a, b) => b.at.localeCompare(a.at));

      return {
        actions: {
          invitations: myApps.filter((v) => v.application.status === 'invited' && v.opportunity.status === 'open'),
          offers: myApps.filter((v) => v.application.status === 'offered'),
          newApplicants: this.db.opportunities
            .filter((o) => o.status === 'open' && this.canManage(accountId, o))
            .map((o) => this.posting(o))
            .filter((p) => p.counts.applied > 0),
          connectionRequests: this.db.connections.filter((c) => c.status === 'pending' && c.to === accountId).length,
          unreadMessages: this.unreadMessages(accountId),
        },
        upcomingConcerts: upcoming,
        opportunities: forMe.map((o) => this.opportunityView(o, accountId)),
        activity: activity.slice(0, 12),
      };
    });
  }

  listNotifications(accountId: ID) {
    return this.call(() =>
      this.db.notifications
        .filter((n) => n.accountId === accountId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30)
        .map((n) => {
          const o = n.opportunityId ? this.db.opportunities.find((x) => x.id === n.opportunityId) : undefined;
          return { notification: n, actor: n.actorId ? this.summary(n.actorId) : undefined, opportunity: o ? { id: o.id, title: o.title, urgent: o.urgent } : undefined };
        }),
    );
  }

  markNotificationsRead(accountId: ID) {
    return this.mutate(() => {
      for (const n of this.db.notifications) if (n.accountId === accountId) n.read = true;
    });
  }
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
