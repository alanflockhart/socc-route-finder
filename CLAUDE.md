# SOCC Route Finder

Public-facing cycling route finder web app for Swavesey & Over Cycling Club (SOCC). No backend, no login. Displays routes from a Google Sheet on an interactive Leaflet map with filtering, weather forecasts, ride planning, route comparison, and road closure overlays.

## Project Structure

```
index.html                     -- App shell: HTML markup, CDN links, CSS import, module entry point
src/
  styles/style.css             -- All CSS (design tokens, layout, components, responsive)
  js/
    main.js                    -- Orchestrator: imports all modules, wires deps, binds UI listeners, runs init
    config.js                  -- CONFIG object (sheet IDs, API keys, feature flags, column mappings, demo data)
    state.js                   -- Shared mutable state (allRoutes, filteredRoutes, allCafes, weatherData, user prefs)
    utils.js                   -- Pure helpers: escHtml, safe, safeNum, normaliseDir, slugify, normaliseGpxUrl
    api.js                     -- Data fetching (Google Sheets CSV), localStorage cache (1hr TTL), CSV parsing
    filters.js                 -- Filter/sort logic, UI controls init, region dropdown, debounced filtering
    map.js                     -- Master map + per-card maps, GPX overlays, markers, popups, view switching
    cards.js                   -- Route card rendering (grid of expandable cards with stats and badges)
    weather.js                 -- Open-Meteo weather API, 7-day forecast strip, ride planner widget
    closures.js                -- TomTom Traffic API: road closures/roadworks on master + card maps
    compare.js                 -- Side-by-side route comparison (up to 3 routes, elevation chart overlay)
    find-my-ride.js            -- Smart scoring engine: matches routes by distance, time, wind alignment
    __tests__/
      utils.test.js            -- Unit tests for utility functions
      filters.test.js          -- Unit tests for filter logic
      weather.test.js          -- Unit tests for weather module
      state.test.js            -- Unit tests for savePrefs / state persistence
e2e/
  app.spec.js                  -- Playwright E2E tests (app load, navigation, interactions)
gpx/                           -- GPX track files for route overlays on maps
vite.config.js                 -- Vite config: base path, dev server port 3000, test exclusions
package.json                   -- Scripts, devDependencies (Vite, Vitest, Playwright, ESLint, Prettier)
playwright.config.js           -- Playwright config: Chromium, baseURL localhost:3000, auto-starts dev server
.github/workflows/deploy.yml  -- CI/CD: install, unit test, Vite build, deploy to GitHub Pages
.claude/launch.json            -- Claude Code launch config for Vite dev server
```

## Tech Stack

- **Build:** Vite 5 (ES module dev server + production bundler)
- **Language:** Vanilla JavaScript (ES modules, no framework)
- **Styles:** Plain CSS in `src/styles/style.css` (CSS custom properties for design tokens)
- **Data:** Google Sheets published as CSV (no auth, auto-updates on load)
- **Maps:** Leaflet.js 1.9.4 + OpenStreetMap tiles (loaded via CDN in index.html)
- **GPX:** leaflet-gpx 1.7.0 (CDN)
- **Charts:** Chart.js 4.4.0 (CDN, used for elevation profiles)
- **Weather:** Open-Meteo API (free, no key, CORS-enabled)
- **Road closures:** TomTom Traffic Incidents API (free tier, key in config)
- **Unit tests:** Vitest 1 + jsdom
- **E2E tests:** Playwright (Chromium)
- **Lint/Format:** ESLint 8 + Prettier 3
- **Hosting:** GitHub Pages (deployed via GitHub Actions)
- **No backend, no server runtime, no paid services**

## Local Development

```bash
npm install              # Install dev dependencies (first time only)
npm run dev              # Start Vite dev server on http://localhost:3000
npm run build            # Production build to dist/
npm run preview          # Preview production build locally
```

The dev server runs on port 3000 with auto-open and HMR. Do not use `file://` -- the app requires HTTP for fetch() and map tiles.

## Preview and Visual Testing

Use Claude Code's preview tools (`preview_start` / `preview_screenshot` / `preview_snapshot`) to:
- Render the app in a real browser and take screenshots to verify layout
- Use `preview_snapshot` (accessibility tree) to verify text content and element presence
- Use `preview_inspect` to check computed CSS values
- Test at multiple viewports with `preview_resize` (mobile 375x812, tablet 768x1024, desktop 1280x800)

