# Changelog

All notable changes to Collector are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) (`npm run bump`).

## [Unreleased]

## [0.3.0] - 2026-11-23

### Added
- Books scanner: the ISBN printed as text is read too (OCR, for books whose barcode is not their ISBN). An ISBN wins: a barcode that is not one waits 2 seconds for the ISBN text, then is used; the item keeps both. The scanner says which one it used.
  - Tesseract (tesseract.js) in a background worker, with model-free image cleanup (adaptive threshold, straightening up to ±12°); only ISBNs with a valid check digit, read twice in a row, are accepted.
  - The engine and English model (about 7 MB) are served by Collector itself under `/ocr/<version>/`, downloaded on first use of the books scanner only, then cached for offline use; other scanners never load them.
- Typing a code: hyphens and spaces accepted, ISBN-10s converted to ISBN-13, a mistyped ISBN (wrong check digit) is flagged and not looked up.

### Changed
- Content-Security-Policy: `script-src` allows `'wasm-unsafe-eval'` (compiling WebAssembly only, for the OCR engine).
- The cover images folder is set with `DATA_DIR` (was `UPLOAD_DIR`, default still `./uploads`). **Upgrading:** rename the variable where it is set, otherwise covers are looked for in `./uploads`.

## [0.2.1] - 2026-11-22

### Added
- A language for every item (optional): French or English to begin with, more can be added to one list (`LANGUAGES` in shared/media.js), their names coming from the browser in the interface language.
  - New items start in the user's language; existing items are left without one.
  - Shown on the item page, filterable in the shelf's filter box, read by the AI from photos, filled by sources that state it (Google Books, Open Library, ISBNdb).
- Online search: a quick language choice (all by default) asks only the sources covering that language, passes it to those that can narrow their results (Google Books, Open Library, MangaDex, TMDB, iTunes), and gives the picked items that language.
- Sources declare the languages they cover (Settings → Sources shows the English-only ones).

## [0.2.0] - 2026-11-22

### Changed
- Fewer per-type fields: every item now has an author, a publisher, a saga and volume, and a format, named for its type:
  - books: author, publisher, format (novel, comic, manga…), ISBN;
  - music: artist, label, format (vinyl, CD, tape), category (album, EP…);
  - movies: director, studio, format (DVD, Blu-ray, 4K), category (movie, series…);
  - games: studio, publisher, platform;
  - custom items: maker, brand, free format and category.
- Books and games no longer have a category: a book's kind and a game's platform are its format.
- The format is required for books, music, movies and games: picked right under the type in the form, the first one pre-selected (custom items keep a free, optional format).
- Game sources also fill the publisher.
- Grid and list show the same lines under the title, per type: books and movies their saga and volume, then author · year (movies: director · studio · year, games: studio · platform · year).
- Grid and list no longer mark read/watched items or digital copies (both stay on the item page and in the filters).
- Phones: the line marking the current tab in the bottom bar slides to the next tab, changing colour on the way.
- Imports follow the new fields: book kinds come from Goodreads shelves and bindings or StoryGraph tags (manga, comic…), Discogs labels fill the label, digital-only releases are filed with CDs, and the preview shows the format each item will get (the type's first one when the export has none).

### Upgrading
- Existing data is moved on the first start (migration `001-common-fields`): book kinds and game platforms become formats, music labels become the label (publisher field), a movie's studio moves to the studio field and its director to the director (author field). The old `label`, `director` and `original_title` columns are then dropped.
- Items without a format get the first one of their type (migration `002-required-format`): novel, vinyl, DVD, Switch 2.
- Database changes now run as numbered migrations, applied once each on start and recorded in a `migrations` table.

## [0.1.1] - 2026-11-21

### Fixed
- Updating from 0.0.1 broke the shelves (server error): new fields need database columns, which the server now adds on start (additive only, nothing is ever removed).
- A first visit no longer loads the page twice when the offline mode installs.
- Online lookups are no longer kept in the offline cache.

### Changed
- Errors are easier to report: every failed request is logged in the browser console with its cause, server errors carry a reference shown in the message and in the server log.

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
