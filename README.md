# Leggio

A working prototype of a professional network built only for classical
musicians. *Leggio* is Italian for "music stand".

- **Hirers** ask for who they need in one sentence — "accordionist within
  50 km of Bologna, free on 14 March, budget €250" — and get a ranked
  shortlist with reasons, a map, and suggestions for what would match if one
  condition moved.
- **Musicians** get a profile shaped like a classical career (instruments and
  doublings, voice type, searchable repertoire, concert history, calendar,
  fee range) and a board of opportunities that always state the fee.

**Live demo:** <https://francescocaserta.github.io/MusicLinkedin/> (deployed from `main` by `.github/workflows/deploy.yml`).

Everything runs in the browser. There is no backend, no account and no API
key; all people and ensembles are fictional.

## Run it

Requires Node.js 20 or newer (developed on Node 24).

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The first visit generates the demo data and
stores it in the browser's `localStorage`.

| Command | What it does |
| --- | --- |
| `npm run dev` | development server on port 5173 |
| `npm run build` then `npm run preview` | production build, served on port 4173 |
| `npm test` | unit tests (search, parser, geography, seed data, mock API) |
| `npm run test:e2e` | browser journeys at desktop and phone widths (first run `npx playwright install chromium`) |
| `npm run typecheck` | TypeScript, strict |

The map uses OpenStreetMap tiles and needs an internet connection; without
one, pins and the radius still render on a plain background.

## Demo personas

There is no login. You step in as one of five prepared people, from the
landing page, from `/demo`, or at any time from the menu in the top right.

| Persona | Who | Good for seeing |
| --- | --- | --- |
| **Nicolò Baldini** | freelance accordionist, Modena | an urgent call waiting, an invitation, applications in progress, a full profile |
| **Giulia Santoro** | orchestral violinist and quartet player, Bologna | a musician who also hires: her own urgent call for a cellist |
| **Hannah Lindner** | mezzo-soprano, Vienna | a singer's profile (voice type, roles, oratorio parts), an offer to confirm |
| **Beatrice Fontana** | manager of a period-instrument orchestra | postings with applicants to review, the ensemble's page |
| **Lorenzo Amadei** | festival director | the headline search, posting, inviting |

The same menu has **Reset demo data** and **Simulate a network failure**
(to see the error states). Open two browser windows with two personas to
watch both sides of a conversation; they share the same data.

## A five-minute walkthrough

1. **Landing page** (`/`). The search box types the headline query and shows
   real results from the demo data, with the map and "near misses". Change the
   sentence, or click one of the examples. Scroll for the profile excerpt, the
   principles and a sample of postings.
2. Click **I need a musician**. You are now Lorenzo, on the same search.
   Each result says why it matches: distance, free on the date, fee against
   budget, shared concerts. Click **2 more within 100 km** to widen it, then
   the browser's back button.
3. Click **Invite** on Nicolò Baldini, choose the "Crinale d'Inverno"
   posting, add a line and send.
4. Menu → **Nicolò Baldini**. A red **urgent call** bar is across the top:
   an orchestra's soloist is ill. Open it to see the fee, dates, repertoire
   ticked against his own, and the calendar check. On **Home** the invitation
   from Lorenzo is waiting: click **I'm interested**.
5. Menu → **Lorenzo Amadei** → *My postings* → the posting → **Make an
   offer**. Switch back to Nicolò and **Confirm**: the dates are blocked in
   his calendar, and he no longer appears in searches for that day.
6. Menu → **Giulia Santoro** → **Find a substitute**. Choose *Cello*, give a
   fee, **Choose who to call**, then **Call**. Answers from (simulated)
   colleagues arrive within about twenty seconds; **Confirm** one and the
   call is filled.
7. As any musician: **My profile** → *Edit profile* (try the Repertoire tab),
   and **My calendar**. Reload the page — the changes are still there.
8. **Network**: accept a request, and write an endorsement — you can only
   choose among concerts you actually shared with that person.

## How it is built

```
src/
  domain/     pure TypeScript: entities, taxonomy, gazetteer, repertoire
              catalogue, and the search engine (parser, matching, ranking)
  data/       api.ts is the contract the UI talks to; mock/ implements it
              in the browser (seed generator, localStorage, simulated replies)
  i18n/       English source strings + Intl formatting; see locales/
  app/        shell, session (persona), toasts
  ui/         shared components (pickers, map, calendar, states)
  features/   one folder per area of the product
  styles/     design tokens and CSS
tests/        Vitest unit tests
e2e/          Playwright journeys
```

To connect a real backend, implement `DataApi` (`src/data/api.ts`) and
return it from `src/data/client.ts`. Nothing in `features/` imports the mock.

See [PLAN.md](PLAN.md) for the plan written before building and
[DECISIONS.md](DECISIONS.md) for the choices made, what is mocked, and what
should come next.
