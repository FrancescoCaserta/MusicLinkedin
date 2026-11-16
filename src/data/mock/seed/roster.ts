/**
 * The hand-written roster of fictional musicians. Every person here is
 * invented; names were chosen to be plausible for where they are based.
 * The generator (index.ts) builds full careers around these rows.
 */

export type Archetype =
  | 'orch' // orchestral player
  | 'free' // all-round freelancer
  | 'solo' // soloist / recitalist
  | 'chamber'
  | 'early' // period-instrument specialist
  | 'contemp' // contemporary-music specialist
  | 'opera' // opera singer
  | 'concert' // concert, oratorio and lied singer
  | 'church' // church musician
  | 'collab' // collaborative pianist / répétiteur
  | 'teach'
  | 'cond'
  | 'comp';

export interface RosterRow {
  /** "First Last" */
  n: string;
  /** Instruments: "primary,other:level,…" — level is secondary | doubling | period. */
  i: string;
  /** Base city (gazetteer name). */
  c: string;
  a: Archetype;
  /** Year of birth — drives career length. */
  b: number;
  /** Indicative fee range per engagement, euros. */
  f: [number, number];
  /** Travel radius in km, when not the archetype default. */
  r?: number;
  intl?: boolean;
  /** false = does not take last-minute calls. */
  urgent?: boolean;
  langs?: string[];
  /** Voice description for singers. */
  v?: string;
}

const r = (
  n: string,
  i: string,
  c: string,
  a: Archetype,
  b: number,
  f: [number, number],
  extra: Partial<RosterRow> = {},
): RosterRow => ({ n, i, c, a, b, f, ...extra });

