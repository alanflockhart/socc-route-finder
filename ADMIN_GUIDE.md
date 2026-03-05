# SOCC Route Finder — Admin Guide

Everything you need to maintain, configure, and extend the app.

---

## Architecture Overview

The entire application is a **single HTML file** (`index.html`) — all CSS and JavaScript are inline. There is no build step, no backend server, and no database.

| Component | Technology | Notes |
|-----------|-----------|-------|
| Frontend | Single `index.html` | All HTML + CSS + JS inline |
| Route data | Google Sheets → CSV | Auto-fetched on page load, cached 1 hour |
| Maps | Leaflet.js 1.9.4 | OpenStreetMap tiles (free, no key) |
| GPX tracks | leaflet-gpx 1.7.0 | Renders route overlays on maps |
| Elevation charts | Chart.js 4.4.0 | Built from GPX elevation data |
| Weather | Open-Meteo API | Free, no key, cached 30 min |
| Road closures | TomTom Traffic API | Free tier (2,500 req/day), needs API key |
| Hosting | Netlify | Free tier, zero build, deploys from GitHub |

---

## CONFIG Reference

All tuneable settings are in the `CONFIG` object at the top of the `<script>` block in `index.html` (around line 2152). Every parameter is documented inline in the code.

### Google Sheets Connection

| Parameter | What it does | How to find the value |
|-----------|-------------|----------------------|
| `SHEET_ID` | Identifies the published Google Sheet | Open your sheet → File → Share → Publish to the web → select CSV → copy the long ID between `/e/` and `/pub` in the URL |
| `SHEET_GID` | Tab ID for the Routes tab | Look at the `gid=` parameter in the sheet URL when you have the Routes tab selected |
| `CAFES_GID` | Tab ID for the Cafes tab | Same — switch to the Cafes tab and copy the `gid=` value |

**Important:** The sheet must be **published** (File → Share → Publish to the web), not just shared. Publishing generates a public CSV URL that the app fetches without authentication.

### Feature Toggles

| Parameter | Default | Effect |
|-----------|---------|--------|
| `USE_DEMO_DATA` | `false` | `true` = ignore the Google Sheet and show hardcoded demo routes. Useful for offline development or testing without internet. |
| `SHOW_DEBUG` | `false` | `true` = show a diagnostics panel at the bottom of the page with fetch timing, cache status, and data counts. |
| `WEATHER_ENABLED` | `true` | `false` = completely hide the weather strip and ride planner. No Open-Meteo API calls are made. |
| `ROAD_CLOSURES_ENABLED` | `true` | `false` = disable all TomTom features. No API calls made, no closure/roadwork icons shown anywhere. |

### Ride Planner

| Parameter | Default | Effect |
|-----------|---------|--------|
| `DEFAULT_RIDE_DAY` | `'sunday'` | Which day of the week is highlighted as the club ride day. Change to any lowercase day name (e.g. `'saturday'`). |
| `TARGET_DISTANCE` | `40` | Default position of the "target distance" slider in miles. Routes closest to this distance score highest in the ride planner. |

### TomTom API Key

