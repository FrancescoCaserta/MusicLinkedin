import type { RoleId, OrganisationKind, OpportunityType } from './types';

/**
 * The classical-music vocabulary of the product: instruments, voice types
 * and roles. Ids are stable; names are English source strings (run through
 * i18n at render time); aliases feed search and the natural-language parser
 * and deliberately include Italian terms.
 */

export type Family =
  | 'strings'
  | 'woodwind'
  | 'brass'
  | 'percussion'
  | 'keyboard'
  | 'plucked'
  | 'accordion'
  | 'early'
  | 'voice';

export interface Instrument {
  id: string;
  name: string;
  family: Family;
  /** Noun for a player: "accordionist", "soprano". */
  player: string;
  /** Other names people type, lower-case, without diacritics. */
  aliases: string[];
  /** For period instruments: the modern counterpart. */
  modern?: string;
  /** For auxiliary instruments: the main instrument they are usually doubled from. */
  doublingOf?: string;
}

const i = (
  id: string,
  name: string,
  family: Family,
  player: string,
  aliases: string[] = [],
  extra: Partial<Instrument> = {},
): Instrument => ({ id, name, family, player, aliases, ...extra });

export const INSTRUMENTS: Instrument[] = [
  // Strings
  i('violin', 'Violin', 'strings', 'violinist', ['violino', 'violinista', 'fiddle', 'geige']),
  i('viola', 'Viola', 'strings', 'violist', ['violista', 'bratsche', 'alto viola']),
  i('cello', 'Cello', 'strings', 'cellist', ['violoncello', 'violoncellist', 'violoncellista']),
  i('double-bass', 'Double bass', 'strings', 'double bassist', [
    'contrabbasso',
    'contrabass',
    'contrabbassista',
    'bassist',
    'double bass player',
    'kontrabass',
  ]),
  // Woodwind
  i('flute', 'Flute', 'woodwind', 'flautist', ['flauto', 'flautista', 'flutist', 'flauto traverso moderno']),
  i('piccolo', 'Piccolo', 'woodwind', 'piccolo player', ['ottavino'], { doublingOf: 'flute' }),
  i('oboe', 'Oboe', 'woodwind', 'oboist', ['oboista']),
  i('cor-anglais', 'Cor anglais', 'woodwind', 'cor anglais player', ['english horn', 'corno inglese'], {
    doublingOf: 'oboe',
  }),
  i('clarinet', 'Clarinet', 'woodwind', 'clarinettist', ['clarinetto', 'clarinettista', 'clarinetist']),
  i('bass-clarinet', 'Bass clarinet', 'woodwind', 'bass clarinettist', ['clarinetto basso', 'clarone'], {
    doublingOf: 'clarinet',
  }),
  i('bassoon', 'Bassoon', 'woodwind', 'bassoonist', ['fagotto', 'fagottista', 'fagott']),
  i('contrabassoon', 'Contrabassoon', 'woodwind', 'contrabassoonist', ['controfagotto'], {
    doublingOf: 'bassoon',
  }),
  i('saxophone', 'Saxophone', 'woodwind', 'saxophonist', ['sassofono', 'sax', 'sassofonista']),
  // Brass
  i('horn', 'Horn', 'brass', 'horn player', ['french horn', 'corno', 'cornista', 'hornist']),
  i('trumpet', 'Trumpet', 'brass', 'trumpeter', ['tromba', 'trombettista', 'trumpet player']),
  i('trombone', 'Trombone', 'brass', 'trombonist', ['trombonista', 'posaune']),
  i('tuba', 'Tuba', 'brass', 'tuba player', ['tubist', 'basso tuba']),
  // Percussion
  i('timpani', 'Timpani', 'percussion', 'timpanist', ['timpanista', 'kettledrums']),
  i('percussion', 'Percussion', 'percussion', 'percussionist', [
    'percussioni',
    'percussionista',
    'marimba',
    'vibraphone',
  ]),
  // Keyboards
  i('piano', 'Piano', 'keyboard', 'pianist', ['pianoforte', 'pianista', 'klavier']),
  i('organ', 'Organ', 'keyboard', 'organist', ['organo', 'organista', 'orgel']),
  i('harpsichord', 'Harpsichord', 'keyboard', 'harpsichordist', [
    'clavicembalo',
    'cembalo',
    'clavicembalista',
    'cembalista',
    'clavecin',
  ]),
  i('fortepiano', 'Fortepiano', 'keyboard', 'fortepianist', ['hammerklavier'], { modern: 'piano' }),
  // Plucked
  i('harp', 'Harp', 'plucked', 'harpist', ['arpa', 'arpista', 'harfe']),
  i('guitar', 'Classical guitar', 'plucked', 'guitarist', ['chitarra', 'chitarrista', 'guitar', 'chitarra classica']),
  i('mandolin', 'Mandolin', 'plucked', 'mandolinist', ['mandolino', 'mandolinista']),
  // Accordion
  i('accordion', 'Accordion', 'accordion', 'accordionist', [
    'fisarmonica',
    'fisarmonicista',
    'bayan',
    'classical accordion',
    'akkordeon',
    'accordeon',
  ]),
  // Early / period instruments
  i('baroque-violin', 'Baroque violin', 'early', 'baroque violinist', ['violino barocco'], { modern: 'violin' }),
  i('baroque-viola', 'Baroque viola', 'early', 'baroque violist', ['viola barocca'], { modern: 'viola' }),
  i('baroque-cello', 'Baroque cello', 'early', 'baroque cellist', ['violoncello barocco'], { modern: 'cello' }),
  i('viola-da-gamba', 'Viola da gamba', 'early', 'gambist', ['gamba', 'viol', 'viola da gamba player']),
  i('violone', 'Violone', 'early', 'violone player', [], { modern: 'double-bass' }),
  i('recorder', 'Recorder', 'early', 'recorder player', ['flauto dolce', 'blockflote', 'flauto diritto']),
  i('traverso', 'Traverso', 'early', 'traverso player', ['baroque flute', 'flauto traversiere', 'flauto traverso'], {
    modern: 'flute',
  }),
  i('baroque-oboe', 'Baroque oboe', 'early', 'baroque oboist', ['oboe barocco', 'hautboy'], { modern: 'oboe' }),
  i('baroque-bassoon', 'Baroque bassoon', 'early', 'baroque bassoonist', ['fagotto barocco', 'dulcian'], {
    modern: 'bassoon',
  }),
  i('natural-trumpet', 'Natural trumpet', 'early', 'natural trumpeter', ['tromba naturale', 'baroque trumpet'], {
    modern: 'trumpet',
  }),
  i('natural-horn', 'Natural horn', 'early', 'natural horn player', ['corno naturale'], { modern: 'horn' }),
  i('sackbut', 'Sackbut', 'early', 'sackbut player', ['trombone rinascimentale', 'baroque trombone'], {
    modern: 'trombone',
  }),
  i('cornetto', 'Cornetto', 'early', 'cornettist', ['cornett', 'zink']),
  i('theorbo', 'Theorbo', 'early', 'theorbist', ['tiorba', 'chitarrone', 'theorbo player']),
  i('lute', 'Lute', 'early', 'lutenist', ['liuto', 'liutista', 'archlute', 'arciliuto']),
  i('baroque-guitar', 'Baroque guitar', 'early', 'baroque guitarist', ['chitarra barocca'], { modern: 'guitar' }),
  // Voices
  i('soprano', 'Soprano', 'voice', 'soprano', ['sopranist']),
  i('mezzo-soprano', 'Mezzo-soprano', 'voice', 'mezzo-soprano', ['mezzo', 'mezzosoprano', 'mezzo soprano']),
  i('contralto', 'Contralto', 'voice', 'contralto', ['alto']),
  i('countertenor', 'Countertenor', 'voice', 'countertenor', ['controtenore', 'counter-tenor', 'counter tenor']),
  i('tenor', 'Tenor', 'voice', 'tenor', ['tenore']),
  i('baritone', 'Baritone', 'voice', 'baritone', ['baritono']),
  i('bass-baritone', 'Bass-baritone', 'voice', 'bass-baritone', ['basso-baritono', 'bass baritone']),
  i('bass', 'Bass', 'voice', 'bass', ['basso', 'bass singer']),
];