export const ROSTER: RosterRow[] = [
  // ── Emilia-Romagna ────────────────────────────────────────────────────
  r('Nicolò Baldini', 'accordion', 'Modena', 'contemp', 1993, [180, 280], { r: 150, intl: true, langs: ['Italian', 'English', 'German'] }),
  r('Giulia Santoro', 'violin,viola:secondary', 'Bologna', 'orch', 1990, [150, 260], { r: 100, langs: ['Italian', 'English', 'French'] }),
  r('Agnese Tibaldi', 'accordion', 'Bologna', 'solo', 1984, [300, 450], { r: 300, intl: true }),
  r('Ruggero Fabbri', 'accordion,piano:secondary', 'Imola', 'free', 1996, [130, 220], { r: 120 }),
  r('Marta Ghidoni', 'accordion', 'Ferrara', 'chamber', 1998, [150, 250], { r: 150 }),
  r('Samuele Orlandi', 'accordion,organ:secondary', 'Reggio Emilia', 'teach', 1979, [160, 260], { r: 80 }),
  r('Pietro Zanarini', 'cello,baroque-cello:period', 'Bologna', 'chamber', 1987, [200, 350], { r: 250, intl: true }),
  r('Costanza Bergonzi', 'harpsichord,organ:secondary,fortepiano:period', 'Bologna', 'early', 1985, [220, 380], { r: 300, intl: true, langs: ['Italian', 'English', 'French', 'German'] }),
  r('Tobia Malagoli', 'theorbo,lute:secondary,baroque-guitar:secondary', 'Modena', 'early', 1989, [200, 340], { r: 300, intl: true }),
  r('Livia Montanari', 'soprano', 'Bologna', 'concert', 1991, [250, 500], { r: 300, v: 'Light lyric soprano — early music and oratorio' }),
  r('Edoardo Gualandi', 'organ,harpsichord:secondary', 'Bologna', 'church', 1975, [120, 250], { r: 60 }),
  r('Chiara Benassi', 'viola', 'Parma', 'orch', 1988, [150, 250], { r: 120 }),
  r('Federico Rambaldi', 'oboe,cor-anglais:doubling', 'Bologna', 'orch', 1983, [170, 280], { r: 120 }),
  r('Alessia Mingardi', 'flute,piccolo:doubling', 'Ferrara', 'orch', 1994, [140, 240], { r: 150 }),
  r('Jacopo Sarti', 'horn,natural-horn:period', 'Ravenna', 'orch', 1986, [160, 260], { r: 150 }),
  r('Margherita Lolli', 'harp', 'Bologna', 'free', 1992, [200, 350], { r: 200 }),
  r('Dario Venturoli', 'double-bass,violone:period', 'Imola', 'free', 1981, [150, 260], { r: 150 }),
  r('Ginevra Zanotti', 'baroque-violin,violin:secondary', 'Bologna', 'early', 1990, [200, 340], { r: 300, intl: true }),
  r('Michele Ansaloni', 'tenor', 'Modena', 'concert', 1988, [300, 650], { r: 400, intl: true, v: 'Tenor — Evangelist, Monteverdi, Mozart' }),
  r('Giacomo Bertozzi', 'bass', 'Mantova', 'concert', 1980, [300, 600], { r: 350, v: 'Bass — Bach, Handel, Monteverdi' }),
  r('Sara Guidotti', 'piano,harpsichord:secondary', 'Bologna', 'collab', 1986, [160, 300], { r: 150 }),
  r('Riccardo Bassoli', 'percussion,timpani:secondary', 'Reggio Emilia', 'free', 1991, [150, 260], { r: 180 }),
  r('Elisa Pedrazzi', 'clarinet,bass-clarinet:doubling', 'Parma', 'orch', 1995, [140, 240], { r: 150 }),
  r('Vittorio Calzolari', 'trumpet,natural-trumpet:period', 'Bologna', 'free', 1980, [170, 300], { r: 250 }),
  r('Anna Bedeschi', 'viola-da-gamba,baroque-cello:secondary', 'Faenza', 'early', 1992, [200, 340], { r: 300, intl: true }),
  r('Stefano Mazzanti', 'baritone', 'Cesena', 'concert', 1984, [300, 600], { r: 300, v: 'Lyric baritone — oratorio and lied' }),
  r('Caterina Rovatti', 'violin', 'Modena', 'chamber', 1989, [180, 320], { r: 250, intl: true }),
  r('Gabriele Tassinari', 'bassoon,contrabassoon:doubling', 'Forlì', 'orch', 1982, [150, 250], { r: 150 }),
  r('Lucia Stanzani', 'mezzo-soprano', 'Ferrara', 'concert', 1987, [280, 550], { r: 300, v: 'Lyric mezzo — Bach, Handel, Rossini' }),
  r('Giovanni Lodi', 'piano', 'Bologna', 'cond', 1978, [400, 900], { r: 400, intl: true }),
  r('Emma Cavazza', 'violin', 'Rimini', 'free', 1999, [110, 200], { r: 120 }),
  r('Leonardo Bonfiglioli', 'trombone,sackbut:period', 'Piacenza', 'free', 1990, [150, 260], { r: 200 }),
  r('Viola Casadei', 'cello', 'Ravenna', 'free', 1997, [120, 210], { r: 150 }),
  r('Enrico Malavasi', 'cello', 'Reggio Emilia', 'orch', 1985, [160, 270], { r: 120 }),
  r('Sofia Maccaferri', 'violin', 'Bologna', 'free', 1997, [120, 220], { r: 150 }),
  r('Leonardo Grandi', 'viola,violin:secondary', 'Bologna', 'free', 1993, [140, 240], { r: 150 }),
  r('Noemi Galeotti', 'soprano', 'Parma', 'opera', 1993, [300, 800], { r: 400, v: 'Lyric soprano — Verdi and Puccini' }),
  // ── Lombardy, Piedmont, Liguria ───────────────────────────────────────
  r('Francesca Colombo', 'violin', 'Milano', 'orch', 1985, [180, 300], { r: 100 }),
  r('Andrea Brambilla', 'cello', 'Milano', 'contemp', 1988, [220, 380], { r: 300, intl: true }),
  r('Martina Galli', 'soprano', 'Milano', 'opera', 1990, [400, 1200], { r: 500, intl: true, v: 'Lyric coloratura soprano' }),
  r('Luca Ferrario', 'trombone,sackbut:period', 'Milano', 'orch', 1982, [180, 300], { r: 150 }),
  r('Davide Pirovano', 'percussion', 'Bergamo', 'contemp', 1992, [200, 350], { r: 250, intl: true }),
  r('Silvia Cattaneo', 'piano', 'Milano', 'solo', 1986, [400, 900], { r: 500, intl: true }),
  r('Paolo Ravasio', 'guitar', 'Brescia', 'solo', 1983, [250, 500], { r: 300, intl: true }),
  r('Beatrice Ruggeri', 'violin,baroque-violin:period', 'Cremona', 'chamber', 1991, [180, 320], { r: 250 }),
  r('Jacopo Verdirame', 'piano', 'Milano', 'comp', 1987, [250, 600], { r: 300, intl: true }),
  r('Marco Tedeschi', 'double-bass', 'Torino', 'orch', 1979, [170, 280], { r: 120 }),
  r('Arianna Ferrero', 'flute,traverso:period', 'Torino', 'chamber', 1993, [160, 280], { r: 200 }),
  r('Simone Gallo', 'bass', 'Torino', 'opera', 1981, [400, 1100], { r: 500, intl: true, v: 'Basso cantante' }),
  r('Viola Parodi', 'piano,fortepiano:period', 'Genova', 'chamber', 1989, [220, 400], { r: 250 }),
  r('Tommaso Repetto', 'oboe,baroque-oboe:period', 'Genova', 'free', 1994, [150, 260], { r: 200 }),
  r('Ilaria Giordano', 'horn', 'Novara', 'orch', 1996, [140, 230], { r: 150 }),
  // ── Veneto, Trentino-Alto Adige, Friuli ───────────────────────────────
  r('Veronica Zanella', 'soprano', 'Venezia', 'concert', 1989, [300, 600], { r: 300, intl: true, v: 'Soprano — Monteverdi, Vivaldi, Handel' }),
  r('Alvise Marangon', 'harpsichord,organ:secondary', 'Venezia', 'early', 1980, [250, 420], { r: 300, intl: true }),
  r('Tommaso Bressan', 'recorder,traverso:secondary', 'Padova', 'early', 1991, [180, 320], { r: 300, intl: true }),
  r('Giada Pavan', 'cello,baroque-cello:period', 'Vicenza', 'free', 1995, [150, 260], { r: 200 }),
  r('Mattia Zorzi', 'bassoon,baroque-bassoon:period', 'Verona', 'early', 1987, [180, 300], { r: 300 }),
  r('Nicola Dal Bosco', 'horn,natural-horn:period', 'Trento', 'orch', 1984, [170, 280], { r: 200 }),
  r('Katharina Oberhofer', 'violin', 'Bolzano', 'orch', 1992, [170, 280], { r: 200, langs: ['German', 'Italian', 'English'] }),
  r('Emanuele Fabris', 'clarinet', 'Udine', 'chamber', 1990, [160, 280], { r: 250 }),
  r('Daniele Brighenti', 'tenor', 'Verona', 'opera', 1989, [350, 900], { r: 500, intl: true, v: 'Lyric tenor — Donizetti, Verdi, Puccini' }),
  r('Elena Rizzardi', 'contralto', 'Verona', 'concert', 1983, [300, 600], { r: 300, v: 'Contralto — Baroque oratorio' }),
  // ── Tuscany, Umbria, Marche ───────────────────────────────────────────
  r('Lorenzo Bianchini', 'piano', 'Firenze', 'solo', 1982, [450, 1000], { r: 500, intl: true }),
  r('Bianca Nardi', 'viola', 'Firenze', 'chamber', 1991, [180, 300], { r: 250 }),
  r('Niccolò Ciampi', 'countertenor', 'Firenze', 'concert', 1990, [350, 700], { r: 400, intl: true, v: 'Countertenor (alto)' }),
  r('Greta Lucchesi', 'harp', 'Lucca', 'free', 1994, [180, 320], { r: 200 }),
  r('Irene Capecchi', 'accordion', 'Firenze', 'contemp', 1995, [200, 320], { r: 250, intl: true }),
  r('Duccio Martelli', 'violin', 'Firenze', 'chamber', 1988, [200, 340], { r: 250 }),
  r('Matilde Cioni', 'cello', 'Siena', 'chamber', 1993, [180, 300], { r: 250 }),
  r('Filippo Mancini', 'tenor', 'Pesaro', 'opera', 1992, [350, 900], { r: 500, intl: true, v: 'Tenore di grazia — Rossini' }),
  r('Loris Cingolani', 'accordion', 'Castelfidardo', 'solo', 1988, [250, 400], { r: 400, intl: true }),
  r('Aurora Santini', 'oboe', 'Perugia', 'free', 1996, [140, 240], { r: 200 }),
  r('Cesare Bartolucci', 'organ', 'Ancona', 'church', 1972, [130, 260], { r: 100 }),
  // ── Rome and the South ────────────────────────────────────────────────
  r('Valerio De Angelis', 'trumpet', 'Roma', 'orch', 1985, [180, 300], { r: 150 }),
  r('Flavia Proietti', 'soprano', 'Roma', 'opera', 1987, [400, 1100], { r: 500, intl: true, v: 'Lirico spinto soprano' }),
  r('Massimo Coletti', 'cello', 'Roma', 'orch', 1978, [180, 300], { r: 150 }),
  r('Ludovica Marini', 'violin', 'Roma', 'solo', 1991, [350, 800], { r: 500, intl: true }),
  r('Claudio Ricci', 'piano', 'Roma', 'cond', 1974, [500, 1200], { r: 600, intl: true }),
  r('Giorgia Fabiani', 'viola', 'Roma', 'orch', 1994, [150, 250], { r: 150 }),
  r('Gennaro Esposito', 'mandolin,guitar:secondary', 'Napoli', 'solo', 1984, [220, 400], { r: 400, intl: true }),
  r('Carmela Russo', 'mezzo-soprano', 'Napoli', 'opera', 1986, [350, 900], { r: 500, v: 'Mezzo-soprano — Rossini and Mozart' }),
  r('Antonio Carbone', 'baritone', 'Salerno', 'opera', 1983, [350, 900], { r: 500, v: 'Verdi baritone' }),
  r('Raffaele Sorrentino', 'double-bass,violone:period', 'Napoli', 'early', 1986, [170, 290], { r: 300 }),
  r('Domenico Lorusso', 'saxophone', 'Bari', 'contemp', 1990, [180, 320], { r: 300, intl: true }),
  r('Rosa Palmisano', 'flute', 'Lecce', 'free', 1997, [120, 220], { r: 200 }),
  r('Salvatore Mancuso', 'tuba', 'Palermo', 'orch', 1981, [170, 280], { r: 200 }),
  r('Agata Messina', 'harp', 'Catania', 'orch', 1989, [180, 300], { r: 250 }),
  r('Efisio Melis', 'guitar', 'Cagliari', 'teach', 1977, [150, 280], { r: 150 }),
  // ── Austria, Switzerland ──────────────────────────────────────────────
  r('Hannah Lindner', 'mezzo-soprano', 'Wien', 'concert', 1989, [400, 900], { r: 500, intl: true, langs: ['German', 'English', 'Italian', 'French'], v: 'Lyric mezzo-soprano — Bach, Mahler, Mozart' }),
  r('Maximilian Gruber', 'horn', 'Wien', 'orch', 1986, [220, 380], { r: 150 }),
  r('Theresa Aigner', 'violin', 'Salzburg', 'chamber', 1993, [220, 380], { r: 300, intl: true }),
  r('Jakob Steinlechner', 'accordion', 'Graz', 'contemp', 1991, [250, 420], { r: 300, intl: true }),
  r('Nora Baumann', 'violin,baroque-violin:period', 'Zürich', 'orch', 1988, [300, 500], { r: 200 }),
  r('Matthias Egli', 'cornetto,recorder:secondary', 'Basel', 'early', 1985, [350, 550], { r: 600, intl: true }),
  r('Leonardo Bernasconi', 'piano', 'Lugano', 'cond', 1980, [500, 1100], { r: 400, intl: true, langs: ['Italian', 'German', 'English', 'French'] }),
  r('Sophie Krenn', 'soprano', 'Wien', 'opera', 1994, [400, 1000], { r: 500, intl: true, v: 'Soubrette / light lyric soprano' }),
  // ── Germany ───────────────────────────────────────────────────────────
  r('Lukas Brandt', 'cello', 'Berlin', 'chamber', 1987, [280, 480], { r: 400, intl: true }),
  r('Johanna Weiss', 'soprano', 'Leipzig', 'concert', 1990, [350, 700], { r: 400, intl: true, v: 'Soprano — Bach and the German Baroque' }),
  r('Felix Hartmann', 'organ,harpsichord:secondary', 'Dresden', 'church', 1983, [200, 380], { r: 200 }),
  r('Clara Neumann', 'clarinet,bass-clarinet:doubling', 'München', 'contemp', 1992, [250, 420], { r: 300, intl: true }),
  r('Moritz Schäfer', 'timpani,percussion:secondary', 'Frankfurt', 'orch', 1984, [240, 400], { r: 250 }),
  r('Annika Vogel', 'viola', 'Hamburg', 'orch', 1991, [230, 380], { r: 200 }),
  r('Jonas Albrecht', 'natural-trumpet,trumpet:secondary', 'Leipzig', 'early', 1986, [280, 450], { r: 500, intl: true }),
  r('Konrad Meissner', 'tenor', 'Dresden', 'concert', 1987, [350, 700], { r: 400, intl: true, v: 'Tenor — Evangelist and Lied' }),
  r('Friedrich Auer', 'bass-baritone', 'München', 'concert', 1982, [350, 700], { r: 400, intl: true, v: 'Bass-baritone — oratorio and Lied' }),
  r('Henrike Sommer', 'accordion', 'Trossingen', 'teach', 1982, [250, 420], { r: 250, intl: true }),
  // ── France, Benelux ───────────────────────────────────────────────────
  r('Camille Lefèvre', 'traverso,flute:secondary', 'Paris', 'early', 1988, [300, 480], { r: 500, intl: true }),
  r('Antoine Mercier', 'harpsichord,organ:secondary', 'Paris', 'early', 1981, [320, 520], { r: 500, intl: true }),
  r('Élise Garnier', 'soprano', 'Lyon', 'opera', 1991, [400, 1000], { r: 500, intl: true, v: 'Lyric soprano — French repertoire and Mozart' }),
  r('Julien Morel', 'bassoon', 'Strasbourg', 'orch', 1985, [230, 380], { r: 200 }),
  r('Mathilde Roux', 'harp', 'Paris', 'solo', 1990, [350, 700], { r: 500, intl: true }),
  r('Hugo Blanchard', 'viola-da-gamba', 'Lyon', 'early', 1993, [280, 450], { r: 500, intl: true }),
  r('Sanne de Vries', 'recorder', 'Amsterdam', 'early', 1990, [280, 450], { r: 400, intl: true }),
  r('Pieter van Dijk', 'baroque-violin,baroque-viola:secondary', 'Utrecht', 'early', 1984, [300, 480], { r: 400, intl: true }),
  r('Lotte Janssens', 'baroque-oboe,oboe:secondary,recorder:secondary', 'Gent', 'early', 1989, [280, 450], { r: 400, intl: true }),
  // ── UK, Ireland ───────────────────────────────────────────────────────
  r('Eleanor Whitfield', 'oboe,cor-anglais:doubling', 'London', 'free', 1988, [220, 360], { r: 150 }),
  r('James Ashworth', 'tenor', 'London', 'concert', 1985, [350, 700], { r: 400, intl: true, v: 'Tenor — Evangelist, English song' }),
  r('Oliver Pemberton', 'trumpet', 'Manchester', 'orch', 1990, [200, 340], { r: 200 }),
  r('Imogen Clarke', 'violin', 'London', 'chamber', 1992, [230, 400], { r: 300, intl: true }),
  r('Rhys Morgan', 'bass-baritone', 'Cardiff', 'concert', 1983, [350, 700], { r: 400, intl: true, v: 'Bass-baritone — oratorio and Mozart' }),
  r('Fiona MacLeod', 'viola', 'Edinburgh', 'chamber', 1989, [220, 360], { r: 300 }),
  // ── Iberia ────────────────────────────────────────────────────────────
  r('Pablo Navarro', 'guitar', 'Madrid', 'solo', 1986, [350, 800], { r: 500, intl: true }),
  r('Marta Vidal', 'cello', 'Barcelona', 'free', 1994, [200, 340], { r: 250 }),
  r('Inês Carvalho', 'piano', 'Lisboa', 'collab', 1988, [220, 400], { r: 300, intl: true }),
  // ── Nordics, Central and South-East Europe ────────────────────────────
  r('Astrid Holm', 'soprano', 'København', 'concert', 1990, [400, 800], { r: 400, intl: true, v: 'Lyric soprano — lied and Nordic song' }),
  r('Erik Lundgren', 'trombone', 'Stockholm', 'orch', 1984, [260, 420], { r: 200 }),
  r('Aino Virtanen', 'accordion', 'Helsinki', 'contemp', 1990, [350, 600], { r: 400, intl: true }),
  r('Zofia Kowalczyk', 'violin', 'Kraków', 'solo', 1993, [250, 600], { r: 500, intl: true }),
  r('Tomasz Nowicki', 'double-bass', 'Warszawa', 'orch', 1982, [180, 300], { r: 200 }),
  r('Petra Novotná', 'horn', 'Praha', 'orch', 1991, [180, 300], { r: 250 }),
  r('Bence Szabó', 'violin,viola:secondary', 'Budapest', 'chamber', 1987, [200, 360], { r: 300, intl: true }),
  r('Luka Kovač', 'accordion', 'Ljubljana', 'solo', 1994, [220, 400], { r: 400, intl: true }),
];
