# Changelog

All notable changes to Collector are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (`npm run bump`).

## [Unreleased]

First version.

### Collections
- Books, music, movies and video games (shown as "Games"), plus a hidden-by-default custom collection.
- Fields per media type: title, original title, author, cover, genre, category, release date, condition, barcode, read/listened/watched/played status and comment, plus publisher, ISBN, saga and volume for books, label and format for music, director, saga, volume and format for movies, publisher, saga and volume for games.
- Video games use their platform as category: a fixed list grouped by brand (Nintendo, PlayStation, Xbox, Sega, others).
- Grid and list views, accent-insensitive search, filters (category, format, genre, status, owner, sort) and a quick filter bar per collection (category or format, with counts).
- Choice of the visible collections and of the one opened on startup (Settings → Collections).

### Adding items
- Barcode scanning with the phone camera (native detector or ZXing fallback), with manual entry.
- Photo of a cover: becomes the item cover and, with an AI configured, is read to prefill the item.
- Photo of a whole shelf (AI): every readable item is listed, owned ones flagged, then reviewed one by one.
- Online search by title, and manual entry.
- "Cherry-picker": results from every source side by side, pick a whole match then adjust field by field; save directly or verify in the form; "Scan another" to chain items.
- Duplicate warning when a scanned barcode is already in the family's collection.

### Metadata sources
- Keyless: Open Library, MangaDex, Google Books, MusicBrainz, Deezer, Apple iTunes, UPCitemdb (trial).
- With an API key (encrypted at rest): ISBNdb, Comic Vine, Discogs, Spotify, Last.fm, TMDB, OMDb, IGDB, RAWG, Barcode Lookup, Go-UPC.
- Barcodes unknown to specialised APIs (movies, games) are resolved through product databases, then searched by title.

### AI assistant
- Providers: OpenAI, Anthropic (Claude), Google (Gemini), Mistral, or any OpenAI-compatible server (OpenRouter, Ollama, LM Studio…), through the Vercel AI SDK.
- Schema-validated answers built from the media definitions; connection test in the settings.

### Family
- Create a family, invite existing accounts, accept or decline, leave, remove members, dissolve.
- Members see every shelf and edit only their own items; each member has a colour and an initial shown on their items.

### Interface
- Mobile-first, responsive (bottom bar on phones, sidebar on desktop), dark and light themes, English and French.
- Neon identity: cassette logo, Tilt Neon headings, per-collection accent colours with animated transitions.
- Installable PWA: offline browsing of the collection (read-only), update prompt, "Scan a barcode" home-screen shortcut, install hint.

### Accounts and security
- Accounts created only from the CLI (`npm run create:user`).
- Passwordless sign-in: emailed link or 6-digit code (MJML email), single use, rate-limited, no account enumeration; "Sign out of all devices".
- Server-side request guard (public addresses only) for cover downloads and cloud AI providers, owner-signed upload names, CSRF origin check, security headers and CSP in production.

### Tooling
- `npm run dev` (LAN-reachable), `npm run dev:https` for testing the camera on a phone, `npm run build`, `npm start`.
- `npm run bump -- --patch|--minor|--major` (minor by default), `npm run icons`, `npm run db:sync`.
- `docker-compose.yml` with Postgres and Mailpit for local development.
