import type {
  Application,
  ApplicationStatus,
  Concert,
  Connection,
  ID,
  ISODate,
  Message,
  Musician,
  Notification,
  Opportunity,
  RepertoireItem,
  Thread,
} from '../../../domain/types';
import { placeByName } from '../../../domain/cities';
import { addDays, nextOccurrence, weekday } from '../../../domain/dates';
import { distanceKm } from '../../../domain/geo';
import { isVoice } from '../../../domain/taxonomy';
import { matchInstrument } from '../../../domain/search/engine';
import { DB_VERSION, type Database } from '../db';
import {
  buildAccountsForMusicians,
  buildBios,
  buildConcerts,
  buildRecordings,
  buildRepertoire,
  createWorld,
  musicianId,
  type HeroConcert,
  type World,
} from './build';
import { opportunitySeeds, rep, type DateTools } from './opportunities';
import { ENDORSEMENTS } from './pools';

export const PERSONA_IDS = {
  nicolo: 'm-nicolo-baldini',
  giulia: 'm-giulia-santoro',
  hannah: 'm-hannah-lindner',
  beatrice: 'acc-beatrice',
  lorenzo: 'acc-lorenzo',
} as const;

const HERO_CONCERTS: HeroConcert[] = [
  {
    daysFromAnchor: -38,
    venue: 'Teatro Dal Verme',
    city: 'Milano',
    kind: 'contemporary',
    orgId: 'org-sestante',
    title: 'Sette parole',
    programme: [
      ['Gubaidulina', 'Sieben Worte'],
      ['Sciarrino', 'Vagabonde blu'],
      ['Pärt', 'Fratres'],
    ],
    players: [
      ['Nicolò Baldini', 'Soloist (bayan)', [0, 1]],
      ['Andrea Brambilla', 'Soloist (cello)', [0, 2]],
    ],
    withMembers: [0, 2],
  },
  {
    daysFromAnchor: -75,
    time: '18:00',
    title: 'Mantice solo',
    venue: 'Chiesa di San Carlo',
    city: 'Modena',
    kind: 'recital',
    programme: [
      ['Bach', 'Goldberg Variations BWV 988 (accordion)'],
      ['D. Scarlatti', 'Keyboard Sonatas (accordion)'],
      ['Gubaidulina', 'De profundis'],
      ['Berio', 'Sequenza XIII “Chanson”'],
    ],
    players: [['Nicolò Baldini', 'Accordion']],
  },
  {
    daysFromAnchor: -128,
    time: '21:15',
    title: 'Buenos Aires sul crinale',
    venue: 'Parco delle Terme (open-air stage)',
    city: 'Porretta Terme',
    kind: 'chamber',
    orgId: 'org-crinale',
    programme: [
      ['Piazzolla', 'Las cuatro estaciones porteñas'],
      ['Piazzolla', 'Five Tango Sensations'],
      ['Puccini', 'Crisantemi'],
    ],
    players: [
      ['Nicolò Baldini', 'Accordion', [0, 1]],
      ['Caterina Rovatti', 'Violin I'],
      ['Giulia Santoro', 'Violin II'],
      ['Chiara Benassi', 'Viola'],
      ['Pietro Zanarini', 'Cello'],
      ['Dario Venturoli', 'Double bass', [0]],
    ],
  },
  {
    daysFromAnchor: -251,
    venue: 'Auditorium Manzoni',
    city: 'Bologna',
    kind: 'orchestral',
    orgId: 'org-reno',
    conductor: 'Tancredi Morosini',
    programme: [
      ['Piazzolla', 'Concerto “Aconcagua”'],
      ['Respighi', 'Antiche danze ed arie, Suite No. 3'],
      ['Stravinsky', 'Pulcinella Suite'],
    ],
    players: [['Nicolò Baldini', 'Soloist (accordion)', [0]]],
    withMembers: [1, 2],
  },
  {
    daysFromAnchor: -424,
    venue: 'Auditorium Manzoni',
    city: 'Bologna',
    kind: 'orchestral',
    orgId: 'org-reno',
    conductor: 'Ilse Brandstetter',
    title: 'Concerto di Carnevale',
    programme: [
      ['Shostakovich', 'Suite for Variety Orchestra'],
      ['Tchaikovsky', 'Orchestral Suite No. 2 Op. 53'],
      ['Rossini', 'Overtures'],
    ],
    players: [['Nicolò Baldini', 'Accordion', [0, 1]]],
    withMembers: [0, 1, 2],
  },
  {
    daysFromAnchor: -512,
    time: '11:00',
    venue: 'Teatro Galli',
    city: 'Rimini',
    kind: 'recital',
    orgId: 'org-malatestiana',
    ensembleName: 'Nicolò Baldini & Pietro Zanarini',
    programme: [
      ['Gubaidulina', 'In croce'],
      ['Piazzolla', 'Histoire du tango'],
      ['Bach', 'Gamba Sonatas BWV 1027–1029'],
    ],
    players: [
      ['Nicolò Baldini', 'Accordion'],
      ['Pietro Zanarini', 'Cello'],
    ],
  },
  {
    daysFromAnchor: 33,
    venue: 'Teatro Dal Verme',
    city: 'Milano',
    kind: 'contemporary',
    orgId: 'org-sestante',
    title: 'Ance libere',
    programme: [
      ['Kagel', 'Episoden, Figuren'],
      ['Hosokawa', 'Melodia'],
      ['Lindberg', 'Jeux d’anches'],
      ['Donatoni', 'Arpège'],
    ],
    players: [['Nicolò Baldini', 'Accordion', [0, 1, 2]]],
    withMembers: [3],
  },
  // Hannah Lindner
  {
    daysFromAnchor: -20,
    venue: 'Konzerthaus — Mozart-Saal',
    city: 'Wien',
    kind: 'orchestral',
    orgId: 'org-donaukanal',
    programme: [
      ['Mahler', 'Rückert-Lieder'],
      ['Schubert', 'Symphony No. 8 “Unfinished” D. 759'],
      ['Mozart', 'Symphony No. 29 in A K. 201'],
    ],
    players: [['Hannah Lindner', 'Mezzo-soprano solo', [0]]],
    withMembers: [1, 2],
  },
  {
    daysFromAnchor: -96,
    time: '19:30',
    title: 'Liederabend',
    venue: 'Ehrbar Saal',
    city: 'Wien',
    kind: 'recital',
    ensembleName: 'Hannah Lindner & Leonardo Bernasconi',
    programme: [
      ['Brahms', 'Vier ernste Gesänge Op. 121'],
      ['Mahler', 'Lieder eines fahrenden Gesellen'],
      ['Berlioz', 'Les nuits d’été'],
    ],
    players: [
      ['Hannah Lindner', 'Mezzo-soprano'],
      ['Leonardo Bernasconi', 'Piano'],
    ],
  },
  {
    daysFromAnchor: -236,
    time: '18:00',
    venue: 'Nikolaikirche',
    city: 'Leipzig',
    kind: 'early',
    orgId: 'org-pleisse',
    programme: [['Bach', 'Matthäus-Passion BWV 244']],
    players: [
      ['Hannah Lindner', 'Alto arias'],
      ['Johanna Weiss', 'Soprano arias'],
      ['James Ashworth', 'Evangelist'],
      ['Rhys Morgan', 'Christus'],
    ],
    withMembers: [0],
  },
  {
    daysFromAnchor: -345,
    venue: 'Église Saint-Roch',
    city: 'Paris',
    kind: 'early',
    orgId: 'org-heures',
    programme: [
      ['Vivaldi', 'Stabat Mater RV 621'],
      ['Pergolesi', 'Stabat Mater'],
    ],
    players: [
      ['Hannah Lindner', 'Alto solo'],
      ['Élise Garnier', 'Soprano solo', [1]],
    ],
    withMembers: [0, 1],
  },
  {
    daysFromAnchor: 26,
    time: '17:00',
    venue: 'Minoritenkirche',
    city: 'Wien',
    kind: 'sacred',
    orgId: 'org-donaukanal',
    programme: [['Handel', 'Messiah HWV 56']],
    players: [
      ['Hannah Lindner', 'Alto solo'],
      ['Sophie Krenn', 'Soprano solo'],
    ],
    withMembers: [0],
  },
  // Giulia Santoro — a quartet date of her own
  {
    daysFromAnchor: -54,
    time: '21:00',
    venue: 'Teatro Comunale',
    city: 'Modena',
    kind: 'chamber',
    orgId: 'org-malvasia',
    programme: [
      ['Verdi', 'String Quartet in E minor'],
      ['Puccini', 'Crisantemi'],
      ['Schubert', 'String Quintet in C D. 956'],
    ],
    players: [
      ['Caterina Rovatti', 'Violin I'],
      ['Giulia Santoro', 'Violin II'],
      ['Chiara Benassi', 'Viola'],
      ['Pietro Zanarini', 'Cello'],
      ['Enrico Malavasi', 'Cello II', [2]],
    ],
  },
];

