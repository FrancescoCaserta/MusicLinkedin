import type {
  Account,
  AccountKind,
  Application,
  ApplicationStatus,
  AvailabilityEntry,
  Concert,
  ConcertParticipant,
  EventFormat,
  EventSession,
  Fee,
  ID,
  ISODate,
  ISODateTime,
  Message,
  Musician,
  Notification,
  Opportunity,
  OpportunityDate,
  OpportunityType,
  Organisation,
  OrganisationKind,
  Place,
  PlayedInstrument,
  ProgrammeItem,
  RepertoireItem,
  RoleId,
  Thread,
  TravelCover,
} from '../domain/types';
import type { Availability, FeeFit, NetworkInfo, Relaxation } from '../domain/search/engine';
import type { OpportunityFit, OpportunityQuery } from '../domain/search/opportunities';
import type { MusicianQuery } from '../domain/search/query';

/**
 * The data-access contract. The UI talks to this interface and nothing else;
 * every method is asynchronous and may fail. The prototype ships one
 * implementation (`mock/mockApi.ts`, in-browser with localStorage); a real
 * backend would provide another with the same shape.
 */

// ── View models ──────────────────────────────────────────────────────────

export interface AccountSummary {
  id: ID;
  kind: AccountKind;
  name: string;
  title: string;
  tint: number;
  /** Profile slug when the account is a musician. */
  slug?: string;
}

/** What a list or a search result needs to show about a musician. */
export interface MusicianCard {
  id: ID;
  slug: string;
  name: string;
  headline: string;
  instruments: PlayedInstrument[];
  roles: RoleId[];
  base: Place;
  travelRadiusKm: number;
  travelsInternationally: boolean;
  fee: { min: number; max: number };
  urgentCalls: boolean;
  tint: number;
  endorsements: number;
  recordings: number;
}

export interface SearchHit {
  musician: MusicianCard;
  score: number;
  distanceKm?: number;
  withinTravelRadius?: boolean;
  instrumentMatch?: { instrumentId: string; level: PlayedInstrument['level'] };
  availability?: Availability;
  feeFit?: FeeFit;
  repertoire: RepertoireItem[];
  network?: NetworkInfo;
  shortlisted: boolean;
}

export interface SearchResponse {
  hits: SearchHit[];
  relaxations: Relaxation[];
  total: number;
}

export interface Session {
  account: Account;
  musician?: Musician;
  /** Organisations the account administers. */
  organisations: { id: ID; slug: string; name: string; kind: OrganisationKind }[];
}

export interface DemoMeta {
  anchor: ISODate;
  demoDate: ISODate;
  seededAt: ISODateTime;
  counts: { musicians: number; organisations: number; opportunities: number; concerts: number };
}

export interface ConcertView extends Omit<Concert, 'participants' | 'invites'> {
  participants: (ConcertParticipant & { name: string; slug: string })[];
  orgSlug?: string;
  /** Confirmed by someone else in the lineup, or presented by an organisation. Otherwise self-added. */
  verified: boolean;
}

/** One line of a lineup as the event page shows it. */
export interface LineupEntry {
  role: string;
  status: 'confirmed' | 'invited' | 'declined' | 'open';
  person?: AccountSummary;
  /** For an open seat. */
  seatId?: ID;
  opportunityId?: ID;
}

export interface EventView {
  event: ConcertView;
  organiser: AccountSummary;
  organisation?: { id: ID; slug: string; name: string };
  lineup: LineupEntry[];
  /** Opportunities that point at this event (fees are on them, never on the event). */
  opportunities: { id: ID; title: string; status: Opportunity['status']; seatId?: ID }[];
  viewer: {
    canManage: boolean;
    /** The viewer's own pending invitation, if any. */
    invite?: { role: string; invitedBy: AccountSummary };
    inLineup: boolean;
    role?: string;
  };
}

export interface EventInput {
  format: EventFormat;
  title?: string;
  orgId?: ID;
  ensembleName?: string;
  venue: string;
  city: string;
  country: string;
  conductor?: string;
  description?: string;
  ticketUrl?: string;
  visibility: 'public' | 'private';
  /** At least one performance. */
  sessions: EventSession[];
  programme: ProgrammeItem[];
  /** The creator's own role, if they play. */
  myRole?: string;
  /** People to invite: they appear only once they confirm. */
  invite: { musicianId: ID; role: string }[];
  openSeats: { role: string; instrumentId?: string }[];
}

