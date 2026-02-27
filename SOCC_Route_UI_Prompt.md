# SOCC Route Finder — Build Prompt & Reference Spec
**Last updated:** February 2026 — reflects actual built state of the app

> This is the primary grounding document for AI-assisted development.
> Load this first in any new session (chat or Claude Code) before touching any code.
> Sections marked **⚠️ Differs from original spec** reflect lessons learned during build.

---

## Handover Checklist (start here in a new session)

1. Read this entire document before writing any code
2. The working file is `index.html` — single file, all HTML/CSS/JS inline
3. Run `python3 -m http.server 8080` in the project folder and open `http://localhost:8080`
4. **Never open `index.html` via `file://`** — fetch() and map tiles are blocked
5. For phone testing on same WiFi: use `http://192.168.x.x:8080` (your machine's local IP)
6. Check `CONFIG` block at top of script — two flags control dev/prod behaviour:
   - `USE_DEMO_DATA: false` — set to `true` to use hardcoded demo routes (no network needed)
   - `SHOW_DEBUG: false` — set to `true` to show the debug panel
7. Cache can be cleared via the 🔄 button in the app, or `localStorage.removeItem('socc_routes_cache')` in the browser console

---

## Project Overview

A **public-facing cycling route finder web app** for Swavesey & Over Cycling Club (SOCC), a small
non-profit club based in Cambridgeshire, UK. Entirely free to host and operate. No backend.
No login. Single HTML file.

**Live deployment:** Netlify (drag-and-drop, zero build minutes via `netlify.toml`)

---

## Tech Stack

- **Database:** Google Sheets published as CSV — no auth, auto-updates on page load
- **Frontend:** Single-file `index.html` — all CSS and JS inline, no build step
- **Maps:** Leaflet.js 1.9.4 with OpenStreetMap tiles
- **GPX rendering:** leaflet-gpx 1.7.0 — draws GPX tracks on Leaflet maps
- **Charts:** Chart.js 4.4.0 — elevation profiles on per-card maps
- **Hosting:** Netlify free tier (or GitHub Pages)
- **No backend, no server, no paid services, no API keys**

### CDN dependencies (pinned versions)
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/gpx.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
```

### Published CSV URL format ⚠️ Differs from original spec
Use the `pub` format — more reliable than `gviz/tq`:
```
https://docs.google.com/spreadsheets/d/e/{2PACX_KEY}/pub?gid={GID}&single=true&output=csv
```
The `2PACX_KEY` comes from: File → Share → Publish to web → select tab → CSV → Publish.
It always starts with `2PACX-` and is **different** from the Sheet ID in the address bar.

**Current SOCC values:**
```js
SHEET_ID:  '2PACX-1vQflvwcr6Nf1NVyvv45Jt7YWF3fxZO0ecaN8JwMYU4gQeghoYR7eLmkGS7zfSqdlA8VuiIhkQ4eCAYz'
SHEET_GID: '429694098'
```

---

## CONFIG Block

This lives at the top of the `<script>` tag in `index.html`. Everything configurable is here.

```js
const CONFIG = {
  SHEET_ID:      '2PACX-1v...',    // Published-to-web key (starts with 2PACX-)
  SHEET_NAME:    'Routes',          // Tab name (informational only)
  SHEET_GID:     '429694098',       // gid= from published URL
  USE_DEMO_DATA: false,             // true = 8 hardcoded demo routes, no network request
  SHOW_DEBUG:    false,             // true = show debug panel with fetch/parse diagnostics
  COLUMN_MAP: {
    '':                               'type',            // unnamed 3rd col = Road/MTB
    'ridable':                        'rideable',
    'new routes number':              'route_number',
    'route name':                     'route_name',
    'distance miles':                 'distance_miles',
    'ascent (per garmin)':            'ascent_metres',
    'garmin connect link':            'garmin_link',
    'direction':                      'direction',
    'notes':                          'notes',
    'source':                         'source',
    'busway segment':                 'busway_segment',
    'last ride':                      'last_ridden',
    'debrief':                        'notes_debrief',
    'speed':                          'recommended_speed_mph',
    'time':                           'estimated_time_raw',    // decimal hours — see below
    'time inc 30 minute coffee stop': 'time_with_coffee',
    'roy group':                      'roy_group',
    'comparison':                     'comparison',
    'start_lat':                      'start_lat',
    'start_lon':                      'start_lon',
    'gpx_url':                        'gpx_url',
  }
};
```

---

## Key Constants (in script, near top)

```js
const SWAVESEY = { lat: 52.3553, lon: -0.0170 };
// Club HQ — default start point for routes without start_lat/start_lon
// Used by master map to estimate marker positions from direction + distance

const DIR_BEARING = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
// Converts direction string to bearing degrees for position estimation
```

---

## Data Schema ⚠️ Differs from original spec

### Actual sheet columns → internal field names
See COLUMN_MAP above for full mapping. Key quirks:

| Issue | Detail |
|---|---|
| **Type column** | Unnamed 3rd column (empty header) — contains `Road` or `MTB`, not Gravel |
| **Rideable** | Column is `Ridable` (one 'e'). Values: blank/YES=show, NO/?Check cafe=hide |
| **Time** | Stored as decimal hours (e.g. `1.746`). App converts to `"1 h 45 min"` at parse time |
| **Busway** | Values are `YES` or `n`/blank — not TRUE/FALSE as originally specced |
| **Direction** | Lowercase in sheet (`nw`, `s/sw`). App normalises via `normaliseDir()` |
| **start_lat/lon** | Not yet in sheet. App estimates position from direction+distance until added |
| **gpx_url** | Not yet in sheet. Add column when GPX files are hosted |

### Rideable logic
- blank → ✅ show (default assumption is rideable)
- `YES` / `yes` / `true` → ✅ show
- `NO` / `no` / `false` / `?Check cafe` / anything unexpected → ❌ hide

### Time column conversion
Sheet stores decimal hours. Converted at parse time:
```js
// 1.746 → "1 h 45 min"
const h = Math.floor(dh);
const m = Math.round((dh - h) * 60);
obj.estimated_time = m > 0 ? `${h} h ${m} min` : `${h} h`;
```

---

## Robustness Helpers — always use these, never raw field values

```js
safe(v)          // Returns trimmed string — never crashes on null/undefined/number/boolean
safeNum(v)       // Returns number or 0 — never NaN
normaliseDir(d)  // Uppercase + trim + split compound (s/sw → S)
escHtml(s)       // HTML-encodes string for safe DOM insertion — prevents XSS
slugify(s)       // Converts route name to URL-safe ID (used for scroll-to-card)
```

---

## Architecture — Master Map

Two-layer system (important — do not collapse into one layer):
```
masterGpxLayer    — L.layerGroup, added FIRST (bottom z-order) — GPX track polylines
masterMarkerLayer — L.layerGroup, added SECOND (top z-order)   — clickable circle markers
```

**Why two layers matter:** GPX tracks must sit below circle markers in the SVG stack so
clicks reach the markers. `preferCanvas: true` must NOT be used — canvas mode ignores
z-order for hit testing. Both layers are cleared and markers re-added on every `applyFilters()`
call so the map always reflects the current filter state.

### GPX colour palette (10 colours, rotated by route index)
```js
const GPX_PALETTE = [
  '#e8621a', // orange
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#dc2626', // red
  '#0891b2', // cyan
  '#d97706', // amber
  '#be185d', // pink
  '#059669', // emerald
  '#7c3aed', // violet
];
const gpxColour = GPX_PALETTE[idx % GPX_PALETTE.length];
```

### Click-to-card flow
1. User clicks circle marker on master map
2. `marker.on('click')` fires → opens popup
3. Popup contains "View full details →" button
4. Button calls `window.scrollToCard(slug)` — **must be on `window`**, Leaflet popup
   onclick strings run in a detached context and cannot reach module-scoped functions
5. `scrollToCard` calls `switchView('list')` then scrolls to `#route-{slug}` with highlight

```js
// These MUST be exposed on window for popup onclick strings to reach them
window.scrollToCard = scrollToCard;
window.switchView   = switchView;
```

### Map initialisation (important for mobile)
Map creation is deferred with `requestAnimationFrame` to guarantee the container has painted
before Leaflet measures it — fixes blank tile issue when switching from hidden to visible panel:
```js
await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
masterMapInstance = L.map(mapEl);  // No preferCanvas
```

---

## UI Layout

### Desktop
- Filter sidebar (280px fixed left) + content area (flex 1 right)
- Content area has two tab views: 📋 List | 🗺️ Map
- Tab state controlled by `currentView` variable and CSS `.active` class

### Mobile
- Sidebar collapses — toggle button reveals filter drawer
- Map height: `calc(100vh - 220px)`, minimum 420px
- Circle markers minimum 10px radius for tap target size

### Filter state object
```js
const state = {
  type: 'all',        // 'all' | 'Road' | 'MTB' | 'Gravel'
  distMin: 0,
  distMax: 160,
  ascentMin: 0,
  ascentMax: 2500,
  dirs: Set,          // all 8 directions checked by default
  cafe: false,
  busway: false,
  sort: 'name'
};
```

---

## Caching

- `localStorage` key: `socc_routes_cache`
- TTL: 1 hour
- Stores: `{ data: [...], timestamp: epoch_ms }`
- Manual clear: 🔄 Refresh route data button in sidebar

**⚠️ Remove before production:** There is a `localStorage.removeItem(CACHE_KEY)` call at the
top of the init sequence that force-clears cache on every page load. This is for development
convenience — remove it once the app is stable.

---

## Debug Panel

Controlled by `CONFIG.SHOW_DEBUG`. When `true`:
- Orange-bordered panel appears below the header
- Shows each step of fetch → parse → filter with ✓/✗ indicators
- Shows column mapping results, row counts, cache hits
- Has a ✕ Hide button to dismiss for the session

When `false` (default/production): panel is `display:none`, `dbg()` returns immediately.
Zero performance cost.

---

## Deployment

### Netlify (recommended — zero build credits)
Add `netlify.toml` to project root:
```toml
[build]
  publish = "."
  command = ""
```
Then drag `index.html` (and `netlify.toml`) to `app.netlify.com/drop`.
Empty `command` = no build process = 0 build minutes used.

### GitHub Pages
Upload `index.html` to repo root → Settings → Pages → Deploy from branch → main → / (root)

---

## Local Development

```bash
# Serve the file over HTTP (required — file:// blocks fetch and map tiles)
python3 -m http.server 8080

# Then open:
http://localhost:8080

# Phone on same WiFi:
http://192.168.x.x:8080   # replace with your machine's LAN IP
```

---

## Browser Debugging (Claude in Chrome extension)

The **Claude in Chrome** extension connects a browser tab to Claude, enabling:
- Direct inspection of the live page
- Reading browser console errors in real time
- Clicking elements and observing behaviour
- Much faster debugging than screenshot → describe → guess → fix cycles

**Works with:** Claude.ai chat interface
**Does not work with:** Claude Code CLI (different product, no extension integration)

For debugging in Claude Code, use `console.log` statements and share the browser console
output manually, or use the built-in `SHOW_DEBUG` panel.

---

## Security

- All field values go through `escHtml()` before DOM insertion — XSS prevention
- `safe()` prevents type coercion from unexpected data types
- All external links: `target="_blank" rel="noopener noreferrer"`
- No cookies, no analytics, no tracking, no GDPR implications
- Sheet is publicly readable — never store member personal data in it

---

## Known Issues / TODO

| Item | Priority | Notes |
|---|---|---|
| GPX track lines not clickable | 🔴 Active issue | Circle markers work correctly — clicking them opens the popup and links to the card. But the GPX track polylines drawn on the map are not interactive. Clicking the coloured route line should also open the same popup/link-to-card as the circle marker. Fix: add a click handler to each GPX layer on load that calls the same popup logic as the circle marker for that route. |
| start_lat / start_lon not in sheet | 🟡 Soon | Master map shows estimated positions. Add columns to sheet — app picks up automatically |
| gpx_url not in sheet | 🟡 Soon | Add column when GPX files are hosted. Column is already in COLUMN_MAP |
| Debug force-clear cache | 🟡 Before production | Remove `localStorage.removeItem(CACHE_KEY)` from init() |
| Debug panel in HTML | 🟡 Before production | Remove `id="debugPanel"` block or leave gated by `SHOW_DEBUG` |
| Roy Group not surfaced | 🟢 Nice to have | Parsed but not shown. Could be a difficulty filter |
| Debrief not shown | 🟢 Nice to have | Parsed into `notes_debrief` but not displayed on cards |
| Route photos | 🟢 Nice to have | Add `photo_url` column — would improve card visuals |
| Print view | 🟢 Nice to have | Single-route print-friendly summary (original stretch goal) |

---

## Design Tokens

```css
--navy:     #1a2e4a;
--orange:   #e8621a;
--grey-100: #f8f9fa;
--grey-200: #e9ecef;
--grey-400: #adb5bd;
--grey-600: #6c757d;
```

Distance badge colours: green `#22a05a` (<25mi) · amber `#d97706` (25–40mi) · red `#dc2626` (>40mi)

---

## Changelog

| Version | Changes |
|---------|---------|
| 1.0 | Initial build — card list, filters, inline maps, elevation charts |
| 1.1 | Switched to 2PACX- published CSV URL format |
| 1.2 | localStorage cache (1hr TTL), Refresh button |
| 1.3 | COLUMN_MAP — maps real sheet headers to internal field names |
| 1.4 | Boolean parsing for YES/NO/blank; busway YES/n normalisation |
| 1.5 | safe() / safeNum() / normaliseDir() robustness helpers |
| 1.6 | Time column: decimal hours → readable string; MTB type; sliders to 160mi/2500m |
| 1.7 | Rideable logic: blank=show, NO=hide; file:// CORS detection in debug panel |
| 1.8 | Master map view — filtered routes on single Leaflet map, GPX track overlay |
| 1.9 | SHOW_DEBUG flag; GPX 10-colour palette; two-layer z-order fix for click-to-card; removed preferCanvas |
