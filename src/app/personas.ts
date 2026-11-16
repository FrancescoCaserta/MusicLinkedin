import type { ID, ISODate } from '../domain/types';

/** How each demo persona is introduced, and what is worth trying as them. */
export interface PersonaGuide {
  role: string;
  blurb: string;
  tries: { label: string; to: (demoDate: ISODate) => string }[];
}

export const headlineSearch = (demoDate: ISODate) => `/search?i=accordion&near=bologna&r=50&d=${demoDate}&b=250`;

export const PERSONA_GUIDE: Record<ID, PersonaGuide> = {
  'm-nicolo-baldini': {
    role: 'Freelance accordionist',
    blurb: 'An urgent call is waiting for an answer, an orchestra has invited him back, and two applications are in progress.',
    tries: [
      { label: 'Answer the urgent call', to: () => '/home' },
      { label: 'See the profile hirers see', to: () => '/musicians/nicolo-baldini' },
      { label: 'Browse work for accordion', to: () => '/opportunities' },
    ],
  },
  'm-giulia-santoro': {
    role: 'Orchestral violinist',
    blurb: 'First violin in an orchestra, second violin in a quartet — and the quartet needs a cellist for Saturday.',
    tries: [
      { label: 'See who answered her urgent call', to: () => '/hiring/opp-u-cello-giulia' },
      { label: 'Start a new urgent substitution', to: () => '/opportunities/urgent' },
      { label: 'Endorse colleagues from past concerts', to: () => '/network' },
    ],
  },
  'm-hannah-lindner': {
    role: 'Mezzo-soprano',
    blurb: 'A singer’s profile: voice type, roles and oratorio parts. Has an offer to confirm and an urgent call from Vienna.',
    tries: [
      { label: 'Confirm the offer from Paris', to: () => '/applications' },
      { label: 'See a singer’s profile', to: () => '/musicians/hannah-lindner' },
      { label: 'Manage her calendar', to: () => '/calendar' },
    ],
  },
  'acc-beatrice': {
    role: 'Ensemble manager',
    blurb: 'Runs a period-instrument orchestra in Bologna, with three open postings and applicants to review.',
    tries: [
      { label: 'Review applicants for the St John Passion', to: () => '/hiring/opp-naviglio-gamba' },
      { label: 'Search: baroque violin near Bologna', to: () => '/search?i=baroque-violin&near=bologna&r=100&period=1' },
      { label: 'Edit the ensemble’s page', to: () => '/ensembles/accademia-del-naviglio' },
    ],
  },
  'acc-lorenzo': {
    role: 'Festival director',
    blurb: 'Needs an accordionist within 50 km of Bologna, free on 14 March, for €250.',
    tries: [
      { label: 'Run that search', to: headlineSearch },
      { label: 'Post an opportunity', to: () => '/opportunities/new' },
      { label: 'Read his messages', to: () => '/messages' },
    ],
  },
};

export const enterPath = (accountId: ID, next: string) => `/enter/${accountId}?next=${encodeURIComponent(next)}`;