const byId = new Map(INSTRUMENTS.map((x) => [x.id, x]));

export function instrument(id: string): Instrument | undefined {
  return byId.get(id);
}

export function instrumentName(id: string): string {
  return byId.get(id)?.name ?? id;
}

export function isVoice(id: string): boolean {
  return byId.get(id)?.family === 'voice';
}

export function isPeriod(id: string): boolean {
  return byId.get(id)?.family === 'early';
}

export const FAMILY_LABELS: Record<Family, string> = {
  strings: 'Strings',
  woodwind: 'Woodwind',
  brass: 'Brass',
  percussion: 'Percussion',
  keyboard: 'Keyboards',
  plucked: 'Harp, guitar & plucked',
  accordion: 'Accordion',
  early: 'Period instruments',
  voice: 'Voices',
};

export const FAMILY_ORDER: Family[] = [
  'strings',
  'woodwind',
  'brass',
  'percussion',
  'keyboard',
  'plucked',
  'accordion',
  'early',
  'voice',
];

export const ROLES: { id: RoleId; label: string; aliases: string[] }[] = [
  { id: 'soloist', label: 'Soloist', aliases: ['soloist', 'solista', 'solo'] },
  { id: 'orchestral', label: 'Orchestral player', aliases: ['orchestral', 'orchestra player', 'tutti', 'orchestrale'] },
  { id: 'chamber', label: 'Chamber musician', aliases: ['chamber', 'chamber musician', 'camerista'] },
  { id: 'accompanist', label: 'Accompanist / répétiteur', aliases: ['accompanist', 'repetiteur', 'collaborative pianist', 'accompagnatore'] },
  { id: 'continuo', label: 'Continuo player', aliases: ['continuo', 'basso continuo'] },
  { id: 'opera', label: 'Opera', aliases: ['opera singer', 'opera'] },
  { id: 'oratorio', label: 'Concert & oratorio', aliases: ['oratorio', 'concert singer'] },
  { id: 'choral', label: 'Ensemble & choral singer', aliases: ['choral', 'chorister', 'consort singer', 'corista'] },
  { id: 'church', label: 'Church musician', aliases: ['church musician', 'liturgical'] },
  { id: 'teacher', label: 'Teacher', aliases: ['teacher', 'insegnante', 'docente', 'tutor'] },
  { id: 'conductor', label: 'Conductor', aliases: ['conductor', 'direttore', 'maestro'] },
  { id: 'composer', label: 'Composer', aliases: ['composer', 'compositore'] },
];

