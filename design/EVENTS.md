# Events

Decided in the design review: concerts become a first-class **Event**, and opportunities can point to one.

## Why

Today `Concert` (with `programme` and `participants`) and `Opportunity` (with its own `dates`, `place`
and `repertoire`) live side by side in `src/domain/types.ts` without a link. The same details are typed twice,
and a hire never reaches the musician's concert history. Making the event the hub fixes that.

## Model

- **Event** (extends today's `Concert`)
  - `kind`: concert · opera production · recording session · masterclass · audition
  - organiser: a musician or an organisation (`orgId`)
  - one or more performances plus a rehearsal schedule (an opera run or a tour is one event)
  - venue, programme, conductor, ticket link, description
  - `visibility`: `private` (lineup and invited musicians only) or `public`
  - **lineup**: entries of `{ musicianId?, role, status }`, where `status` is
    `invited` → `confirmed` (or `declined`), or `open` for a seat that has no one yet.
- **Opportunity** gains an optional `eventId` (and the lineup seat it fills).
  - If linked, schedule, place and programme come from the event and are read-only in the form;
    the opportunity keeps only seat, fee, deadline, urgency and notes.
  - If not linked ("Write it yourself"), it works as it does today.
  - **The fee lives only on the opportunity.** It is never shown on the public event.

## Rules

1. **Confirmation is required.** Adding someone to a lineup creates an `invited` entry and a notification
   ("Giulia added you to a lineup · Confirm / That's not me"). They appear on the event only once confirmed.
2. **A hire fills the seat.** When an application on a linked opportunity becomes `confirmed`, the seat
   becomes that musician's `confirmed` lineup entry.
3. **Everything else comes from lineups.**
   - Concert history on the personal page = events where the musician is `confirmed`, marked **verified**.
     Concerts a musician adds alone show as **self-added** until another lineup member confirms them.
   - Calendar: confirmed events mark the days booked; invitations show as "needs your answer".
   - Endorsements can only be written between people confirmed in the same event (today's
     `endorse(fromId, toId, concertId, …)` already ties them to a concert).
   - "Played with" and the Network's **Play together** suggestions come from shared lineups.
4. **Sharing.** A post can attach an event and is shown as "I'm playing · Role" when the author is in the lineup.
   Event cards in the feed show any open seat ("1 open seat · Double bass"), linking to the opportunity.

## Screens that use it

`M1-Event` / `D-Event`, `M1-CreateEvent` / `D-CreateEvent`, `M1-PostLinked` / `D-PostOpportunity`,
`M1-Calendar` / `D-Calendar`, `M1-Compose` / `D-Compose`, the lineup item in `M1-Alerts` / `D-Alerts`,
and the verified concerts and "Played with" row in `M1-Profile`.