| Parameter | Default | Notes |
|-----------|---------|-------|
| `TOMTOM_API_KEY` | *(current key)* | Free tier allows 2,500 requests/day. Sign up at [developer.tomtom.com](https://developer.tomtom.com) to get your own key. If the key expires or quota is exceeded, closures/roadworks silently stop loading — the app continues working. |

---

## Google Sheets — How to Update Routes

### Routes Tab

The Routes tab is the primary data source. Each row is one route. The column headers (case-insensitive) map to internal fields via `CONFIG.COLUMN_MAP`.

#### Required Columns

| Sheet Column Header | Internal Field | Description |
|--------------------|---------------|-------------|
| `Route Name` | `route_name` | Display name, e.g. "Johnson's Old Hurst" |
| `Type` | `type` | Must be one of: `Road`, `MTB`, `Gravel` |
| `Distance Miles` | `distance_miles` | Numeric, e.g. `27.07` |
| `Direction` | `direction` | Compass direction from HQ: `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW` |

#### Recommended Columns

| Sheet Column Header | Internal Field | Description |
|--------------------|---------------|-------------|
| `Ascent (per Garmin)` | `ascent_metres` | Total climbing in metres |
| `New Routes Number` | `route_number` | Numeric ID shown on cards, e.g. `27` |
| `Garmin Connect Link` | `garmin_link` | Full URL to the route on Garmin Connect |
| `gpx_url` | `gpx_url` | **Full URL** to the GPX file (see GPX Files section below) |
| `start_lat` | `start_lat` | Start point latitude in decimal degrees, e.g. `52.3063` |
| `start_long` | `start_lon` | Start point longitude, e.g. `-0.0005` |
| `Ridable` | `rideable` | `yes` / `no` / blank — `no` hides the route from the app |
| `Speed` | `recommended_speed_mph` | Suggested average speed in mph |
| `Time` | `estimated_time_raw` | Ride time in decimal hours, e.g. `1.746` (auto-converted to "1 h 45 min") |
| `Time inc 30 minute coffee stop` | `time_with_coffee` | Pre-formatted time string |
| `Busway Segment` | `busway_segment` | `yes` / `no` — marks routes using the guided busway |
| `Last Ride` | `last_ridden` | Date text, e.g. "10 Jan" |

#### Optional Columns

| Sheet Column Header | Internal Field | Description |
|--------------------|---------------|-------------|
| `Roy Group` | `roy_group` | Route author or group |
| `Debrief` | `notes_debrief` | Post-ride notes |
| `Notes` | `notes` | General notes |
| `Source` | `source` | Who created the route |
| `Comparison` | `comparison` | Comparison notes vs similar routes |

**Adding new columns:** Any column header not listed in `COLUMN_MAP` passes through to the route object as-is (lowercased). For example, if you add a column called `difficulty` in the sheet, it becomes `route.difficulty` in the code automatically.

### Cafes Tab

Each row is one cafe stop. Column mapping is defined in `CONFIG.CAFE_COLUMN_MAP`.

| Sheet Column Header | Internal Field | Description |
|--------------------|---------------|-------------|
| `N1` | `route_ref` | Route number this cafe is on |
| `Name` | `cafe_name` | Cafe display name |
| `Village` | `village` | Village/town |
| `Lat` | `lat` | Latitude (decimal degrees) |
| `Long` | `lon` | Longitude (decimal degrees) |
| `Rating` | `rating` | Star rating |
| `Sunday Opening Time` | `sunday_hours` | Sunday opening hours |
| `Saturday` | `saturday_hours` | Saturday opening hours |
| `Website` | `website` | Full URL |
| `Notes` | `notes` | Extra info |

### After Updating the Sheet

Changes appear automatically on next page load (or after the 1-hour cache expires). To force an immediate refresh, users can click the **"Refresh data"** button in the app.

---

## GPX Files

GPX files provide the route tracks for map overlays, elevation profiles, and downloads.

### File Location

GPX files live in the `/gpx/` folder in the repository. They are served as static files by Netlify.

### Naming Convention

```
gpx/COURSE_{garmin_id}-{RouteName}({distance}).gpx
```

Examples:
- `COURSE_417699358_JohnsonsOldHurst(27).gpx`
- `COURSE_334349971-Platform1Clare(83).gpx`

The filename doesn't matter to the app — only the URL in the Google Sheet matters.

### Adding a New GPX File

1. **Export from Garmin Connect** — download the `.gpx` file for the route.
2. **Add to the repository** — place the file in the `gpx/` folder.
3. **Commit and push** to both `master` and `v2` branches.
4. **Update the Google Sheet** — in the `gpx_url` column for that route, enter the full URL:
   ```
   https://socc-route-finder.netlify.app/gpx/COURSE_12345-RouteName(50).gpx
   ```
5. The app picks up the new GPX on next data refresh.

### What GPX Enables

When a route has a `gpx_url`, the app provides:
- Route track drawn on master map and card map
- Elevation profile chart
- GPX download button
- Road closure proximity detection on card maps
- Route comparison overlay charts

Without a `gpx_url`, the route still appears as a card and map marker — just without the track overlay or elevation data.

---

## Caching

The app uses `localStorage` to avoid hammering external APIs on every page load.

| Cache | Key | TTL | What it stores |
|-------|-----|-----|---------------|
| Routes | `socc_routes_cache` | 1 hour | Parsed route data from Google Sheets |
| Cafes | `socc_cafes_cache` | 1 hour | Parsed cafe data from Google Sheets |
| Weather | `socc_weather_cache` | 30 min | 7-day forecast from Open-Meteo |
| Prefs | `socc_user_prefs` | Permanent | User filter settings and target distance |
| Closures | In-memory only | 30 min | TomTom road incident data |

Users can clear the route/cafe cache by clicking **"Refresh data"** in the app. Preference clearing is handled by the **"Reset all filters"** button.

---

## Deployment

The app is hosted on **Netlify** (free tier). It deploys automatically from the GitHub repository.

| Setting | Value |
|---------|-------|
| Repository | `github.com/alanflockhart/socc-route-finder` |
| Production branch | `master` |
| Build command | None — no build step needed |
| Publish directory | `/` (root) |

### Deploying Changes

1. Push to `master` for production.
2. Netlify deploys automatically within ~30 seconds.

---

## Local Development

The app must be served over HTTP — `file://` blocks `fetch()` and map tiles.

```bash
# Python (most systems)
python3 -m http.server 8080

# Then open http://localhost:8080
```

### Development Mode

Set `USE_DEMO_DATA: true` in CONFIG to work offline with hardcoded demo routes (no Google Sheet fetch needed).

Set `SHOW_DEBUG: true` to see the diagnostics panel showing fetch timing, cache age, route count, and data parsing details.

---

## Key Constants & Internals

These are defined in the JavaScript but outside CONFIG. Change with care.

| Constant | Location | Purpose |
|----------|----------|---------|
| `SWAVESEY` | ~line 4362 | Club HQ coordinates `{lat: 52.3063, lon: -0.0004}`. Master map centres here. All direction/distance calculations reference this point. |
| `CACHE_TTL` | ~line 2688 | Route data cache lifetime: `60 * 60 * 1000` (1 hour) |
| `WEATHER_CACHE_TTL` | ~line 2356 | Weather cache lifetime: `30 * 60 * 1000` (30 minutes) |
| `CLOSURE_CACHE_TTL` | ~line 2479 | Road closure cache lifetime: `30 * 60 * 1000` (30 minutes) |
| `GPX_PALETTE` | ~line 4556 | Array of 10 colours used to distinguish GPX routes on the master map |
| `WMO_CODES` | ~line 2359 | Maps weather codes to emoji icons and descriptions |

---

## Security Notes

- **No API keys are secret** — the TomTom key is a free-tier key visible in client-side code. It has no access to sensitive data.
- **All external data is sanitised** — the `escHtml()` function is applied to all CSV/GPX/URL data before DOM insertion.
- **No cookies, no analytics, no tracking** — by design, the app collects nothing.
- **No backend** — there is no server to compromise. All data flows are read-only.
- **External links** use `target="_blank" rel="noopener noreferrer"` to prevent reverse tabnapping.

---

## Future Considerations

- **Adding new external APIs** — the architecture supports it. Follow the existing pattern: fetch → cache → render. Add a CONFIG toggle so it can be disabled.
- **Splitting the file** — the single-file approach is intentional (simple hosting, no build step). Only split if the file becomes genuinely hard to navigate (currently ~4,900 lines).
- **New route types** — add a new type value in the Google Sheet (e.g. `Gravel`). The app dynamically creates filter buttons from the data — no code change needed.
- **Moving the HQ** — update the `SWAVESEY` constant and the weather API coordinates in `fetchWeather()`.
- **Replacing TomTom** — if the free tier runs out, set `ROAD_CLOSURES_ENABLED: false` to disable it cleanly. The rest of the app is unaffected.