// ── Hand-finished profiles for the personas ──────────────────────────────

function finishPersonas(w: World): void {
  const nicolo = w.byName('Nicolò Baldini');
  nicolo.headline = 'Accordionist (bayan) · contemporary music, Piazzolla, Bach';
  nicolo.bio =
    'Nicolò Baldini plays the classical accordion — a free-bass bayan — in the places people least expect to find one: in front of a symphony orchestra, inside a string quartet, alone in a church with the Goldberg Variations. Trained at the Conservatorio “G. Rossini” in Pesaro and then for two years in Trossingen, he has worked closely with composers on new pieces for the instrument and is a regular guest of Ensemble Sestante in Milan. Recent seasons have included Gubaidulina’s Sieben Worte, Piazzolla’s Aconcagua concerto with the Orchestra Filarmonica del Reno, and the accordion parts that orchestras suddenly need filled: Shostakovich, Tchaikovsky’s Second Suite, the tavern band in Wozzeck. Based in Modena, he reads fast, travels with his own instrument and amplification, and is used to joining a programme at the dress rehearsal.';
  nicolo.instruments[0].note = 'Pigini Sirius bayan, free-bass (C-system); own discreet amplification for outdoor concerts';
  nicolo.training = [
    { id: 'nb-tr2', institution: 'Staatliche Hochschule für Musik Trossingen', qualification: 'Master of Music — accordion', teacher: 'Christiane Lindemann', from: 2016, to: 2018 },
    { id: 'nb-tr1', institution: 'Conservatorio “G. Rossini”, Pesaro', qualification: 'Diploma accademico di I livello — accordion', teacher: 'Renato Valdinoci', from: 2012, to: 2015 },
  ];
  nicolo.awards = [
    { id: 'nb-aw1', year: 2019, competition: 'Premio Internazionale di Fisarmonica “Mantice d’Oro”', result: 'First prize, classical category' },
    { id: 'nb-aw2', year: 2017, competition: 'Internationaler Akkordeonwettbewerb “Hohe Schule”, Klingenthal-Aue', result: 'Third prize and prize for the best performance of a contemporary work' },
  ];
  nicolo.practical = { ownTransport: true, canInvoice: true, urgentCalls: true, noticeHours: 6 };
  nicolo.teachingRate = 40;
  if (!nicolo.roles.includes('teacher')) nicolo.roles.push('teacher');
  forceRepertoire(nicolo, [
    ['Piazzolla', 'Las cuatro estaciones porteñas', 'ready'],
    ['Piazzolla', 'Concerto “Aconcagua”', 'ready'],
    ['Piazzolla', 'Five Tango Sensations', 'ready'],
    ['Piazzolla', 'Histoire du tango', 'ready'],
    ['Gubaidulina', 'De profundis', 'ready'],
    ['Gubaidulina', 'In croce', 'ready'],
    ['Gubaidulina', 'Sieben Worte', 'ready'],
    ['Bach', 'Goldberg Variations BWV 988 (accordion)', 'ready'],
    ['Shostakovich', 'Suite for Variety Orchestra', 'ready'],
    ['Berio', 'Sequenza XIII “Chanson”', 'ready'],
    ['Berg', 'Wozzeck', 'performed'],
    ['Hindemith', 'Kammermusik No. 1 Op. 24', 'performed'],
    ['Zolotaryov', 'Sonata No. 3', 'performed'],
  ]);
  nicolo.recordings = [
    { id: 'nb-rec1', title: 'Gubaidulina: De profundis', kind: 'video', year: 2026, durationSec: 742, note: 'Live at Chiesa di San Carlo, Modena' },
    { id: 'nb-rec2', title: 'Piazzolla: Las cuatro estaciones porteñas — Invierno porteño', kind: 'video', year: 2026, durationSec: 418, note: 'With Quartetto Malvasia, Festival Note sul Crinale' },
    { id: 'nb-rec3', title: 'Bach: Goldberg Variations — Aria and Variations 1–7', kind: 'audio', year: 2025, durationSec: 655, note: 'Studio recording' },
    { id: 'nb-rec4', title: 'Berio: Sequenza XIII “Chanson”', kind: 'audio', year: 2024, durationSec: 534, note: 'Recorded for radio broadcast' },
  ];

  const giulia = w.byName('Giulia Santoro');
  const renoPos = giulia.positions.find((p) => p.orgId === 'org-reno');
  if (renoPos) {
    renoPos.title = 'Violin I';
    renoPos.from = 2015;
  }
  const renoOrg = w.organisations.find((o) => o.id === 'org-reno')!;
  const renoMember = renoOrg.members.find((x) => x.musicianId === giulia.id);
  if (renoMember) {
    renoMember.role = 'Violin I';
    renoMember.since = 2015;
  }
  giulia.headline = 'Violin I, Orchestra Filarmonica del Reno · Quartetto Malvasia';
  giulia.bio =
    'Giulia Santoro has been a member of the first violins of the Orchestra Filarmonica del Reno since 2015 and is second violin of the Quartetto Malvasia, which she co-founded in Modena in 2016. She studied at the Conservatorio “G.B. Martini” in Bologna and at the Scuola di Musica di Fiesole, and spent a year with the academy of a German radio orchestra before returning to Emilia. Alongside the orchestra’s season she plays chamber music at festivals across the region, guests as a viola player when a section needs one, and coaches the violins of a youth orchestra. Colleagues call her when they need a desk partner who has already marked the bowings.';
  giulia.practical = { ownTransport: true, canInvoice: true, urgentCalls: true, noticeHours: 12 };
  forceRepertoire(giulia, [
    ['Brahms', 'Symphony No. 2 in D Op. 73', 'ready'],
    ['Mahler', 'Symphony No. 1 “Titan”', 'ready'],
    ['Verdi', 'La traviata', 'ready'],
    ['Verdi', 'String Quartet in E minor', 'ready'],
    ['Schubert', 'String Quintet in C D. 956', 'ready'],
    ['Mozart', 'Violin Concerto No. 5 in A K. 219', 'ready'],
    ['Bach', 'Partita No. 2 in D minor BWV 1004', 'performed'],
  ]);

  const hannah = w.byName('Hannah Lindner');
  hannah.headline = 'Lyric mezzo-soprano · Bach, Mahler, Mozart';
  hannah.bio =
    'Hannah Lindner is a Vienna-based mezzo-soprano whose year is shaped by the church calendar and the recital stage: the alto arias of Bach’s Passions and the Christmas Oratorio, Handel’s Messiah, Mahler and Brahms with piano and with orchestra. She studied at the Universität für Musik und darstellende Kunst Wien and at the Guildhall School in London, and sings regularly with the Camerata Donaukanal, the Pleißenburg Consort in Leipzig and Les Heures Claires in Paris. On stage she has sung Cherubino, Dorabella and Sesto. She learns quickly, sings in five languages and is known among conductors for stepping into oratorio performances at short notice with the arias memorised.';
  hannah.practical = { ownTransport: false, canInvoice: true, urgentCalls: true, noticeHours: 6 };
  hannah.training = [
    { id: 'hl-tr2', institution: 'Guildhall School of Music & Drama, London', qualification: 'Master of Performance — vocal studies', teacher: 'Rosalind Fairbairn', from: 2011, to: 2013 },
    { id: 'hl-tr1', institution: 'Universität für Musik und darstellende Kunst Wien', qualification: 'Bachelor of Arts — singing (Lied and oratorio)', teacher: 'Ingrid Hofstätter', from: 2007, to: 2011 },
  ];
  hannah.awards = [
    { id: 'hl-aw1', year: 2015, competition: 'Internationaler Liedwettbewerb “Das Wort im Lied”', result: 'Second prize (with pianist Leonardo Bernasconi)' },
    { id: 'hl-aw2', year: 2013, competition: 'Concorso di Canto Barocco “Premio Fioritura”', result: 'First prize' },
  ];
  hannah.recordings = [
    { id: 'hl-rec1', title: 'Bach: “Erbarme dich”, Matthäus-Passion', kind: 'video', year: 2026, durationSec: 398, note: 'Live at Nikolaikirche, Leipzig' },
    { id: 'hl-rec2', title: 'Mahler: Rückert-Lieder — “Ich bin der Welt abhanden gekommen”', kind: 'video', year: 2026, durationSec: 402, note: 'With Camerata Donaukanal, Konzerthaus Wien' },
    { id: 'hl-rec3', title: 'Brahms: Vier ernste Gesänge', kind: 'audio', year: 2026, durationSec: 1085, note: 'Live at Ehrbar Saal, Wien' },
  ];

  forceRepertoire(w.byName('Anna Bedeschi'), [['Bach', 'Johannes-Passion BWV 245', 'ready', 'viola da gamba solo, continuo']]);
  forceRepertoire(w.byName('Hugo Blanchard'), [['Bach', 'Johannes-Passion BWV 245', 'ready', 'viola da gamba solo']]);
  forceRepertoire(w.byName('Pietro Zanarini'), [['Bach', 'Johannes-Passion BWV 245', 'performed', 'continuo']]);
  forceRepertoire(w.byName('Viola Casadei'), [['Dvořák', 'String Quartet No. 12 “American” Op. 96', 'ready']]);

  // A composer should have works of their own.
  const jacopo = w.byName('Jacopo Verdirame');
  jacopo.repertoire.unshift(
    { id: 'jv-own1', composer: 'Verdirame', work: 'Lamento d’Arianna, dopo Monteverdi — for mezzo-soprano and six players (2025)', genre: 'contemporary', status: 'ready', lastPerformed: 2026, part: 'composer, piano' },
    { id: 'jv-own2', composer: 'Verdirame', work: 'Carte da navigare — for ensemble (2024)', genre: 'contemporary', status: 'ready', lastPerformed: 2025, part: 'composer' },
    { id: 'jv-own3', composer: 'Verdirame', work: 'Tre notturni di carta — for piano (2022)', genre: 'contemporary', status: 'ready', lastPerformed: 2025, part: 'composer, piano' },
  );
  forceRepertoire(hannah, [
    ['Bach', 'Weihnachtsoratorium BWV 248', 'ready', 'Alto arias'],
    ['Bach', 'Matthäus-Passion BWV 244', 'ready', 'Alto arias'],
    ['Bach', 'Johannes-Passion BWV 245', 'ready', 'Alto arias'],
    ['Handel', 'Messiah HWV 56', 'ready', 'Alto solo'],
    ['Vivaldi', 'Stabat Mater RV 621', 'ready', 'Alto solo'],
    ['Vivaldi', 'Nisi Dominus RV 608', 'performed', 'Alto solo'],
    ['Mahler', 'Rückert-Lieder', 'ready'],
    ['Mozart', 'Le nozze di Figaro', 'ready', 'Cherubino'],
    ['Mozart', 'Così fan tutte', 'performed', 'Dorabella'],
    ['Mozart', 'La clemenza di Tito', 'performed', 'Sesto'],
    ['Mozart', 'Requiem K. 626', 'ready', 'Alto solo'],
  ]);
}

