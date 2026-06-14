# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Conferidor de Figurinhas — Copa 2026** is a mobile-first PWA for tracking FIFA World Cup 2026 stickers (figurinhas) during trades. It syncs in real-time via Supabase and works offline in read-only mode.

- **Tech Stack:** Vanilla JavaScript, Supabase, ES Modules, Service Worker, CSS custom properties
- **No build tool** — directly served HTTP with ES Modules via importmap
- **Language:** Portuguese (UI) + Portuguese (docs and comments)

## Running Locally

### Setup
```bash
cp config.example.js config.js
# Edit config.js with your Supabase credentials and PIN hash
```

### Development Server
```bash
python3 -m http.server 8080
# Then visit http://localhost:8080
```

**Note:** Must serve via HTTP (not `file://`) because the app uses ES Modules.

### Generate PIN Hash
```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('YOUR_PIN').digest('hex'))"
```

## Architecture

### File Structure
```
app.js                  # Main app logic, state, UI rendering (30KB)
db.js                   # Supabase abstraction layer (fetch, mark, undo, recents, subscribe)
supabase.js             # Supabase client initialization
config.js               # Credentials and secrets (gitignored)
config.example.js       # Configuration template
style.css               # Styling with CSS custom properties, dark mode
sw.js                   # Service Worker (cache-first strategy)
index.html              # Entry point with PWA meta tags and importmap
manifest.webmanifest    # PWA manifest
icon.svg                # App icon
seed.html / seed.js     # Bootstrap script to initialize Supabase data
data/
  └── figurinhas.js     # Static data: 48 teams with sticker counts
```

### State Management
- **Single source of truth** in `state` object (app.js:77)
- State mutations return new state (immutable pattern)
- Derived values: `filteredTeams`, `totalMissing()`
- LocalStorage for: `fifa26_username`, `fifa26_edit_unlocked`

### Data Flow
1. **Load:** `loadTeams()` → fetch from Supabase → merge with static figurinhas data
2. **Update:** User marks sticker → `markCollected()` → Supabase update
3. **Sync:** `subscribeToChanges()` listener → reload state → re-render
4. **Offline:** Service Worker caches app shell → read-only mode works offline

### Key Abstractions

#### Quick Search (`quickCheck()`)
Regex pattern: `CODE [NUM]` (e.g., `BRA 8`)
- Returns `{ team, num, needed }` or `null`
- Used in quick-search input field for instant feedback

#### PIN Verification (`verifyPin()`)
- User PIN hashed client-side with Web Crypto API
- Compares against `ACCESS_PIN_HASH` from config
- Opens editor mode with profile selection

#### Team Filtering (`searchTeams()`)
- Normalizes accents (NFD + diacritic removal)
- Case-insensitive substring search
- Used in dropdown search for team selection

## Database Schema (Supabase)

**Table: `stickers`**
- `team_code` (text) — Country code (BRA, GER, etc.)
- `number` (int) — Sticker number (1–24)
- `status` (text) — 'faltante' or 'colada'
- `pair_id` (text) — Unique identifier for the album pair (RLS enforced)
- `updated_by` (text) — Who marked it last
- `updated_at` (timestamp) — When it was updated

**RLS Policy:** All queries filtered by `pair_id` (enforced in db.js)

## Deployment

### GitHub Pages
Every push to `main` triggers `.github/workflows/` action → publishes to Pages.

**Required GitHub Secrets:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PAIR_CODE`
- `ACCESS_PIN_HASH`

## Key Features

| Feature | Where | How |
|---------|-------|-----|
| Quick search | app.js:45 | Regex parsing, instant lookup |
| Real-time sync | app.js, db.js:48 | Supabase subscription listener |
| PIN protection | app.js:56, 93 | SHA-256 crypto + stored hash |
| Offline mode | sw.js | Cache-first service worker |
| Dark theme | style.css | CSS custom properties (--color-*, --duration-*) |
| PWA install | index.html | Manifest + apple-touch-icon + meta tags |

## Common Development Tasks

### Adding a New Team
1. Add entry to `data/figurinhas.js` with `code`, `name`, `count`
2. Seed new team data via `seed.html` → Supabase
3. App auto-loads from Supabase

### Updating Styles
- Edit `style.css` directly
- Use CSS custom properties (tokens) defined in `:root`
- Dark mode is default; no light mode fallback

### Testing a Feature Locally
- Open DevTools → Network → Offline to test service worker fallback
- Clear cache in DevTools → Application → Storage → Clear site data
- Edit `sw.js` cache name (e.g., `copa2026-v4`) to force refresh

### Debugging Real-Time Sync
- Open DevTools → Application → Connections → View active subscriptions
- Check Supabase studio for `pair_id` being used
- Verify RLS policies allow the authenticated user

## Service Worker Details

**Strategy:** Cache-first
- App shell (JS, CSS, HTML, icon, manifest) cached on install
- Fetches from cache; falls back to network if unavailable
- Offline mode = read-only (no Supabase writes)

**Cache Invalidation:** Change `CACHE` variable name (e.g., `copa2026-v3` → `copa2026-v4`) and update `SHELL` array if new files added.

## Notes for Future Work

- **Large app.js:** Consider splitting state management and render logic if it exceeds 50 lines of a single function
- **No bundler:** Keeps deployment simple but limits code-splitting options; use dynamic `import()` for large libraries
- **PIN hashing:** Client-side only; never send plaintext PIN over network. Always use HTTPS in production.
- **Offline editing:** Currently disabled (read-only offline); could add IndexedDB queue for offline edits if needed
- **Accessibility:** Keyboard navigation and screen reader labels present; test with real devices
