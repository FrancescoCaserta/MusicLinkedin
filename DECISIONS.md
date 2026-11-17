# Decisions

Choices made while building the prototype, with the reasoning. Where the
brief was open, I picked the option that seemed most sensible and recorded
it here.

## Name and identity

**Leggio** — Italian for "music stand" (pronounced *LED-jo*; English
speakers reach it through *arpeggio*).

- It is the object every classical musician sits behind, and orchestral
  seating is counted in stands ("third stand of the violas", *primo
  leggio*). The product does two things with stands: a hirer fills one, a
  musician is offered one. Hence the landing line *Every stand filled.
  Every fee stated.*
- It is six letters, has no meaning to avoid in English, and is not one of
  the worn musical brand words (Maestro, Forte, Crescendo, Harmony, Cadenza).
- Considered and dropped: *Tutti* (already used by several marketplaces),
  *Accordo* ("chord" and "agreement" — nice, but reads as a car), *Spalla*
  (too obscure outside Italy), *Organico* (reads as "organic").
- **Not done:** a trademark or domain search. That is the first thing to do
  before using the name in public.

**Mark:** a music stand in three strokes (tilted desk, stem, foot) with one
red line for the top edge of the page. **Wordmark:** Bodoni Moda — the
letter of Italian libretti and score title pages. **Interface type:** Hanken
Grotesk. **Palette:** warm paper, black ink, one deep red (oxblood), plus a
vermilion reserved for urgent calls and a muted green for "free". Section
labels are small spaced capitals, as on a concert programme. No clefs or
notes anywhere; the only musical ornament is a five-line rule used once.

Fonts are bundled through npm (no font service is contacted).

## Product

- **Search is one sentence plus filters.** A rule-based parser (no AI
  service) reads instrument, place and radius, date, budget, repertoire, role
  and a few flags, in English and with Italian instrument and month names.
  What it understood is shown as chips before you press Enter. The filters
  remain the source of truth and the whole search lives in the URL, so a
  search can be shared or bookmarked.
- **Results explain themselves.** Distance, availability on the date, fee
  against budget, the matching repertoire entry and its state, shared
  concerts and endorsements are shown on each card; ranking uses the same
  signals.
