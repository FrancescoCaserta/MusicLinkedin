import type {
  Account,
  Concert,
  ConcertKind,
  ConcertParticipant,
  Genre,
  ID,
  ISODate,
  Musician,
  Organisation,
  PlayedInstrument,
  ProgrammeItem,
  RepertoireItem,
  RoleId,
} from '../../../domain/types';
import {
  BAROQUE_ENSEMBLE_WORKS,
  BRASS_CHAMBER_WORKS,
  CHAMBER_ORCHESTRA_WORKS,
  CHORAL_WORKS,
  CONTEMPORARY_WORKS,
  CONTINUO_WORKS,
  OPERA_WORKS,
  ORCHESTRAL_WORKS,
  PIANO_CHAMBER_WORKS,
  SACRED_WORKS,
  SOLO_REPERTOIRE,
  SONG_WORKS,
  STRING_CHAMBER_WORKS,
  VOICE_REPERTOIRE,
  WIND_CHAMBER_WORKS,
  type Work,
} from '../../../domain/catalogue';
import { CITIES, placeByName } from '../../../domain/cities';
import { addDays, diffDays } from '../../../domain/dates';
import { distanceKm } from '../../../domain/geo';
import { instrument, instrumentName, isVoice, normalise, type Family } from '../../../domain/taxonomy';
import { ORGANISATIONS, type OrgSeed, type ProgrammePool } from './organisations';
import {
  ACCORDION_NOTES,
  COMPETITIONS,
  CONSERVATORIES,
  GENERIC_VENUES,
  GENERIC_VENUES_INTL,
  INSTRUMENT_NOTES,
  MASTERCLASS_PLACES,
  POSTGRAD,
  RESULTS,
  TEACHER_FIRST,
  TEACHER_SURNAMES,
  VENUES,
} from './pools';
import { Rng } from './rng';
import { ROSTER, type Archetype, type RosterRow } from './roster';

/**
 * Builds people, organisations and their shared concert history.
 * Everything is derived deterministically from the roster and the anchor
 * date, so that careers hang together: what someone has in their repertoire
 * is what they have played in the concerts listed on their profile.
 */

