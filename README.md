# Collector ✨

Personal manager for physical collections: books (novels, comics, mangas, magazines), music (vinyls, CDs, tapes), movies (DVD, Blu-ray), games and custom items. Scan a barcode, snap a cover or type it in; cherry-pick the best metadata from every source; share shelves with your family.

- **Backend**: Node.js (≥ 23.6, runs TypeScript natively), Express 5, Sequelize, Postgres
- **Frontend**: Vue 3 (Options API), vue-router, vue-i18n (EN/FR), vue-feather, Vite

## Quick start (dev)

```bash
docker compose up -d          # Postgres :5432 + Mailpit (SMTP :1025, UI http://localhost:8025)
cp .env.example .env
npm install
npm run create:user -- you@example.com --name "You" --locale fr
npm run dev                   # API :3000 + app http://localhost:5173
```

Ask for a magic link on the login page, then open it from Mailpit (http://localhost:8025).

`npm run dev` is reachable from other devices of your network: the console prints the LAN addresses (e.g. `http://192.168.1.30:5173`). In dev, magic links point to the address the login page was opened from, so they work on the phone too.

Phones only give camera access (barcode scanning) over HTTPS: use `npm run dev:https` and open `https://<your-ip>:5173` (self-signed certificate: accept the warning once per device). It serves HTTP/1.1 on purpose: Vite's built-in HTTPS server uses HTTP/2, which Chrome on Android rejects with a self-signed certificate (`ERR_TOO_MANY_RETRIES`).

## Versioning

```bash
npm run bump                # minor: 0.1.0 → 0.2.0 (default)
npm run bump -- --patch     # 0.1.0 → 0.1.1
npm run bump -- --major     # 0.1.0 → 1.0.0
```

Write release notes under `## [Unreleased]` in `CHANGELOG.md` as you go. The bump:

1. updates the version in `package.json`, `package-lock.json` and the web manifest;
2. moves the "Unreleased" notes under `## [x.y.z] - <date>` and starts a fresh "Unreleased";
3. commits exactly those files as "Release vx.y.z" (add `--no-commit` to review first).

The version is built into the app (login screen, settings): rebuild after bumping.

## Production

```bash
npm run build                 # builds the app into dist/
NODE_ENV=production npm start # serves the app on / and the API on /api
```

Required environment variables (the server refuses to start in production if any is missing):

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port |
| `JWT_SECRET` | Signs session tokens **and** encrypts stored API keys. Keep it stable. |
| `PUBLIC_URL` | Public URL of the app, used in magic links (`https://…` also enables secure cookies) |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | Postgres |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `SMTP_FROM` | Magic-link emails (port 465 = implicit TLS) |

Optional: `DATA_DIR` (default `./uploads`) for cover images.

The database is brought up to date on every start, so deploying a new version needs no extra step:
1. missing tables are created from the models (`sequelize.sync`) and new columns are added (additive only, nothing is dropped);
2. pending migrations (`server/migrations/`, for data that moves between fields) are applied once each, in order, each in its own transaction, and recorded in the `migrations` table.

`npm run db:sync` does the same without starting the server. In development, `npm run db:sync -- --alter` then makes the tables match the models exactly, dropping the columns they no longer have; or start from an empty database (`docker compose down -v`). A shipped migration is never edited: add a new one to `server/migrations/index.ts`.
The `unaccent` extension is enabled when possible so search ignores accents ("asterix" finds "Astérix").

## Progressive Web App

Production builds are installable (Android/desktop: install prompt; iPhone: Share → Add to Home Screen; the app shows the hint).

- **Service worker** (`app/sw.js`, built into `dist/sw.js` with a build id): the app shell is pre-cached, covers are cached as viewed, API reads are network-first with the last copy as fallback, so the collection stays browsable offline (read-only). Lookups and auth calls are never cached; cached data and covers are wiped on logout. After a deploy, the app offers "A new version is available · Reload". Disabled in dev.
- **Sign-in in an installed app**: iOS home-screen apps cannot receive links and keep their own cookies, so the email carries a 6-digit code next to the link; the login screen accepts it (5 attempts, same expiry as the link). Android routes the link into the installed app. Installed apps get 365-day sessions (60 in a browser).
- **Shortcut**: long-press the icon → "Scan a barcode".
- **Icons**: `npm run icons` renders `app/public/icons/*` and the email logo from the cassette drawing.

The sign-in email is written in MJML (`server/emails/magic-link.mjml`), compiled once at startup.

## Security notes

- **Secrets**: `JWT_SECRET` signs sessions **and** encrypts stored API keys. In production it must be random and at least 32 characters (`openssl rand -base64 48`); the server refuses the example value. Changing it signs everyone out and makes stored API keys unreadable (users re-enter them).
- **Sign-in**: single-use link and 6-digit code (15 min, 5 tries per code, consumed atomically), rate-limited per IP (IPv6 per /64) and per account; unknown emails get the same responses. Sessions are httpOnly cookies; Settings → "Sign out of all devices" revokes every session.
- **Requests**: state-changing API calls from another origin are refused; security headers and a strict CSP are sent in production. `X-Forwarded-For` is only trusted from proxies on the same machine or a private network.
- **Outgoing requests**: cover downloads and cloud AI providers only reach public addresses (checked at connection time, size-capped). The "OpenAI-compatible" AI provider may reach local addresses on purpose (self-hosted models).
- **Covers**: upload names carry an owner signature; items can only use their owner's uploads; files are deleted only when no item uses them.
- **Dev services** (`docker-compose.yml`) listen on 127.0.0.1 only: Mailpit shows every sign-in email.

## Users & family

- Accounts are created only from the CLI: `npm run create:user -- <email> [--name "…"] [--locale en|fr]`.
- Sign-in is passwordless: a single-use magic link (15 min), then a 60-day session JWT in an httpOnly cookie.
- A user can start a family and invite existing users by email. Members see every shelf of the family; each member edits only their own items. When the owner leaves, ownership passes to the oldest member.

## Preferences

Each user picks in **Settings → Collections** which collections the interface shows (Books, Music, Movies and Games by default; Custom is hidden) and which one opens on startup (Books by default). Hiding a collection only hides it from the UI: its items are kept and still reachable by link.

## Collections

`book`, `music`, `movie`, `videogame` (shown as "Games") and `custom`. Video games use their platform as category (fixed list grouped by brand: Nintendo, PlayStation, Xbox, Sega, others). On each shelf a quick bar filters on the main dimension: category for books and games, format for music and movies.

## Metadata sources

Set in **Settings → Metadata sources**; keys are encrypted at rest (AES-256-GCM) and never sent back to the browser.

| Media | Keyless | With a key |
| --- | --- | --- |
| Books | Open Library, MangaDex, Google Books (key optional) | ISBNdb, Comic Vine |
| Music | MusicBrainz, Deezer, Apple iTunes | Discogs, Spotify, Last.fm |
| Movies | — | TMDB, OMDb |
| Games | — | IGDB (Twitch), RAWG |
| Any barcode | UPCitemdb (free trial quota) | Barcode Lookup, Go-UPC |

**Scanning** queries every barcode-capable source in parallel. ISBNs automatically switch to Books. For movies and games, where specialised APIs have no barcode search, the product name from the barcode databases is cleaned up ("[Blu-ray] Édition collector"…) and used as a title search. All results land in the cherry-picker: take a whole match, then adjust field by field (values most sources agree on are pre-selected).

**AI (optional)**: Settings → AI assistant, pick a provider: OpenAI, Anthropic (Claude), Google (Gemini), Mistral, or "OpenAI-compatible" (OpenRouter, Ollama, LM Studio…, base URL required), then a key and a vision-capable model id. Calls go through the [Vercel AI SDK](https://ai-sdk.dev) (`server/lib/ai.ts`): one code path, the provider packages handle each vendor's API and structured-output mode, and answers are validated against schemas built from `shared/media.js`. A cover photo gets read by the model, and what it finds seeds a regular barcode/title lookup.

**Shelf photo (AI only)**: one photo of a shelf, a pile of CDs, a stack of games… The model lists every readable item (titles already in the collection are flagged), then you review them one by one: each item is looked up in the regular sources and lands in the cherry-picker (the AI reading is always one of the choices), with Skip / Verify / Save. The review session survives a detour through the form and a page reload.

## Project layout

```
shared/media.js        media types, fields, categories, genres, formats (server + app)
server/
  main.ts              Express app, static app + SPA fallback
  config.ts db.ts      env, Sequelize models
  routes/              auth, items, lookup, uploads, family, settings
  connectors/          one file per media family + aggregator
  lib/                 jwt, crypto, mailer, images (sharp), llm
  importers/           CSV imports (Goodreads, StoryGraph, Discogs, Letterboxd, RAWG…)
  migrations/          data changes between releases, applied on start
  scripts/             create-user, db-sync
app/
  main.js App.vue      router, shell (sidebar / bottom nav)
  views/ components/   library, item, form, add (scan/search/photo), cherry-picker…
  i18n/                en.js, fr.js
```

Keyboard: `/` search, `1`–`5` switch shelf, `n` add. On touch screens, swipe left/right on the library to change shelf.
