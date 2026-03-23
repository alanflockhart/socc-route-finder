# Contributing to SOCC Route Finder

Developer onboarding guide for the v2 modular codebase.

---

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (ships with Node.js)
- Git

---

## Getting Started

```bash
git clone <repo-url>
cd socc-route-finder
git checkout v2-modernisation
npm install
npm run dev
```

Vite starts a dev server on **http://localhost:3000** and opens your browser automatically. Hot module replacement is active -- save a file and the browser updates instantly.

> **Note:** Do not open `index.html` directly via `file://`. Fetch requests and map tiles require HTTP.

---

## Architecture Overview

### Entry Point

`index.html` loads `src/js/main.js` as an ES module (`<script type="module">`). There is no framework -- everything is vanilla JS with ES module imports.

### main.js -- The Orchestrator

`main.js` does three things:

1. **Imports all modules** and wires cross-module dependencies
2. **Binds UI event listeners** to DOM elements (replacing inline `onclick` handlers)
3. **Runs `init()`** which fetches data in parallel, populates state, and triggers the first render

### Module Dependency Diagram

```
main.js
  |-- config.js        (CONFIG constants)
  |-- state.js         (shared mutable state)
  |-- api.js           (data fetching, caching, debug logging)
  |-- utils.js         (pure helper functions)
  |-- filters.js       (filter/sort logic, UI controls)
  |   |-- cards.js
  |   |-- map.js
  |   |-- weather.js
  |   +-- closures.js
  |-- cards.js          (route card rendering)
  |   |-- weather.js
  |   +-- state.js
  |-- map.js            (Leaflet map logic)
  |   +-- closures.js
  |-- weather.js        (Open-Meteo weather data)
  |-- closures.js       (TomTom road closures)
  |-- compare.js        (route comparison panel)
  |   +-- weather.js
  +-- find-my-ride.js   (smart ride scoring engine)
      +-- weather.js
```

### Lazy Dependency Pattern

Several modules have circular import relationships (e.g., `cards.js` needs `map.js` functions, and `map.js` needs to trigger card rendering). These are resolved with setter functions:

- **`setRenderCards(fn)`** -- weather.js receives a reference to `renderCards` from cards.js
- **`setCardDeps(openMapForCard, checkHash)`** -- cards.js receives map functions it needs
- **`setMapRefs(getMasterMap, getLeafletMaps)`** -- closures.js receives map accessors

`main.js` calls all three setters at startup, before `init()` runs. This avoids circular import issues while keeping modules independently testable.

### window.* Assignments

Some functions must be callable from dynamically-generated HTML (e.g., Leaflet popup `onclick` attributes). These are explicitly assigned to `window` in `main.js`:

```
window.scrollToCard, window.switchView, window.toggleMap,
window.shareRoute, window.toggleCompare, window.resetFilters
```

If you add a new function that needs to be called from dynamic HTML, assign it to `window` in `main.js` and document why.

---

## Module Reference

| Module | Responsibility |
|---|---|
| `config.js` | All tuneable settings: Sheet IDs, API keys, feature flags, demo data |
| `state.js` | Shared mutable state containers (`allRoutes`, `filteredRoutes`, `weatherData`, etc.) and their setters |
| `utils.js` | Pure utility functions: `escHtml()`, `safe()`, `safeNum()`, `normaliseDir()`, `slugify()` |
| `api.js` | Fetches route and cafe data from Google Sheets CSV, manages localStorage cache, debug logging |
| `filters.js` | Filter controls (distance, ascent, direction, region, type), sorting, `applyFilters()` orchestration, and active filter count badge |
| `cards.js` | Renders the route card grid, card expand/collapse, per-card map and elevation chart |
| `map.js` | Master overview map, per-card Leaflet maps, GPX track rendering, marker layers, view switching |
| `weather.js` | Open-Meteo API integration, weather strip, ride planner, wind alignment scoring |
| `closures.js` | TomTom Traffic API integration, road closure/roadwork overlays on maps |
| `compare.js` | Side-by-side route comparison panel (up to 3 routes); shows toast when limit reached; GPX elevation profiles fetched in parallel |
| `find-my-ride.js` | Smart scoring engine that recommends routes based on distance, time, and weather preferences; shows loading state during scoring |

