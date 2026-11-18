# Leggio redesign

The agreed visual direction ("01 · Grotesk & Serif") and the screens drawn in it.
This folder is the reference for restyling the app; nothing here is wired into the build.

- **Live canvas** (all screens side by side, clickable): https://claude.ai/artifact/SB9raPPCQkmxN7Pm6MULmB
- **[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)**: colours, type, spacing, components and rules. Start here.
- **[EVENTS.md](EVENTS.md)**: the Event model that links opportunities, lineups, concert history and endorsements.
- **`screens/`**: one file per screen. Each is plain HTML with inline styles, written for the design canvas.
  Open them in a text editor to read exact values. In a browser most render, but a few parts
  (calendar grids, the Edit labels on the personal page) use canvas template syntax (`{{…}}`, `<sc-for>`,
  `<sc-if>`) and only display correctly on the canvas. `canvas.json` is the canvas layout.

## Screens and where they go in the app

Mobile frames are 390 × 844 (the personal page is a full-length scroll). Desktop pages are fluid, laid out at 1440.

| Screen | Mobile | Desktop | App route today |
| --- | --- | --- | --- |
| Home feed | `Main.dc.html` | `D-Home.dc.html` | `/home` |
| Search results | `M1-Search.dc.html` | `D-Search.dc.html` | `/search` |
| Search filters | `M1-Filters.dc.html` | (side panel on desktop) | `/search` |
| Messages | `M1-Messages.dc.html` | `D-Messages.dc.html` (plus dock on Home) | `/messages` |
| Notifications | `M1-Alerts.dc.html` | `D-Alerts.dc.html` | new |
| Network | `M1-Network.dc.html` | `D-Network.dc.html` | `/network` |
| New post | `M1-Compose.dc.html` | `D-Compose.dc.html` | new |
| Calendar | `M1-Calendar.dc.html` | `D-Calendar.dc.html` | `/calendar` |
| Work (opportunities) | `M1-Work.dc.html` | `D-Work.dc.html` | `/opportunities` |
| Opportunity detail | `M1-Opportunity.dc.html` | `D-Opportunity.dc.html` | `/opportunities/:id` |
| Post an opportunity, written by hand | `M1-PostOpportunity.dc.html` | (same form, switch set to "Write it yourself") | `/opportunities/new` |
| Post an opportunity, linked to an event | `M1-PostLinked.dc.html` | `D-PostOpportunity.dc.html` | `/opportunities/new` |
| Event page | `M1-Event.dc.html` | `D-Event.dc.html` | new |
| Create an event | `M1-CreateEvent.dc.html` | `D-CreateEvent.dc.html` | new |
| Ensembles | `M1-Ensembles.dc.html` | `D-Ensembles.dc.html` | `/ensembles` |
| Ensemble page | `M1-Ensemble.dc.html` | `D-Ensemble.dc.html` | `/ensembles/:slug` |
| Personal page, as others see it | `M1-Profile.dc.html` | `D-Profile.dc.html` | `/musicians/:slug` |
| Personal page, my own view (Edit labels) | `M1-Profile-Mono.dc.html` | (same, with Edit labels) | `/musicians/:slug` when it's you; replaces most of `/profile/edit` |
| Style sheet | `M1-Style.dc.html` | | |

## Navigation (both sizes)

- **Mobile top bar:** Home shows the Leggio wordmark with Post and Messages on the right, then avatar and search below.
  Other tabs: avatar · search · Post (+) · Messages.
- **Mobile bottom tabs:** Home · Network · Ensembles · Alerts · Work. "Find musicians" is no longer a tab: search does it.
- **Desktop top bar:** wordmark · search · Home · Network · Ensembles · Work · Alerts · **Post** · avatar.
  Messages lives in a dock at the bottom right, as on LinkedIn, and as a full page.

## Suggested order of work

1. Shared tokens and base components (see DESIGN-SYSTEM.md), replacing the current fonts and colours.
2. App shell: top bar and bottom tabs.
3. Home feed, then the personal page (visitor view and own view).
4. Work, opportunity detail and the post form.
5. Search with filters, Network, Notifications, Messages.
6. Events (data model first, see EVENTS.md), then the event page, Create event, Calendar and New post.
