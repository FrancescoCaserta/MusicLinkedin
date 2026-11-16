import type { Place } from './types';
import { normalise } from './taxonomy';

/**
 * A small built-in gazetteer: dense in Italy (down to towns that matter for
 * a radius search around Bologna), major musical centres elsewhere in Europe.
 * A real product would call a geocoder; the interface (`findCity`,
 * `searchCities`) would stay the same.
 */

export interface City {
  id: string;
  /** Local name, used for display. */
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** English or other names people type. */
  aliases: string[];
  /** Rough size rank for ordering suggestions (3 = major). */
  rank: 1 | 2 | 3;
}

type Row = [string, string, number, number, (1 | 2 | 3)?, string[]?];

const rows: Row[] = [
  // Emilia-Romagna
  ['Bologna', 'IT', 44.4949, 11.3426, 3],
  ['Modena', 'IT', 44.6471, 10.9252, 2],
  ['Reggio Emilia', 'IT', 44.6989, 10.6297, 2, ["reggio nell'emilia"]],
  ['Parma', 'IT', 44.8015, 10.3279, 2],
  ['Piacenza', 'IT', 45.0526, 9.693, 2],
  ['Ferrara', 'IT', 44.8381, 11.6198, 2],
  ['Ravenna', 'IT', 44.4184, 12.2035, 2],
  ['Imola', 'IT', 44.3531, 11.7148, 1],
  ['Faenza', 'IT', 44.2857, 11.8833, 1],
  ['Forlì', 'IT', 44.2227, 12.0407, 2],
  ['Cesena', 'IT', 44.1391, 12.2431, 1],
  ['Rimini', 'IT', 44.0678, 12.5695, 2],
  ['Carpi', 'IT', 44.7837, 10.8853, 1],
  ['Porretta Terme', 'IT', 44.1554, 10.9747, 1, ['porretta']],
  ['Fidenza', 'IT', 44.8663, 10.0613, 1],
  // Tuscany
  ['Firenze', 'IT', 43.7696, 11.2558, 3, ['florence']],
  ['Prato', 'IT', 43.8777, 11.1022, 1],
  ['Pistoia', 'IT', 43.9303, 10.9079, 1],
  ['Lucca', 'IT', 43.8429, 10.5027, 2],
  ['Pisa', 'IT', 43.7228, 10.4017, 2],
  ['Livorno', 'IT', 43.5485, 10.3106, 2, ['leghorn']],
  ['Siena', 'IT', 43.3188, 11.3308, 2],
  ['Arezzo', 'IT', 43.4633, 11.8796, 1],
  ['Fiesole', 'IT', 43.8065, 11.2936, 1],
  // Veneto, Trentino-Alto Adige, Friuli
  ['Venezia', 'IT', 45.4408, 12.3155, 3, ['venice']],
  ['Padova', 'IT', 45.4064, 11.8768, 2, ['padua']],
  ['Verona', 'IT', 45.4384, 10.9916, 2],
  ['Vicenza', 'IT', 45.5455, 11.5354, 2],
  ['Treviso', 'IT', 45.6669, 12.243, 1],
  ['Rovigo', 'IT', 45.0698, 11.7902, 1],
  ['Trento', 'IT', 46.0748, 11.1217, 2],
  ['Bolzano', 'IT', 46.4983, 11.3548, 2, ['bozen']],
  ['Trieste', 'IT', 45.6495, 13.7768, 2],
  ['Udine', 'IT', 46.0711, 13.2346, 2],
  // Lombardy, Piedmont, Liguria
  ['Milano', 'IT', 45.4642, 9.19, 3, ['milan']],
  ['Bergamo', 'IT', 45.6983, 9.6773, 2],
  ['Brescia', 'IT', 45.5416, 10.2118, 2],
  ['Cremona', 'IT', 45.1332, 10.0227, 2],
  ['Mantova', 'IT', 45.1564, 10.7914, 2, ['mantua']],
  ['Pavia', 'IT', 45.1847, 9.1582, 1],
  ['Como', 'IT', 45.8081, 9.0852, 1],
  ['Monza', 'IT', 45.5845, 9.2744, 1],
  ['Torino', 'IT', 45.0703, 7.6869, 3, ['turin']],
  ['Novara', 'IT', 45.4469, 8.622, 1],
  ['Alessandria', 'IT', 44.9133, 8.615, 1],
  ['Cuneo', 'IT', 44.3845, 7.5427, 1],
  ['Genova', 'IT', 44.4056, 8.9463, 3, ['genoa']],
  // Centre
  ['Ancona', 'IT', 43.6158, 13.5189, 2],
  ['Pesaro', 'IT', 43.9125, 12.9155, 2],
  ['Castelfidardo', 'IT', 43.4631, 13.5466, 1],
  ['Macerata', 'IT', 43.2984, 13.4535, 1],
  ['Fermo', 'IT', 43.1605, 13.7181, 1],
  ['Perugia', 'IT', 43.1107, 12.3908, 2],
  ['Spoleto', 'IT', 42.7341, 12.7378, 1],
  ['Roma', 'IT', 41.9028, 12.4964, 3, ['rome']],
  ['Viterbo', 'IT', 42.4207, 12.1077, 1],
  ['Latina', 'IT', 41.4676, 12.9036, 1],
  ["L'Aquila", 'IT', 42.3498, 13.3995, 1, ['aquila']],
  ['Pescara', 'IT', 42.4618, 14.2161, 2],
  // South and islands
  ['Napoli', 'IT', 40.8518, 14.2681, 3, ['naples']],
  ['Salerno', 'IT', 40.6824, 14.7681, 2],
  ['Ravello', 'IT', 40.6492, 14.6117, 1],
  ['Bari', 'IT', 41.1171, 16.8719, 2],
  ['Lecce', 'IT', 40.3515, 18.175, 2],
  ['Martina Franca', 'IT', 40.7023, 17.3384, 1],
  ['Matera', 'IT', 40.6664, 16.6043, 1],
  ['Cosenza', 'IT', 39.2983, 16.2537, 1],
  ['Reggio Calabria', 'IT', 38.1113, 15.6474, 1],
  ['Palermo', 'IT', 38.1157, 13.3615, 3],
  ['Catania', 'IT', 37.5079, 15.083, 2],
  ['Messina', 'IT', 38.1938, 15.554, 1],
  ['Cagliari', 'IT', 39.2238, 9.1217, 2],
  ['Sassari', 'IT', 40.7259, 8.5557, 1],
  // Austria, Switzerland
  ['Wien', 'AT', 48.2082, 16.3738, 3, ['vienna']],
  ['Salzburg', 'AT', 47.8095, 13.055, 2],
  ['Graz', 'AT', 47.0707, 15.4395, 2],
  ['Innsbruck', 'AT', 47.2692, 11.4041, 2],
  ['Linz', 'AT', 48.3069, 14.2858, 2],
  ['Zürich', 'CH', 47.3769, 8.5417, 3, ['zurich', 'zurigo']],
  ['Basel', 'CH', 47.5596, 7.5886, 2, ['basle', 'basilea']],
  ['Bern', 'CH', 46.948, 7.4474, 2, ['berne', 'berna']],
  ['Genève', 'CH', 46.2044, 6.1432, 2, ['geneva', 'ginevra']],
  ['Lugano', 'CH', 46.0037, 8.9511, 2],
  ['Luzern', 'CH', 47.0502, 8.3093, 2, ['lucerne', 'lucerna']],
  // Germany
  ['München', 'DE', 48.1351, 11.582, 3, ['munich', 'monaco di baviera']],
  ['Berlin', 'DE', 52.52, 13.405, 3, ['berlino']],
  ['Leipzig', 'DE', 51.3397, 12.3731, 2, ['lipsia']],
  ['Dresden', 'DE', 51.0504, 13.7373, 2, ['dresda']],
  ['Hamburg', 'DE', 53.5511, 9.9937, 3, ['amburgo']],
  ['Köln', 'DE', 50.9375, 6.9603, 3, ['cologne', 'colonia', 'koeln']],
  ['Frankfurt', 'DE', 50.1109, 8.6821, 3, ['frankfurt am main', 'francoforte']],
  ['Stuttgart', 'DE', 48.7758, 9.1829, 2, ['stoccarda']],
  ['Freiburg', 'DE', 47.999, 7.8421, 2, ['freiburg im breisgau', 'friburgo']],
  ['Trossingen', 'DE', 48.0756, 8.6367, 1],
  ['Nürnberg', 'DE', 49.4521, 11.0767, 2, ['nuremberg', 'norimberga']],
  ['Bremen', 'DE', 53.0793, 8.8017, 2, ['brema']],
  // France, Benelux
  ['Paris', 'FR', 48.8566, 2.3522, 3, ['parigi']],
  ['Lyon', 'FR', 45.764, 4.8357, 3, ['lione', 'lyons']],
  ['Strasbourg', 'FR', 48.5734, 7.7521, 2, ['strasburgo', 'strassburg']],
  ['Marseille', 'FR', 43.2965, 5.3698, 2, ['marsiglia', 'marseilles']],
  ['Nice', 'FR', 43.7102, 7.262, 2, ['nizza']],
  ['Toulouse', 'FR', 43.6047, 1.4442, 2, ['tolosa']],
  ['Bordeaux', 'FR', 44.8378, -0.5792, 2],
  ['Amsterdam', 'NL', 52.3676, 4.9041, 3],
  ['Den Haag', 'NL', 52.0705, 4.3007, 2, ['the hague', "l'aia"]],
  ['Utrecht', 'NL', 52.0907, 5.1214, 2],
  ['Rotterdam', 'NL', 51.9244, 4.4777, 2],
  ['Bruxelles', 'BE', 50.8503, 4.3517, 3, ['brussels', 'brussel']],
  ['Antwerpen', 'BE', 51.2194, 4.4025, 2, ['antwerp', 'anversa']],
  ['Gent', 'BE', 51.0543, 3.7174, 2, ['ghent', 'gand']],
  ['Luxembourg', 'LU', 49.6116, 6.1319, 2, ['lussemburgo']],
  // UK, Ireland
  ['London', 'GB', 51.5074, -0.1278, 3, ['londra']],
  ['Manchester', 'GB', 53.4808, -2.2426, 2],
  ['Birmingham', 'GB', 52.4862, -1.8904, 2],
  ['Edinburgh', 'GB', 55.9533, -3.1883, 2, ['edimburgo']],
  ['Glasgow', 'GB', 55.8642, -4.2518, 2],
  ['Cardiff', 'GB', 51.4816, -3.1791, 2],
  ['Oxford', 'GB', 51.752, -1.2577, 1],
  ['Dublin', 'IE', 53.3498, -6.2603, 2, ['dublino']],
  // Iberia
  ['Madrid', 'ES', 40.4168, -3.7038, 3],
  ['Barcelona', 'ES', 41.3874, 2.1686, 3, ['barcellona']],
  ['València', 'ES', 39.4699, -0.3763, 2, ['valencia']],
  ['Sevilla', 'ES', 37.3891, -5.9845, 2, ['seville', 'siviglia']],
  ['Bilbao', 'ES', 43.263, -2.935, 2],
  ['Lisboa', 'PT', 38.7223, -9.1393, 3, ['lisbon', 'lisbona']],
  ['Porto', 'PT', 41.1579, -8.6291, 2, ['oporto']],
  // Nordics, Baltics
  ['København', 'DK', 55.6761, 12.5683, 3, ['copenhagen', 'copenaghen']],
  ['Stockholm', 'SE', 59.3293, 18.0686, 3, ['stoccolma']],
  ['Göteborg', 'SE', 57.7089, 11.9746, 2, ['gothenburg']],
  ['Oslo', 'NO', 59.9139, 10.7522, 3],
  ['Bergen', 'NO', 60.3913, 5.3221, 2],
  ['Helsinki', 'FI', 60.1699, 24.9384, 3],
  ['Tallinn', 'EE', 59.437, 24.7536, 2],
  ['Riga', 'LV', 56.9496, 24.1052, 2],
  ['Vilnius', 'LT', 54.6872, 25.2797, 2],
  // Central and south-east Europe
  ['Warszawa', 'PL', 52.2297, 21.0122, 3, ['warsaw', 'varsavia']],
  ['Kraków', 'PL', 50.0647, 19.945, 2, ['cracow', 'krakow', 'cracovia']],
  ['Praha', 'CZ', 50.0755, 14.4378, 3, ['prague', 'praga']],
  ['Brno', 'CZ', 49.1951, 16.6068, 2],
  ['Budapest', 'HU', 47.4979, 19.0402, 3],
  ['Bratislava', 'SK', 48.1486, 17.1077, 2],
  ['Ljubljana', 'SI', 46.0569, 14.5058, 2, ['lubiana']],
  ['Zagreb', 'HR', 45.815, 15.9819, 2, ['zagabria']],
  ['Athens', 'GR', 37.9838, 23.7275, 3, ['athina', 'atene']],
];

