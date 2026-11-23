# Contributing to Collector

Thanks for wanting to help! This page is for working on Collector's code. To install and run it for yourself, see the [README](README.md).

## Stack

- **Server**: Node.js ≥ 23.6 (runs TypeScript natively, no build step), Express 5, Sequelize 6, PostgreSQL
- **App**: Vue 3 (Options API), vue-router, vue-i18n (English and French), vue-feather icons, Vite
- **Shared**: `shared/media.js` defines the media types, their fields, formats, genres and validation, used by both sides

## Getting started

```bash
docker compose up -d          # Postgres :5432 + Mailpit (SMTP :1025, UI http://localhost:8025)
cp .env.example .env
npm install
npm run create:user -- you@example.com --name "You" --locale en
npm run dev                   # API :3000 + app http://localhost:5173
```

Ask for a magic link on the login page, then open it from Mailpit (http://localhost:8025). Both services in `docker-compose.yml` listen on 127.0.0.1 only: Mailpit shows every sign-in email.

`npm run dev` is reachable from other devices of your network: the console prints the LAN addresses (e.g. `http://192.168.1.30:5173`). In development, magic links point to the address the login page was opened from, so they work on a phone too.

Phones only give camera access (barcode scanning) over HTTPS: use `npm run dev:https` and open `https://<your-ip>:5173` (self-signed certificate: accept the warning once per device). It serves HTTP/1.1 on purpose: Vite's built-in HTTPS server uses HTTP/2, which Chrome on Android rejects with a self-signed certificate (`ERR_TOO_MANY_RETRIES`).

| Script | |
| --- | --- |
| `npm run dev` / `dev:https` | API (watch mode) + Vite |
| `npm run build` | Builds the app into `dist/` |
| `npm start` | Production server (app on `/`, API on `/api`) |
| `npm run typecheck` | TypeScript check of the server |
| `npm run create:user` | Creates an account |
| `npm run db:sync` | Brings the database schema up to date without starting the server |
| `npm run icons` | Renders `app/public/icons/*` and the email logo from the cassette drawing |
| `npm run bump` | Release (see below) |

## Project layout

```
shared/media.js        media types, fields, formats, genres, ISBN helpers (server + app)
server/
  main.ts              Express app, security headers, static app + SPA fallback
  config.ts db.ts      environment, Sequelize models, schema updates
  routes/              auth, items, lookup, uploads, covers, import, export, family, settings
  connectors/          metadata sources, one file per media family + aggregator
  importers/           CSV imports (Goodreads, StoryGraph, Discogs, Letterboxd, RAWG)
  migrations/          data changes between releases, applied on start
  lib/                 jwt, crypto, mailer, images (sharp), archive (export zip), AI, duplicate matching
  emails/              sign-in email (MJML, compiled at startup)
  scripts/             create-user, db-sync, icons, bump, dev-https
app/
  main.js App.vue      router, shell (sidebar on desktop, bottom bar on phones)
  views/ components/   shelves, item, form, add (scan / search / photo), review, settings
  lib/                 store, API client, add session, ISBN text reader, service worker helpers
  i18n/                en.js, fr.js
  sw.js                service worker
```

## Conventions

- **Match the surrounding code**: Options API components, comments that explain *why*, the same naming and density.
- **Both languages**: every interface string goes in `app/i18n/en.js` *and* `app/i18n/fr.js`.
- **Media definitions live in one place**: a new field, format or genre starts in `shared/media.js`; the server validates with it and the app builds its forms and filters from it.
- **Changelog as you go**: write user-facing notes under `## [Unreleased]` in `CHANGELOG.md`. When a release needs something from people who self-host (a renamed setting…), say so under an **Upgrading** line.
- Run `npm run typecheck` and `npm run build` before sending a change.

## Database changes

The schema follows the models (`server/db.ts`), and is brought up to date on every start:

1. missing tables are created (`sequelize.sync`) and new columns are added (additive only: nothing is dropped, renamed or changed);
2. pending migrations (`server/migrations/`, for data that moves between fields) are applied once each, in order, each in its own transaction, and recorded in the `migrations` table.

So adding a field is usually just the model and `shared/media.js`. Moving data needs a migration: add a new file and list it in `server/migrations/index.ts`. **Never edit or reorder a migration that has shipped**, and make each one work on a fresh database too (tables there are created from the current models, so check what exists before moving data).

In development, `npm run db:sync -- --alter` then makes the tables match the models exactly, dropping the columns they no longer have; or start over with `docker compose down -v`.

## Adding a metadata source

Connectors live in `server/connectors/`, one file per media family (`books.ts`, `music.ts`, `movies.ts`, `games.ts`, `generic.ts` for barcodes). A connector declares what it can do (barcode, title search), the languages it covers and whether it needs a key, and returns candidates with fields named as in `shared/media.js`. The aggregator (`index.ts`) asks every eligible source in parallel; the app merges and compares the answers in the cherry-picker.

Keys are stored per user, encrypted (AES-256-GCM with a key derived from `JWT_SECRET`), and never sent back to the browser.

## Adding an importer

Importers live in `server/importers/`, one per media family, on top of the CSV reader in `csv.ts`. An importer recognises its service from the file's columns, maps each row to item fields, and leaves out what is not owned (wishlists, to-read shelves…). Duplicates are flagged by the shared matching in `server/lib/matching.ts`.

### Collector's own archive

`server/lib/archive.ts` writes and reads Collector's export: a `.zip` with `collector.json` (`{ format: "collector-export", version, app, exported_at, items }`, each item its `type`, its fields as in `shared/media.js`, `extra`, `added_at`, and `cover`: `covers/<n>.webp` in the archive, or an `https://` link) and the `covers/` files. A breaking change to this format bumps `version`; older versions must stay importable.

Imports trust nothing in the archive: only `collector.json` and `covers/<n>.webp` entries are read, by exact name, never written to disk under their own name; entry sizes are capped and checked while inflating (zip bombs, lying headers); the JSON goes through the same validation as any save; ids, owners and dates are never taken from it; and every cover is decoded and re-encoded by `storeImage` (raster formats only), so nothing but a clean picture is kept. The archive is uploaded once, kept in a temporary file between the preview, the import and the copy of its covers (in small batches driven by the app, so a large archive never holds a request open), then deleted.

## How some parts work

### Adding items

Every method (barcode, photo, search, manual) ends in the same review (`ReviewView` → `ItemReview` → `CherryPicker`): the sources are asked (barcode or ISBN first, then title and author; an AI reading counts as one more source), and the user picks a whole result or single fields. Several items picked at once form a session (`app/lib/addSession.js`) that survives a detour through the form and a reload.

**Barcodes** use the browser's `BarcodeDetector` when available, ZXing otherwise. On the books scanner, the **ISBN text reader** (`app/lib/isbnReader.js`) also runs Tesseract (tesseract.js, LSTM, digits-only) in a worker on a cleaned-up crop of the frame (adaptive threshold, deskew up to ±12°); only ISBNs with a valid check digit, read twice in a row, count. An ISBN wins: a barcode that is not one waits 2 seconds for the text. The engine and English model (about 7 MB) are copied by `vite.config.js` to `/ocr/<version>/`, downloaded on first use of the books scanner only.

**AI** calls go through the [Vercel AI SDK](https://ai-sdk.dev) (`server/lib/ai.ts`): one code path for every provider, answers validated against schemas built from `shared/media.js`.

### Progressive Web App

- **Service worker** (`app/sw.js`, built into `dist/sw.js` with a build id): the app shell is pre-cached, covers are cached as viewed, API reads are network-first with the last copy as a fallback, so the collection stays browsable offline (read-only). Lookups and auth calls are never cached; cached data and covers are wiped on logout. The OCR files are cached on first use and kept across builds. After a deploy, the app offers "A new version is available · Reload". Disabled in development.
- **Sign-in in an installed app**: iOS home-screen apps cannot receive links and keep their own cookies, so the email carries a 6-digit code next to the link (5 attempts, same expiry as the link). Android routes the link into the installed app. Installed apps get 365-day sessions (60 in a browser).
- **Shortcut**: long-press the icon → "Scan a barcode".

### Security

- **Secrets**: `JWT_SECRET` signs sessions and encrypts stored API keys. In production it must be random and at least 32 characters; the server refuses the example value.
- **Sign-in**: single-use link and 6-digit code (15 min, 5 tries per code, consumed atomically), rate-limited per IP (IPv6 per /64) and per account; unknown emails get the same responses. Sessions are httpOnly cookies; "Sign out of all devices" revokes every session.
- **Requests**: state-changing API calls from another origin are refused; security headers and a strict CSP are sent in production (`script-src` allows `'wasm-unsafe-eval'` for the OCR engine only). `X-Forwarded-For` is only trusted from proxies on the same machine or a private network.
- **Outgoing requests**: cover downloads and cloud AI providers only reach public addresses (checked at connection time, size-capped). The "OpenAI-compatible" provider may reach local addresses on purpose (self-hosted models).
- **Covers**: every image is decoded and re-encoded to webp (raster formats only: no SVG or PDF; metadata and appended data dropped; pixel count capped). Upload names carry an owner signature; items can only use their owner's uploads; files are deleted only when no item uses them.

Found a vulnerability? Please report it privately to the maintainer rather than in a public issue.

### Accounts and family

Accounts are created only from the CLI. A user can start a family and invite existing users by email. Members see every shelf of the family; each edits only their own items. When the owner leaves, ownership passes to the oldest member.

## Releasing

```bash
npm run bump                # minor: 0.3.0 → 0.4.0 (default)
npm run bump -- --patch     # 0.3.0 → 0.3.1
npm run bump -- --major     # 0.3.0 → 1.0.0
```

The bump:

1. updates the version in `package.json`, `package-lock.json` and the web manifest;
2. moves the "Unreleased" notes under `## [x.y.z] - <date>` and starts a fresh "Unreleased";
3. commits exactly those files as "Release vx.y.z" (add `--no-commit` to review first).

The version is built into the app (login screen, settings): rebuild after bumping.