export interface EndorsementView {
  id: ID;
  text: string;
  createdAt: ISODateTime;
  from: AccountSummary;
  to: AccountSummary;
  concert: Pick<Concert, 'id' | 'date' | 'venue' | 'city' | 'ensembleName' | 'programme'>;
}

export type ConnectionState = 'self' | 'none' | 'pending-out' | 'pending-in' | 'connected';

export interface ProfileView {
  musician: Musician;
  concerts: ConcertView[];
  endorsements: EndorsementView[];
  organisations: { id: ID; slug: string; name: string; kind: OrganisationKind; role: string }[];
  connections: number;
  /** From shared confirmed lineups. */
  playedWith: {
    count: number;
    /** Most frequent first. */
    people: (AccountSummary & { concerts: number })[];
    /** Among them, people the viewer knows (connections, or the viewer). */
    known: AccountSummary[];
  };
  relation: {
    state: ConnectionState;
    connectionId?: ID;
    /** Concerts the viewer shares with this musician (as player, or as the presenting organisation). */
    sharedConcerts: ConcertView[];
    mutuals: AccountSummary[];
    /** Whether the viewer has already written an endorsement. */
    endorsed: boolean;
  };
  shortlisted: boolean;
}

export interface OpportunityView {
  opportunity: Opportunity;
  poster: AccountSummary;
  organisation?: { id: ID; slug: string; name: string; kind: OrganisationKind };
  /** Present when the viewer has a musician profile. */
  fit?: OpportunityFit;
  myApplication?: Application;
  applicants: number;
  isMine: boolean;
}

export interface ApplicantView {
  application: Application;
  musician: MusicianCard;
  fit: OpportunityFit;
  network?: NetworkInfo;
}

export interface PostingView {
  opportunity: Opportunity;
  organisation?: { id: ID; slug: string; name: string };
  counts: { applied: number; shortlisted: number; invited: number; offered: number; confirmed: number; total: number };
}

export interface MyApplicationView {
  application: Application;
  opportunity: Opportunity;
  poster: AccountSummary;
  organisation?: { id: ID; slug: string; name: string };
}

export interface OpportunityInput {
  type: OpportunityType;
  title: string;
  orgId?: ID;
  instruments: string[];
  roleLabel?: string;
  place: Place;
  dates: OpportunityDate[];
  fee: Fee;
  travel: TravelCover;
  travelNote?: string;
  dressCode?: string;
  pitch?: number;
  repertoire: ProgrammeItem[];
  description: string;
  deadline?: ISODate;
  urgent: boolean;
  /** Link to an event: its schedule, place and programme are used, and the seat is filled on hire. */
  eventId?: ID;
  seatId?: ID;
}

export interface PostView {
  id: ID;
  body: string;
  createdAt: ISODateTime;
  author: AccountSummary;
  /** The attached event, with its open seats. */
  concert?: ConcertView;
  /** "I'm playing · Role" when the author is on the attached event's lineup. */
  playing?: string;
  bravos: number;
  bravoed: boolean;
  /**
   * What the viewer's connections did on this post, for the line above it:
   * "Anna commented on this", "Marco and 2 others gave a Bravo to this".
   */
  activity?: { kind: 'comment' | 'bravo'; by: AccountSummary; others: number };
  comments: { id: ID; author: AccountSummary; body: string; createdAt: ISODateTime }[];
}

export interface ConnectionView {
  connectionId: ID;
  account: AccountSummary;
  since: ISODateTime;
  sharedConcerts: number;
}

export interface SuggestionView {
  account: AccountSummary;
  sharedConcerts: number;
  mutuals: number;
  /** The most recent concert played together. */
  lastConcert?: Pick<Concert, 'id' | 'date' | 'venue' | 'city' | 'ensembleName'>;
}

export interface NetworkView {
  connections: ConnectionView[];
  incoming: ConnectionView[];
  outgoing: ConnectionView[];
  suggestions: SuggestionView[];
  /** Connected colleagues you have played with and not yet endorsed. */
  endorsable: SuggestionView[];
  received: EndorsementView[];
  given: EndorsementView[];
  /** Musicians near you, on another instrument, who share repertoire with you. Not yet connected. */
  playTogether: { account: AccountSummary; instrumentId: string; city: string; distanceKm: number; works: { composer: string; work: string }[] }[];
}

