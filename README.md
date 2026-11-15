# Icarus Interactive Map

Personal local map for **ICARUS** (Olympus first). Catalog locations and tiles run offline; your markers, found checks, ore tags, and comments save to a JSON file on disk. No ads.

Built with Vite, React, TypeScript, and MapLibre GL.

## Features

- **Olympus map** with local tiles (zooms 8–13) and original MapGenie-style category icons
- **A–P / 1–16 grid** overlays with cell labels
- **Filters**: category visibility, hide found, search, advanced deep-ore filter
- **Pin popups** for catalog locations and custom markers (auto-place so they stay on screen)
- **Profiles**
  - **Base** — browse-only catalog; filters stay in the session and are not saved
  - **Named profiles** — save found state, deep-ore rolls, comments, and custom markers
- **Custom markers** with type presets (Note, Outpost, Cache, Hazard, Crop plot, Waypoint, Deep drill, Ore spot, Predator, Generator), color, title, and comments
- **Comments** on catalog pins and custom markers
- **Place marker** button or `M` shortcut — pin cursor, click to drop, then pick options (`Esc` cancels)
- Routes: `/` games → `/icarus` worlds → `/icarus/olympus` map

## Requirements

- Node.js 20+ recommended
- Local tiles under `public/tiles/` and icons under `public/icons/` (see Import below)

## Setup

```bash
npm install
npm run import:icons   # if icons are not present yet
npm run import:tiles   # downloads Olympus tiles (large; needs network)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Local (`npm run dev`)

Profiles save through a Vite middleware at `/api/user/:gameId` into `data/user/<game>.json`.

### Cloudflare Pages / static hosts

There is no file API on Cloudflare Pages. The app **falls back to `localStorage`** in that browser — markers, found checks, ores, and comments still work. They stay on that device/browser (not synced across machines).

```bash
npm run build
# deploy the `dist/` folder to Cloudflare Pages
```

Build settings typically: framework Vite, build `npm run build`, output `dist`.

## Profiles and persistence

User data lives in `data/user/<gameId>.json` (for example `data/user/icarus.json`).

The Vite dev server exposes:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/user/:gameId` | Load file (creates empty Base profile if missing) |
| `PUT` | `/api/user/:gameId` | Save with revision check (409 on conflict) |

Each named profile stores per-map state:

- `found` — location ids marked found
- `hiddenCategoryIds` / `hideFound` — filter preferences
- `ores` — deep mining location → rolled ore id
- `comments` — catalog location → your note
- `markers` — custom pins (title, notes, color, kind, coordinates)

## Marker types

| Label | Use |
|-------|-----|
| Note | General reminder |
| Outpost | Base / shelter |
| Cache | Loot stash |
| Hazard | Danger / trap |
| Crop plot | Farming |
| Waypoint | Navigation |
| Deep drill | Drill / exotic mining |
| Ore spot | Resource node |
| Predator | Wildlife threat |
| Generator | Power |

## Project layout

```
src/
  App.tsx                 Routing + map shell
  catalog/                Game registry + Olympus JSON + ores
  map/                    MapLibre canvas, grid, pin popups
  sidebar/                Filters, search, categories
  profiles/               Profile create / switch / delete
  state/userData.ts       Load / debounce-save API client
  home/                   Game and world pickers
public/
  tiles/                  Local map tiles (often gitignored)
  icons/                  Marker glyphs / atlas slices
data/
  user/                   Saved profile JSON
scripts/
  normalize-mapgenie.mjs  Catalog normalize
  slice-icons.mjs         Icon import
  download-tiles.mjs      Tile download
```

## Import scripts

```bash
npm run normalize      # Normalize MapGenie extract into catalog JSON
npm run import:icons   # Slice marker atlas into public/icons
npm run import:tiles   # Download Olympus tiles into public/tiles
```

Tiles and raw extracts can be large; keep them out of git if you prefer (see `.gitignore`).

## Keyboard

| Key | Action |
|-----|--------|
| `M` | Toggle place-marker mode (named profile) |
| `Esc` | Cancel placing / close draft marker |

## Notes

- This is a personal offline helper, not an official ICARUS or MapGenie product.
- Catalog content and icons originate from a MapGenie-style extract for personal use.
- Adding another world later: drop a catalog JSON under `src/catalog/games/`, register it in `registry.ts`, and import matching tiles/icons.
