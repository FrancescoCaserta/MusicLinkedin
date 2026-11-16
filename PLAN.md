# Leggio — product and architecture plan

*Leggio* (Italian for "music stand") is a working prototype of a professional
network for classical musicians. This plan was written before the build;
`DECISIONS.md` records what was actually decided along the way.

## 1. Product

### Who it is for

| Side | Who | What they need |
| --- | --- | --- |
| Hirers | ensembles, orchestras, festivals, churches, private-event organisers, musicians needing a substitute | the right player, near enough, free on the date, within budget, who already knows the piece |
| Musicians | freelance and employed classical musicians | a profile that fits a classical career, and paid work with the fee stated up front |

### Principles

1. **Search is the product.** One sentence — "accordionist within 50 km of
   Bologna, free on 14 March, budget €250" — becomes structured filters, a
   ranked shortlist with reasons, and a map. When nothing matches, the product
   says what would (wider radius, higher budget, another date).
2. **Repertoire is data.** "Has already played this piece" is what gets
   musicians hired, so repertoire is structured, searchable, and cross-checked
   against every opportunity's programme.
3. **Every opportunity states the fee.** A posting cannot be created without
   one.
4. **Trust comes from concerts.** Endorsements can only be written by someone
   who shares a concert with you, and they cite that concert.
5. **Substitutions are urgent.** A last-minute call is a two-step flow that
   reaches free, nearby, willing players in under a minute.
6. **Classical only.** Vocabulary, taxonomy and look belong to the classical
   world: voice types, period instruments, pitch standards, continuo,
   programmes, dress codes.

### Surface

- **Landing page** (logged out): live search preview on the real demo data,
  a real profile excerpt, the principles, and entry points into the personas.
- **Find musicians**: natural-language bar + filters (instrument/voice, place
  and radius, date, budget, repertoire, role, period instruments, urgent-ready,
  network), ranked list with "why this match", map, near-miss suggestions,
  shortlist, invite, message.
- **Musician profile**: instruments and doublings, voice type, roles,
  repertoire table, concert history, recordings, training and masterclasses,
  awards, positions, availability calendar, base and travel radius, fee range,
  practicalities (pitch, languages, invoicing, transport), concert-linked
  endorsements, printable one-sheet. Full editor.
- **Opportunities**: engagement, urgent substitution, audition, permanent
  position, teaching. Browse with filters, detail page with fee, dates,
  repertoire (ticked against your own), travel, dress code; apply; calendar
  clash warnings.
- **Hiring**: post an opportunity, urgent-substitute flow, review applicants,
  suggested musicians, invite, shortlist → offer → confirm.
- **Network**: connections, requests, "played together" suggestions,
  endorsements tied to shared concerts.
- **Ensembles and organisations**: page with members, concerts, open
  opportunities; editable by its admins.
- **Messages**: one-to-one threads.
- **Home**: a light feed — things needing action, upcoming concerts in the
  network, new opportunities, network activity.
- **Calendar**: the musician's availability, edited by tapping days.

### Demo personas

A freelance accordionist, an orchestral violinist, a mezzo-soprano, an
ensemble manager and a festival director. Switching persona is the "login".

## 2. Architecture

```
src/
  domain/      pure TypeScript, no React, no storage
    types.ts         entities
    taxonomy.ts      instruments, voice types, roles (ids, labels, aliases)
    cities.ts geo.ts gazetteer + haversine
    dates.ts money.ts
    search/          query model, natural-language parser, matching, ranking,
                     near-miss relaxations, opportunity matching
  data/
    api.ts           DataApi — the only contract the UI knows
    client.ts        exports the active implementation (swap point)
    mock/            in-browser implementation: localStorage store,
                     deterministic seed generator, simulated responses
    hooks.ts         TanStack Query hooks over DataApi
  i18n/              source-string dictionary + Intl formatters
  app/               shell, routing, session (persona), toasts
  ui/                design-system primitives
  features/          landing, search, profile, opportunities, hiring,
                     network, organisations, messages, home, calendar
  styles/            tokens + layered CSS
tests/               Vitest unit tests (search, parser, geo, mock API flows)
e2e/                 Playwright journeys
```

- **Stack**: Vite, React 19, TypeScript (strict), React Router, TanStack
  Query, Leaflet with open tiles (no key), hand-written CSS on design tokens,
  self-hosted variable fonts.
- **Data access**: the UI calls `DataApi` only, always asynchronously, and
  handles loading and failure. The mock adds a little latency, persists to
  `localStorage`, and can be swapped for an HTTP client in one file.
- **Search** runs behind `api.searchMusicians(query)`; the engine is a pure
  function so it is unit-tested and could move server-side unchanged.
- **Seed**: deterministic generator (seeded PRNG) anchored to today's date:
  100+ fictional musicians from a hand-written roster, ~30 ensembles and
  organisations, shared concerts (which make "played together" verifiable),
  hand-written opportunities, applications, messages and endorsements.
- **i18n**: English source strings passed through `t()`, dates/money through
  `Intl`; adding a language means adding one dictionary.

## 3. Stages

1. Scaffold, design tokens, plan.
2. Domain model, taxonomy, gazetteer, search engine + tests.
3. Seed generator and mock API + tests.
4. App shell, personas, landing page.
5. Search experience (list, map, shortlist, invite).
6. Profiles, editor, calendar.
7. Opportunities, urgent substitution, applications, hiring.
8. Messages, network and endorsements, organisations, home feed.
9. Browser walkthrough at desktop and phone widths, fixes, e2e tests, docs.