function forceRepertoire(m: Musician, entries: [string, string, RepertoireItem['status'], string?][]): void {
  const year = Number(m.updatedAt.slice(0, 4));
  for (const [composer, work, status, part] of entries) {
    const found = m.repertoire.find((r) => r.composer === composer && r.work === work);
    if (found) {
      found.status = status;
      if (part) found.part = part;
      found.lastPerformed ??= status === 'ready' ? year - 1 : year - 4;
    } else {
      const genre = /Symphony|Suite for Variety/.test(work) ? 'orchestral' : /Passion|Messiah|Requiem|Stabat|Nisi|oratorium/.test(work) ? 'sacred' : /nozze|Così|Tito|Wozzeck|traviata/.test(work) ? 'opera' : /Concerto/.test(work) ? 'concerto' : /Lieder/.test(work) ? 'song' : 'chamber';
      m.repertoire.push({ id: `${m.id}-rf${m.repertoire.length}`, composer, work, part, genre, status, lastPerformed: status === 'ready' ? year - 1 : year - 4 });
    }
  }
  const order = { ready: 0, performed: 1, learning: 2 } as const;
  m.repertoire.sort((x, y) => order[x.status] - order[y.status] || x.composer.localeCompare(y.composer) || x.work.localeCompare(y.work));
}

// ── Availability ─────────────────────────────────────────────────────────

const BLOCK_NOTES = ['Orchestra production', 'Teaching days', 'Recording session', 'Tour', 'Private engagement', 'Opera run', 'Course', 'Jury duty', 'Chamber music project'];

function buildAvailability(w: World, demoDate: ISODate): void {
  for (const m of w.musicians) {
    const row = w.rows.get(m.id)!;
    const rng = w.rng.fork(`avail:${m.id}`);
    const set = (date: ISODate, status: 'busy' | 'tentative', note?: string) => {
      if (date < w.anchor) return;
      if (m.availability[date]?.status === 'busy') return;
      m.availability[date] = { status, note };
    };
    for (const c of w.concerts) {
      if (c.date < w.anchor || !c.participants.some((p) => p.musicianId === m.id)) continue;
      set(c.date, 'busy', `Concert — ${c.ensembleName ?? c.venue}, ${c.city}`);
      set(addDays(c.date, -1), 'busy', `Rehearsal — ${c.ensembleName ?? c.city}`);
    }
    const blocks = row.a === 'orch' ? 10 : row.a === 'free' ? 7 : 6;
    for (let k = 0; k < blocks; k++) {
      const start = addDays(w.anchor, rng.int(1, 210));
      const len = row.a === 'orch' ? rng.int(2, 5) : rng.int(1, 3);
      const status = rng.chance(0.78) ? 'busy' : 'tentative';
      const note = status === 'tentative' ? 'Pencilled — to be confirmed' : rng.pick(BLOCK_NOTES);
      for (let d = 0; d < len; d++) set(addDays(start, d), status, note);
    }
  }

  // The demo walkthrough relies on these.
  const clear = (name: string, ...dates: ISODate[]) => {
    for (const d of dates) delete w.byName(name).availability[d];
  };
  const day = (n: number) => addDays(w.anchor, n);
  clear('Nicolò Baldini', demoDate, addDays(demoDate, -1), addDays(demoDate, -2), day(0), day(1), day(2), day(3));
  clear('Marta Ghidoni', demoDate, addDays(demoDate, -1), addDays(demoDate, -2));
  clear('Agnese Tibaldi', demoDate);
  w.byName('Ruggero Fabbri').availability[demoDate] = { status: 'busy', note: 'Concert — Teatro Ebe Stignani, Imola' };
  w.byName('Samuele Orlandi').availability[demoDate] = { status: 'tentative', note: 'Pencilled — to be confirmed' };
  clear('Irene Capecchi', demoDate);
  // Giulia's quartet cellist really is away on the Saturday of her urgent call.
  const sat = addDays(w.anchor, 2 + ((5 - weekday(addDays(w.anchor, 2)) + 7) % 7));
  w.byName('Pietro Zanarini').availability[sat] = { status: 'busy', note: 'Orchestra production — tour' };
  clear('Viola Casadei', sat);
  clear('Enrico Malavasi', sat);
  clear('Hannah Lindner', day(3), day(4), day(5));
  // Applicants who wrote "free for all the dates" really are.
  const passion = [8, 9, 10, 11, 12].map((n) => addDays(demoDate, n));
  clear('Anna Bedeschi', ...passion);
  clear('Hugo Blanchard', ...passion);
  clear('Viola Parodi', ...[232, 246].map(day));
}