const slug = (s: string) => normalise(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const CITIES: City[] = rows.map(([name, country, lat, lng, rank = 1, aliases = []]) => ({
  id: slug(name),
  name,
  country,
  lat,
  lng,
  rank,
  aliases,
}));

const index = new Map<string, City>();
for (const c of CITIES) {
  index.set(normalise(c.name), c);
  index.set(c.id, c);
  for (const a of c.aliases) index.set(normalise(a), c);
}

/** All searchable names, longest first (for the query parser). */
export const CITY_TERMS: { term: string; city: City }[] = [...index.entries()]
  .filter(([k]) => k.includes(' ') || !k.includes('-'))
  .map(([term, city]) => ({ term, city }))
  .sort((a, b) => b.term.length - a.term.length);

export function findCity(name: string): City | undefined {
  return index.get(normalise(name)) ?? index.get(slug(name));
}

export function cityById(id: string): City | undefined {
  return index.get(id);
}

export function searchCities(text: string, limit = 8): City[] {
  const q = normalise(text);
  if (!q) return CITIES.filter((c) => c.rank === 3).slice(0, limit);
  const scored: { c: City; s: number }[] = [];
  for (const c of CITIES) {
    const names = [normalise(c.name), ...c.aliases.map(normalise)];
    let s = 0;
    for (const n of names) {
      if (n === q) s = Math.max(s, 100);
      else if (n.startsWith(q)) s = Math.max(s, 60);
      else if (n.includes(` ${q}`)) s = Math.max(s, 30);
    }
    if (s) scored.push({ c, s: s + c.rank });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

export function placeOf(city: City, venue?: string): Place {
  return { name: city.name, country: city.country, lat: city.lat, lng: city.lng, cityId: city.id, venue };
}

export function placeByName(name: string, venue?: string): Place {
  const c = findCity(name);
  if (!c) throw new Error(`Unknown city: ${name}`);
  return placeOf(c, venue);
}

export const COUNTRY_NAMES: Record<string, string> = {
  IT: 'Italy',
  AT: 'Austria',
  CH: 'Switzerland',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  BE: 'Belgium',
  LU: 'Luxembourg',
  GB: 'United Kingdom',
  IE: 'Ireland',
  ES: 'Spain',
  PT: 'Portugal',
  DK: 'Denmark',
  SE: 'Sweden',
  NO: 'Norway',
  FI: 'Finland',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  PL: 'Poland',
  CZ: 'Czechia',
  HU: 'Hungary',
  SK: 'Slovakia',
  SI: 'Slovenia',
  HR: 'Croatia',
  GR: 'Greece',
};