export interface OrganisationCard {
  id: ID;
  slug: string;
  name: string;
  kind: OrganisationKind;
  base: Place;
  founded: number;
  tint: number;
  members: number;
  concerts: number;
  openOpportunities: number;
}

export interface OrganisationView {
  organisation: Organisation;
  admins: AccountSummary[];
  isAdmin: boolean;
  members: { musician: MusicianCard; role: string; since?: number }[];
  /** Musicians who have appeared with the organisation without being members. */
  guests: { musician: MusicianCard; concerts: number }[];
  upcoming: ConcertView[];
  past: ConcertView[];
  opportunities: Opportunity[];
}

export interface ThreadView {
  thread: Thread;
  other: AccountSummary;
  last: Message;
  unread: number;
  opportunity?: { id: ID; title: string };
}

export interface ThreadDetail {
  thread: Thread;
  other: AccountSummary;
  messages: Message[];
  opportunity?: { id: ID; title: string };
}

export interface NotificationView {
  notification: Notification;
  actor?: AccountSummary;
  opportunity?: { id: ID; title: string; urgent: boolean };
  concert?: { id: ID; title: string; date: ISODate };
}

export interface Badges {
  unreadMessages: number;
  unreadNotifications: number;
  /** Open urgent calls waiting for this musician's answer. */
  urgentCalls: MyApplicationView[];
}

export interface HomeView {
  /** Things waiting for the viewer, most pressing first. */
  actions: {
    invitations: MyApplicationView[];
    offers: MyApplicationView[];
    newApplicants: PostingView[];
    connectionRequests: number;
    unreadMessages: number;
  };
  upcomingConcerts: { concert: ConcertView; people: AccountSummary[]; mine: boolean }[];
  opportunities: OpportunityView[];
  activity: (
    | { kind: 'endorsement'; id: ID; at: ISODateTime; endorsement: EndorsementView }
    | { kind: 'opportunity'; id: ID; at: ISODateTime; opportunity: Opportunity; poster: AccountSummary; organisation?: { name: string; slug: string } }
    | { kind: 'connection'; id: ID; at: ISODateTime; a: AccountSummary; b: AccountSummary }
  )[];
}

export interface ConcertInput {
  date: ISODate;
  venue: string;
  city: string;
  country: string;
  ensembleName?: string;
  orgId?: ID;
  programme: ProgrammeItem[];
  /** The creator's own role, and optionally other participants. */
  participants: ConcertParticipant[];
}

export type MusicianPatch = Partial<
  Pick<
    Musician,
    | 'headline'
    | 'bio'
    | 'instruments'
    | 'voiceDescription'
    | 'roles'
    | 'base'
    | 'travelRadiusKm'
    | 'travelsInternationally'
    | 'fee'
    | 'teachingRate'
    | 'languages'
    | 'pitches'
    | 'practical'
    | 'training'
    | 'masterclasses'
    | 'repertoire'
    | 'recordings'
    | 'awards'
  >
>;

// ── The contract ─────────────────────────────────────────────────────────

export interface DataApi {
  // Demo and session
  getMeta(): Promise<DemoMeta>;
  listPersonas(): Promise<{ account: AccountSummary; base: Place }[]>;
  getSession(accountId: ID): Promise<Session>;
  resetDemo(): Promise<void>;
  /** Lets the mock advance simulated activity; a real backend would push instead. Returns true if anything changed. */
  poll(): Promise<boolean>;
  subscribe(listener: () => void): () => void;

  // Finding musicians
  searchMusicians(query: MusicianQuery, viewerId?: ID): Promise<SearchResponse>;
  suggestPeople(text: string, viewerId?: ID, limit?: number): Promise<AccountSummary[]>;
  getShortlist(accountId: ID): Promise<MusicianCard[]>;
  toggleShortlist(accountId: ID, musicianId: ID): Promise<boolean>;

  // Profiles
  getProfile(slugOrId: string, viewerId?: ID): Promise<ProfileView>;
  updateMusician(id: ID, patch: MusicianPatch): Promise<Musician>;
  setAvailability(id: ID, dates: ISODate[], status: 'free' | 'busy' | 'tentative', note?: string): Promise<Record<ISODate, AvailabilityEntry>>;
  addConcert(input: ConcertInput, creatorId: ID): Promise<Concert>;
  deleteConcert(concertId: ID, byId: ID): Promise<void>;

