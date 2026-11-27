<p align="center">
  <img src="docs/screenshots/hero.webp" alt="Collector: a book shelf on desktop and an item page on a phone">
</p>

<p align="center">
  <b>Your books, records, films and games, on one shelf you host yourself.</b><br>
  Scan a barcode, pick the best metadata from a dozen sources, share the shelves with your family.<br>
  Installable on phones, browsable offline, in English and French.
</p>

<p align="center">
  <a href="#-self-hosting">Self-hosting</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-metadata-sources">Sources</a> ·
  <a href="#-updating">Updating</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## ✨ Features

### Your shelves, beautifully

Books (novels, comics, manga, magazines…), music (vinyl, CD, tape), movies (DVD, Blu-ray, 4K) and video games, each on its own shelf with its own colour. Grid or list, accent-insensitive search, filters (format, genre, saga, tags, language, read / not read, physical or digital copy, owner) and a quick bar to jump between formats.

<p align="center">
  <img src="docs/screenshots/books-desktop.webp" width="72%" alt="The books shelf on desktop">
  <img src="docs/screenshots/books-mobile.webp" width="23%" alt="The books shelf on a phone">
</p>

<details>
<summary><b>More shelves: music, movies, games, list view</b></summary>
<br>
<p align="center">
  <img src="docs/screenshots/music-desktop.webp" width="72%" alt="The music shelf on desktop">
  <img src="docs/screenshots/music-mobile.webp" width="23%" alt="The music shelf on a phone">
</p>
<p align="center">
  <img src="docs/screenshots/movies-desktop.webp" width="72%" alt="The movies shelf on desktop">
  <img src="docs/screenshots/movies-mobile.webp" width="23%" alt="The movies shelf on a phone">
</p>
<p align="center">
  <img src="docs/screenshots/games-desktop.webp" width="72%" alt="The games shelf on desktop">
  <img src="docs/screenshots/games-mobile.webp" width="23%" alt="The games shelf on a phone">
</p>
<p align="center">
  <img src="docs/screenshots/list-desktop.webp" width="72%" alt="The list view on desktop">
  <img src="docs/screenshots/list-mobile.webp" width="23%" alt="The list view on a phone">
</p>
</details>

### Every item, in detail

Author, publisher or label, saga and volume, format, genre, language, release date, condition, read / listened / watched / played, a synopsis from the sources and your own notes. Mark something as a digital copy when you own it but not on the shelf, and add your own **tags** (`#signed`, `#first edition`, `#to lend`…): tap one to see everything that has it.

<p align="center">
  <img src="docs/screenshots/item-desktop.webp" width="72%" alt="An item page on desktop">
  <img src="docs/screenshots/item-mobile.webp" width="23%" alt="An item page on a phone">
</p>

### Adding things, the fast way

Four ways in, one review at the end:

- **📷 Scan a barcode** with the phone's camera (or type it). For books, the ISBN **printed as text** is read too, on the device: handy when the barcode on the back is a shop's, not the ISBN.
- **🔎 Search online** by title, optionally in one language.
- **🤖 Snap a photo** of a cover, or of a whole shelf, and let an AI list what it sees (optional, bring your own provider).
- **✍️ Type it in**, with the sources one click away to complete it.

Every candidate then goes through the same **cherry-picker**: all the sources answer side by side, take a whole result or pick field by field. Collector warns you when you **already own it** (same barcode or ISBN) or **maybe own it** (same title and author, another edition?).

<p align="center">
  <img src="docs/screenshots/scan-desktop.webp" width="72%" alt="The barcode scanner on desktop">
  <img src="docs/screenshots/scan-mobile.webp" width="23%" alt="The barcode scanner on a phone">
</p>
<p align="center">
  <img src="docs/screenshots/add-desktop.webp" width="72%" alt="Choosing how to add an item, on desktop">
  <img src="docs/screenshots/add-mobile.webp" width="23%" alt="Choosing how to add an item, on a phone">
</p>

### Bring your collection in, take it with you

Import the CSV export of **Goodreads**, **The StoryGraph**, **Discogs**, **Letterboxd** or **RAWG**. You see everything before it is saved; duplicates are left unticked, wishlists and to-read shelves are left out. Then let Collector **find the missing covers** in the background.

Your data stays yours: **export** your whole collection as a single `.zip` (every item, with or without the covers), to keep as a backup or to **import into another Collector** server. Every cover in an archive is checked and re-encoded on the way in.