// ── Network ──────────────────────────────────────────────────────────────

function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildNetwork(w: World, db: Database): void {
  const rng = w.rng.fork('network');
  const shared = new Map<string, number>();
  for (const c of w.concerts) {
    if (c.date >= w.anchor) continue;
    const ids = c.participants.map((p) => p.musicianId);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) shared.set(pairKey(ids[a], ids[b]), (shared.get(pairKey(ids[a], ids[b])) ?? 0) + 1);
  }
  const connected = new Set<string>();
  let seq = 0;
  const connect = (a: ID, b: ID, status: Connection['status'] = 'accepted', daysAgo = rng.int(20, 500)) => {
    if (a === b || connected.has(pairKey(a, b))) return;
    connected.add(pairKey(a, b));
    db.connections.push({ id: `cn-${++seq}`, from: a, to: b, status, createdAt: `${addDays(w.anchor, -daysAgo)}T10:00:00.000Z` });
  };

  const personas = Object.values(PERSONA_IDS) as ID[];
  for (const [key, n] of [...shared.entries()].sort()) {
    const [a, b] = key.split('|');
    const p = 0.33 + 0.12 * Math.min(n, 3);
    if (!rng.chance(p)) continue;
    const flip = rng.chance(0.5);
    connect(flip ? a : b, flip ? b : a);
  }

  // Organiser personas know the people who play for them.
  for (const org of w.organisations) {
    for (const admin of org.admins) {
      const players = new Set<ID>(org.members.map((x) => x.musicianId));
      for (const c of w.concerts) if (c.orgId === org.id && c.date < w.anchor) for (const p of c.participants) players.add(p.musicianId);
      for (const id of [...players].sort()) if (id !== admin && rng.chance(personas.includes(admin) ? 0.6 : 0.3)) connect(admin, id);
    }
  }
  connect(PERSONA_IDS.beatrice, PERSONA_IDS.lorenzo);
  connect(PERSONA_IDS.lorenzo, PERSONA_IDS.nicolo);
  connect(PERSONA_IDS.giulia, musicianId('Caterina Rovatti'));
  connect(PERSONA_IDS.giulia, musicianId('Pietro Zanarini'));
  connect(PERSONA_IDS.giulia, musicianId('Chiara Benassi'));
  connect(PERSONA_IDS.nicolo, musicianId('Andrea Brambilla'));
  connect(PERSONA_IDS.nicolo, musicianId('Pietro Zanarini'));

  // A few pending requests waiting for each musician persona.
  for (const persona of [PERSONA_IDS.nicolo, PERSONA_IDS.giulia, PERSONA_IDS.hannah]) {
    const candidates = [...shared.keys()]
      .filter((k) => k.split('|').includes(persona) && !connected.has(k))
      .map((k) => k.split('|').find((x) => x !== persona)!)
      .sort();
    for (const other of rng.sample(candidates, 2)) {
      connect(other, persona, 'pending', rng.int(1, 9));
      db.notifications.push({ id: `n-cr-${persona}-${other}`, accountId: persona, kind: 'connection-request', actorId: other, createdAt: `${addDays(w.anchor, -rng.int(1, 6))}T08:30:00.000Z`, read: false });
    }
  }
  const beatriceCandidates = w.musicians.filter((m) => distanceKm(m.base, placeByName('Bologna')) < 120 && !connected.has(pairKey(m.id, PERSONA_IDS.beatrice)));
  for (const m of rng.sample(beatriceCandidates, 2)) connect(m.id, PERSONA_IDS.beatrice, 'pending', rng.int(1, 5));
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_x, k: string) => vars[k] ?? '');
}