- **Near misses.** When fewer than six people match, the engine reports what
  one change would add ("2 more within 100 km", "1 more from €300", "1 is
  busy that day"). An empty result is the worst outcome of a hiring search,
  so it should never be a dead end.
- **Budget is compared with the lower end** of a musician's indicative fee
  range, and the card says "within" or "well within" budget.
- **Repertoire has three states**: performance-ready, performed before, in
  preparation. Opportunities tick their programme against the viewer's
  repertoire, and applicants are shown to the hirer with "has played 2 of 3".
- **Concerts are shared records.** One concert has many participants. This
  is what makes "played together" verifiable, drives ensemble pages, and
  gates endorsements.
- **Endorsements require a shared concert** (on stage together, or the
  endorser administers the organisation that presented it) and display that
  concert. One endorsement per pair. There are no skill badges.
- **No fee, no posting.** The form refuses to publish without a fee, and so
  does the data layer.
- **Urgent substitution is its own flow**: a one-screen form with a live
  count of who is free, then a pre-selected call list, then answers arriving
  on the same page. Confirming one musician fills the call, tells the others,
  and blocks the date in the confirmed player's calendar. Musicians see a
  call as a bar across every page with *I can do it / I can't*.
- **Normal engagements go applied → shortlisted → offered → confirmed**, with
  the musician confirming the offer. Urgent calls skip the offer step because
  the musician has already said yes.
- **Musicians can hire too** (a violinist looking for a cellist), so posting
  and searching are available to every account.

### Added beyond the brief

- Natural-language search and near-miss suggestions (above).
- Calendar clash warnings on opportunities, and automatic blocking of dates
  on confirmation.
- Classical practicalities on the profile: pitch standards (A=415/430/440…),
  instrument details (free-bass system, transposing continuo organ),
  rehearsal languages, own transport, whether the musician can invoice,
  shortest notice for urgent calls.
- A saved shortlist ("who I would call again") with invite-all.
- A print stylesheet: the profile prints as a compact one-sheet.
- Organiser endorsements ("we booked them"), which are the most useful kind
  to another hirer.

### Simplified or left out

- **No photos.** Avatars are monograms. Invented faces for invented people
  would be misleading; a real product needs headshots.
- **Recordings have no media.** Seeded recordings play a short synthesised
  placeholder and say so; recordings a user adds are links that open.
- **The home feed is deliberately short** (things waiting for you, work that
  fits, six items of network activity).
- **Messaging is one-to-one**, text only.
- **No Italian interface yet** (see below), no dark mode, no notification
  settings, no account creation.
- **Ensemble pages**: admins can edit the description and members. Adding a
  concert on behalf of an ensemble is not in the UI (musicians can add their
  own concerts).

## Technical

- **Stack:** Vite, React 19, TypeScript (strict), React Router, TanStack
  Query, Leaflet, hand-written CSS on design tokens. No UI kit: the look is
  the product's own.
- **Data access:** the UI only knows `DataApi` (`src/data/api.ts`): every
  call is asynchronous, can fail, and returns copies. `src/data/client.ts`
  chooses the implementation. The mock adds 90–260 ms of latency so loading
  states are real.
- **Search runs behind the API** (`searchMusicians(query)`), implemented by a
  pure engine in `src/domain/search` that a server could reuse unchanged.
- **Distance** is great-circle (haversine) between a built-in gazetteer of
  about 150 European cities, dense in northern Italy.
- **Map:** OpenStreetMap's public tiles, toned down with a CSS filter.
  (CARTO's lighter tiles now require a key.) OSM's tile servers are fine for
  a demo but not for production traffic.
- **Persistence:** one JSON document (about 1.9 MB) in `localStorage`,
  rewritten after each change; if storage is unavailable the session
  continues in memory. Tabs stay in sync through the `storage` event.
- **i18n:** English source strings are the message ids (`t('Find
  musicians')`), with `plural()` and `Intl` for dates, numbers and money.
  A translation is one dictionary; `src/i18n/locales/it.sample.ts` and a test
  show the mechanism. I did not ship a language switch because a partly
  translated interface would break the "no half-working features" rule.
- **After any change, all queries are refetched.** Simple and correct at
  this size; a real backend would invalidate selectively.
- **One JS bundle of ~280 kB gzipped.** Route-level code splitting was not
  worth it for a demo.

## Seed data

Deterministic for a given day (seeded generator), anchored to the day the
demo is first opened so dates always look current.

- **132 musicians** from a hand-written roster (name, instruments, city,
  kind of career, age, fee range) across about 40 instruments and voice
  types and 17 countries, weighted towards Emilia-Romagna so the Bologna
  searches are rich.
- **30 organisations** (orchestras, period ensembles, choirs, opera
  companies, a festival, a church, a concert society, a music school, a
  wedding agency), about **490 concerts**, **44 hand-written opportunities**,
  about 1,000 connections and 180 endorsements.
- Careers are generated so they hang together: repertoire comes from the
  concerts on the profile plus what that kind of player carries; an
  accordionist is not credited with a string quartet; opera tenors are not
  cast as Bach Evangelists; orchestras do not book the same soloist twice.
- The five personas, their concerts, endorsements, messages and applications
  are written by hand.
- **Real:** composers, works, cities, conservatories, most venues.
  **Invented:** every person, ensemble, organisation, teacher and
  competition. Any resemblance to a real ensemble's name is unintended, and
  I could not check each invented name against the real world.

## What is mocked

| Area | In the prototype |
| --- | --- |
| Backend, database | in-browser implementation of `DataApi`, `localStorage` |
| Authentication | choosing a persona; no passwords, no permissions beyond "is this your posting / your page" |
| Other people's actions | when you invite or call musicians who are not personas, their answers are simulated after a short delay (accept, decline, or silence); offers to them are usually confirmed. Messages to them get no reply |
| Email, push | none; notifications exist only in the app |
| Payments, contracts | none |
| Geocoding | built-in city list; free-text addresses are not located |
| Media | no uploads; see recordings above |

## Verification

- 90 unit tests: parser, search filters and ranking, near misses, repertoire
  matching, opportunity fit, geography, seed integrity, and the mock API's
  workflows (apply, invite, offer, confirm, urgent fill, messages,
  endorsement rules, persistence).
- 12 browser journeys run at desktop (1360 px) and phone (Pixel 7) widths —
  24 runs, all passing — each failing on any console error and checking that
  no page scrolls sideways.
- I also looked at screenshots of every main page at both widths and fixed
  what I found, including two real bugs the journeys exposed: an instrument
  picked inside a labelled field could be un-picked by the same click, and a
  failed session request left pages on "Loading…".

Known limits: tested in Chromium only; the calendar's shift-click range
selection has no touch equivalent (tap days one by one); keyboard support is
solid in forms, menus and pickers but has not had a full screen-reader pass.

## What I would build next

1. **Real accounts and a backend** behind `DataApi`: Postgres with PostGIS
   for distance, full-text search for repertoire, proper authorisation.
2. **Onboarding that fills the profile fast**: import repertoire and concert
   history from a CV or programme PDFs; ensembles adding a concert once for
   everyone who played.
3. **Calendar sync** (iCal/Google) so availability maintains itself — the
   search is only as good as the calendars.
4. **Notifications off-platform** for urgent calls (push, SMS, WhatsApp),
   since that is where substitutions happen today.
5. **Italian, German and French** interfaces.
6. **Trust and safety**: verification of organisations, reporting, and
   moderation of endorsements.
7. **Contracts and payment** with the paperwork each country needs (in Italy,
   the social-security filing a hirer must make per performance).
8. **Headshots and hosted media**, with consent and rights handled properly.
9. A decision on the **business model** — the obvious candidates are a
   subscription for organisations or a fee on confirmed engagements — and
   research with real musicians and orchestra managers before building more.