<p align="center">
  <img src="docs/screenshots/import-desktop.webp" width="72%" alt="The import page on desktop">
  <img src="docs/screenshots/import-mobile.webp" width="23%" alt="The import page on a phone">
</p>

### For the whole family

Start a family and invite the other accounts of your server. Everyone sees every shelf, edits only their own items, and gets a colour and an initial on what they own. Your shelves open on your own items; switch to everyone in the filters.

<p align="center">
  <img src="docs/screenshots/filters-desktop.webp" width="72%" alt="The filters on desktop">
  <img src="docs/screenshots/filters-mobile.webp" width="23%" alt="The filters on a phone">
</p>

### An app on your phone

Install it from the browser (Android and desktop: install prompt; iPhone: Share → Add to Home Screen). It opens like an app, keeps you signed in for a year, browses your collection **offline**, and long-pressing its icon goes straight to the scanner. Dark and light themes, English and French.

### Private by design

Your server, your database, your covers. No password to leak: you sign in with a link or a 6-digit code sent by email. API keys you enter are encrypted at rest and never sent back to the browser.

---

## 🏠 Self-hosting

Collector is a single Node.js app (it serves both the interface and the API) backed by PostgreSQL. It needs:

| | |
| --- | --- |
| **Node.js** | 23.6 or later (24 LTS recommended) |
| **PostgreSQL** | 13 or later |
| **An SMTP account** | to send the sign-in emails: your mail provider, a transactional service (Brevo, Mailgun, Postmark…), your host's |
| **A domain with HTTPS** | phones only give websites access to the camera over HTTPS, and the app can only be installed from an HTTPS address |

### 1. Get the code and build it

```bash
git clone https://github.com/myeti/collector.git
cd collector
npm ci
npm run build
```

> Run `npm ci` without `NODE_ENV=production` in the environment: the build tools are development dependencies.

### 2. Create the database

With an existing PostgreSQL server:

```sql
CREATE USER collector WITH PASSWORD 'a-strong-password';
CREATE DATABASE collector OWNER collector;
```

Or in a container:

```bash
docker run -d --name collector-db --restart unless-stopped \
  -e POSTGRES_USER=collector -e POSTGRES_PASSWORD=a-strong-password -e POSTGRES_DB=collector \
  -p 127.0.0.1:5432:5432 -v collector-db:/var/lib/postgresql/data \
  postgres:17-alpine
```

Tables are created on the first start. Collector also enables PostgreSQL's `unaccent` extension so that searching "asterix" finds "Astérix".

### 3. Configure

Copy the example and edit it:

```bash
cp .env.example .env
```