---

## Data Flow

### Routes (core path)

```
Google Sheets (published CSV)
  --> fetchRoutes()          [api.js, cached 1hr in localStorage]
  --> setAllRoutes()         [state.js]
  --> applyFilters()         [filters.js]
  --> setFilteredRoutes()    [state.js]
  --> renderCards()          [cards.js]
  --> refreshMasterMap()     [map.js]
```

### Weather

```
Open-Meteo API (free, no key)
  --> fetchWeather()         [weather.js, cached 30min]
  --> setWeatherData()       [state.js]
  --> renderWeatherStrip()   [weather.js]
  --> renderRidePlanner()    [weather.js]
```

### Road Closures

```
TomTom Traffic API (requires API key in config)
  --> loadMapClosures()      [closures.js, cached 30min]
  --> closure/roadwork layers added to master map
```

### Caching

| Data | Cache Key | TTL |
|---|---|---|
| Routes | `socc_routes_cache` | 1 hour |
| Cafes | `socc_cafes_cache` | 1 hour |
| Weather | `socc_weather_cache` | 30 minutes |
| User preferences | `socc_prefs` | Persistent (no expiry) |

---

## Testing

### Unit Tests (Vitest)

```bash
npm test              # single run
npm run test:watch    # watch mode
```

Tests live in `src/js/__tests__/`. Current test files:

- `utils.test.js` -- pure utility functions
- `filters.test.js` -- filter and sort logic
- `weather.test.js` -- weather data processing
- `state.test.js` -- savePrefs serialisation and state persistence (uses `// @vitest-environment jsdom` since state.js imports config.js which accesses the DOM at load time)

**Adding a new unit test:** Create `src/js/__tests__/<module>.test.js`. Vitest auto-discovers files matching `*.test.js`. Import functions directly from the module under test.

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

Tests live in `e2e/`. Playwright automatically starts the Vite dev server on port 3000 before running tests. The test suite runs in Chromium.

- `app.spec.js` -- end-to-end application tests

**Adding a new E2E test:** Create a `*.spec.js` file in `e2e/`. Use `page.goto('/')` as the base URL is preconfigured to `http://localhost:3000`.

### Running Tests in CI

The GitHub Actions pipeline runs unit tests automatically on every push. E2E tests are not currently in the CI pipeline -- run them locally before pushing significant UI changes.

---

## Build and Deployment

### Local Build

```bash
npm run build
```

Outputs to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

### CI/CD Pipeline (GitHub Actions)

Pushes to `v2-modernisation` or `master` trigger the deploy workflow (`.github/workflows/deploy.yml`):

```
npm ci --> npm test --> npm run build --> deploy to GitHub Pages
```

### Base Path

The app is deployed under `/socc-route-finder/` (configured in `vite.config.js`). All asset references in production use this prefix. You do not need to worry about this during local development -- Vite handles it automatically.

---

## Code Conventions

### Security

- **All external data** (CSV fields, GPX content, URL params) must pass through `escHtml()` before DOM insertion. No exceptions.
- Never use `innerHTML` with unsanitised data. Use `textContent` or sanitised template strings.
- External links always use `target="_blank" rel="noopener noreferrer"`.

### Privacy

- No cookies, no analytics, no tracking. This is a hard rule.
- No PII is collected or stored. localStorage holds only route cache data and user filter preferences.

### Styling

- CSS custom properties for theming: `--teal`, `--navy`, `--orange`, `--grey-100` through `--grey-900`.
- Responsive breakpoints are handled in the `<style>` block of `index.html`.

### Dependencies

- Pin CDN library versions (Leaflet 1.9.4, Chart.js 4.4.0, leaflet-gpx 1.7.0).
- Justify any new external dependency before adding it. Prefer vanilla JS.

### Code Review Checklist

Before submitting a PR, verify:

1. No new `innerHTML` usage with unsanitised dynamic data
2. No hardcoded secrets, tokens, or API keys
3. `escHtml()` applied to all externally-sourced strings rendered in DOM
4. Browser console is clean -- no errors or warnings
5. `npm test` passes
6. Demo mode (`USE_DEMO_DATA: true` in config.js) still works
