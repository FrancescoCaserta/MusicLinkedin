import type { Musician } from '../src/domain/types';
import { placeByName } from '../src/domain/cities';

/** A minimal musician for engine tests; override what the test is about. */
export function musician(over: Partial<Musician> & { id: string; city?: string }): Musician {
  const { city = 'Bologna', ...rest } = over;
  const name = rest.name ?? rest.id;
  return {
    slug: rest.id,
    firstName: name.split(' ')[0],
    lastName: name.split(' ').slice(1).join(' ') || name,
    name,
    headline: '',
    bio: '',
    instruments: [{ instrumentId: 'violin', level: 'primary' }],
    roles: ['orchestral'],
    base: placeByName(city),
    travelRadiusKm: 100,
    travelsInternationally: false,
    fee: { min: 150, max: 250 },
    languages: ['Italian'],
    pitches: [440],
    practical: { ownTransport: true, canInvoice: true, urgentCalls: true },
    training: [],
    masterclasses: [],
    positions: [],
    repertoire: [],
    recordings: [],
    awards: [],
    availability: {},
    activeSince: 2015,
    tint: 0,
    joinedAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...rest,
  };
}