function buildEndorsements(w: World, db: Database): void {
  const rng = w.rng.fork('endorsements');
  const accepted = new Set(db.connections.filter((c) => c.status === 'accepted').map((c) => pairKey(c.from, c.to)));
  const seen = new Set<string>();
  let seq = 0;
  const push = (fromId: ID, toId: ID, concert: Concert, text: string, daysAfter = rng.int(2, 40)) => {
    if (seen.has(`${fromId}>${toId}`)) return;
    seen.add(`${fromId}>${toId}`);
    const at = addDays(concert.date, daysAfter);
    db.endorsements.push({ id: `en-${++seq}`, fromId, toId, concertId: concert.id, text, createdAt: `${at > w.anchor ? w.anchor : at}T12:00:00.000Z` });
  };

  const past = w.concerts.filter((c) => c.date < w.anchor);
  const find = (pred: (c: Concert) => boolean) => past.find(pred)!;

  // Hand-written endorsements for the personas.
  const N = PERSONA_IDS.nicolo;
  const crinale = find((c) => c.orgId === 'org-crinale' && c.participants.some((p) => p.musicianId === N));
  push(PERSONA_IDS.lorenzo, N, crinale, 'We booked Nicolò for the open-air Piazzolla evening with the Quartetto Malvasia. Arrived a day early to rehearse, re-voiced two of the Estaciones overnight when the wind got up, and held four hundred people silent in a spa-town park. First name on my list for next summer.', 5);
  const sette = find((c) => c.title === 'Sette parole');
  push(musicianId('Andrea Brambilla'), N, sette, 'Sieben Worte lives or dies on the breathing between cello and bayan. With Nicolò I never had to look up: the bellows changes were exactly where my bow changes were. A rare chamber partner on any instrument.', 3);
  const aconcagua = find((c) => c.orgId === 'org-reno' && c.programme.some((p) => p.work.includes('Aconcagua')) && c.participants.some((p) => p.musicianId === N));
  push('acc-marcello-rinaldi', N, aconcagua, 'Soloist in Piazzolla’s Aconcagua for our subscription series. Parts and technical rider arrived three weeks ahead, the orchestra applauded at the first rehearsal, and the invoice was on my desk the morning after. We have since called him twice for orchestral accordion parts.', 9);
  push(musicianId('Pietro Zanarini'), N, crinale, 'I have played with Nicolò in duo and with the quartet. Learns the whole score, not just the accordion line, and has the best rehearsal manners I know — every suggestion comes with a reason.', 12);
  push(musicianId('Caterina Rovatti'), N, crinale, 'Four string players and an accordion can go wrong in many ways. With Nicolò the balance was solved in the first ten minutes and the rest of the rehearsal was about music.', 20);

  const G = PERSONA_IDS.giulia;
  const quartet = find((c) => c.orgId === 'org-malvasia' && c.programme.some((p) => p.work.includes('Quintet in C')));
  push(musicianId('Caterina Rovatti'), G, quartet, 'Ten years of sitting next to Giulia. The most reliable second violin a first could ask for: inner voices that sing, intonation you can lean on, and a pencil that is always sharper than mine.', 4);
  push(musicianId('Enrico Malavasi'), G, quartet, 'Joined the Malvasia as second cello for the Schubert Quintet. Giulia had bowed my part and marked every awkward page turn before I arrived. That is the level of preparation.', 6);
  push(PERSONA_IDS.lorenzo, G, crinale, 'Giulia has played four editions of the festival, as a quartet player and leading our chamber orchestra evening. Calm, quick and kind — the musicians we invite always ask if she will be there.', 15);
  const renoConcert = find((c) => c.orgId === 'org-reno' && c.participants.some((p) => p.musicianId === G));
  push('acc-marcello-rinaldi', G, renoConcert, 'Eleven seasons in our first violins and never once late for a service. When a guest leader needs a desk partner who knows how this orchestra breathes, we seat them next to Giulia.', 30);

  const H = PERSONA_IDS.hannah;
  const passion = find((c) => c.orgId === 'org-pleisse' && c.participants.some((p) => p.musicianId === H));
  push(musicianId('Jonas Albrecht'), H, passion, 'Hannah sang the alto arias in our St Matthew Passion. “Erbarme dich” at a tempo that let the violin solo speak, the text placed like a Lied singer. She had the whole part from memory at the first rehearsal.', 4);
  push(musicianId('James Ashworth'), H, passion, 'I was the Evangelist next to Hannah in Leipzig. A wonderful colleague to stand beside for three hours: completely secure, always listening across the ensemble, and generous in the duets.', 8);
  const rueckert = find((c) => c.orgId === 'org-donaukanal' && c.participants.some((p) => p.musicianId === H));
  push('acc-veronika-stadler', H, rueckert, 'Our Rückert-Lieder with Hannah sold out the Mozart-Saal. She stepped in for us two seasons ago with thirty-six hours’ notice and has been our first call for the alto repertoire ever since.', 6);
  const lieder = find((c) => c.title === 'Liederabend' && c.participants.some((p) => p.musicianId === H));
  push(musicianId('Leonardo Bernasconi'), H, lieder, 'A recital partner who rehearses like a chamber musician. In the Vier ernste Gesänge every breath was agreed and then, in the concert, freely remade. I would play for Hannah any day.', 5);

  // Generated endorsements for everyone else.
  for (const m of w.musicians) {
    const mine = past.filter((c) => c.participants.some((p) => p.musicianId === m.id));
    const target = Math.min(mine.length, rng.int(0, 3));
    let made = 0;
    for (const c of rng.shuffle(mine)) {
      if (made >= target) break;
      const role = c.participants.find((p) => p.musicianId === m.id)!.role;
      const voice = isVoice(m.instruments[0].instrumentId);
      const fit = voice ? 'singer' : /Soloist/.test(role) || (c.kind === 'recital' && c.participants[0].musicianId === m.id) ? 'soloist' : /Continuo/.test(role) ? 'continuo' : c.kind === 'orchestral' || c.kind === 'opera' ? 'section' : 'any';
      const org = c.orgId ? w.organisations.find((o) => o.id === c.orgId) : undefined;
      const admin = org?.admins[0];
      const peers = c.participants.map((p) => p.musicianId).filter((id) => id !== m.id && accepted.has(pairKey(id, m.id)));
      const fromOrganiser = admin && admin !== m.id && !c.participants.some((p) => p.musicianId === admin) && rng.chance(0.35);
      const fromId = fromOrganiser ? admin : peers.length ? rng.pick(peers) : undefined;
      if (!fromId) continue;
      const pool = ENDORSEMENTS.filter((t) => t.from === (fromOrganiser ? 'organiser' : 'peer') && (t.fit === fit || t.fit === 'any') && (t.text.includes('{ensemble}') ? !!org : true));
      const work = rng.pick(c.programme);
      const text = fill(rng.pick(pool).text, {
        first: m.firstName,
        work: `${work.composer}’s ${work.work.replace(/ (BWV|HWV|RV|K\.|Op\.|D\.) ?[\d–/ No.a-z]+.*$/, '')}`,
        venue: c.venue.split(' — ')[0],
        ensemble: org?.name ?? '',
        part: voice ? role : '',
      });
      push(fromId, m.id, c, text);
      made++;
    }
  }
}

// ── Opportunities, applications, messages ────────────────────────────────

const APPLICATION_NOTES = [
  'Free for every date listed and based less than an hour away, so no accommodation needed.',
  'I have played this programme before — most recently last season — and would be glad to do it again. Available for all rehearsals.',
  'Available for all services. I know the main work well; there is a recent live recording on my profile.',
  'I would love to be considered. One question: is the first rehearsal movable by an hour? I have a teaching commitment until 13:30 that day.',
  'Happy to confirm all dates. I can bring my own instrument and travel by train.',
  'This is repertoire I have wanted to return to. I have not performed it in concert since my studies, but it is in the fingers and I would prepare thoroughly.',
  'Free on those dates. I worked with two of your regular players last year; they can tell you how I rehearse.',
  'Interested and available. The fee works for me if travel from my base is covered as stated.',
];

