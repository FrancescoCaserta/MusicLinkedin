import type { OrganisationKind } from '../../../domain/types';

/**
 * Invented ensembles and organisations. Names are fictional; any resemblance
 * to a real ensemble is unintended.
 */

export type ProgrammePool =
  | 'symphonic'
  | 'chamber-orchestra'
  | 'baroque'
  | 'contemporary'
  | 'choral'
  | 'opera'
  | 'quartet'
  | 'piano-trio'
  | 'wind'
  | 'brass'
  | 'festival'
  | 'recitals'
  | 'church'
  | 'none';

export interface OrgSeed {
  id: string;
  name: string;
  kind: OrganisationKind;
  city: string;
  founded: number;
  about: string;
  pool: ProgrammePool;
  /** Past concerts to generate. */
  concerts: number;
  /** Admin: an invented organiser (name + job title) … */
  admin?: { name: string; title: string; id?: string };
  /** … or a musician from the roster (by name). */
  adminMusician?: string;
  /** Fixed members by roster name, with their role. */
  members?: [string, string][];
  /** How far members are drawn from, in km, when members are generated. */
  reach?: number;
}

export const ORGANISATIONS: OrgSeed[] = [
  {
    id: 'org-naviglio',
    name: 'Accademia del Naviglio',
    kind: 'baroque-ensemble',
    city: 'Bologna',
    founded: 2009,
    pool: 'baroque',
    concerts: 14,
    reach: 180,
    admin: { id: 'acc-beatrice', name: 'Beatrice Fontana', title: 'General manager, Accademia del Naviglio' },
    about:
      'Period-instrument orchestra founded in Bologna in 2009 and named after the canal that once carried the city’s silk north. The Accademia plays the Italian and German Baroque at A=415, one or two to a part, with a core of continuo players who have worked together for fifteen years. Each season is built around a Passion at Easter, a Christmas programme and a summer residency in the Apennines.',
  },
  {
    id: 'org-reno',
    name: 'Orchestra Filarmonica del Reno',
    kind: 'orchestra',
    city: 'Bologna',
    founded: 1994,
    pool: 'symphonic',
    concerts: 14,
    reach: 130,
    admin: { name: 'Marcello Rinaldi', title: 'Orchestra manager, Orchestra Filarmonica del Reno' },
    about:
      'Symphony orchestra based in Bologna, giving a subscription season of fourteen programmes and touring the theatres of Emilia-Romagna. The orchestra has a permanent core of forty-two players and engages extras for the larger Romantic repertoire. Open rehearsals for schools are part of every production.',
  },
  {
    id: 'org-crinale',
    name: 'Festival Note sul Crinale',
    kind: 'festival',
    city: 'Porretta Terme',
    founded: 2011,
    pool: 'festival',
    concerts: 10,
    reach: 200,
    admin: { id: 'acc-lorenzo', name: 'Lorenzo Amadei', title: 'Artistic director, Festival Note sul Crinale' },
    about:
      'A chamber music festival along the Apennine ridge between Bologna and Pistoia: two weeks every July in village churches, cloisters and one open-air stage, plus a short winter series in Bologna. Musicians live together for the festival and programmes are rehearsed on site, which is why we invite people who are as good to work with as they are to hear.',
  },
  {
    id: 'org-malvasia',
    name: 'Quartetto Malvasia',
    kind: 'chamber-ensemble',
    city: 'Modena',
    founded: 2016,
    pool: 'quartet',
    concerts: 9,
    adminMusician: 'Caterina Rovatti',
    members: [
      ['Caterina Rovatti', 'Violin I'],
      ['Giulia Santoro', 'Violin II'],
      ['Chiara Benassi', 'Viola'],
      ['Pietro Zanarini', 'Cello'],
    ],
    about:
      'String quartet formed in Modena in 2016 by four friends from the conservatory orchestras of Emilia. The quartet plays the classical core repertoire alongside the Italian quartet tradition — Verdi, Puccini, Malipiero — and regularly collaborates with guests for quintets and for programmes with accordion and voice.',
  },
  {
    id: 'org-ghirlandina',
    name: 'Coro da Camera Ghirlandina',
    kind: 'choir',
    city: 'Modena',
    founded: 2003,
    pool: 'choral',
    concerts: 8,
    reach: 150,
    admin: { name: 'Donatella Sighinolfi', title: 'President, Coro da Camera Ghirlandina' },
    about:
      'Chamber choir of twenty-eight voices in Modena. Semi-professional: section leaders and soloists are engaged professionally for each project, and the choir joins local orchestras for the great oratorios twice a year.',
  },
  {
    id: 'org-santegidio',
    name: 'Cappella Musicale di Sant’Egidio',
    kind: 'church',
    city: 'Bologna',
    founded: 1987,
    pool: 'church',
    concerts: 7,
    reach: 80,
    adminMusician: 'Edoardo Gualandi',
    about:
      'The music foundation of a parish church in the centre of Bologna, with a two-manual mechanical organ of 1998 and a sung liturgy every Sunday. The Cappella engages soloists and instrumentalists for feast days and for a Sunday-afternoon cantata series from October to May.',
  },
  {
    id: 'org-sestante',
    name: 'Ensemble Sestante',
    kind: 'contemporary-ensemble',
    city: 'Milano',
    founded: 2012,
    pool: 'contemporary',
    concerts: 10,
    reach: 220,
    admin: { name: 'Irene Castoldi', title: 'Producer, Ensemble Sestante' },
    about:
      'Milan-based ensemble for the music of the last hundred years, from Schoenberg to pieces whose ink is still wet. Sestante commissions three new works every season and has a flexible line-up of six to fourteen players.',
  },
  {
    id: 'org-borromea',
    name: 'Orchestra Borromea',
    kind: 'chamber-orchestra',
    city: 'Milano',
    founded: 2001,
    pool: 'chamber-orchestra',
    concerts: 10,
    reach: 130,
    admin: { name: 'Gianluca Moretti', title: 'Artistic coordinator, Orchestra Borromea' },
    about:
      'Chamber orchestra of strings with added winds, playing without a conductor wherever the music allows. Season in Milan and on the lakes; frequent programmes with soloists from the orchestra.',
  },
  {
    id: 'org-corte',
    name: 'Opera in Corte',
    kind: 'opera-company',
    city: 'Parma',
    founded: 2014,
    pool: 'opera',
    concerts: 7,
    reach: 300,
    admin: { name: 'Raffaella Ghiretti', title: 'Casting and production, Opera in Corte' },
    about:
      'Touring summer opera company performing in the courtyards of Emilian castles and palaces, with a reduced orchestra of eighteen. Two productions each summer — one Mozart or Rossini, one from the Italian nineteenth century — cast largely with singers in the first ten years of their careers.',
  },
  {
    id: 'org-granducato',
    name: 'Compagnia Lirica del Granducato',
    kind: 'opera-company',
    city: 'Firenze',
    founded: 2007,
    pool: 'opera',
    concerts: 7,
    reach: 350,
    admin: { name: 'Ottavia Baldacci', title: 'Artistic administrator, Compagnia Lirica del Granducato' },
    about:
      'Independent opera company in Florence producing three titles a year in historic theatres across Tuscany, and running a young-artist programme for singers and répétiteurs.',
  },
  {
    id: 'org-laguna',
    name: 'Ensemble Laguna Antica',
    kind: 'baroque-ensemble',
    city: 'Venezia',
    founded: 2005,
    pool: 'baroque',
    concerts: 9,
    reach: 200,
    adminMusician: 'Alvise Marangon',
    about:
      'Venetian period-instrument ensemble devoted to the music written for the city’s churches and ospedali: Monteverdi, Cavalli, Legrenzi, Vivaldi. Directed from the harpsichord.',
  },
  {
    id: 'org-tiberina',
    name: 'Orchestra Sinfonica Tiberina',
    kind: 'orchestra',
    city: 'Roma',
    founded: 1998,
    pool: 'symphonic',
    concerts: 9,
    reach: 150,
    admin: { name: 'Fabrizio Conti', title: 'Personnel manager, Orchestra Sinfonica Tiberina' },
    about:
      'Roman symphony orchestra with a season of symphonic and choral-symphonic programmes, film-with-live-orchestra evenings, and a summer series in the archaeological sites of Lazio.',
  },
  {
    id: 'org-posillipo',
    name: 'Ensemble Posillipo Barocco',
    kind: 'baroque-ensemble',
    city: 'Napoli',
    founded: 2010,
    pool: 'baroque',
    concerts: 7,
    reach: 250,
    adminMusician: 'Raffaele Sorrentino',
    about:
      'Period-instrument ensemble exploring the Neapolitan school — Pergolesi, Leo, Durante, the Scarlattis — much of it from manuscripts in the city’s conservatory library.',
  },
  {
    id: 'org-subalpina',
    name: 'Orchestra Subalpina',
    kind: 'chamber-orchestra',
    city: 'Torino',
    founded: 1996,
    pool: 'chamber-orchestra',
    concerts: 8,
    reach: 150,
    admin: { name: 'Enrica Vallauri', title: 'Orchestra manager, Orchestra Subalpina' },
    about:
      'Chamber orchestra of Turin and the Piedmontese valleys, with a season that pairs the classical repertoire with twentieth-century Italian music for strings.',
  },
  {
    id: 'org-ginestra',
    name: 'Trio Ginestra',
    kind: 'chamber-ensemble',
    city: 'Firenze',
    founded: 2018,
    pool: 'piano-trio',
    concerts: 7,
    adminMusician: 'Duccio Martelli',
    members: [
      ['Duccio Martelli', 'Violin'],
      ['Matilde Cioni', 'Cello'],
      ['Lorenzo Bianchini', 'Piano'],
    ],
    about:
      'Piano trio based in Florence. Complete Beethoven and Brahms trio cycles alongside the French repertoire; in residence each autumn in the Val d’Orcia.',
  },
  {
    id: 'org-donaukanal',
    name: 'Camerata Donaukanal',
    kind: 'chamber-orchestra',
    city: 'Wien',
    founded: 2008,
    pool: 'chamber-orchestra',
    concerts: 8,
    reach: 300,
    admin: { name: 'Veronika Stadler', title: 'Managing director, Camerata Donaukanal' },
    about:
      'Viennese chamber orchestra of freelance players, giving its own series in the Konzerthaus and accompanying the city’s choirs in the oratorio repertoire.',
  },
  {
    id: 'org-pleisse',
    name: 'Pleißenburg Consort',
    kind: 'baroque-ensemble',
    city: 'Leipzig',
    founded: 2006,
    pool: 'baroque',
    concerts: 8,
    reach: 350,
    adminMusician: 'Jonas Albrecht',
    about:
      'Leipzig period-instrument ensemble centred on Bach’s cantatas and oratorios, performed with solo voices and single strings in the city’s churches.',
  },
  {
    id: 'org-glockenbach',
    name: 'Ensemble Glockenbach',
    kind: 'contemporary-ensemble',
    city: 'München',
    founded: 2014,
    pool: 'contemporary',
    concerts: 7,
    reach: 400,
    admin: { name: 'Sebastian Kranz', title: 'Dramaturg and manager, Ensemble Glockenbach' },
    about:
      'Munich collective for new music and music theatre, working closely with living composers and running a two-year academy for young players.',
  },
  {
    id: 'org-heures',
    name: 'Les Heures Claires',
    kind: 'baroque-ensemble',
    city: 'Paris',
    founded: 2002,
    pool: 'baroque',
    concerts: 8,
    reach: 500,
    adminMusician: 'Antoine Mercier',
    about:
      'Paris ensemble on period instruments, at home in the French Baroque — Charpentier, Couperin, Rameau — and in the cantatas of Bach and Handel.',
  },
  {
    id: 'org-fenwick',
    name: 'The Fenwick Consort',
    kind: 'choir',
    city: 'London',
    founded: 1999,
    pool: 'choral',
    concerts: 7,
    reach: 600,
    admin: { name: 'Harriet Loxley', title: 'Administrator, The Fenwick Consort' },
    about:
      'Vocal consort of eight to sixteen singers specialising in Renaissance polyphony and its echoes in contemporary choral music. Tours in the UK and on the continent.',
  },
  {
    id: 'org-amstel',
    name: 'Het Amstel Barok',
    kind: 'baroque-ensemble',
    city: 'Amsterdam',
    founded: 2004,
    pool: 'baroque',
    concerts: 7,
    reach: 300,
    adminMusician: 'Pieter van Dijk',
    about:
      'Amsterdam baroque orchestra led from the first violin, known for Telemann and for its long-running lunchtime series in the Waalse Kerk.',
  },
  {
    id: 'org-lindenhof',
    name: 'Kammerorchester Lindenhof',
    kind: 'chamber-orchestra',
    city: 'Zürich',
    founded: 1991,
    pool: 'chamber-orchestra',
    concerts: 7,
    reach: 300,
    admin: { name: 'Regula Hürlimann', title: 'Geschäftsführerin, Kammerorchester Lindenhof' },
    about:
      'Zürich chamber orchestra with a subscription series, a baroque cycle on period bows and an education programme in the canton’s schools.',
  },
  {
    id: 'org-chiave',
    name: 'Scuola di Musica Chiave di Volta',
    kind: 'music-school',
    city: 'Imola',
    founded: 1988,
    pool: 'none',
    concerts: 0,
    reach: 60,
    admin: { name: 'Paola Mirri', title: 'Director, Scuola di Musica Chiave di Volta' },
    about:
      'Music school in Imola with 420 students from age six to adult amateurs, pre-conservatory courses and a youth orchestra. Teachers are working musicians, engaged on annual contracts by the hour.',
  },
  {
    id: 'org-cerimonie',
    name: 'Cerimonie in Musica',
    kind: 'events',
    city: 'Firenze',
    founded: 2015,
    pool: 'none',
    concerts: 0,
    reach: 150,
    admin: { name: 'Elisabetta Corsini', title: 'Founder, Cerimonie in Musica' },
    about:
      'Classical musicians for weddings, ceremonies and private events in Tuscany and Emilia: string quartets, harp, organ and voice. We book conservatory-trained professionals only, pay within fifteen days and always state the fee in advance.',
  },
  {
    id: 'org-delta',
    name: 'Ottoni del Delta',
    kind: 'chamber-ensemble',
    city: 'Ferrara',
    founded: 2013,
    pool: 'brass',
    concerts: 6,
    adminMusician: 'Vittorio Calzolari',
    members: [
      ['Vittorio Calzolari', 'Trumpet I'],
      ['Valerio De Angelis', 'Trumpet II'],
      ['Jacopo Sarti', 'Horn'],
      ['Leonardo Bonfiglioli', 'Trombone'],
      ['Salvatore Mancuso', 'Tuba'],
    ],
    about:
      'Brass quintet from the Po delta: Gabrieli to Arnold, ceremonial music, and an annual Christmas tour of churches between Ferrara and Ravenna.',
  },
  {
    id: 'org-libeccio',
    name: 'Quintetto Libeccio',
    kind: 'chamber-ensemble',
    city: 'Genova',
    founded: 2017,
    pool: 'wind',
    concerts: 6,
    adminMusician: 'Tommaso Repetto',
    members: [
      ['Arianna Ferrero', 'Flute'],
      ['Tommaso Repetto', 'Oboe'],
      ['Elisa Pedrazzi', 'Clarinet'],
      ['Ilaria Giordano', 'Horn'],
      ['Gabriele Tassinari', 'Bassoon'],
    ],
    about:
      'Wind quintet named after the south-westerly that blows over the Ligurian coast. Core quintet repertoire, plus sextets with piano and outdoor serenades in summer.',
  },
  {
    id: 'org-malatestiana',
    name: 'Società dei Concerti Malatestiana',
    kind: 'concert-society',
    city: 'Rimini',
    founded: 1952,
    pool: 'recitals',
    concerts: 9,
    reach: 300,
    admin: { name: 'Corrado Semprini', title: 'Artistic secretary, Società dei Concerti Malatestiana' },
    about:
      'One of Romagna’s historic concert societies: a season of sixteen chamber concerts and recitals, and a Sunday-morning series for young artists in their first five professional years.',
  },
  {
    id: 'org-tramuntana',
    name: 'Ensemble Tramuntana',
    kind: 'chamber-orchestra',
    city: 'Barcelona',
    founded: 2011,
    pool: 'chamber-orchestra',
    concerts: 5,
    reach: 600,
    admin: { name: 'Núria Casals', title: 'Manager, Ensemble Tramuntana' },
    about:
      'String orchestra from Barcelona with a taste for Iberian and Latin American repertoire, often with guitar and accordion soloists.',
  },
  {
    id: 'org-vltava',
    name: 'Vltava Chamber Players',
    kind: 'chamber-ensemble',
    city: 'Praha',
    founded: 2009,
    pool: 'festival',
    concerts: 5,
    reach: 600,
    admin: { name: 'Markéta Vondrová', title: 'Producer, Vltava Chamber Players' },
    about:
      'Flexible chamber group of strings, winds and piano in Prague, playing Dvořák, Janáček and Martinů alongside the central European classics.',
  },
  {
    id: 'org-nordlys',
    name: 'Nordlys Sinfonietta',
    kind: 'chamber-orchestra',
    city: 'København',
    founded: 2010,
    pool: 'chamber-orchestra',
    concerts: 5,
    reach: 700,
    admin: { name: 'Mette Dalgaard', title: 'Artistic planner, Nordlys Sinfonietta' },
    about:
      'Copenhagen sinfonietta of sixteen players moving between the classical repertoire and Nordic and Baltic music of today.',
  },
];