export const slugify = (s: string) =>
  normalise(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const musicianId = (name: string) => `m-${slugify(name)}`;

const SELF_SUFFICIENT = new Set(['piano', 'organ', 'harpsichord', 'fortepiano', 'guitar', 'accordion', 'harp', 'lute', 'theorbo', 'percussion']);
const CONTINUO = new Set(['harpsichord', 'organ', 'theorbo', 'lute', 'baroque-guitar', 'viola-da-gamba', 'baroque-cello', 'violone', 'baroque-bassoon']);
const ORCHESTRAL_FAMILIES = new Set<Family>(['strings', 'woodwind', 'brass', 'percussion']);
const EARLY_COMPOSERS = new Set(['Bach', 'Vivaldi', 'Handel', 'Telemann', 'Corelli', 'Purcell', 'Torelli', 'Biber', 'Marcello', 'Albinoni', 'Boccherini', 'Haydn', 'Mozart', 'Monteverdi', 'G. Gabrieli', 'Castello', 'Quantz', 'C.P.E. Bach', 'Rameau', 'Couperin', 'Sammartini', 'Hummel', 'Stamitz', 'Dittersdorf', 'Vanhal', 'Albrechtsberger', 'Hoffmeister', 'Tartini', 'Locatelli', 'Leclair', 'Weber', 'Beethoven']);
/** Which instruments each ensemble piece of new music actually calls for. */
const FORCES: Record<string, string[]> = {
  'Chamber Concerto': ['flute', 'oboe', 'clarinet', 'bass-clarinet', 'horn', 'trombone', 'piano', 'harpsichord', 'violin', 'viola', 'cello', 'double-bass'],
  'Dérive 1': ['flute', 'clarinet', 'violin', 'cello', 'percussion', 'piano'],
  'Vortex temporum': ['piano', 'flute', 'clarinet', 'violin', 'viola', 'cello'],
  'Different Trains': ['violin', 'viola', 'cello'],
  'Music for 18 Musicians': ['percussion', 'piano', 'violin', 'cello', 'clarinet', 'soprano'],
  'Lo spazio inverso': ['flute', 'clarinet', 'violin', 'cello', 'piano'],
  '…sofferte onde serene…': ['piano'],
  Cendres: ['flute', 'cello', 'piano'],
  Arcadiana: ['violin', 'viola', 'cello'],
  'Kafka-Fragmente': ['soprano', 'violin'],
  'Hommage à R. Sch.': ['clarinet', 'viola', 'piano'],
  'Why Patterns?': ['flute', 'piano', 'percussion'],
  'Professor Bad Trip': ['flute', 'clarinet', 'guitar', 'piano', 'percussion', 'violin', 'viola', 'cello', 'trumpet', 'double-bass'],
  Arpège: ['flute', 'clarinet', 'violin', 'cello', 'piano', 'percussion'],
  Anahit: ['violin', 'flute', 'clarinet', 'horn', 'trumpet', 'trombone', 'saxophone', 'viola', 'cello', 'double-bass'],
  'Pierrot lunaire Op. 21': ['mezzo-soprano', 'soprano', 'flute', 'clarinet', 'violin', 'cello', 'piano'],
  'Folk Songs': ['mezzo-soprano', 'flute', 'clarinet', 'harp', 'viola', 'cello', 'percussion'],
  Fratres: ['violin', 'viola', 'cello', 'double-bass', 'percussion', 'piano'],
  'Sieben Worte': ['cello', 'accordion', 'violin', 'viola', 'double-bass'],
};
const ROMANTIC_VOICES = new Set(['Verdi', 'Rossini', 'Puccini', 'Brahms', 'Mendelssohn', 'Beethoven', 'Mozart', 'Haydn', 'Donizetti', 'Bellini', 'Bizet', 'Mascagni', 'Leoncavallo', 'Orff', 'Fauré', 'Duruflé']);
const INVENTED_CONDUCTORS = ['Aurelio Venturi', 'Ilse Brandstetter', 'Tancredi Morosini', 'Hélène Aubry', 'Gregor Halász', 'Bruno Castellani'];

const ROLES: Record<Archetype, RoleId[]> = {
  orch: ['orchestral', 'chamber'],
  free: ['orchestral', 'chamber'],
  solo: ['soloist', 'chamber'],
  chamber: ['chamber', 'orchestral'],
  early: ['chamber', 'orchestral'],
  contemp: ['soloist', 'chamber'],
  opera: ['opera', 'oratorio'],
  concert: ['oratorio', 'choral'],
  church: ['church', 'accompanist', 'teacher'],
  collab: ['accompanist', 'chamber'],
  teach: ['teacher', 'chamber'],
  cond: ['conductor', 'accompanist'],
  comp: ['composer', 'chamber', 'teacher'],
};

const DEFAULT_LANGS: Record<string, string[]> = {
  IT: ['Italian', 'English'],
  AT: ['German', 'English'],
  DE: ['German', 'English'],
  CH: ['German', 'English', 'French'],
  FR: ['French', 'English'],
  NL: ['Dutch', 'English', 'German'],
  BE: ['Dutch', 'French', 'English'],
  GB: ['English'],
  ES: ['Spanish', 'English'],
  PT: ['Portuguese', 'English', 'Spanish'],
  DK: ['Danish', 'English', 'German'],
  SE: ['Swedish', 'English'],
  FI: ['Finnish', 'English', 'Swedish'],
  PL: ['Polish', 'English', 'German'],
  CZ: ['Czech', 'English', 'German'],
  HU: ['Hungarian', 'English', 'German'],
  SI: ['Slovenian', 'English', 'Croatian'],
};

export interface World {
  anchor: ISODate;
  rng: Rng;
  musicians: Musician[];
  rows: Map<ID, RosterRow>;
  accounts: Account[];
  organisations: Organisation[];
  orgSeeds: Map<ID, OrgSeed>;
  concerts: Concert[];
  byName: (name: string) => Musician;
  /** What each musician actually played in the concerts on record, most recent first. */
  credited: Map<ID, { work: Work; part?: string; last: ISODate }[]>;
}

interface Credit {
  work: Work;
  part?: string;
  last: ISODate;
}

// ── People ───────────────────────────────────────────────────────────────

function parseInstruments(spec: string): PlayedInstrument[] {
  return spec.split(',').map((tok, k) => {
    const [id, level] = tok.split(':');
    if (!instrument(id)) throw new Error(`Unknown instrument in roster: ${id}`);
    return { instrumentId: id, level: k === 0 ? 'primary' : ((level ?? 'secondary') as PlayedInstrument['level']) };
  });
}

function makeMusician(row: RosterRow, anchor: ISODate, root: Rng): Musician {
  const rng = root.fork(`m:${row.n}`);
  const [firstName, ...rest] = row.n.split(' ');
  const lastName = rest.join(' ');
  const instruments = parseInstruments(row.i);
  const primary = instruments[0].instrumentId;
  const fam = instrument(primary)!.family;
  const base = placeByName(row.c);
  const year = Number(anchor.slice(0, 4));

  if (primary === 'accordion') instruments[0].note = rng.pick(ACCORDION_NOTES);
  for (const p of instruments) {
    const notes = INSTRUMENT_NOTES[p.instrumentId];
    if (notes && !p.note && rng.chance(0.75)) p.note = rng.pick(notes);
  }

  const roles = [...ROLES[row.a]];
  const add = (r: RoleId, p: number) => {
    if (!roles.includes(r) && rng.chance(p)) roles.push(r);
  };
  if (row.a === 'orch') add('teacher', 0.3);
  if (row.a === 'free') (add('soloist', 0.3), add('teacher', 0.4));
  if (row.a === 'solo') add('teacher', 0.5);
  if (row.a === 'chamber') (add('soloist', 0.4), add('teacher', 0.4));
  if (row.a === 'early') add('soloist', 0.5);
  if (row.a === 'contemp') add('teacher', 0.3);
  if (row.a === 'concert') (add('opera', 0.4), add('teacher', 0.3));
  if (row.a === 'opera') add('teacher', 0.15);
  if (instruments.some((p) => CONTINUO.has(p.instrumentId)) && ['early', 'church', 'collab'].includes(row.a)) {
    if (!roles.includes('continuo')) roles.push('continuo');
  }

  const period = instruments.some((p) => instrument(p.instrumentId)!.family === 'early' || p.level === 'period');
  let pitches: number[] = [];
  if (fam !== 'voice' && !['cond', 'comp'].includes(row.a)) {
    if (period || ['harpsichord', 'organ'].includes(primary)) {
      pitches = [415, 440];
      if (rng.chance(0.45)) pitches.push(430);
      if (['cornetto', 'sackbut', 'theorbo', 'organ', 'harpsichord', 'recorder'].some((x) => instruments.some((p) => p.instrumentId === x)) && rng.chance(0.6)) pitches.push(466);
      if (rng.chance(0.2)) pitches.push(392);
      if (fam !== 'early') pitches.push(442);
    } else {
      pitches = [440, 442];
    }
    pitches = [...new Set(pitches)].sort((a, b) => a - b);
  }

  const langs = row.langs ?? [...(base.name === 'Lugano' ? ['Italian', 'German', 'English'] : (DEFAULT_LANGS[base.country] ?? ['English']))];
  if (!row.langs) {
    const extra = base.country === 'IT' ? ['French', 'German', 'Spanish'] : ['Italian', 'French', 'German'];
    const pick = rng.pick(extra);
    if (rng.chance(0.4) && !langs.includes(pick)) langs.push(pick);
  }

  const urgentDefault = ['free', 'orch', 'chamber', 'early', 'contemp', 'collab', 'church', 'concert', 'opera'].includes(row.a) ? 0.82 : row.a === 'solo' ? 0.5 : 0.3;
  const urgentCalls = row.urgent ?? rng.chance(urgentDefault);
  const bulky = ['harp', 'double-bass', 'percussion', 'timpani', 'harpsichord', 'violone', 'tuba'].includes(primary);

  return {
    id: musicianId(row.n),
    slug: slugify(row.n),
    firstName,
    lastName,
    name: row.n,
    headline: '',
    bio: '',
    instruments,
    voiceDescription: row.v,
    roles,
    base,
    travelRadiusKm: row.r ?? 150,
    travelsInternationally: row.intl ?? false,
    fee: { min: row.f[0], max: row.f[1] },
    teachingRate: roles.includes('teacher') ? rng.pick(base.country === 'IT' ? [30, 35, 40, 45] : [50, 60, 70, 80]) : undefined,
    languages: langs,
    pitches,
    practical: {
      ownTransport: bulky || rng.chance(0.72),
      canInvoice: rng.chance(year - row.b > 30 ? 0.85 : 0.6),
      urgentCalls,
      noticeHours: urgentCalls ? rng.pick([3, 6, 6, 12, 24]) : undefined,
    },
    training: [],
    masterclasses: [],
    positions: [],
    repertoire: [],
    recordings: [],
    awards: [],
    availability: {},
    activeSince: row.b + rng.int(21, 24),
    tint: rng.int(0, 359),
    joinedAt: `${addDays(anchor, -rng.int(40, 520))}T09:00:00.000Z`,
    updatedAt: `${addDays(anchor, -rng.int(1, 35))}T09:00:00.000Z`,
  };
}

function institutionCountry(name: string): string {
  const rules: [RegExp, string][] = [
    [/Wien|Salzburg|Mozarteum|Graz/, 'AT'],
    [/Basel|Basiliensis|Zürich|Zürcher|Genève|Lugano|Gstaad/, 'CH'],
    [/Conservatorio|Accademia|Scuola|Fiesole|Imola|Siena/, 'IT'],
    [/Hochschule|Ensemble Modern|Bremen/, 'DE'],
    [/Conservatoire|Haute école|Rhin/, 'FR'],
    [/Royal|Guildhall/, 'GB'],
    [/Gent/, 'BE'],
    [/Koninklijk|Conservatorium|HKU/, 'NL'],
    [/Sibelius/, 'FI'],
    [/Danske/, 'DK'],
    [/Kungliga/, 'SE'],
    [/Akademia|Uniwersytet/, 'PL'],
    [/AMU/, 'CZ'],
    [/Liszt/, 'HU'],
    [/Akademija/, 'SI'],
    [/Real Conservatorio|Catalunya/, 'ES'],
    [/Lisboa/, 'PT'],
  ];
  return rules.find(([re]) => re.test(name))?.[1] ?? 'IT';
}

function teacherName(rng: Rng, country: string, used: Set<string>): string {
  const c = TEACHER_SURNAMES[country] ? country : 'IT';
  const free = TEACHER_SURNAMES[c].filter((x) => !used.has(x));
  const surname = rng.pick(free.length ? free : TEACHER_SURNAMES[c]);
  used.add(surname);
  return `${rng.pick(TEACHER_FIRST[c])} ${surname}`;
}

function addTraining(m: Musician, row: RosterRow, root: Rng): void {
  const rng = root.fork(`t:${m.id}`);
  const used = new Set<string>();
  const primary = m.instruments[0].instrumentId;
  const fam = instrument(primary)!.family;
  const subject = fam === 'voice' ? 'singing' : row.a === 'cond' ? 'piano and conducting' : row.a === 'comp' ? 'composition and piano' : instrumentName(instrument(primary)?.modern ?? primary).toLowerCase();
  const home = CONSERVATORIES[m.base.name] ?? CONSERVATORIES[m.base.country === 'IT' ? 'Bologna' : 'Wien'];
  const italian = institutionCountry(home) === 'IT';
  const start = row.b + rng.int(17, 19);
  m.training.push({
    id: `${m.id}-tr1`,
    institution: home,
    qualification: italian ? `Diploma accademico di I livello — ${subject}` : `Bachelor of Music — ${subject}`,
    teacher: teacherName(rng, institutionCountry(home), used),
    from: start,
    to: start + (italian ? 3 : 4),
  });
  const specialism =
    row.a === 'early' ? 'early' : primary === 'accordion' ? 'accordion' : fam === 'voice' ? 'voice' : row.a === 'contemp' ? 'contemp' : fam === 'strings' ? 'strings' : fam === 'woodwind' || fam === 'brass' ? 'wind' : fam === 'keyboard' ? 'keyboard' : 'general';
  if (rng.chance(row.a === 'teach' || row.a === 'church' ? 0.45 : 0.8)) {
    const inst = rng.pick(POSTGRAD[specialism].filter((x) => x !== home));
    const from = start + (italian ? 3 : 4);
    const it2 = institutionCountry(inst) === 'IT';
    const subj2 = specialism === 'early' ? `${instrumentName(primary).toLowerCase()} (historical performance)` : subject;
    m.training.push({
      id: `${m.id}-tr2`,
      institution: inst,
      qualification: /summer|Chigiana|Stauffer|Incontri/.test(inst) ? `Advanced course — ${subj2}` : it2 ? `Diploma accademico di II livello — ${subj2}` : `Master of Music — ${subj2}`,
      teacher: teacherName(rng, institutionCountry(inst), used),
      from,
      to: from + 2,
    });
  }
  m.training.reverse();
  const n = rng.int(1, 3);
  const places = rng.sample(MASTERCLASS_PLACES, n);
  for (let k = 0; k < n; k++) {
    m.masterclasses.push({
      id: `${m.id}-mc${k}`,
      teacher: teacherName(rng, rng.pick(['IT', 'DE', 'FR', 'GB', 'AT', 'NL']), used),
      place: places[k],
      year: row.b + rng.int(20, 27),
    });
  }
  m.masterclasses.sort((a, b) => b.year - a.year);

  const year = Number(m.joinedAt.slice(0, 4));
  const count = row.a === 'solo' ? rng.int(2, 3) : rng.chance(0.55) ? rng.int(1, 2) : 0;
  const pool = [...COMPETITIONS[fam], ...COMPETITIONS.any];
  for (const [k, competition] of rng.sample(pool, count).entries()) {
    m.awards.push({
      id: `${m.id}-aw${k}`,
      competition,
      result: /finalist|Borsa/.test(competition) ? (competition.includes('Borsa') ? 'Scholarship holder' : 'Finalist') : rng.pick(RESULTS),
      year: Math.min(year - 1, row.b + rng.int(20, 29)),
    });
  }
  m.awards.sort((a, b) => b.year - a.year);
}

// ── Organisations and membership ─────────────────────────────────────────

/** Which of their instruments a musician would play for this kind of organisation. */
function instrumentFor(m: Musician, kind: OrgSeed['kind'], pool: ProgrammePool): string | undefined {
  const early = m.instruments.find((p) => instrument(p.instrumentId)!.family === 'early' || ['harpsichord', 'organ'].includes(p.instrumentId));
  const modern = m.instruments.find((p) => {
    const f = instrument(p.instrumentId)!.family;
    return f !== 'early' && f !== 'voice' && p.level !== 'period';
  });
  if (kind === 'baroque-ensemble' || pool === 'baroque') return early?.instrumentId;
  return modern?.instrumentId;
}

function seat(instrumentId: string, rng: Rng, baroque = false): string {
  const name = instrumentName(instrumentId);
  const lower = name.toLowerCase();
  if (instrumentId === 'violin' || instrumentId === 'baroque-violin') return rng.chance(0.5) ? 'Violin I' : 'Violin II';
  if (baroque && CONTINUO.has(instrumentId)) return `Continuo (${lower})`;
  const fam = instrument(instrumentId)!.family;
  if (fam === 'strings' || instrumentId === 'baroque-viola') return rng.chance(0.3) ? `Principal ${lower}` : name;
  if (fam === 'woodwind' || fam === 'brass') return rng.chance(0.55) ? `Principal ${lower}` : `${name} II`;
  return name;
}

function buildOrganisations(w: World): void {
  const memberships = new Map<ID, number>();
  // Home ensembles first: fixed line-ups and church posts count towards the cap.
  for (const seed of ORGANISATIONS) for (const [name] of seed.members ?? []) memberships.set(musicianId(name), (memberships.get(musicianId(name)) ?? 0) + 1);
  for (const seed of ORGANISATIONS) {
    const rng = w.rng.fork(`org:${seed.id}`);
    const base = placeByName(seed.city);
    const members: Organisation['members'] = [];
    const reach = seed.reach ?? 150;
    const near = w.musicians
      .map((m) => ({ m, d: distanceKm(base, m.base), row: w.rows.get(m.id)! }))
      .filter((x) => x.d <= reach)
      .sort((a, b) => a.d - b.d);

    if (seed.members) {
      for (const [name, role] of seed.members) members.push({ musicianId: musicianId(name), role, since: seed.founded });
    } else {
      const perInstrument = new Map<string, number>();
      const performing = !['music-school', 'events'].includes(seed.kind);
      const take = (m: Musician, role: string, cap: number, key: string) => {
        const n = perInstrument.get(key) ?? 0;
        if (n >= cap || members.some((x) => x.musicianId === m.id)) return;
        // Nobody is a regular member of everything within reach.
        const load = memberships.get(m.id) ?? 0;
        if (performing && load >= 2) return;
        if (performing) memberships.set(m.id, load + 1);
        perInstrument.set(key, n + 1);
        members.push({ musicianId: m.id, role, since: Math.max(seed.founded, m.activeSince + rng.int(0, 4)) });
      };
      for (const { m, row } of near) {
        const fam = instrument(m.instruments[0].instrumentId)!.family;
        const ins = instrumentFor(m, seed.kind, seed.pool);
        switch (seed.kind) {
          case 'orchestra':
            if (members.length < 18 && ins && ['orch', 'free', 'chamber'].includes(row.a) && (ORCHESTRAL_FAMILIES.has(instrument(ins)!.family) || ins === 'harp')) take(m, seat(ins, rng), ins === 'violin' ? 5 : 2, ins);
            break;
          case 'chamber-orchestra':
            if (members.length < 11 && ins && ['orch', 'free', 'chamber'].includes(row.a) && (instrument(ins)!.family === 'strings' || ['oboe', 'horn', 'flute', 'bassoon'].includes(ins))) take(m, seat(ins, rng), ins === 'violin' ? 4 : 2, ins);
            break;
          case 'baroque-ensemble':
            if (members.length < 11 && ins && !['opera', 'cond', 'comp', 'church', 'teach', 'collab'].includes(row.a) && fam !== 'voice') take(m, seat(ins, rng, true), ins === 'baroque-violin' ? 3 : 2, ins);
            break;
          case 'contemporary-ensemble':
            if (members.length < 8 && ins && ins !== 'accordion' && (row.a === 'contemp' || row.a === 'comp' || (['free', 'chamber'].includes(row.a) && ['flute', 'clarinet', 'violin', 'cello', 'piano', 'percussion', 'viola'].includes(ins)))) take(m, instrumentName(ins), 1, ins);
            break;
          case 'choir':
            if (members.length < 8 && fam === 'voice' && row.a === 'concert') take(m, `${instrumentName(m.instruments[0].instrumentId)} (section leader)`, 2, m.instruments[0].instrumentId);
            break;
          case 'opera-company':
            if (members.length < 3 && ['collab', 'cond'].includes(row.a)) take(m, row.a === 'cond' ? 'Music director' : 'Répétiteur', 1, row.a);
            break;
          case 'church':
            if (members.length < 4 && (m.instruments[0].instrumentId === 'organ' || (fam === 'voice' && row.a === 'concert'))) take(m, m.instruments[0].instrumentId === 'organ' ? 'Organist' : `${instrumentName(m.instruments[0].instrumentId)} soloist`, 2, fam);
            break;
          case 'music-school':
            if (members.length < 8 && m.roles.includes('teacher') && ins) take(m, `${instrumentName(ins)} teacher`, 1, ins);
            break;
          case 'events':
            if (members.length < 9 && ins && ['free', 'chamber', 'church'].includes(row.a) && ['violin', 'viola', 'cello', 'harp', 'organ', 'flute'].includes(ins)) take(m, `${instrumentName(ins)} (roster)`, 3, ins);
            break;
          default:
            break;
        }
      }
    }

    let admins: ID[];
    if (seed.adminMusician) {
      admins = [musicianId(seed.adminMusician)];
    } else {
      const a = seed.admin!;
      const id = a.id ?? `acc-${slugify(a.name)}`;
      admins = [id];
      w.accounts.push({ id, kind: 'organiser', name: a.name, title: a.title, orgIds: [seed.id], base, tint: rng.int(0, 359) });
    }

    w.organisations.push({
      id: seed.id,
      slug: slugify(seed.name),
      name: seed.name,
      kind: seed.kind,
      base,
      about: seed.about,
      founded: seed.founded,
      admins,
      members,
      tint: rng.int(0, 359),
    });
    w.orgSeeds.set(seed.id, seed);
  }

  // Positions on profiles mirror memberships.
  for (const org of w.organisations) {
    for (const mem of org.members) {
      const m = w.musicians.find((x) => x.id === mem.musicianId);
      if (!m) throw new Error(`Unknown member ${mem.musicianId} in ${org.name}`);
      m.positions.push({ id: `${m.id}-pos-${org.id}`, title: mem.role, organisation: org.name, orgId: org.id, from: mem.since ?? org.founded });
    }
  }
}

// ── Concerts ─────────────────────────────────────────────────────────────

const KIND: Record<ProgrammePool, ConcertKind> = {
  symphonic: 'orchestral',
  'chamber-orchestra': 'orchestral',
  baroque: 'early',
  contemporary: 'contemporary',
  choral: 'sacred',
  opera: 'opera',
  quartet: 'chamber',
  'piano-trio': 'chamber',
  wind: 'chamber',
  brass: 'chamber',
  festival: 'chamber',
  recitals: 'recital',
  church: 'sacred',
  none: 'chamber',
};

const VOICE_SLOTS: [string, string[]][] = [
  ['Soprano', ['soprano']],
  ['Alto', ['mezzo-soprano', 'contralto', 'countertenor']],
  ['Tenor', ['tenor']],
  ['Bass', ['bass', 'bass-baritone', 'baritone']],
];

class ConcertBuilder {
  /** orgId → musicians who have already appeared as its soloist */
  soloists = new Map<ID, Set<ID>>();
  private counts = new Map<ID, number>();
  private busy = new Map<ID, Set<ISODate>>();
  credits = new Map<ID, Map<string, Credit>>();
  private seq = 0;

  constructor(private w: World) {}

  count(id: ID): number {
    return this.counts.get(id) ?? 0;
  }

  bump(id: ID, date: ISODate): void {
    this.counts.set(id, this.count(id) + 1);
    const set = this.busy.get(id) ?? new Set<ISODate>();
    set.add(date);
    this.busy.set(id, set);
  }

  private free(id: ID, date: ISODate): boolean {
    return !this.busy.get(id)?.has(date);
  }

  credit(id: ID, work: Work, date: ISODate, part?: string): void {
    const key = `${work.composer}|${work.work}|${part ?? ''}`;
    const map = this.credits.get(id) ?? new Map<string, Credit>();
    const prev = map.get(key);
    if (!prev || prev.last < date) map.set(key, { work, part, last: date });
    this.credits.set(id, map);
  }

  /** Musicians near a place matching a predicate, least-booked first among the nearest. */
  pickNear(place: { lat: number; lng: number }, km: number, date: ISODate, rng: Rng, pred: (m: Musician, row: RosterRow) => boolean, exclude: ID[] = [], strict = false): Musician | undefined {
    const pool = this.w.musicians
      .filter((m) => !exclude.includes(m.id) && this.free(m.id, date) && pred(m, this.w.rows.get(m.id)!))
      .map((m) => ({ m, d: distanceKm(place, m.base) }))
      .filter((x) => x.d <= km || (!strict && x.m.travelsInternationally))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    if (!pool.length) return undefined;
    const min = Math.min(...pool.map((x) => this.count(x.m.id)));
    return rng.pick(pool.filter((x) => this.count(x.m.id) <= min + 1)).m;
  }

  add(c: Omit<Concert, 'id'>, credits: { id: ID; works: Work[]; part?: (w: Work) => string | undefined }[]): Concert {
    const concert: Concert = { ...c, id: `c-${String(++this.seq).padStart(4, '0')}` };
    const seen = new Set<ID>();
    concert.participants = concert.participants.filter((p) => (seen.has(p.musicianId) ? false : (seen.add(p.musicianId), true)));
    for (const p of concert.participants) {
      this.counts.set(p.musicianId, this.count(p.musicianId) + 1);
      const set = this.busy.get(p.musicianId) ?? new Set<ISODate>();
      set.add(concert.date);
      this.busy.set(p.musicianId, set);
    }
    for (const cr of credits) for (const work of cr.works) this.credit(cr.id, work, concert.date, cr.part?.(work));
    this.w.concerts.push(concert);
    return concert;
  }

  venue(city: string, country: string, rng: Rng): string {
    return rng.pick(VENUES[city] ?? (country === 'IT' ? GENERIC_VENUES : GENERIC_VENUES_INTL));
  }
}

const items = (works: Work[]): ProgrammeItem[] => works.map((x) => ({ composer: x.composer, work: x.work }));

function soloPool(m: Musician): Work[] {
  const primary = m.instruments[0].instrumentId;
  if (SOLO_REPERTOIRE[primary]) return SOLO_REPERTOIRE[primary];
  if (isVoice(primary)) return VOICE_REPERTOIRE[primary] ?? [];
  const modern = instrument(primary)?.modern;
  if (modern && SOLO_REPERTOIRE[modern]) return SOLO_REPERTOIRE[modern].filter((x) => EARLY_COMPOSERS.has(x.composer));
  const second = m.instruments.find((p) => SOLO_REPERTOIRE[p.instrumentId]);
  return second ? SOLO_REPERTOIRE[second.instrumentId] : [];
}

function vocalPart(voiceId: string, work: Work): string | undefined {
  return VOICE_REPERTOIRE[voiceId]?.find((x) => x.composer === work.composer && x.work === work.work)?.part;
}

function orgConcert(w: World, b: ConcertBuilder, org: Organisation, seed: OrgSeed, date: ISODate, rng: Rng, shuffled: Map<string, Work[]>): void {
  const pool = seed.pool;
  if (pool === 'none') return;
  const cycle = (key: string, list: Work[]): Work => {
    const arr = shuffled.get(key) ?? rng.shuffle(list);
    const next = arr.shift()!;
    arr.push(next);
    shuffled.set(key, arr);
    return next;
  };

  // Where: usually at home, sometimes on tour nearby.
  let place = org.base;
  if (rng.chance(0.22)) {
    const others = CITIES.filter((c) => c.name !== org.base.name && distanceKm(c, org.base) < 130 && c.rank >= 2);
    if (others.length) place = placeByName(rng.pick(others).name);
  }
  const venue = b.venue(place.name, place.country, rng);

  const fixed = !!seed.members;
  const participants: ConcertParticipant[] = [];
  const credits: { id: ID; works: Work[]; part?: (x: Work) => string | undefined }[] = [];
  const ensemble: ID[] = [];
  for (const mem of org.members) {
    const hero = ['m-giulia-santoro', 'm-nicolo-baldini', 'm-hannah-lindner'].includes(mem.musicianId);
    if (fixed || hero || rng.chance(0.72)) {
      participants.push({ musicianId: mem.musicianId, role: mem.role.replace(' (section leader)', '').replace(' (roster)', '') });
      ensemble.push(mem.musicianId);
    }
  }
  const exclude = () => participants.map((p) => p.musicianId);
  const had = b.soloists.get(org.id) ?? new Set<ID>();
  b.soloists.set(org.id, had);
  const programme: Work[] = [];
  let conductor: string | undefined;
  let title: string | undefined;

  const addSingers = (work: Work, km: number) => {
    for (const [label, voices] of VOICE_SLOTS) {
      const singer = b.pickNear(place, km, date, rng, (m, row) => voices.includes(m.instruments[0].instrumentId) && (row.a === 'concert' || (row.a === 'opera' && ROMANTIC_VOICES.has(work.composer))), exclude(), pool === 'church' || pool === 'choral');
      if (!singer) continue;
      const part = vocalPart(singer.instruments[0].instrumentId, work) ?? `${label} solo`;
      participants.push({ musicianId: singer.id, role: part });
      credits.push({ id: singer.id, works: [work], part: () => part });
    }
  };

  const addGuests = (n: number, km: number, pred: (m: Musician, row: RosterRow) => boolean, role: (m: Musician) => string) => {
    for (let k = 0; k < n; k++) {
      const g = b.pickNear(place, km, date, rng, pred, exclude());
      if (!g) break;
      participants.push({ musicianId: g.id, role: role(g) });
      ensemble.push(g.id);
    }
  };

  switch (pool) {
    case 'symphonic':
    case 'chamber-orchestra': {
      const works = pool === 'symphonic' ? ORCHESTRAL_WORKS : CHAMBER_ORCHESTRA_WORKS;
      const soloist = rng.chance(pool === 'symphonic' ? 0.75 : 0.5)
        ? b.pickNear(place, 450, date, rng, (m, row) => ['solo', 'chamber', 'contemp'].includes(row.a) && !had.has(m.id) && soloPool(m).some((x) => x.genre === 'concerto'), exclude())
        : undefined;
      if (soloist) {
        had.add(soloist.id);
        const concerto = rng.pick(soloPool(soloist).filter((x) => x.genre === 'concerto'));
        programme.push(concerto);
        participants.push({ musicianId: soloist.id, role: `Soloist (${instrumentName(soloist.instruments[0].instrumentId).toLowerCase()})` });
        credits.push({ id: soloist.id, works: [concerto] });
      }
      const n = pool === 'symphonic' ? (soloist ? 1 : 2) : soloist ? 2 : 3;
      const rest: Work[] = [];
      for (let k = 0; k < n; k++) rest.push(cycle(pool, works));
      programme.push(...rest);
      if (pool === 'symphonic') {
        addGuests(rng.int(1, 3), 160, (m, row) => ['orch', 'free'].includes(row.a) && ORCHESTRAL_FAMILIES.has(instrument(m.instruments[0].instrumentId)!.family), (m) => seat(m.instruments[0].instrumentId, rng));
        const cond = rng.chance(0.5) ? b.pickNear(place, 500, date, rng, (_m, row) => row.a === 'cond', exclude()) : undefined;
        if (cond) {
          participants.push({ musicianId: cond.id, role: 'Conductor' });
          credits.push({ id: cond.id, works: programme, part: () => 'conductor' });
          conductor = cond.name;
        } else conductor = rng.pick(INVENTED_CONDUCTORS);
      }
      credits.push(...ensemble.map((id) => ({ id, works: rest })));
      break;
    }
    case 'baroque': {
      const big = rng.chance(0.55);
      if (big) {
        const work = cycle('baroque-vocal', BAROQUE_ENSEMBLE_WORKS.filter((x) => x.genre !== 'orchestral'));
        programme.push(work);
        addSingers(work, 450);
      } else {
        for (let k = 0; k < 3; k++) programme.push(cycle('baroque-instr', BAROQUE_ENSEMBLE_WORKS.filter((x) => x.genre === 'orchestral')));
      }
      addGuests(rng.int(0, 2), 300, (m, row) => row.a !== 'cond' && !!instrumentFor(m, 'baroque-ensemble', 'baroque') && !isVoice(m.instruments[0].instrumentId), (m) => seat(instrumentFor(m, 'baroque-ensemble', 'baroque')!, rng, true));
      credits.push(
        ...ensemble.map((id) => {
          const role = participants.find((p) => p.musicianId === id)!.role;
          return { id, works: programme, part: () => (role.startsWith('Continuo') ? 'continuo' : undefined) };
        }),
      );
      break;
    }
    case 'contemporary': {
      for (let k = 0; k < 3; k++) programme.push(cycle('contemp', CONTEMPORARY_WORKS));
      // Flexible line-up: only the players the pieces call for take part.
      const playing = participants.filter((p) => {
        const m = w.musicians.find((x) => x.id === p.musicianId)!;
        const ids = m.instruments.map((x) => x.instrumentId);
        const works = programme.filter((x) => (FORCES[x.work] ?? []).some((f) => ids.includes(f)));
        if (works.length) credits.push({ id: m.id, works });
        return works.length > 0;
      });
      participants.length = 0;
      participants.push(...playing);
      break;
    }
    case 'choral':
    case 'church': {
      const small = SACRED_WORKS.filter((x) => ['Gloria RV 589', 'Stabat Mater', 'Requiem Op. 48', 'Krönungsmesse K. 317', 'Magnificat BWV 243', 'Stabat Mater RV 621', 'Requiem K. 626', 'Petite messe solennelle', 'Messa di Gloria'].includes(x.work));
      if (pool === 'church' || rng.chance(0.5)) {
        const work = cycle(pool === 'church' ? 'church' : 'choral-symphonic', pool === 'church' ? small : SACRED_WORKS);
        programme.push(work);
        const keep = participants.filter((p) => !isVoice(w.musicians.find((m) => m.id === p.musicianId)!.instruments[0].instrumentId));
        participants.length = 0;
        participants.push(...keep);
        addSingers(work, 350);
        const organist = pool === 'church' ? undefined : b.pickNear(place, 200, date, rng, (m) => m.instruments[0].instrumentId === 'organ', exclude());
        if (organist) {
          participants.push({ musicianId: organist.id, role: 'Organ' });
          credits.push({ id: organist.id, works: [work], part: () => 'organ' });
        }
        for (const p of keep) credits.push({ id: p.musicianId, works: [work], part: () => 'organ' });
      } else {
        for (let k = 0; k < 3; k++) programme.push(cycle('a-cappella', CHORAL_WORKS));
        credits.push(...ensemble.map((id) => ({ id, works: programme, part: () => 'consort' })));
      }
      break;
    }
    case 'opera': {
      const work = cycle('opera', OPERA_WORKS);
      programme.push(work);
      title = work.work;
      const taken = new Set<string>();
      for (const [voiceId, list] of Object.entries(VOICE_REPERTOIRE)) {
        for (const r of list.filter((x) => x.genre === 'opera' && x.composer === work.composer && x.work === work.work)) {
          if (taken.has(r.part!)) continue;
          const singer = b.pickNear(place, 600, date, rng, (m, row) => m.instruments[0].instrumentId === voiceId && ['opera', 'concert'].includes(row.a), exclude());
          if (!singer) continue;
          taken.add(r.part!);
          participants.push({ musicianId: singer.id, role: r.part! });
          credits.push({ id: singer.id, works: [work], part: () => r.part });
        }
      }
      const before = ensemble.length;
      addGuests(rng.int(4, 6), 200, (m, row) => ['orch', 'free'].includes(row.a) && ORCHESTRAL_FAMILIES.has(instrument(m.instruments[0].instrumentId)!.family), (m) => seat(m.instruments[0].instrumentId, rng));
      credits.push(...ensemble.slice(before).map((id) => ({ id, works: [work] })));
      for (const mem of org.members) {
        if (!participants.some((p) => p.musicianId === mem.musicianId)) continue;
        credits.push({ id: mem.musicianId, works: [work], part: () => (mem.role === 'Répétiteur' ? 'répétiteur' : 'conductor') });
        if (mem.role === 'Music director') conductor = w.musicians.find((m) => m.id === mem.musicianId)!.name;
      }
      conductor ??= rng.pick(INVENTED_CONDUCTORS);
      break;
    }
    case 'quartet': {
      const list = STRING_CHAMBER_WORKS.filter((x) => /Quartet|Crisantemi|Langsamer/.test(x.work));
      for (let k = 0; k < 3; k++) programme.push(cycle('quartet', list));
      credits.push(...ensemble.map((id) => ({ id, works: programme })));
      break;
    }
    case 'piano-trio': {
      const list = PIANO_CHAMBER_WORKS.filter((x) => /Trio/.test(x.work));
      for (let k = 0; k < 3; k++) programme.push(cycle('trio', list));
      credits.push(...ensemble.map((id) => ({ id, works: programme })));
      break;
    }
    case 'wind': {
      const list = WIND_CHAMBER_WORKS.filter((x) => /Quintet|Bagatelles|Kammermusik|pièces|Summer/.test(x.work));
      for (let k = 0; k < 3; k++) programme.push(cycle('wind', list));
      credits.push(...ensemble.map((id) => ({ id, works: programme })));
      break;
    }
    case 'brass': {
      for (let k = 0; k < 4; k++) programme.push(cycle('brass', BRASS_CHAMBER_WORKS));
      credits.push(...ensemble.map((id) => ({ id, works: programme })));
      break;
    }
    case 'festival': {
      const form = rng.pick(['strings', 'strings', 'piano', 'wind']);
      if (form === 'strings') {
        addGuests(2, 300, (m, row) => ['chamber', 'solo', 'free'].includes(row.a) && m.instruments[0].instrumentId === 'violin', () => 'Violin');
        addGuests(1, 300, (m) => m.instruments[0].instrumentId === 'viola', () => 'Viola');
        addGuests(rng.int(1, 2), 300, (m, row) => m.instruments[0].instrumentId === 'cello' && row.a !== 'orch', () => 'Cello');
        for (let k = 0; k < 2; k++) programme.push(cycle('fest-strings', STRING_CHAMBER_WORKS));
      } else if (form === 'piano') {
        addGuests(1, 400, (m, row) => m.instruments[0].instrumentId === 'piano' && ['solo', 'chamber', 'collab'].includes(row.a), () => 'Piano');
        addGuests(1, 300, (m, row) => m.instruments[0].instrumentId === 'violin' && row.a !== 'orch', () => 'Violin');
        addGuests(1, 300, (m) => m.instruments[0].instrumentId === 'viola', () => 'Viola');
        addGuests(1, 300, (m, row) => m.instruments[0].instrumentId === 'cello' && row.a !== 'orch', () => 'Cello');
        for (let k = 0; k < 2; k++) programme.push(cycle('fest-piano', PIANO_CHAMBER_WORKS));
      } else {
        for (const ins of ['flute', 'oboe', 'clarinet', 'horn', 'bassoon']) addGuests(1, 300, (m) => m.instruments[0].instrumentId === ins, () => instrumentName(ins));
        for (let k = 0; k < 3; k++) programme.push(cycle('fest-wind', WIND_CHAMBER_WORKS));
      }
      credits.push(...ensemble.map((id) => ({ id, works: programme })));
      break;
    }
    case 'recitals': {
      const soloist = b.pickNear(place, 500, date, rng, (m, row) => ['solo', 'chamber', 'contemp', 'early'].includes(row.a) && soloPool(m).filter((x) => x.genre !== 'concerto').length >= 3, exclude());
      if (!soloist) return;
      recital(w, b, soloist, date, rng, { place, venue, orgId: org.id });
      return;
    }
    default:
      return;
  }

  if (participants.length < 2 && pool !== 'church') return;
  b.add(
    {
      date,
      time: rng.pick(['18:00', '20:30', '21:00', '17:00', '20:00']),
      title,
      venue,
      city: place.name,
      country: place.country,
      kind: KIND[pool],
      orgId: org.id,
      ensembleName: org.name,
      conductor,
      programme: items(programme),
      participants,
      createdBy: org.admins[0],
    },
    credits,
  );
}

function recital(
  w: World,
  b: ConcertBuilder,
  soloist: Musician,
  date: ISODate,
  rng: Rng,
  at?: { place: { name: string; country: string }; venue: string; orgId?: ID },
): void {
  const primary = soloist.instruments[0].instrumentId;
  const singer = isVoice(primary);
  const pool = singer
    ? [...SONG_WORKS, ...soloPool(soloist).filter((x) => x.genre === 'song')]
    : soloPool(soloist).filter((x) => x.genre !== 'concerto' && x.genre !== 'orchestral' && x.genre !== 'opera' && x.genre !== 'sacred');
  if (pool.length < 2) return;
  const programme = rng.sample(pool, singer ? 2 : rng.int(3, 4));
  const place = at?.place ?? soloist.base;
  const venue = at?.venue ?? b.venue(place.name, place.country, rng);
  const participants: ConcertParticipant[] = [{ musicianId: soloist.id, role: singer ? instrumentName(primary) : instrumentName(primary) }];
  const credits: { id: ID; works: Work[]; part?: (x: Work) => string | undefined }[] = [{ id: soloist.id, works: programme }];
  const needsPartner = singer || (!SELF_SUFFICIENT.has(primary) && programme.some((x) => x.genre === 'chamber'));
  let ensembleName: string | undefined;
  if (needsPartner) {
    const early = w.rows.get(soloist.id)!.a === 'early';
    const partner = b.pickNear(soloist.base, 400, date, rng, (m, row) => (early ? ['harpsichord', 'theorbo'].includes(m.instruments[0].instrumentId) : m.instruments[0].instrumentId === 'piano' && ['collab', 'chamber', 'solo'].includes(row.a)), [soloist.id]);
    if (partner) {
      participants.push({ musicianId: partner.id, role: instrumentName(partner.instruments[0].instrumentId) });
      const shared = programme.filter((x) => singer || x.genre === 'chamber');
      credits.push({ id: partner.id, works: shared, part: () => (early ? 'continuo' : 'piano') });
      ensembleName = `${soloist.name} & ${partner.name}`;
    }
  }
  b.add(
    {
      date,
      time: rng.pick(['11:00', '17:30', '18:00', '20:30', '21:00']),
      title: singer ? 'Liederabend' : rng.pick(['Recital', 'Recital', 'Chamber recital', 'Concerto di mezzogiorno', 'Solo recital']),
      venue,
      city: place.name,
      country: place.country,
      kind: 'recital',
      orgId: at?.orgId,
      ensembleName,
      programme: items(programme),
      participants,
      createdBy: at?.orgId ? w.organisations.find((o) => o.id === at.orgId)!.admins[0] : soloist.id,
    },
    credits,
  );
}

export interface HeroConcert {
  daysFromAnchor: number;
  time?: string;
  title?: string;
  venue: string;
  city: string;
  kind: ConcertKind;
  orgId?: ID;
  ensembleName?: string;
  conductor?: string;
  programme: [string, string][];
  /** [name, role, indexes of programme items they played (default all)] */
  players: [string, string, number[]?][];
  /** Add the organisation's regular members as ensemble players for these programme indexes. */
  withMembers?: number[];
}

function heroConcert(w: World, b: ConcertBuilder, h: HeroConcert): void {
  const date = addDays(w.anchor, h.daysFromAnchor);
  const place = placeByName(h.city);
  const works: Work[] = h.programme.map(([composer, work]) => ({ composer, work, genre: genreOf(composer, work, h.kind) }));
  const participants: ConcertParticipant[] = [];
  const credits: { id: ID; works: Work[]; part?: (x: Work) => string | undefined }[] = [];
  for (const [name, role, idx] of h.players) {
    const m = w.byName(name);
    participants.push({ musicianId: m.id, role });
    credits.push({ id: m.id, works: idx ? idx.map((k) => works[k]) : works, part: (x) => (isVoice(m.instruments[0].instrumentId) ? (vocalPart(m.instruments[0].instrumentId, x) ?? role) : undefined) });
  }
  if (h.orgId && h.withMembers) {
    const org = w.organisations.find((o) => o.id === h.orgId)!;
    for (const mem of org.members) {
      if (participants.some((p) => p.musicianId === mem.musicianId)) continue;
      const ids = w.musicians.find((x) => x.id === mem.musicianId)!.instruments.map((x) => x.instrumentId);
      const theirs = h.withMembers.map((k) => works[k]).filter((x) => h.kind !== 'contemporary' || (FORCES[x.work] ?? []).some((f) => ids.includes(f)));
      if (!theirs.length) continue;
      participants.push({ musicianId: mem.musicianId, role: mem.role });
      credits.push({ id: mem.musicianId, works: theirs });
    }
  }
  b.add(
    {
      date,
      time: h.time ?? '20:30',
      title: h.title,
      venue: h.venue,
      city: place.name,
      country: place.country,
      kind: h.kind,
      orgId: h.orgId,
      ensembleName: h.ensembleName ?? (h.orgId ? w.organisations.find((o) => o.id === h.orgId)!.name : undefined),
      conductor: h.conductor,
      programme: items(works),
      participants,
      createdBy: h.orgId ? w.organisations.find((o) => o.id === h.orgId)!.admins[0] : participants[0].musicianId,
    },
    credits,
  );
}

const CATALOGUE_GENRES = new Map<string, Genre>();
for (const pool of [
  ...Object.values(SOLO_REPERTOIRE),
  ...Object.values(VOICE_REPERTOIRE),
  ORCHESTRAL_WORKS,
  CHAMBER_ORCHESTRA_WORKS,
  OPERA_WORKS,
  SACRED_WORKS,
  BAROQUE_ENSEMBLE_WORKS,
  STRING_CHAMBER_WORKS,
  PIANO_CHAMBER_WORKS,
  WIND_CHAMBER_WORKS,
  BRASS_CHAMBER_WORKS,
  CONTEMPORARY_WORKS,
  CHORAL_WORKS,
  SONG_WORKS,
]) {
  for (const x of pool) if (!CATALOGUE_GENRES.has(`${x.composer}|${x.work}`)) CATALOGUE_GENRES.set(`${x.composer}|${x.work}`, x.genre);
}

function genreOf(composer: string, work: string, kind: ConcertKind): Genre {
  const known = CATALOGUE_GENRES.get(`${composer}|${work}`);
  if (known) return known;
  return ({ orchestral: 'orchestral', chamber: 'chamber', recital: 'solo', opera: 'opera', sacred: 'sacred', early: 'sacred', contemporary: 'contemporary' } as const)[kind];
}

export function buildConcerts(w: World, heroes: HeroConcert[]): ConcertBuilder {
  const b = new ConcertBuilder(w);
  for (const h of heroes) heroConcert(w, b, h);

  for (const org of w.organisations) {
    const seed = w.orgSeeds.get(org.id)!;
    const rng = w.rng.fork(`concerts:${org.id}`);
    const shuffled = new Map<string, Work[]>();
    const dates: ISODate[] = [];
    for (let k = 0; k < seed.concerts; k++) dates.push(addDays(w.anchor, -rng.int(12, 900)));
    const upcoming = seed.pool === 'none' ? 0 : rng.int(1, 2);
    for (let k = 0; k < upcoming; k++) dates.push(addDays(w.anchor, rng.int(6, 110)));
    for (const date of dates.sort()) orgConcert(w, b, org, seed, date, rng, shuffled);
  }

  // Recitals and solo dates, so that soloists and chamber players have a history of their own.
  for (const m of w.musicians) {
    const row = w.rows.get(m.id)!;
    const rng = w.rng.fork(`recitals:${m.id}`);
    const n = { solo: 4, contemp: 3, chamber: 2, early: 2, concert: 2, collab: 0, free: 1, teach: 1, opera: 1, church: 1, comp: 1 }[row.a as string] ?? 0;
    for (let k = 0; k < n; k++) recital(w, b, m, addDays(w.anchor, -rng.int(15, 880)), rng);
    if (['solo', 'contemp'].includes(row.a) && rng.chance(0.6)) recital(w, b, m, addDays(w.anchor, rng.int(8, 120)), rng);
  }

  // Nobody should have an empty concert history.
  for (const m of w.musicians) {
    const rng = w.rng.fork(`fill:${m.id}`);
    let guard = 0;
    while (b.count(m.id) < 3 && guard++ < 4) {
      const before = b.count(m.id);
      recital(w, b, m, addDays(w.anchor, -rng.int(30, 800)), rng);
      if (b.count(m.id) === before) break;
    }
  }

  // Orchestral players far from any orchestra on the platform: guest weeks with the nearest one.
  for (const m of w.musicians) {
    if (b.count(m.id) >= 3) continue;
    const primary = m.instruments[0].instrumentId;
    if (!ORCHESTRAL_FAMILIES.has(instrument(primary)!.family)) continue;
    const rng = w.rng.fork(`guest:${m.id}`);
    const host = w.organisations
      .filter((o) => ['orchestra', 'chamber-orchestra'].includes(o.kind))
      .sort((x, y) => distanceKm(x.base, m.base) - distanceKm(y.base, m.base))[0];
    const theirs = w.concerts.filter((c) => c.orgId === host.id && c.date < w.anchor && !c.participants.some((p) => p.musicianId === m.id));
    for (const c of rng.sample(theirs, 4)) {
      c.participants.push({ musicianId: m.id, role: seat(primary, rng) });
      b.bump(m.id, c.date);
      for (const item of c.programme) {
        const genre = genreOf(item.composer, item.work, c.kind);
        if (genre !== 'concerto') b.credit(m.id, { ...item, genre }, c.date);
      }
    }
  }

  w.concerts.sort((x, y) => y.date.localeCompare(x.date));
  w.credited = new Map([...b.credits.entries()].map(([id, map]) => [id, [...map.values()].sort((x, y) => y.last.localeCompare(x.last))]));
  return b;
}

// ── Repertoire ───────────────────────────────────────────────────────────

export function buildRepertoire(w: World, b: ConcertBuilder): void {
  const yearNow = Number(w.anchor.slice(0, 4));
  for (const m of w.musicians) {
    const row = w.rows.get(m.id)!;
    const rng = w.rng.fork(`rep:${m.id}`);
    const primary = m.instruments[0].instrumentId;
    const out = new Map<string, RepertoireItem>();
    let seq = 0;
    const put = (work: Work, part: string | undefined, status: RepertoireItem['status'], last?: number) => {
      const key = `${work.composer}|${work.work}`;
      const prev = out.get(key);
      const item: RepertoireItem = { id: `${m.id}-r${seq++}`, composer: work.composer, work: work.work, part: part ?? work.part, genre: work.genre, status, lastPerformed: last };
      if (!prev) out.set(key, item);
      else if (status === 'ready' && prev.status !== 'ready') out.set(key, { ...prev, status, lastPerformed: last ?? prev.lastPerformed });
    };

    // 1. What they have played in the concerts on record.
    for (const c of b.credits.get(m.id)?.values() ?? []) {
      const ago = diffDays(w.anchor, c.last);
      const status = ago < 0 ? 'learning' : ago < 600 ? 'ready' : 'performed';
      put(c.work, c.part, status, ago < 0 ? undefined : Number(c.last.slice(0, 4)));
    }

    // 2. The wider repertoire a musician of this kind carries.
    const sampleInto = (pool: Work[], share: number, part?: string, readyP = 0.45) => {
      for (const work of rng.sample(pool, Math.round(pool.length * share))) {
        const roll = rng.next();
        const status = roll < readyP ? 'ready' : roll < 0.88 ? 'performed' : 'learning';
        put(work, part, status, status === 'learning' ? undefined : yearNow - (status === 'ready' ? rng.int(0, 2) : rng.int(2, 7)));
      }
    };
    const solo = soloPool(m);
    const voice = isVoice(primary);
    if (voice) {
      const roles = solo.filter((x) => x.genre === 'opera');
      const concert = solo.filter((x) => x.genre !== 'opera');
      sampleInto(roles, row.a === 'opera' ? 0.75 : 0.3);
      sampleInto(concert, row.a === 'opera' ? 0.45 : 0.8);
      if (row.a === 'concert') sampleInto(SONG_WORKS, 0.3);
    } else if (row.a === 'cond') {
      sampleInto(ORCHESTRAL_WORKS, 0.4, 'conductor');
      sampleInto(SACRED_WORKS, 0.35, 'conductor');
      sampleInto(OPERA_WORKS, 0.25, 'conductor');
    } else {
      sampleInto(solo, ['solo', 'contemp', 'chamber'].includes(row.a) ? 0.8 : row.a === 'comp' ? 0.2 : 0.5);
      const fam = instrument(instrument(primary)?.modern ?? primary)!.family;
      const orchestral = ORCHESTRAL_FAMILIES.has(fam) || primary === 'harp';
      if (orchestral && ['orch', 'free'].includes(row.a)) {
        sampleInto(ORCHESTRAL_WORKS, row.a === 'orch' ? 0.45 : 0.25, undefined, 0.35);
        sampleInto(OPERA_WORKS, row.a === 'orch' ? 0.3 : 0.15, undefined, 0.3);
      }
      if (['chamber', 'free', 'solo'].includes(row.a)) {
        if (fam === 'strings') sampleInto(STRING_CHAMBER_WORKS, 0.35);
        if (fam === 'woodwind' || primary === 'horn') sampleInto(WIND_CHAMBER_WORKS, 0.4);
        if (fam === 'brass' && primary !== 'horn') sampleInto(BRASS_CHAMBER_WORKS, 0.6);
        if (primary === 'piano') sampleInto(PIANO_CHAMBER_WORKS, 0.5);
      }
      if (row.a === 'early') {
        sampleInto(BAROQUE_ENSEMBLE_WORKS, 0.35, m.roles.includes('continuo') ? 'continuo' : undefined);
        if (m.roles.includes('continuo')) sampleInto(CONTINUO_WORKS, 0.5);
      }
      if (row.a === 'contemp' && primary !== 'accordion') sampleInto(CONTEMPORARY_WORKS, 0.35);
      if (row.a === 'collab') {
        sampleInto(SONG_WORKS, 0.6, 'piano');
        sampleInto(PIANO_CHAMBER_WORKS, 0.5);
        sampleInto(OPERA_WORKS, 0.3, 'répétiteur');
      }
      if (row.a === 'church') {
        sampleInto(SACRED_WORKS, 0.35, 'organ');
        if (m.roles.includes('continuo')) sampleInto(CONTINUO_WORKS, 0.3);
      }
    }

    const order = { ready: 0, performed: 1, learning: 2 } as const;
    m.repertoire = [...out.values()].sort((x, y) => order[x.status] - order[y.status] || x.composer.localeCompare(y.composer) || x.work.localeCompare(y.work));
  }
}

// ── Recordings, headline, biography ──────────────────────────────────────

export function buildRecordings(w: World): void {
  for (const m of w.musicians) {
    const rng = w.rng.fork(`rec:${m.id}`);
    if (rng.chance(0.12)) continue;
    const mine = w.concerts.filter((c) => c.date < w.anchor && c.participants.some((p) => p.musicianId === m.id));
    const voice = isVoice(m.instruments[0].instrumentId);
    const keys = m.instruments[0].instrumentId === 'piano';
    const ready = m.repertoire.filter(
      (r) => r.status === 'ready' && (voice ? r.genre !== 'orchestral' : ['solo', 'concerto', 'chamber', 'contemporary'].includes(r.genre) || (keys && r.genre === 'song')),
    );
    const n = Math.min(ready.length, rng.int(1, 4));
    for (const [k, r] of rng.sample(ready, n).entries()) {
      const live = mine.find((c) => c.programme.some((p) => p.composer === r.composer && p.work === r.work));
      m.recordings.push({
        id: `${m.id}-rec${k}`,
        title: `${r.composer}: ${r.work}${r.part && !/continuo|piano|organ|conductor|consort|répétiteur/.test(r.part) ? ` — ${r.part}` : ''}`,
        kind: rng.chance(0.55) ? 'video' : 'audio',
        year: live ? Number(live.date.slice(0, 4)) : (r.lastPerformed ?? Number(w.anchor.slice(0, 4)) - 1),
        durationSec: rng.int(170, 840),
        note: live ? `Live at ${live.venue}, ${live.city}` : rng.pick(['Studio recording', 'Live recording', 'Recorded for radio broadcast', 'Self-produced session']),
      });
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Violin I" → "a member of the first violins"; "Oboe II" → "second oboe". */
function describeSeat(title: string): string {
  if (title === 'Violin I') return 'a member of the first violins';
  if (title === 'Violin II') return 'a member of the second violins';
  const second = /^(.*) II$/.exec(title);
  if (second) return `second ${second[1].toLowerCase()}`;
  if (/^Principal /.test(title)) return title.toLowerCase();
  if (/^Continuo/.test(title)) return 'a continuo player';
  return `a member of the ${title.toLowerCase()} section`;
}
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function buildBios(w: World): void {
  for (const m of w.musicians) {
    const row = w.rows.get(m.id)!;
    const rng = w.rng.fork(`bio:${m.id}`);
    const primary = m.instruments[0].instrumentId;
    const ins = instrument(primary)!;
    const player = ins.player;
    const an = /^[aeiou]/i.test(player) ? 'an' : 'a';
    const orgs = m.positions.map((p) => p.organisation);
    const mainPos =
      (row.a === 'church' ? m.positions.find((p) => /Cappella|Organist/.test(`${p.organisation} ${p.title}`)) : undefined) ??
      m.positions.find((p) => /orchestra|Orchestra|Camerata|Sinfonietta|Kammerorchester/.test(p.organisation)) ??
      m.positions[0];
    const recent = w.concerts.filter((c) => c.date < w.anchor && c.participants.some((p) => p.musicianId === m.id)).slice(0, 6);
    const ready = m.repertoire.filter((r) => r.status === 'ready');
    const composers = [...new Set(ready.map((r) => r.composer))];
    const [cA, cB] = rng.sample(composers.length >= 2 ? composers : ['Bach', 'Brahms'], 2);

    // Headline
    const headline: Record<Archetype, () => string> = {
      orch: () => (mainPos ? `${mainPos.title}, ${mainPos.organisation}` : `Orchestral ${player}`),
      free: () => `Freelance ${player} · orchestra, chamber music${m.roles.includes('teacher') ? ', teaching' : ''}`,
      solo: () => `${cap(player)} · soloist and recitalist`,
      chamber: () => (orgs[0] ? `${cap(player)} · ${orgs[0]}` : `${cap(player)} · chamber musician`),
      early: () => `${ins.name} · period instruments${m.roles.includes('continuo') ? ', continuo' : ''}`,
      contemp: () => `${cap(player)} · contemporary music, chamber, solo`,
      opera: () => m.voiceDescription ?? cap(player),
      concert: () => m.voiceDescription ?? cap(player),
      church: () => (mainPos ? `${mainPos.title}, ${mainPos.organisation}` : `Organist and continuo player`),
      collab: () => 'Collaborative pianist and répétiteur',
      teach: () => `${ins.name} teacher and chamber musician`,
      cond: () => 'Conductor',
      comp: () => 'Composer and pianist',
    };
    m.headline = headline[row.a]();

    // Biography
    const s: string[] = [];
    const where = m.base.name;
    const opening: Record<Archetype, string[]> = {
      orch: mainPos
        ? [`${m.name} is ${describeSeat(mainPos.title)} of the ${mainPos.organisation}, a post held since ${mainPos.from}.`]
        : [`${m.name} is an orchestral ${player} based in ${where}, working as a guest with orchestras across the region.`],
      free: [
        `${m.name} is a freelance ${player} based in ${where}, equally at home in an orchestra section, in chamber music and in the recording studio.`,
        `Based in ${where}, ${m.name} works as a freelance ${player} with orchestras, chamber groups and opera companies throughout the region.`,
      ],
      solo: [
        `${m.name} appears as a soloist and recitalist at home and abroad, with a repertoire that runs from ${cA} to ${cB}.`,
        `${cap(an)} ${player} with a growing international calendar, ${m.name} divides the season between concerto appearances, recitals and chamber music.`,
      ],
      chamber: [
        `Chamber music is at the centre of ${m.name}’s work${orgs[0] ? `, above all with ${orgs[0]}` : ''}.`,
        `${m.name} is ${an} ${player} for whom playing means, first of all, playing with others${orgs[0] ? ` — since ${m.positions[0].from} as a member of ${orgs[0]}` : ''}.`,
      ],
      early: [
        `${m.name} plays ${ins.name.toLowerCase()} with period-instrument ensembles in ${m.base.country === 'IT' ? 'Italy' : 'Europe'} and beyond, with a particular love for ${rng.pick(['the Italian Seicento', 'Bach’s cantatas and Passions', 'the French Baroque', 'the Venetian repertoire', 'the German seventeenth century'])}.`,
        `A specialist in historical performance, ${m.name} works as ${an} ${player}${m.roles.includes('continuo') ? ' and continuo player' : ''} with ensembles such as ${list(orgs.slice(0, 2)) || 'leading period-instrument groups'}.`,
      ],
      contemp: [
        `${m.name} is ${an} ${player} devoted to the music of our time, working directly with composers on new pieces while keeping ${cA} and ${cB} in constant rotation.`,
        `New music is where ${m.name} feels most at home: premieres, close work with composers, and the twentieth-century classics that made the ${ins.name.toLowerCase()} a concert instrument.`,
      ],
      opera: [`${m.voiceDescription ?? cap(player)}. ${m.name} has built a stage repertoire that centres on ${list(m.repertoire.filter((r) => r.genre === 'opera' && r.part).slice(0, 3).map((r) => `${r.part} (${r.work})`)) || 'the Italian lyric repertoire'}.`],
      concert: [
        `${m.name} is a concert singer whose calendar is built around the oratorio repertoire, song recitals and work with vocal consorts.`,
        `${m.voiceDescription ?? cap(player)}. ${m.name} is most often heard in ${rng.pick(['the Passions and cantatas of Bach', 'the oratorios of Handel and Bach', 'sacred music from Monteverdi to Mozart'])}, alongside regular recital work.`,
      ],
      church: [`${m.name} ${mainPos ? `has been ${mainPos.title.toLowerCase()} of the ${mainPos.organisation} since ${mainPos.from}` : `is an organist based in ${where}`}, and plays continuo for choirs and ensembles across the region.`],
      collab: [`${m.name} is a collaborative pianist and répétiteur: song recitals, instrumental duos, auditions and the opera rehearsal room.`],
      teach: [`${m.name} divides the week between teaching and performing — ${ins.name.toLowerCase()} teacher${mainPos ? ` at the ${mainPos.organisation}` : ''} and an active chamber musician.`],
      cond: [`${m.name} is a conductor who came to the podium from the keyboard, working with orchestras, choirs and opera companies in ${m.base.country === 'IT' ? 'Italy' : 'the German-speaking countries'} and abroad.`],
      comp: [`${m.name} is a composer and pianist whose chamber and vocal works are performed by ensembles for new music in Italy and abroad.`],
    };
    s.push(rng.pick(opening[row.a]));

    const [t1, t2] = [...m.training].reverse();
    if (t1) s.push(`Studied at the ${t1.institution} with ${t1.teacher}${t2 ? `, then at ${/^Det /.test(t2.institution) ? '' : 'the '}${t2.institution} with ${t2.teacher}` : ''}.`);

    const guestOrgs = [...new Set(recent.map((c) => c.ensembleName).filter((x): x is string => !!x && !orgs.includes(x) && !x.includes('&')))];
    const played = (w.credited.get(m.id) ?? []).filter((c) => c.last < w.anchor);
    const recentWorks: string[] = [];
    const seenComposers = new Set<string>();
    for (const c of played) {
      if (seenComposers.has(c.work.composer)) continue;
      seenComposers.add(c.work.composer);
      recentWorks.push(`${c.work.composer}’s ${c.work.work.replace(/ \(.*\)$/, '').replace(/ (BWV|HWV|RV|K\.|Op\.|D\.|TWV|Hob\.) ?[\d–/: No.a-zA-Z]+.*$/, '')}`);
      if (recentWorks.length === 2) break;
    }
    if (recentWorks.length) {
      s.push(`Recent seasons have included ${list(recentWorks)}${guestOrgs.length ? `, and guest appearances with ${list(guestOrgs.slice(0, 2))}` : ''}.`);
    }
    if (m.awards[0] && !/Finalist|Scholarship/.test(m.awards[0].result)) s.push(`${m.awards[0].result} at the ${m.awards[0].competition} (${m.awards[0].year}).`);
    if (m.roles.includes('teacher') && row.a !== 'teach' && rng.chance(0.6)) s.push(rng.pick(['Teaches a small class of private students.', 'Regularly coaches youth orchestra sections and chamber groups.', 'Gives masterclasses and workshops for conservatory students.']));
    m.bio = s.join(' ');
  }
}

export function buildAccountsForMusicians(w: World): void {
  for (const m of w.musicians) {
    w.accounts.push({
      id: m.id,
      kind: 'musician',
      name: m.name,
      title: m.headline,
      musicianId: m.id,
      orgIds: w.organisations.filter((o) => o.admins.includes(m.id)).map((o) => o.id),
      base: m.base,
      tint: m.tint,
    });
  }
}

export function createWorld(anchor: ISODate): World {
  const rng = new Rng('leggio-seed-v1');
  const rows = new Map<ID, RosterRow>();
  const musicians = ROSTER.map((row) => {
    const m = makeMusician(row, anchor, rng);
    rows.set(m.id, row);
    return m;
  });
  const byId = new Map(musicians.map((m) => [m.id, m]));
  if (byId.size !== musicians.length) throw new Error('Duplicate musician in roster');
  const w: World = {
    anchor,
    rng,
    musicians,
    rows,
    accounts: [],
    organisations: [],
    orgSeeds: new Map(),
    concerts: [],
    credited: new Map(),
    byName: (name) => {
      const m = byId.get(musicianId(name));
      if (!m) throw new Error(`Unknown musician: ${name}`);
      return m;
    },
  };
  for (const m of musicians) addTraining(m, rows.get(m.id)!, rng);
  buildOrganisations(w);
  return w;
}