After any UI change, use the preview tools to visually confirm the result before considering the task complete.

## Module Architecture

The app is split into 11 ES modules under `src/js/`. The orchestrator (`main.js`) imports all modules and wires cross-module dependencies.

| Module | Responsibility |
|---|---|
| `main.js` | Orchestrator: imports everything, wires lazy deps, binds DOM event listeners, calls `init()` |
| `config.js` | `CONFIG` object with all tuneable settings; `DEMO_ROUTES` and `DEMO_CAFES` for offline dev |
| `state.js` | Shared mutable state (`allRoutes`, `filteredRoutes`, `allCafes`, `weatherData`, filter `state` object, user prefs persistence) |
| `utils.js` | Pure helpers: `escHtml()`, `safe()`, `safeNum()`, `normaliseDir()`, `slugify()`, `normaliseGpxUrl()`, badge helpers |
| `api.js` | Fetches routes and cafes from Google Sheets CSV, manages localStorage cache (1hr TTL), `dbg()` logger, `parseCSV()` |
| `filters.js` | `applyFilters()` pipeline, `initControls()` for sidebar inputs, region dropdown, range adjusters, debounced filtering, active filter count badge |
| `map.js` | Master map and per-card maps, GPX track rendering, circle markers, cafe markers, popups, view switching, hash-based deep links |
| `cards.js` | Renders the route card grid from `filteredRoutes`, expandable cards with stats, badges, wind alignment |
| `weather.js` | Open-Meteo 7-day forecast, weather strip rendering, ride planner widget, wind alignment scoring |
| `closures.js` | TomTom Traffic API integration, closure/roadwork overlays on master and card maps |
| `compare.js` | Route comparison panel (up to 3 routes), side-by-side stats, overlaid elevation charts (parallel GPX fetch), toast when limit reached |
| `find-my-ride.js` | Smart scoring engine: distance/time/wind preferences, scores and ranks routes, loading state during scoring |

### Lazy-Dependency Wiring Pattern

Several modules have circular dependencies (e.g., `cards.js` needs `map.js` functions but `map.js` rendering triggers `cards.js`). These are resolved via setter functions that `main.js` calls after all imports:

```
setRenderCards(renderCards)      -- weather.js needs to call renderCards from cards.js
setCardDeps(openMapForCard, checkHash)  -- cards.js needs map functions
setMapRefs(getMasterMap, getLeafletMaps) -- closures.js needs map references
```

Each module exports a `set*` function that accepts the dependency as a callback. The module stores it in a local variable and calls it when needed. This avoids import cycles while keeping modules decoupled.

### Window-Exposed Functions

Functions called from dynamically-generated HTML (e.g., Leaflet popup `onclick` attributes) must be on `window`:

```
window.scrollToCard, window.switchView, window.toggleMap,
window.shareRoute, window.toggleCompare, window.resetFilters
```

## Key Config

The `CONFIG` object in `src/js/config.js` controls all tuneable settings:

- `SHEET_ID`, `SHEET_GID`, `CAFES_GID` -- Google Sheets data source identifiers
- `USE_DEMO_DATA: false` -- set `true` for offline dev with hardcoded demo routes
- `SHOW_DEBUG: false` -- set `true` to show diagnostics panel
- `WEATHER_ENABLED: true` -- toggle weather strip and ride planner
- `DEFAULT_RIDE_DAY: 'sunday'` -- highlighted day in weather strip
- `TARGET_DISTANCE: 40` -- default target distance (miles) for ride planner
- `TOMTOM_API_KEY` -- TomTom Traffic API key (free tier)
- `ROAD_CLOSURES_ENABLED: true` -- toggle all TomTom features
- `COLUMN_MAP` -- maps Google Sheet column headers to internal field names

## Testing

### Unit Tests (Vitest)

```bash
npm test              # Run all unit tests once
npm run test:watch    # Watch mode for development
```

Tests live in `src/js/__tests__/` and cover `utils.js`, `filters.js`, `weather.js`, and `state.js` (savePrefs persistence). Uses jsdom for DOM simulation where modules access the DOM at load time.

### E2E Tests (Playwright)

```bash
npm run test:e2e      # Run Playwright tests (auto-starts dev server)
```

Tests live in `e2e/app.spec.js`. Runs against Chromium with the Vite dev server auto-started on port 3000. Configured with 30s timeout, 1 retry, and trace-on-first-retry. Covers: page load, cards, region/type/distance filters, map tab, weather strip, Find My Ride, comparison modal, comparison limit toast, empty state, filter count badge, card map toggle.

