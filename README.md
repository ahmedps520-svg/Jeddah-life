# JEDDAH LIFE

**Live:** https://jeddah-life.onrender.com

**Discover Your City Differently.** A bilingual (English / Arabic) city guide for Jeddah that answers one question: *what should we do today?*

Everything in the app is built on real places and labelled honestly: where a detail came from, whether it has been verified, and whether a price or time is an estimate. Nothing is invented to make the app look busy.

## Features

- **Home** — rotating photo hero (Wikimedia Commons, credited), mood search, 12 category tiles, and rails that only appear when there is real data behind them (trending needs real activity; personalised picks need real signals).
- **Explore & search** — natural-language search in English and Arabic (“cheap coffee near the waterfront”, «مطعم رخيص في الحمراء»), filters, sorting, suggestions, recent and popular searches. A rule-based interpreter always works; an AI interpreter is used only when configured, and results say which one was used.
- **Interactive map** — MapLibre with clustering, combined filters, a synced list, previews, directions, and neighbourhood boundaries.
- **Place pages** — gallery with photo credits, verified vs. inferred attributes, listed hours (“listed as open”, never “open”), price basis, sources, notes, visited, reviews, reporting and “you might also like”.
- **Outing planner** and **Make It Happen** — itineraries from real places with estimated times, travel and costs that respect the budget, plus replace/reorder/add/remove, save and share.
- **Events** — list and calendar, filters, saving and reminders. Events are admin-managed from official sources; the page says so when there are none.
- **Neighbourhoods** — destination guides with practical tips, boundary maps, per-area sections and a walking route only when real distances are walkable.
- **Hidden gems** — editors’ picks plus community recommendations that go through moderation.
- **Plan together** — shared plans with a link or 6-character room code; guests can join with just a name; votes on places and dates, discussion, budget estimate and a final plan. Clients stay in sync by polling a version counter.
- **Accounts** — optional. Saved places, collections (reorder, share, cover), notes, visited, interests, privacy and notification settings, data export and full account deletion.
- **Notifications** — reminders for saved events and dated outings, event changes, and shared-plan activity, all respecting user preferences.
- **Admin** — places, events, categories, featured content, moderation of reviews/submissions/reports, audit log.
- **PWA** — installable, maskable icons, offline fallback page (the service worker never serves stale listings).

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, `proxy.ts` for locale routing), React 19, TypeScript, Tailwind CSS v4
- SQLite via [libSQL](https://github.com/tursodatabase/libsql) and [Drizzle ORM](https://orm.drizzle.team) — a local file by default, or Turso in production
- [MapLibre GL](https://maplibre.org) with [OpenFreeMap](https://openfreemap.org) vector tiles
- [`opening_hours`](https://github.com/opening-hours/opening_hours.js) for OSM opening-hours strings, evaluated in Asia/Riyadh time
- `sharp` for re-encoding uploads (metadata and GPS stripped)
- Optional: [Claude](https://docs.anthropic.com) via `@anthropic-ai/sdk` for interpreting search queries
- Vitest for unit tests

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install          # also copies the MapLibre worker into public/vendor
cp .env.example .env # optional — every variable has a sensible default
npm run setup        # creates data/jeddah-life.db, runs migrations and seeds places
npm run dev          # http://localhost:3000
```

To create an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`) before running `npm run setup` (or `npm run seed`). An existing account with that email is promoted to admin. The admin area is at `/en/admin`.

If the database hasn’t been set up, every page shows a “setup needed” notice instead of failing.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development, production build and server |
| `npm run setup` / `npm run seed` | Migrate and seed the database. `npm run seed -- --refresh` also overwrites seeded places, guides and hero slides with the latest seed files (user data is kept) |
| `npm run anchors` | Rebuild `data/seed/anchors.json`, `hero.json` and guide photos from the research in `data/research/anchors/` |
| `npm run icons` | Render PWA icons from `public/icons/favicon.svg` |
| `npm run db:generate` | Generate a Drizzle migration after changing `src/lib/db/schema.ts` |
| `npm run lint` / `typecheck` / `test` | ESLint, TypeScript and Vitest |

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./data/jeddah-life.db` | libSQL URL — a local file or a Turso database (`libsql://…`) |
| `DATABASE_AUTH_TOKEN` | — | Token for a remote libSQL/Turso database |
| `UPLOAD_DIR` | `./data/uploads` | Where user photos are stored (needs persistent storage in production) |
| `SITE_URL` | `http://localhost:3000` | Public base URL for the sitemap and robots file |
| `NEXT_PUBLIC_MAP_STYLE_URL` | OpenFreeMap Positron | Vector map style; the app recolours it to match the brand |
| `ANTHROPIC_API_KEY` | — | Enables AI interpretation of search queries. Without it, search uses the rule-based interpreter |
| `SEARCH_AI_MODEL` | `claude-opus-5-5` | Model used for query interpretation |
| `SEARCH_AI` | — | Set to `off` to disable AI interpretation even when a key is present |
| `SEARCH_AI_TIMEOUT_MS` | `6000` | Time limit before falling back to the rule-based interpreter |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | — | Create or promote an administrator when seeding |

Secrets are only read on the server.

## Data

| Data | Source | Licence | Notes |
| --- | --- | --- | --- |
| Landmarks (55) | Researched from OpenStreetMap, Wikidata and official websites | ODbL / CC0 / per site | `data/research/anchors/` keeps the research, sources per place, and a list of places deliberately excluded. Places that couldn’t be confirmed are imported as “not yet verified” |
| Cafés, restaurants and other places (~2,400) | [Overture Maps Foundation](https://overturemaps.org) places | CDLA Permissive 2.0 | Imported as “not yet verified” |
| Neighbourhood boundaries (153) | Overture Maps divisions (from OpenStreetMap) | ODbL | |
| Photos | Wikimedia Commons | CC BY / CC BY-SA / CC0 | Author and licence shown on every image |
| Map tiles | OpenFreeMap / OpenMapTiles, © OpenStreetMap contributors | ODbL | |

`scripts/data/build_overture.py` rebuilds `data/seed/overture-places.json` and `neighbourhoods.json` from Overture’s public release with DuckDB (raw downloads are cached in the git-ignored `data/raw/`).

How the app stays honest:

- **Verification** — “Verified”, “Not yet verified” and “Community” labels on every place; the date details were checked.
- **Prices** — verified prices, free entry, typical-spend estimates for food and drink (always labelled), or unknown. Unknown prices are never counted as free, and plans never claim to fit a budget while any price is unknown.
- **Hours** — shown as “listed as open/closed” from listed hours; the planner never schedules a stop where the listed hours say it’s closed.
- **Attributes** inferred from the type of place (e.g. indoor, family-friendly, free entry for public spaces) are labelled as such.
- **Ratings** come only from reviews written on JEDDAH LIFE.

## Project structure

```
src/
  app/[lang]/          Pages (en / ar); the root layout lives here
  app/api/             Route handlers (JSON APIs)
  components/          UI by feature
  lib/                 Data access, search, planner, i18n, auth
  lib/i18n/dictionaries English and Arabic strings (sections/ for larger areas)
scripts/               Seeding, data import, icons
data/seed/             Seed data checked into the repo
data/research/         Editorial research and provenance
tests/                 Unit tests
```

## Deployment notes

- The app needs a writable, persistent database and upload directory. Either run it on a host with a persistent disk (and keep `data/` there), or set `DATABASE_URL` to a Turso database and `UPLOAD_DIR` to a mounted volume.
- Set `SITE_URL` to the public URL.
- Run `npm run setup` once against the production database, with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set to create the first administrator.
- Stop the server before re-seeding a local SQLite file.
- The live demo runs on Render's free plan: build `npm ci && npm run setup && npm run build`, start `npm run setup && npm start`. Its filesystem is temporary, so accounts and saves reset when the service redeploys or sleeps after inactivity. For persistent data, use a paid instance with a disk mounted at `/var/data` and set `DATABASE_URL=file:/var/data/jeddah-life.db` and `UPLOAD_DIR=/var/data/uploads`; the start command seeds the empty disk on first boot.