function buildOpportunities(w: World, db: Database, t: DateTools, now: Date): void {
  const rng = w.rng.fork('opps');
  const adminOf = (orgId: string) => w.organisations.find((o) => o.id === orgId)!.admins[0];
  for (const s of opportunitySeeds(t)) {
    const createdAt = s.postedHours != null ? new Date(now.getTime() - s.postedHours * 3600_000).toISOString() : `${addDays(w.anchor, -s.posted)}T${String(8 + (s.posted % 9)).padStart(2, '0')}:15:00.000Z`;
    const o: Opportunity = {
      id: s.id,
      type: s.type,
      title: s.title,
      postedBy: s.org ? adminOf(s.org) : musicianId(s.by!),
      orgId: s.org,
      instruments: s.instruments,
      roleLabel: s.role,
      place: placeByName(s.city, s.venue),
      dates: s.dates.map(([date, kind, time, note]) => ({ date, kind, time, note })),
      fee: s.fee,
      travel: s.travel,
      travelNote: s.travelNote,
      dressCode: s.dress,
      pitch: s.pitch,
      repertoire: rep(s.rep),
      description: s.text,
      // Keep deadlines in the future however close the demo date is.
      deadline: s.deadline && s.deadline < addDays(w.anchor, 4) ? addDays(w.anchor, 4) : s.deadline,
      urgent: !!s.urgent,
      status: 'open',
      createdAt,
    };
    db.opportunities.push(o);
  }

  let seq = 0;
  const apply = (oppId: ID, who: ID, status: ApplicationStatus, origin: Application['origin'], message: string | undefined, hoursAgo: number, inviteMessage?: string) => {
    const at = new Date(now.getTime() - hoursAgo * 3600_000).toISOString();
    db.applications.push({ id: `ap-${++seq}`, opportunityId: oppId, musicianId: who, origin, status, message, inviteMessage, createdAt: at, updatedAt: at });
  };

  // Hand-placed applications that the personas will see.
  const id = musicianId;
  apply('opp-naviglio-gamba', id('Anna Bedeschi'), 'shortlisted', 'applied', 'I played “Es ist vollbracht” with Ensemble Laguna Antica last Lent and with you in the 2023 Passion. Seven-string bass viol after Bertrand, comfortable at 415 in Vallotti. Free for all five dates.', 70);
  apply('opp-naviglio-gamba', id('Hugo Blanchard'), 'applied', 'applied', 'Bonjour — I would be very happy to come from Lyon for this. I have played the St John eleven times, including the 1749 version with the contrabassoon. Travel by train (Lyon–Turin–Bologna, about six hours).', 40);
  apply('opp-naviglio-gamba', id('Pietro Zanarini'), 'applied', 'applied', 'A slightly cheeky application: gamba is my second instrument, but I played this aria in Faenza two years ago and would love to do it with you. If you would rather have a specialist I completely understand — I am also free to play cello in the continuo.', 22);
  apply('opp-naviglio-natale', id('Ginevra Zanotti'), 'offered', 'applied', 'Free for all four services. I know the Corelli and the Manfredini from memory by now.', 150);
  apply('opp-naviglio-natale', id('Beatrice Ruggeri'), 'applied', 'applied', 'Available and very interested. Baroque violin by a Cremonese maker, gut strings, 415. I can share a car from Cremona with a colleague if you also need a viola.', 96);
  apply('opp-naviglio-natale', id('Pieter van Dijk'), 'declined', 'applied', 'I would come from Utrecht if flights are covered; I have a free week then.', 180);
  apply('opp-naviglio-theorbo', id('Tobia Malagoli'), 'applied', 'applied', 'Theorbo in A at 466 and a baroque guitar for the psalms — I played second theorbo in the Vespers in Ravenna in 2022. Free for the whole period.', 60);
  apply('opp-crinale-inverno', id('Irene Capecchi'), 'applied', 'applied', 'I am based in Florence, so a little outside the region, but I have all three pieces in repertoire and played In croce in September. Free for both rehearsals and the concert.', 30);
  apply('opp-crinale-residency', id('Viola Parodi'), 'shortlisted', 'applied', 'Two weeks of chamber music in the mountains is exactly my idea of a good July. I have played the Brahms Quintet and the Trout many times, the Messiaen twice. Free for the whole period.', 50);
  apply('opp-crinale-residency', id('Sara Guidotti'), 'applied', 'applied', 'I played for your winter series two years ago. All four works are in my repertoire; the Shostakovich Trio most recently in May.', 28);
  apply('opp-crinale-residency', id('Inês Carvalho'), 'applied', 'applied', 'Writing from Lisbon — I would travel for this. Strong sight-reader, used to festival rehearsal schedules. Recordings of the Brahms on my profile.', 18);
  apply('opp-t-crinale-masterclass', id('Lukas Brandt'), 'applied', 'applied', 'I taught on a similar course in Brandenburg for four summers and love the Schubert Quintet from the second cello chair. Italian is basic but improving; I teach in English and German.', 44);
  apply('opp-t-crinale-masterclass', id('Massimo Coletti'), 'applied', 'applied', 'Thirty years in an orchestra and fifteen of teaching. Available the whole week.', 20);
  apply('opp-u-cello-giulia', id('Viola Casadei'), 'applied', 'invited', 'I can do it — free all Saturday and I played the “American” in June. I will bring my own stand.', 20, 'Viola, could you cover Pietro on Saturday? Private concert, programme below, €200.');
  apply('opp-u-cello-giulia', id('Enrico Malavasi'), 'invited', 'invited', undefined, 24, 'Enrico, any chance you are free Saturday evening? Quartet programme, Pietro is on tour.');
  apply('opp-u-cello-giulia', id('Giada Pavan'), 'unavailable', 'invited', 'So sorry — I am in Vicenza for a wedding that evening.', 25, 'Giada, are you free on Saturday? Quartet concert in Bologna.');

  // The musician personas' own applications and invitations.
  apply('opp-nordlys-gubaidulina', PERSONA_IDS.nicolo, 'shortlisted', 'applied', 'I performed Sieben Worte in Milan last month with Ensemble Sestante — the live video is on my profile. Free for the whole period; I travel with a bayan in a flight case and need one extra seat or hold luggage.', 190);
  apply('opp-t-chiave-accordion', PERSONA_IDS.nicolo, 'applied', 'applied', 'Imola is forty minutes from me and Tuesdays and Thursdays are free. I teach free-bass and standard bass, and have prepared two students for conservatory admission.', 60);
  apply('opp-reno-shostakovich', PERSONA_IDS.nicolo, 'invited', 'invited', undefined, 30, 'Nicolò, the Suite for Variety Orchestra is back in February and the conductor asked for you by name. Same conditions as last time, two concerts this year. Can we count on you?');
  apply('opp-u-accordion-reno', PERSONA_IDS.nicolo, 'invited', 'invited', undefined, 2.5, 'Nicolò — our soloist is out. You played the Estaciones at the Crinale festival in July: could you step in? Rehearsal tomorrow 14:30.');
  apply('opp-u-accordion-reno', id('Agnese Tibaldi'), 'unavailable', 'invited', 'I am teaching in Trossingen this week, I am sorry.', 2.4, 'Agnese, emergency: are you free to play the Estaciones with us on Thursday?');
  apply('opp-u-accordion-reno', id('Marta Ghidoni'), 'invited', 'invited', undefined, 2.3, 'Marta, we need an accordion soloist for Piazzolla on Thursday — are you free?');
  apply('opp-p-borromea-leader', PERSONA_IDS.giulia, 'applied', 'applied', 'Eleven seasons in the first violins of the Orchestra Filarmonica del Reno and ten as a quartet player. I have led our conductorless chamber programmes since 2022 and would welcome the chance to do a trial week.', 100);
  apply('opp-cerimonie-quartet', PERSONA_IDS.giulia, 'invited', 'invited', undefined, 46, 'Giulia, we are building next season’s roster and several clients in Bologna have asked for you. Would you join as a regular first or second violin? You choose your dates.');
  apply('opp-heures-nisi', PERSONA_IDS.hannah, 'offered', 'applied', 'I sang the Stabat Mater with you at Saint-Roch last year and have the Nisi Dominus in repertoire at 415. Free for all three days; I would come by night train from Vienna.', 120);
  apply('opp-u-mezzo-donaukanal', PERSONA_IDS.hannah, 'invited', 'invited', undefined, 1.5, 'Hannah, our alto has lost her voice. Weihnachtsoratorium I–III on Saturday, rehearsal Thursday evening. Please say you are in Vienna.');
  apply('opp-ghirlandina-requiem', PERSONA_IDS.hannah, 'applied', 'applied', 'I would be glad to come to Modena for this. The Requiem is in my current repertoire and I am happy to sing the choruses from the front as you describe.', 70);

  // Generated applications so that every board looks alive.
  const taken = new Set(db.applications.map((a) => `${a.opportunityId}|${a.musicianId}`));
  for (const o of db.opportunities) {
    if (o.urgent) continue;
    const wanted = rng.int(1, 4) - db.applications.filter((a) => a.opportunityId === o.id).length;
    const pool = w.musicians.filter((m) => {
      if (Object.values(PERSONA_IDS).includes(m.id as never)) return false;
      if (o.instruments.length ? !matchInstrument(m, o.instruments, true) : !m.roles.includes('conductor')) return false;
      const d = distanceKm(o.place, m.base);
      return d <= m.travelRadiusKm || (m.travelsInternationally && o.travel !== 'none');
    });
    for (const m of rng.sample(pool, Math.max(0, wanted))) {
      if (taken.has(`${o.id}|${m.id}`)) continue;
      taken.add(`${o.id}|${m.id}`);
      apply(o.id, m.id, rng.pick<ApplicationStatus>(['applied', 'applied', 'applied', 'shortlisted']), 'applied', rng.pick(APPLICATION_NOTES), rng.int(6, 200));
    }
  }
}