### Functional Testing Practices

- After every change, verify the app loads without errors (check browser console via `preview_console_logs`)
- Test the critical path: data fetch -> card rendering -> map markers -> GPX overlay -> popup interaction
- Confirm `USE_DEMO_DATA: true` mode works for offline/isolated testing
- Test with empty/malformed data -- the app must degrade gracefully, never throw to the user

### Cross-Browser and Responsive

- Test at mobile, tablet, and desktop breakpoints using `preview_resize`
- Verify touch targets are at least 44x44px on mobile (WCAG 2.5.8)
- Check that map interactions (pan, zoom, popup) work at all viewport sizes

### Accessibility (WCAG 2.1 AA)

- All interactive elements must be keyboard-navigable
- Images and icons need meaningful `alt` text or `aria-label`
- Colour contrast ratios must meet 4.5:1 for normal text, 3:1 for large text
- Use semantic HTML (`<nav>`, `<main>`, `<button>`) -- not div-with-onclick

## Deployment

**GitHub Actions -> GitHub Pages** (`.github/workflows/deploy.yml`):

1. Triggers on push to `master` or `v2-modernisation`
2. Installs deps (`npm ci`), runs unit tests (`npm test`), builds (`npm run build`)
3. Deploys `dist/` to GitHub Pages

Vite base path is set to `/socc-route-finder/` in `vite.config.js` for correct asset paths on GitHub Pages.

## Architecture Notes

- **Two map layers** (do not collapse): `masterGpxLayer` (bottom, GPX tracks) + `masterMarkerLayer` (top, clickable circle markers)
- **Do not use** `preferCanvas: true` -- breaks z-order hit testing on markers
- Map init uses `requestAnimationFrame` delay -- fixes blank tiles on mobile
- All field values go through `escHtml()` before DOM insertion (XSS prevention)
- localStorage caches: `socc_routes_cache` (1hr TTL), `socc_cafes_cache` (1hr TTL), `socc_weather_cache` (30min TTL), `socc_closures_cache` (30min TTL), `socc_user_prefs` (persistent)
- GPX files load lazily (on card expand / map focus), not all at once

## Conventions

- CSS uses design tokens via custom properties (`--navy`, `--orange`, `--grey-*`)
- External links: always `target="_blank" rel="noopener noreferrer"`
- No cookies, no analytics, no tracking
- Pin CDN library versions in `index.html` (Leaflet 1.9.4, Chart.js 4.4.0, leaflet-gpx 1.7.0)
- HTML structure lives in `index.html`; CSS in `src/styles/style.css`; JS split across `src/js/` modules
- Event listeners are bound in `main.js` via `addEventListener` -- no inline `onclick` in HTML

## Security Standards

### Input Handling (OWASP)

- **All** user-facing data (from CSV, GPX, URL params) must pass through `escHtml()` before DOM insertion -- no exceptions
- Never use `innerHTML` with unsanitised data; prefer `textContent` or sanitised templates
- URL parameters: validate and sanitise before use; reject unexpected keys

### Content Security

- External links always use `target="_blank" rel="noopener noreferrer"` (prevents reverse tabnapping)
- Only load scripts/styles from trusted CDNs already listed in the tech stack
- Do not add inline event handlers (`onclick="..."` in HTML) -- use `addEventListener` in JS

### Data and Privacy

- No cookies, no analytics, no tracking -- this is a hard rule, not a suggestion
- No PII is collected or stored; localStorage holds only route cache data and filter preferences
- Google Sheets data is public/read-only CSV -- never introduce write access or auth tokens

### Dependency Management

- Pin CDN library versions in `index.html`
- npm devDependencies are build/test tools only -- no runtime npm packages
- Before adding any new external dependency, justify it -- prefer vanilla JS solutions

## Code Review Checklist

Before considering any change complete, verify:

1. No new `innerHTML` usage with dynamic data (use `escHtml()` for any external strings)
2. No hardcoded secrets, tokens, or API keys (except TomTom key already in config)
3. `escHtml()` applied to all externally-sourced strings rendered in DOM
4. Console is clean -- no errors or warnings
5. Demo mode (`USE_DEMO_DATA: true`) still functions correctly
6. Unit tests pass (`npm test`)
7. Lazy-dep wiring in `main.js` is updated if new cross-module dependencies are added
8. Window-exposed functions are documented if new ones are added