export function roleLabel(id: RoleId): string {
  return ROLES.find((r) => r.id === id)?.label ?? id;
}

export const PITCHES = [392, 415, 430, 440, 442, 466];

export const ORG_KIND_LABELS: Record<OrganisationKind, string> = {
  orchestra: 'Symphony orchestra',
  'chamber-orchestra': 'Chamber orchestra',
  'baroque-ensemble': 'Period-instrument ensemble',
  'chamber-ensemble': 'Chamber ensemble',
  'contemporary-ensemble': 'Contemporary music ensemble',
  choir: 'Choir',
  'opera-company': 'Opera company',
  festival: 'Festival',
  church: 'Church music',
  'concert-society': 'Concert society',
  'music-school': 'Music school',
  events: 'Private events',
};

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  engagement: 'Engagement',
  substitution: 'Urgent substitution',
  audition: 'Audition',
  position: 'Permanent position',
  teaching: 'Teaching',
};

export const LANGUAGES = [
  'Italian',
  'English',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Dutch',
  'Polish',
  'Czech',
  'Hungarian',
  'Danish',
  'Swedish',
  'Finnish',
  'Slovenian',
  'Croatian',
  'Russian',
];

/** Lower-case, strip diacritics and punctuation — used for all text matching. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ł/g, 'l')
    .replace(/[’'`´]/g, "'")
    .replace(/[^a-z0-9'€./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface InstrumentTerm {
  term: string;
  instrumentId: string;
}

/**
 * Every phrase that identifies an instrument, longest first so that
 * "viola da gamba" wins over "viola" and "mezzo-soprano" over "soprano".
 */
export const INSTRUMENT_TERMS: InstrumentTerm[] = (() => {
  const out: InstrumentTerm[] = [];
  const seen = new Set<string>();
  const add = (term: string, instrumentId: string) => {
    const n = normalise(term);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ term: n, instrumentId });
  };
  for (const ins of INSTRUMENTS) {
    for (const base of [ins.name, ins.player, ...ins.aliases]) {
      add(base, ins.id);
      add(base.replace(/-/g, ' '), ins.id);
      const n = normalise(base);
      if (!n.endsWith('s')) add(`${n}s`, ins.id);
    }
  }
  return out.sort((a, b) => b.term.length - a.term.length);
})();
