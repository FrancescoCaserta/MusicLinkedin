# Design system: 01 · Grotesk & Serif

Swiss structure, warm grey paper, one serif for what people write. Clean, spacious, square.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#1F1F1E` | Text, primary buttons, active tab, selected chips, booked days |
| `ground` | `#EFEEEA` | Page background |
| `surface` | `#F7F6F3` | Cards, attachments, quiet panels |
| `field` | `#E3E1DC` | Search and input fill |
| `rule` | `#D6D3CC` | 1 px dividers, secondary borders |
| `muted` | `#6E6C67` | Secondary text (4.9:1 on ground) |
| `faint` | `#8F8C85` | Large decorative numbers only (e.g. "/14"), never small text |
| `accent` | `#E2641B` | Fill for actions and urgency, always with `ink` text on top |
| `accent-text` | `#B84A0E` | Orange used as text (labels such as "Urgent · closes tomorrow") |

**The orange rule.** Orange appears only on:
- actions: Apply, Invite to a job, Accept, Confirm, Publish, Post, the main button of a form;
- urgent items: "Urgent" labels, open seats, "needs your answer" markers;
- unread counts and dots;
- a Bravo you have given.

Never use orange for decoration, active tabs or headings. White text on orange fails contrast, so text on orange is always `ink`.

Photos are full colour or black-and-white. Placeholders in the screens are grey silhouettes.

## Type

- **Inter Tight** (400, 500, 600): interface, names, headings, numbers.
- **Newsreader** (400, italic): post text, bios, quotes and titles of works (italic).

| Role | Size / weight | Notes |
| --- | --- | --- |
| Page title, mobile | 44 / 500 | letter-spacing −0.045em, line-height 0.95 |
| Page title, desktop | 56–72 / 500 | letter-spacing −0.05em |
| Big number (date, fee, counter) | 26–64 / 500 | letter-spacing −0.04em; dates as `14.03` |
| Item title | 16–20 / 600 | letter-spacing −0.01em |
| Body | 14–15 / 400 | line-height 1.5 |
| Post text | Newsreader 17–19 | line-height 1.45 |
| Secondary | 12–13 / 400 `muted` | |
| Label | 10 / 500, uppercase, letter-spacing 0.12em | preceded by an 8 px `■` square |

Counters are written as `/14` in `faint` next to a title. Lists are numbered `01`, `02`, `03` when order matters (search ranking).

## Shape and spacing

- **Corners: 0 everywhere.** Square buttons, fields, cards and avatars.
- **Avatars: square.** 36–52 px in lists, 112 px (mobile) / 168 px (desktop) on the personal page.
- Dividers are 1 px `rule`; a 1 px `ink` line opens a section. No shadows, except the messaging dock and modal dialogs.
- Spacing on a 4 px base: 8 · 12 · 16 · 20 · 24 · 32 · 48. Mobile side margin 20 px; desktop container 1200 px with 32 px padding.
- Touch targets ≥ 44 px.

## Components

- **Primary button:** `ink` fill, `ground` text, 44–52 px tall, label left and a small ▸ triangle right.
- **Action button:** the same in `accent` fill with `ink` text (Apply, Accept, Post…).
- **Secondary button:** 1 px `ink` border, transparent.
- **Text action:** underlined 1 px `ink` (e.g. "Edit" on your own personal page, "Change").
- **Chip:** 28–36 px, square. Selected chips are `ink` fill; others have a `rule` border.
- **Segmented switch:** two halves in a 1 px `ink` border; the selected half is filled `ink`. Used for "By name / By criteria" and "Link to an event / Write it yourself".
- **Tabs:** text links with a 2 px `ink` underline on the active one.
- **Bottom tab bar (mobile):** icon above a 10 px label; active tab has a 2 px `ink` bar on top and `ink` colour, others `muted`.
- **Card / attachment:** `surface` fill, optional 1 px border; for events, a big date on the left and title plus venue on the right.
- **Bravo:** clapping-hands icon. Outline by default; once you've given it, `accent` fill with an `ink` outline.
- **Activity banner:** a thin line above a post ("Mario Rossi gave a Bravo to this") with a 18–20 px avatar, 12–13 px `muted`.
- **Open seat:** a 1.5 px dashed `accent` square with a +, labelled "Open seat · Instrument" in `accent-text`.
- **Form field:** no box, just a bottom border (`ink` for key fields, `rule` for others) with a 10 px uppercase label above.
- **Icons:** stroke 1.5 px, square ends where possible, 20–22 px.

## Accessibility

- Text contrast ≥ 4.5:1 (`muted` on `ground` passes; `faint` is for 24 px+ only).
- Real `button`, `a` and `label`/`input` elements; icon-only buttons carry `aria-label`.
- Status is never colour-only: Booked / On hold / Unavailable also differ in fill and border style.
