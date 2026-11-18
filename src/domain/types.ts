/**
 * Domain entities. Pure data — no behaviour, no storage, no React.
 * Dates are local calendar days as 'YYYY-MM-DD'; timestamps are ISO strings.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface Place {
  /** Display name, e.g. "Bologna". */
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  lat: number;
  lng: number;
  /** Gazetteer id when the place is a known city. */
  cityId?: string;
  venue?: string;
}

// ── Musicians ────────────────────────────────────────────────────────────

export type InstrumentLevel = 'primary' | 'secondary' | 'doubling' | 'period';

export interface PlayedInstrument {
  /** Instrument or voice-type id from the taxonomy. */
  instrumentId: string;
  level: InstrumentLevel;
  /** e.g. "Pigini Sirius, free-bass (C-system)". */
  note?: string;
}

export type RoleId =
  | 'soloist'
  | 'orchestral'
  | 'chamber'
  | 'accompanist'
  | 'continuo'
  | 'opera'
  | 'oratorio'
  | 'choral'
  | 'church'
  | 'teacher'
  | 'conductor'
  | 'composer';

export interface Training {
  id: ID;
  institution: string;
  qualification: string;
  teacher?: string;
  from: number;
  to: number;
}

export interface Masterclass {
  id: ID;
  teacher: string;
  place: string;
  year: number;
}

export interface Position {
  id: ID;
  title: string;
  organisation: string;
  orgId?: ID;
  from: number;
  to?: number;
}

export type RepertoireStatus = 'ready' | 'performed' | 'learning';

export type Genre =
  | 'concerto'
  | 'solo'
  | 'chamber'
  | 'orchestral'
  | 'opera'
  | 'sacred'
  | 'song'
  | 'contemporary';

export interface RepertoireItem {
  id: ID;
  composer: string;
  work: string;
  /** Part or operatic role, e.g. "Susanna", "continuo", "Evangelist". */
  part?: string;
  genre: Genre;
  /** ready = could perform at short notice; performed = has played it, needs preparation. */
  status: RepertoireStatus;
  lastPerformed?: number;
}

export interface Recording {
  id: ID;
  title: string;
  kind: 'audio' | 'video';
  year: number;
  durationSec: number;
  /** Optional external link; seeded recordings use the built-in placeholder player. */
  url?: string;
  note?: string;
}

export interface Award {
  id: ID;
  year: number;
  competition: string;
  result: string;
}

export type AvailabilityStatus = 'busy' | 'tentative';

export interface AvailabilityEntry {
  status: AvailabilityStatus;
  note?: string;
  /** Set when the entry was created by a confirmed engagement. */
  opportunityId?: ID;
}

