# Changelog

All notable changes to Collector are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (`npm run bump`).

## [Unreleased]

## [0.1.0] - 2026-11-21

First version.

### Collections
- Books, music, movies and video games (shown as "Games"), plus a hidden-by-default custom collection.
- Fields per media type: title, author, cover, genre, category, release date, condition, barcode, read/listened/watched/played status, digital copy (owned, but not as a physical item), description (synopsis from the sources) and a personal comment, plus publisher, ISBN, saga and volume for books, label and format for music, director, saga, number and format for movies, saga and number for games.
- Video games use their platform as category: a fixed list grouped by brand (Nintendo, PlayStation, Xbox, Sega, others).
- Grid and list views sorted by title by default, accent-insensitive search, filters (category, format, genre, status, physical or digital copy, owner, sort) and a quick filter bar per collection (category or format, with counts).
- The search bar (logo, search, filters, grid/list) stays pinned to the top while the shelf scrolls. On phones the filters float over the list (a tap outside closes them), pages start right under the status bar, the search field shows the item count (the clear button while typing) and a single button switches between grid and list; on desktop, filters opened from further down appear right under the bar.
- Games show their platform before the developer in the grid and the list.
- Choice of the visible collections and of the one opened on startup (Settings → Collections).

### Adding items
- Four ways in, one process: scan a barcode (camera or typed code), photo of a cover or a whole shelf (AI), online search, or manual entry.
- Photo and search list what was found with checkboxes (items already owned start unticked), then each ticked item is reviewed one by one, with progress and a list to jump around.
- Every item goes through the same review: the sources are asked (barcode / ISBN first, then title and author; the AI reading of a photo counts as one more source), the query can be edited and asked again, a whole result or single fields are picked, then Ignore, Edit (the form, the picks kept on the way back) or Save.
- A single detected cover offers the photo itself as the cover; the form's cover button takes or uploads a photo.
- Duplicate check at two levels, the same everywhere (add review, form, photo and search lists, import): "Already owned" for the same barcode or ISBN, "Maybe owned" for the same title and author (another edition?). In the review and the form it follows what is picked or typed, live.
- "Search sources" in the form completes a manual entry or an existing item, through the same review.
- After saving a single item: "Scan another" / "Add another" to go through a pile.

### Importing a collection
- CSV exports from Goodreads, The StoryGraph, Discogs, Letterboxd and RAWG (Settings → Import), the service recognised from the file.
- Preview before anything is saved: items already in the family's collection ("Already owned" or "Maybe owned") and rows repeated in the file are left unticked; games listed on several platforms ask which one.
- Left out: Goodreads "to-read" shelf, Letterboxd watchlist, Discogs wantlist, RAWG wishlist, and The StoryGraph books not marked as owned.
- Read status, ebook / audiobook / digital editions, series and volume ("Title (Series, #2)"), publisher, label, record format and grading are carried over.
- "Find the covers" after an import, or later for any collection (Settings → Import → Missing covers): looked up by ISBN, barcode, then title and author, kept only when they match; runs in the background with its progress shown, covers appearing as they are found.

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
- Shelves open on your own items; choosing everyone or another member in the filters is remembered on the device (per account), and the counts follow.

### Interface
- Mobile-first, responsive (bottom bar on phones, sidebar on desktop), dark and light themes, English and French.
- Settings in three pages: Account (profile, app, collections, family), Sources (metadata and AI) and Import.
- Neon identity: cassette logo, Tilt Neon headings, per-collection accent colours with animated transitions, splash screen on startup.
- Installable PWA: offline browsing of the collection (read-only), update prompt, "Scan a barcode" home-screen shortcut, install hint.

### Accounts and security
- Accounts created only from the CLI (`npm run create:user`).
- Passwordless sign-in: emailed link or 6-digit code (MJML email), single use, rate-limited, no account enumeration; "Sign out of all devices".
- Server-side request guard (public addresses only) for cover downloads and cloud AI providers, owner-signed upload names, CSRF origin check, security headers and CSP in production.

### Tooling
- `npm run dev` (LAN-reachable), `npm run dev:https` for testing the camera on a phone, `npm run build`, `npm start`.
- `npm run bump -- --patch|--minor|--major` (minor by default), `npm run icons`, `npm run db:sync`.
- `docker-compose.yml` with Postgres and Mailpit for local development.