function buildMessages(db: Database, now: Date): void {
  const id = musicianId;
  let tSeq = 0;
  let mSeq = 0;
  /** lines: [who (0 = a, 1 = b), hours ago, text] */
  const thread = (a: ID, b: ID, lines: [0 | 1, number, string][], opportunityId?: ID, unreadFor?: ID) => {
    const tid = `th-${++tSeq}`;
    const msgs: Message[] = lines.map(([who, hoursAgo, body]) => ({
      id: `msg-${++mSeq}`,
      threadId: tid,
      fromId: who === 0 ? a : b,
      body,
      sentAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
      readBy: [a, b],
    }));
    if (unreadFor) {
      const last = msgs[msgs.length - 1];
      last.readBy = last.readBy.filter((x) => x !== unreadFor);
    }
    const t: Thread = { id: tid, participants: [a, b], opportunityId, updatedAt: msgs[msgs.length - 1].sentAt };
    db.threads.push(t);
    db.messages.push(...msgs);
  };
  const P = PERSONA_IDS;

  thread(P.lorenzo, P.nicolo, [
    [0, 30 * 24, 'Nicolò, the recording from July arrived — the Invierno is extraordinary. Can I use ninety seconds of it for the festival’s winter trailer?'],
    [1, 30 * 24 - 3, 'Of course, with pleasure. If you credit the quartet as well, use whatever you like.'],
    [0, 26, 'One more thing: we are closing the winter series in Bologna in March with a programme that has your name on it — Goldberg, In croce, Tango Sensations. The posting goes up this week. Budget is tight, I will be honest.'],
    [1, 20, 'March could work, I need to check one date with Sestante. Send me the details when it is posted and I will answer the same day.'],
  ], undefined, P.lorenzo);

  thread(id('Andrea Brambilla'), P.nicolo, [
    [0, 9 * 24, 'Sestante want to repeat Sieben Worte in Lugano next autumn. Are you in? Same fee as Milan plus the hotel.'],
    [1, 9 * 24 - 2, 'Yes, absolutely. Could we find two days before for the middle movements? I would like to try the fourth word slower.'],
    [0, 8 * 24, 'Slower and quieter. I will ask Irene to book the small studio.'],
    [0, 5, 'Studio is booked for the 3rd and 4th. Also — did you see the Reno are looking for someone for Piazzolla on Thursday? That is you, surely.'],
  ], undefined, P.nicolo);

  thread('acc-paola-mirri', P.nicolo, [
    [1, 58, 'Good morning — I applied for the accordion teaching post. Would it be possible to visit the school and meet the class before the deadline?'],
    [0, 50, 'Good morning Nicolò, thank you for applying. You are very welcome on Thursday from 16:00; two of the pre-conservatory students have their lessons then and would be delighted to play for you.'],
  ], 'opp-t-chiave-accordion');

  thread(P.giulia, id('Caterina Rovatti'), [
    [1, 4 * 24, 'Programme for the foundation dinner: Sunrise, Crisantemi, the American. Forty-five minutes, they want us to start at 19:00 sharp.'],
    [0, 4 * 24 - 1, 'Fine by me. Pietro is on tour with the orchestra that weekend though — did he tell you?'],
    [1, 3 * 24, 'He did not. Can you find us a cellist? You know everyone.'],
    [0, 28, 'Posted it as an urgent call and wrote to Viola, Enrico and Giada directly. Viola has already said yes — I just need to confirm her.'],
    [1, 27, 'You are a saint. Viola is lovely, we played Mendelssohn Octet together in Ravenna.'],
  ]);

  thread(id('Viola Casadei'), P.giulia, [
    [0, 20, 'Hi Giulia! Saw your call — I am free Saturday. Do you have the bowings for the Dvořák or shall I mark my own?'],
    [1, 19, 'Wonderful, thank you. I will send you our parts tonight, everything is marked. Rehearsal at 15:00 at the palazzo, I will send the address.'],
    [0, 18, 'Perfect. See you Saturday.'],
  ], 'opp-u-cello-giulia');

  thread('acc-elisabetta-corsini', P.giulia, [
    [0, 46, 'Dear Giulia, I have sent you an invitation to join our roster for next season. Three couples getting married in Bologna have asked specifically for a quartet with you in it after hearing the Malvasia.'],
  ], 'opp-cerimonie-quartet', P.giulia);

  thread(P.beatrice, id('Costanza Bergonzi'), [
    [0, 6 * 24, 'Costanza, for the St John: are you happy on the chamber organ for the whole piece, or do you want the harpsichord in the arias as well? I need to tell the tuner by Friday.'],
    [1, 6 * 24 - 4, 'Organ throughout, harpsichord only for “Ach, mein Sinn” and “Eilt”. If the tuner can do both at 415 Vallotti on the morning of the dress, I am happy.'],
    [0, 5 * 24, 'Done. And we still need a gamba — the posting has had three applications. Anna is the obvious choice but there is a very good application from Lyon.'],
    [1, 5 * 24 - 2, 'Anna knows how we breathe in that aria. But Hugo Blanchard is excellent, I played with him in Basel. You will not go wrong either way.'],
  ]);

  thread(id('Anna Bedeschi'), P.beatrice, [
    [0, 68, 'Dear Beatrice, I have applied for the Passion. Just to say that I could also bring a violone in G if Dario is not free for the Modena date.'],
    [1, 60, 'Thank you Anna — noted, and very useful. We are deciding this week.'],
    [0, 7, 'One practical question while you decide: is the Thursday rehearsal in the basilica or in the rehearsal room? The basilica is very cold for gut strings in March.'],
  ], 'opp-naviglio-gamba', P.beatrice);

  thread(P.beatrice, P.lorenzo, [
    [1, 12 * 24, 'Beatrice, would the Accademia consider a programme for the festival next July? A Vivaldi evening in the cloister at Riola, eight players, no conductor.'],
    [0, 12 * 24 - 5, 'We would love it. Eight players at 415, harpsichord needed on site. Shall we talk fees on Thursday?'],
    [1, 11 * 24, 'Thursday is good. I will bring the budget; it states the fee per player, as always.'],
  ]);

  thread('acc-veronika-stadler', P.hannah, [
    [0, 21 * 24, 'Dear Hannah, thank you again for the Rückert-Lieder. The orchestra would like to plan Das Lied von der Erde in the chamber version for spring 2028. Would you hold the first week of April?'],
    [1, 21 * 24 - 6, 'Dear Veronika, with great pleasure — pencilled. It was a joy to sing with the Camerata.'],
    [0, 1.4, 'Hannah, emergency: our alto for the Weihnachtsoratorium has lost her voice. I have sent you an urgent call through Leggio. Rehearsal Thursday 18:00, concert Saturday. Can you?'],
  ], 'opp-u-mezzo-donaukanal', P.hannah);

  thread(id('Antoine Mercier'), P.hannah, [
    [0, 5 * 24, 'Chère Hannah, we would like to offer you the Vivaldi programme in February. The offer is on the platform; fee as posted, train and two hotel nights.'],
    [1, 5 * 24 - 3, 'Cher Antoine, wonderful news. Let me check one rehearsal clash in Vienna and I will confirm within the week.'],
  ], 'opp-heures-nisi');

  thread(P.lorenzo, id('Viola Parodi'), [
    [1, 49, 'Dear Lorenzo, I have applied for the residency. If it helps, I can send a recording of the Messiaen from Genoa last spring.'],
    [0, 40, 'Dear Viola, please do. We are shortlisting three pianists and will speak to each of you next week.'],
  ], 'opp-crinale-residency');
}

