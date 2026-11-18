import type {
  Account,
  Application,
  Concert,
  Connection,
  Endorsement,
  ID,
  ISODate,
  ISODateTime,
  Message,
  Musician,
  Notification,
  Opportunity,
  Organisation,
  Post,
  Thread,
} from '../../domain/types';

/** A simulated event that will happen later (e.g. a musician answering an urgent call). */
export interface ScheduledEvent {
  id: ID;
  at: ISODateTime;
  kind: 'application-response';
  applicationId: ID;
  /** What the simulated musician does. */
  outcome: 'applied' | 'unavailable';
  message?: string;
}

/** The whole mock backend state — what a real backend would keep in its database. */
export interface Database {
  meta: {
    version: number;
    seededAt: ISODateTime;
    /** The "today" the seed was generated for. */
    anchor: ISODate;
    /** The 14 March used in the demo walkthrough. */
    demoDate: ISODate;
    /** Demo persona account ids, in display order. */
    personas: ID[];
  };
  accounts: Account[];
  musicians: Musician[];
  organisations: Organisation[];
  concerts: Concert[];
  opportunities: Opportunity[];
  applications: Application[];
  connections: Connection[];
  endorsements: Endorsement[];
  threads: Thread[];
  messages: Message[];
  notifications: Notification[];
  posts: Post[];
  /** accountId → saved musician ids */
  shortlists: Record<ID, ID[]>;
  scheduled: ScheduledEvent[];
}

export const DB_VERSION = 1;