  // Events
  getEvent(id: ID, viewerId?: ID): Promise<EventView>;
  createEvent(input: EventInput, creatorId: ID): Promise<Concert>;
  /** Events the account organises or plays in, upcoming first — for linking an opportunity. */
  listMyEvents(accountId: ID): Promise<ConcertView[]>;
  /** Pending lineup invitations for a musician. */
  listLineupInvites(musicianId: ID): Promise<{ event: ConcertView; role: string; invitedBy: AccountSummary }[]>;
  /** "Confirm" or "That's not me". */
  respondToLineup(eventId: ID, musicianId: ID, accept: boolean): Promise<void>;

  // Opportunities
  listOpportunities(query: OpportunityQuery, viewerId?: ID): Promise<OpportunityView[]>;
  getOpportunity(id: ID, viewerId?: ID): Promise<OpportunityView>;
  createOpportunity(input: OpportunityInput, accountId: ID): Promise<Opportunity>;
  setOpportunityStatus(id: ID, status: Opportunity['status'], accountId: ID): Promise<Opportunity>;
  apply(opportunityId: ID, musicianId: ID, message: string): Promise<Application>;
  withdraw(applicationId: ID, musicianId: ID): Promise<Application>;
  invite(opportunityId: ID, musicianIds: ID[], message: string, fromId: ID): Promise<Application[]>;
  /** A musician answers an invitation, an urgent call or an offer. */
  respond(applicationId: ID, musicianId: ID, accept: boolean, message?: string): Promise<Application>;
  /** The hirer moves an applicant along: shortlist, decline, offer, or confirm directly. */
  setApplicationStatus(applicationId: ID, status: Extract<ApplicationStatus, 'applied' | 'shortlisted' | 'declined' | 'offered' | 'confirmed'>, accountId: ID): Promise<Application>;
  listApplicants(opportunityId: ID, accountId: ID): Promise<ApplicantView[]>;
  listPostings(accountId: ID): Promise<PostingView[]>;
  listMyApplications(musicianId: ID): Promise<MyApplicationView[]>;
  /** Musicians who fit an opportunity and have not yet applied or been invited. */
  suggestForOpportunity(opportunityId: ID, accountId: ID): Promise<SearchResponse>;

  // Network
  getNetwork(accountId: ID): Promise<NetworkView>;
  requestConnection(fromId: ID, toId: ID): Promise<void>;
  respondToConnection(connectionId: ID, accept: boolean, byId: ID): Promise<void>;
  removeConnection(connectionId: ID, byId: ID): Promise<void>;
  endorse(fromId: ID, toId: ID, concertId: ID, text: string): Promise<void>;

  // Organisations
  listOrganisations(text?: string): Promise<OrganisationCard[]>;
  getOrganisation(slug: string, viewerId?: ID): Promise<OrganisationView>;
  updateOrganisation(id: ID, patch: { about?: string }, byId: ID): Promise<Organisation>;
  addMember(orgId: ID, musicianId: ID, role: string, byId: ID): Promise<void>;
  removeMember(orgId: ID, musicianId: ID, byId: ID): Promise<void>;

  // Messages
  listThreads(accountId: ID): Promise<ThreadView[]>;
  getThread(threadId: ID, accountId: ID): Promise<ThreadDetail>;
  /** Finds the thread between two accounts, if they have one. */
  findThread(accountId: ID, otherId: ID): Promise<ID | undefined>;
  sendMessage(input: { fromId: ID; toId: ID; body: string; opportunityId?: ID }): Promise<{ threadId: ID }>;
  markThreadRead(threadId: ID, accountId: ID): Promise<void>;

  // Posts
  listFeed(accountId: ID): Promise<PostView[]>;
  createPost(input: { authorId: ID; body: string; concertId?: ID }): Promise<PostView>;
  /** Gives or takes back a Bravo; returns whether it is now given. */
  toggleBravo(postId: ID, accountId: ID): Promise<boolean>;
  addComment(postId: ID, accountId: ID, body: string): Promise<void>;

  // Home and notifications
  getHome(accountId: ID): Promise<HomeView>;
  getBadges(accountId: ID): Promise<Badges>;
  listNotifications(accountId: ID): Promise<NotificationView[]>;
  markNotificationsRead(accountId: ID): Promise<void>;
}

/** Thrown by implementations for expected failures (not found, not allowed, invalid). */
export class ApiError extends Error {
  constructor(
    public code: 'not-found' | 'forbidden' | 'invalid' | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