function buildNotifications(db: Database, at: Date): void {
  const now = at.getTime();
  let seq = 0;
  const note = (accountId: ID, kind: Notification['kind'], hoursAgo: number, extra: Partial<Notification> = {}, read = false) => {
    db.notifications.push({ id: `n-${++seq}`, accountId, kind, createdAt: new Date(now - hoursAgo * 3600_000).toISOString(), read, ...extra });
  };
  const P = PERSONA_IDS;
  const poster = (oppId: ID) => db.opportunities.find((o) => o.id === oppId)!.postedBy;
  note(P.nicolo, 'urgent-call', 2.5, { opportunityId: 'opp-u-accordion-reno', actorId: poster('opp-u-accordion-reno') });
  note(P.nicolo, 'invitation', 30, { opportunityId: 'opp-reno-shostakovich', actorId: poster('opp-reno-shostakovich') });
  note(P.nicolo, 'application-status', 52, { opportunityId: 'opp-nordlys-gubaidulina', actorId: poster('opp-nordlys-gubaidulina'), status: 'shortlisted' });
  note(P.giulia, 'invitation', 46, { opportunityId: 'opp-cerimonie-quartet', actorId: poster('opp-cerimonie-quartet') });
  note(P.giulia, 'invitation-response', 20, { opportunityId: 'opp-u-cello-giulia', actorId: musicianId('Viola Casadei'), status: 'applied' });
  note(P.giulia, 'invitation-response', 25, { opportunityId: 'opp-u-cello-giulia', actorId: musicianId('Giada Pavan'), status: 'unavailable' }, true);
  note(P.hannah, 'urgent-call', 1.5, { opportunityId: 'opp-u-mezzo-donaukanal', actorId: poster('opp-u-mezzo-donaukanal') });
  note(P.hannah, 'application-status', 5 * 24, { opportunityId: 'opp-heures-nisi', actorId: poster('opp-heures-nisi'), status: 'offered' });
  note(P.beatrice, 'application', 22, { opportunityId: 'opp-naviglio-gamba', actorId: musicianId('Pietro Zanarini') });
  note(P.beatrice, 'application', 40, { opportunityId: 'opp-naviglio-gamba', actorId: musicianId('Hugo Blanchard') });
  note(P.beatrice, 'application', 60, { opportunityId: 'opp-naviglio-theorbo', actorId: musicianId('Tobia Malagoli') }, true);
  note(P.lorenzo, 'application', 18, { opportunityId: 'opp-crinale-residency', actorId: musicianId('Inês Carvalho') });
  note(P.lorenzo, 'application', 30, { opportunityId: 'opp-crinale-inverno', actorId: musicianId('Irene Capecchi') });
}

// ── Entry point ──────────────────────────────────────────────────────────

export function buildSeed(anchor: ISODate, now: Date = new Date()): Database {
  const demoDate = nextOccurrence(3, 14, anchor);
  const w = createWorld(anchor);
  const builder = buildConcerts(w, HERO_CONCERTS);
  buildRepertoire(w, builder);
  buildRecordings(w);
  buildBios(w);
  finishPersonas(w);
  buildAccountsForMusicians(w);
  buildAvailability(w, demoDate);

  const db: Database = {
    meta: {
      version: DB_VERSION,
      seededAt: now.toISOString(),
      anchor,
      demoDate,
      personas: [PERSONA_IDS.nicolo, PERSONA_IDS.giulia, PERSONA_IDS.hannah, PERSONA_IDS.beatrice, PERSONA_IDS.lorenzo],
    },
    accounts: w.accounts,
    musicians: w.musicians,
    organisations: w.organisations,
    concerts: w.concerts,
    opportunities: [],
    applications: [],
    connections: [],
    endorsements: [],
    threads: [],
    messages: [],
    notifications: [],
    posts: [],
    shortlists: {},
    scheduled: [],
  };

  const tools: DateTools = {
    day: (n) => addDays(anchor, n),
    on: (wd, n) => {
      const from = addDays(anchor, n);
      return addDays(from, (wd - weekday(from) + 7) % 7);
    },
    demo: demoDate,
    demoPlus: (n) => addDays(demoDate, n),
  };
  buildNetwork(w, db);
  buildEndorsements(w, db);
  buildOpportunities(w, db, tools, now);
  buildMessages(db, now);
  buildNotifications(db, now);
  buildPosts(db, now, anchor);

  // Accounts carry the final headline.
  for (const a of db.accounts) {
    const m = a.musicianId ? db.musicians.find((x) => x.id === a.musicianId) : undefined;
    if (m) a.title = m.headline;
  }
  db.shortlists[PERSONA_IDS.beatrice] = [musicianId('Anna Bedeschi'), musicianId('Costanza Bergonzi'), musicianId('Tobia Malagoli'), musicianId('Ginevra Zanotti')];
  db.shortlists[PERSONA_IDS.lorenzo] = [musicianId('Caterina Rovatti'), musicianId('Viola Parodi')];
  db.shortlists[PERSONA_IDS.giulia] = [musicianId('Viola Casadei'), musicianId('Enrico Malavasi'), musicianId('Sofia Maccaferri')];
  return db;
}

// ── Posts ────────────────────────────────────────────────────────────────

const POST_UPCOMING = [
  'First read-through of {work} this morning. The hall is cold, the room is warm.',
  'Marking bowings for {work} on the train. Three more stops and I will have found the phrasing in bar 40.',
  'Rehearsals for {work} start next week. If you are in town, come and hear it.',
];
const POST_PAST = [
  'Thank you to everyone who came. {work} felt like a conversation, not a performance.',
  'Back home after the concerts. Grateful for colleagues who make {work} sound easy when it is not.',
];
const POST_PLAIN = [
  'Looking for a quiet practice room in the city centre on weekday mornings. Recommendations welcome.',
  'A reminder that a stated fee in the first line saves everyone three emails. Thank you to the organisers who already do it.',
  'New strings, new week. Somehow it always sounds better on a Monday.',
];

/**
 * A few posts per persona, attached to concerts the authors really play in.
 * The first is by someone outside the persona's connections, given a Bravo by
 * one of them, so the feed shows why it is there.
 */
function buildPosts(db: Database, now: Date, anchor: ISODate): void {
  const accepted = db.connections.filter((c) => c.status === 'accepted');
  const friendsOf = (id: ID) => accepted.flatMap((c) => (c.from === id ? [c.to] : c.to === id ? [c.from] : []));
  const isMusician = (id: ID) => db.musicians.some((m) => m.id === id);
  let k = 0;
  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  for (const persona of db.meta.personas) {
    const friends = friendsOf(persona).filter(isMusician);
    const bridge = friends.find((f) => friendsOf(f).some((x) => x !== persona && isMusician(x) && !friends.includes(x)));
    const stranger = bridge ? friendsOf(bridge).find((x) => x !== persona && isMusician(x) && !friends.includes(x)) : undefined;
    const authors = [...(stranger ? [stranger] : []), ...friends.slice(0, 3)];
    for (const [j, author] of authors.entries()) {
      const concert = db.concerts.find((c) => c.participants.some((p) => p.musicianId === author) && c.date >= addDays(anchor, -10) && c.visibility !== 'private');
      const work = concert?.programme[0]?.work;
      const pool = concert && concert.date < anchor ? POST_PAST : POST_UPCOMING;
      const body = concert && work ? pool[k % pool.length].replace('{work}', work) : POST_PLAIN[k % POST_PLAIN.length];
      const fans = friendsOf(author).filter((x) => x !== persona).slice(0, 3 + (k % 9));
      if (author === stranger && bridge && !fans.includes(bridge)) fans.unshift(bridge);
      db.posts.push({
        id: `post-${++k}`,
        authorId: author,
        body,
        concertId: concert?.id,
        bravos: fans,
        comments: j === 1 && fans[0] ? [{ id: `pc-${k}`, authorId: fans[0], body: 'Wish I could be there. In bocca al lupo!', createdAt: hours(1 + j) }] : [],
        createdAt: hours(2 + j * 7 + (k % 5)),
      });
    }
  }
}