export interface Musician {
  id: ID;
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  headline: string;
  bio: string;
  instruments: PlayedInstrument[];
  /** For singers: fach / description, e.g. "Lyric mezzo". */
  voiceDescription?: string;
  roles: RoleId[];
  base: Place;
  travelRadiusKm: number;
  travelsInternationally: boolean;
  /** Indicative fee per engagement (rehearsals + concert), in euros. */
  fee: { min: number; max: number; note?: string };
  /** Indicative hourly teaching rate in euros. */
  teachingRate?: number;
  languages: string[];
  /** Pitch standards the musician plays at, in Hz (415, 430, 440, 442, 466). */
  pitches: number[];
  practical: {
    ownTransport: boolean;
    canInvoice: boolean;
    /** Accepts last-minute substitution calls. */
    urgentCalls: boolean;
    /** Typical minimum notice in hours for an urgent call. */
    noticeHours?: number;
  };
  training: Training[];
  masterclasses: Masterclass[];
  positions: Position[];
  repertoire: RepertoireItem[];
  recordings: Recording[];
  awards: Award[];
  /** Days that are not free. Any day not listed is free. */
  availability: Record<ISODate, AvailabilityEntry>;
  activeSince: number;
  /** Hue for the monogram avatar. */
  tint: number;
  joinedAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Concerts (shared between everyone who played) ─────────────────────────

export interface ProgrammeItem {
  composer: string;
  work: string;
}

export type ConcertKind =
  | 'orchestral'
  | 'chamber'
  | 'recital'
  | 'opera'
  | 'sacred'
  | 'early'
  | 'contemporary';

export interface ConcertParticipant {
  musicianId: ID;
  /** e.g. "Violin I", "Continuo", "Soloist", "Evangelist". */
  role: string;
}

/** What sort of event this is (design/EVENTS.md). Concerts seeded before events existed have none: read as 'concert'. */
export type EventFormat = 'concert' | 'opera' | 'recording' | 'masterclass' | 'audition';

/**
 * Someone added to a lineup who has not confirmed yet, or turned it down.
 * Only confirmed people live in `participants`, so concert history, endorsements
 * and "played with" never count an unconfirmed name.
 */
export interface LineupInvite {
  musicianId: ID;
  role: string;
  status: 'invited' | 'declined';
  invitedBy: ID;
  at: ISODateTime;
}

/** A seat in the lineup with no one in it yet, optionally advertised by an opportunity. */
export interface OpenSeat {
  id: ID;
  role: string;
  instrumentId?: string;
  opportunityId?: ID;
}

export interface EventSession {
  date: ISODate;
  time?: string;
  kind: 'performance' | 'rehearsal';
  note?: string;
}

/**
 * A concert is the hub of the Event model: opportunities can point to one, and
 * its confirmed lineup is what concert history, endorsements and the calendar read.
 */
export interface Concert {
  id: ID;
  date: ISODate;
  time?: string;
  title?: string;
  venue: string;
  city: string;
  country: string;
  kind: ConcertKind;
  orgId?: ID;
  ensembleName?: string;
  conductor?: string;
  programme: ProgrammeItem[];
  participants: ConcertParticipant[];
  createdBy: ID;
  format?: EventFormat;
  /** Private events are seen only by their lineup, invitees and organisers. Seeded concerts are public. */
  visibility?: 'public' | 'private';
  description?: string;
  ticketUrl?: string;
  /** Every performance and rehearsal; `date` is the first performance. */
  sessions?: EventSession[];
  invites?: LineupInvite[];
  openSeats?: OpenSeat[];
}

// ── Accounts and organisations ───────────────────────────────────────────

export type AccountKind = 'musician' | 'organiser';

export interface Account {
  id: ID;
  kind: AccountKind;
  name: string;
  /** One line under the name, e.g. "General manager, Accademia del Naviglio". */
  title: string;
  /** Present when the account has a musician profile (same id). */
  musicianId?: ID;
  /** Organisations this account administers. */
  orgIds: ID[];
  base: Place;
  tint: number;
}

export type OrganisationKind =
  | 'orchestra'
  | 'chamber-orchestra'
  | 'baroque-ensemble'
  | 'chamber-ensemble'
  | 'contemporary-ensemble'
  | 'choir'
  | 'opera-company'
  | 'festival'
  | 'church'
  | 'concert-society'
  | 'music-school'
  | 'events';

export interface OrganisationMember {
  musicianId: ID;
  role: string;
  since?: number;
}

export interface Organisation {
  id: ID;
  slug: string;
  name: string;
  kind: OrganisationKind;
  base: Place;
  about: string;
  founded: number;
  admins: ID[];
  members: OrganisationMember[];
  tint: number;
}

// ── Opportunities ────────────────────────────────────────────────────────

export type OpportunityType = 'engagement' | 'substitution' | 'audition' | 'position' | 'teaching';

export type FeeUnit = 'total' | 'per-concert' | 'per-service' | 'per-hour' | 'per-month' | 'per-year';

export interface Fee {
  amount: number;
  /** Upper bound when the fee is a range. */
  max?: number;
  unit: FeeUnit;
  note?: string;
}

export type OpportunityDateKind = 'rehearsal' | 'dress' | 'performance' | 'audition' | 'start';

export interface OpportunityDate {
  date: ISODate;
  time?: string;
  kind: OpportunityDateKind;
  note?: string;
}

export type TravelCover = 'none' | 'travel' | 'travel-accommodation';

export interface Opportunity {
  id: ID;
  type: OpportunityType;
  title: string;
  postedBy: ID;
  orgId?: ID;
  /** Instrument / voice ids sought (any of). */
  instruments: string[];
  /** e.g. "Principal oboe", "Continuo", "Mezzo soloist". */
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
  status: 'open' | 'filled' | 'closed';
  createdAt: ISODateTime;
  /** Linked event: schedule, place and programme come from it. The fee stays here, never on the event. */
  eventId?: ID;
  /** The open seat on that event this opportunity fills. */
  seatId?: ID;
}

export type ApplicationStatus =
  | 'invited' // hirer invited the musician; awaiting their answer
  | 'applied' // musician applied, or said yes to an invitation
  | 'shortlisted'
  | 'offered' // hirer offered the engagement; awaiting confirmation
  | 'confirmed'
  | 'declined' // hirer declined
  | 'unavailable' // musician declined an invitation or offer
  | 'withdrawn';

export interface Application {
  id: ID;
  opportunityId: ID;
  musicianId: ID;
  origin: 'applied' | 'invited';
  status: ApplicationStatus;
  /** Musician's note to the hirer. */
  message?: string;
  /** Hirer's note in the invitation. */
  inviteMessage?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── Network ──────────────────────────────────────────────────────────────

export interface Connection {
  id: ID;
  /** Requester. */
  from: ID;
  to: ID;
  status: 'pending' | 'accepted';
  createdAt: ISODateTime;
}

export interface Endorsement {
  id: ID;
  fromId: ID;
  toId: ID;
  /** The concert both people played — required. */
  concertId: ID;
  text: string;
  createdAt: ISODateTime;
}

// ── Messaging and notifications ──────────────────────────────────────────

export interface Thread {
  id: ID;
  participants: [ID, ID];
  /** Opportunity the conversation started from, if any. */
  opportunityId?: ID;
  updatedAt: ISODateTime;
}

export interface Message {
  id: ID;
  threadId: ID;
  fromId: ID;
  body: string;
  sentAt: ISODateTime;
  readBy: ID[];
}

export type NotificationKind =
  | 'invitation'
  | 'urgent-call'
  | 'application'
  | 'application-status'
  | 'invitation-response'
  | 'connection-request'
  | 'connection-accepted'
  | 'endorsement'
  | 'lineup-invite'
  | 'lineup-response';

export interface Notification {
  id: ID;
  accountId: ID;
  kind: NotificationKind;
  actorId?: ID;
  opportunityId?: ID;
  concertId?: ID;
  /** For lineup responses: did they confirm? */
  accepted?: boolean;
  /** Application status at the time, for status notifications. */
  status?: ApplicationStatus;
  createdAt: ISODateTime;
  read: boolean;
}