| Variable | |
| --- | --- |
| `PORT` | Port the app listens on, e.g. `3000` |
| `PUBLIC_URL` | The address people open, e.g. `https://collector.example.com` (used in the sign-in emails) |
| `JWT_SECRET` | A long random secret: `openssl rand -base64 48`. It signs sessions **and** encrypts stored API keys: keep it, and keep it secret. Changing it signs everyone out and makes the saved API keys unreadable. |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | PostgreSQL connection |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` | Mail server. Port 465 uses TLS directly, any other port upgrades with STARTTLS. |
| `SMTP_FROM` | Sender of the sign-in emails, e.g. `"Collector <collector@example.com>"` |
| `DATA_DIR` | *Optional.* Where cover images are stored, `./uploads` by default |

All but `DATA_DIR` are required: the server refuses to start without them, or with the example secret.

### 4. Create the accounts

There is no public sign-up: accounts are created from the server.

```bash
npm run create:user -- you@example.com --name "Your name" --locale en
```

`--locale` is `en` or `fr`. Run it again for each member of the household, then build your family from **Settings → Account**.

### 5. Start it

```bash
npm start
```

Open `PUBLIC_URL`, enter your email, and click the link (or type the code) you receive.

To keep it running, a **systemd** service (`/etc/systemd/system/collector.service`):

```ini
[Unit]
Description=Collector
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/collector
ExecStart=/usr/bin/npm start
Restart=on-failure
User=collector

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now collector
```

### 6. Put it behind HTTPS

Any reverse proxy works; run it on the same machine or the same private network (Collector only trusts forwarded client addresses from there). With [Caddy](https://caddyserver.com), certificates included:

```caddy
collector.example.com {
	reverse_proxy localhost:3000
}
```

With nginx, raise the upload size (photos are up to 20 MB, a Collector export with its covers can be much larger):

```nginx
server {
    server_name collector.example.com;
    client_max_body_size 1g;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # listen 443 ssl; + your certificates (certbot --nginx does it for you)
}
```

---

## 🔌 Metadata sources

Collector asks every source that fits at once, and lets you pick. Many work out of the box; add keys in **Settings → Sources** to unlock the others (each user has their own keys).

| | Without a key | With an API key |
| --- | --- | --- |
| **Books** | Open Library, Google Books, MangaDex | ISBNdb, Comic Vine |
| **Music** | MusicBrainz, Deezer, Apple iTunes | Discogs, Spotify, Last.fm |
| **Movies** | | TMDB, OMDb |
| **Games** | | IGDB (via Twitch), RAWG |
| **Any barcode** | UPCitemdb (small daily quota) | Barcode Lookup, Go-UPC |

For movies and games, the best start is a **TMDB** key and a **RAWG** or **IGDB** key: their barcodes are first resolved through the product databases, then searched by title.

<p align="center">
  <img src="docs/screenshots/sources-desktop.webp" width="72%" alt="The sources settings on desktop">
  <img src="docs/screenshots/sources-mobile.webp" width="23%" alt="The sources settings on a phone">
</p>

### AI assistant (optional)

Photo reading (a cover, or a whole shelf at once) needs a model that understands images. In **Settings → Sources → AI assistant**, pick **OpenAI**, **Anthropic**, **Google Gemini**, **Mistral**, or any **OpenAI-compatible** server (OpenRouter, or your own Ollama or LM Studio), then a key and a vision model. Without it, everything else works.

---

## 🔄 Updating

```bash
git pull
npm ci
npm run build
sudo systemctl restart collector
```

The database is upgraded automatically on start. Read the [changelog](CHANGELOG.md) first: when a release asks for something on your side (a renamed setting, say), it says so under **Upgrading**.

After an update, open apps show **"A new version is available · Reload"**.

## 💾 Backups

Each member can download their own collection from **Settings → Import & export → Export**: one `.zip` with every item and its cover, that any Collector server can import.

For the whole server, keep two things: the database and the covers folder.

```bash
pg_dump -U collector -h localhost collector > collector-$(date +%F).sql
tar czf covers-$(date +%F).tgz uploads/     # or your DATA_DIR
```

To restore, load the dump into an empty database (`psql -U collector -h localhost collector < collector-….sql`), put the covers back in place, and start Collector with the **same `JWT_SECRET`**.

---

## 💡 Tips

- **Keyboard**: `/` to search, `1`–`5` to switch shelf, `n` to add. On a phone, swipe left or right on a shelf to change shelf.
- **Moving servers?** Export from the old one, import the `.zip` on the new one (**Import → Collector**): items, covers, read status and notes come along.
- **Hide what you do not collect**: **Settings → Account → Collections** chooses the shelves shown and the one opened first. Hidden shelves keep their items.
- **A pile to add?** After saving a scanned item, **Scan another** goes straight back to the camera.
- **Lost a phone?** **Settings → Sign out of all devices** (under Sign out) ends every session.

## 🩺 Troubleshooting

| | |
| --- | --- |
| **The sign-in email never arrives** | Check the server's logs for "Sign-in email … failed", then your SMTP settings and the spam folder. |
| **The camera does not start on a phone** | The site must be opened over HTTPS, and the browser allowed to use the camera. You can always type the code under the camera. |
| **Importing a Collector export fails at once** | A reverse proxy may refuse large uploads: raise its limit (`client_max_body_size` with nginx). |
| **Covers are missing after an update** | Check that `DATA_DIR` points to the folder holding them (before 0.3.0, the setting was named `UPLOAD_DIR`). |
| **"Missing environment variables" on start** | Every variable of the table above is required, except `DATA_DIR`. |
| **Searching "asterix" does not find "Astérix"** | The database user could not enable `unaccent` (the logs say so on start): run `CREATE EXTENSION unaccent;` in the database as an administrator. |

---

<p align="center">
  <b>Made by Magalon</b>, for the people whose shelves are overflowing.<br>
  Want to help? Read <a href="CONTRIBUTING.md">CONTRIBUTING.md</a>.<br>
  <sub>Released under the <a href="LICENSE">MIT license</a>.</sub>
</p>
