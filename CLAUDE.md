# SOCC Route Finder

Public-facing cycling route finder web app for Swavesey & Over Cycling Club (SOCC). No backend, no login, single HTML file.

## Project Structure

```
index.html              — Entire app: HTML + CSS + JS inline (single-file architecture)
SOCC_Route_UI_Prompt.md — Detailed build spec & reference (read this for deep context)
gpx/                    — GPX track files for route overlays on maps
files.zip               — Archived source files
netlify.toml            — Deployment config (if present)
```

## Tech Stack

- **Frontend:** Single `index.html` — all CSS and JS inline, no build step, no framework
- **Data:** Google Sheets published as CSV (no auth, auto-updates on load)
- **Maps:** Leaflet.js 1.9.4 + OpenStreetMap tiles
- **GPX:** leaflet-gpx 1.7.0
- **Charts:** Chart.js 4.4.0 (elevation profiles)
- **Hosting:** Netlify free tier (zero build minutes)
- **No backend, no server, no paid services, no API keys**

## Local Development

Must serve over HTTP — `file://` blocks fetch() and map tiles:

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Preview & Visual Testing

Use Claude Code's **preview server** (`preview_start` / `preview_screenshot` / `preview_snapshot`) to:
- Spin up a local HTTP server and render `index.html` in a real browser
- Take screenshots to verify layout, map rendering, and responsive behaviour
- Use `preview_snapshot` (accessibility tree) to verify text content and element presence
- Use `preview_inspect` to check computed CSS values (colours, spacing, fonts)
- Test at multiple viewports with `preview_resize` (mobile 375×812, tablet 768×1024, desktop 1280×800)

After any UI change, use the preview tools to visually confirm the result before considering the task complete.

## Key Config

CONFIG block at top of `<script>` in `index.html` controls everything:
- `USE_DEMO_DATA: false` — set `true` for offline dev with hardcoded demo routes
- `SHOW_DEBUG: false` — set `true` to show diagnostics panel

## Architecture Notes

- **Two map layers** (do not collapse): `masterGpxLayer` (bottom, GPX tracks) + `masterMarkerLayer` (top, clickable circle markers)
- **Do not use** `preferCanvas: true` — breaks z-order hit testing
- `window.scrollToCard` and `window.switchView` must stay on `window` (Leaflet popup onclick context)
- Map init uses `requestAnimationFrame` delay — fixes blank tiles on mobile
- All field values go through `escHtml()` before DOM insertion (XSS prevention)
- Helper functions: `safe()`, `safeNum()`, `normaliseDir()`, `escHtml()`, `slugify()`

## Conventions

- Everything lives in one file — do not split into separate JS/CSS files
- Cache key: `socc_routes_cache` in localStorage (1hr TTL)
- Design tokens use CSS custom properties (--navy, --orange, --grey-*)
- External links: always `target="_blank" rel="noopener noreferrer"`
- No cookies, no analytics, no tracking

## Testing Standards

Follow these practices when making changes:

### Functional Testing
- After every change, verify the app loads without errors (check browser console via `preview_console_logs`)
- Test the critical path: data fetch → card rendering → map markers → GPX overlay → popup interaction
- Confirm `USE_DEMO_DATA: true` mode works for offline/isolated testing
- Test with empty/malformed data — the app must degrade gracefully, never throw to the user

### Cross-Browser & Responsive
- Test at mobile, tablet, and desktop breakpoints using `preview_resize`
- Verify touch targets are at least 44×44px on mobile (WCAG 2.5.8)
- Check that map interactions (pan, zoom, popup) work at all viewport sizes

### Accessibility (WCAG 2.1 AA)
- All interactive elements must be keyboard-navigable
- Images and icons need meaningful `alt` text or `aria-label`
- Colour contrast ratios must meet 4.5:1 for normal text, 3:1 for large text
- Use semantic HTML (`<nav>`, `<main>`, `<button>`) — not div-with-onclick

### Performance
- No render-blocking resources beyond the CDN libs already in use
- localStorage cache (1hr TTL) must be respected — don't bypass it without reason
- GPX files should load lazily (on card expand / map focus), not all at once

## Security Standards

### Input Handling (OWASP)
- **All** user-facing data (from CSV, GPX, URL params) must pass through `escHtml()` before DOM insertion — no exceptions
- Never use `innerHTML` with unsanitised data; prefer `textContent` or sanitised templates
- URL parameters: validate and sanitise before use; reject unexpected keys

### Content Security
- External links always use `target="_blank" rel="noopener noreferrer"` (prevents reverse tabnapping)
- Only load scripts/styles from trusted CDNs already listed in the tech stack
- Do not add inline event handlers (`onclick="..."` in HTML) — use `addEventListener` in JS

### Data & Privacy
- No cookies, no analytics, no tracking — this is a hard rule, not a suggestion
- No PII is collected or stored; localStorage holds only route cache data
- Google Sheets data is public/read-only CSV — never introduce write access or auth tokens

### Dependency Management
- Pin CDN library versions (Leaflet 1.9.4, Chart.js 4.4.0, leaflet-gpx 1.7.0)
- Before adding any new external dependency, justify it — prefer vanilla JS solutions
- Review CDN URLs for integrity (use SRI `integrity` hashes where supported)

### Code Review Checklist
Before considering any change complete, verify:
1. No new `innerHTML` usage with dynamic data
2. No hardcoded secrets, tokens, or API keys
3. `escHtml()` applied to all externally-sourced strings rendered in DOM
4. Console is clean — no errors or warnings
5. Demo mode (`USE_DEMO_DATA: true`) still functions correctly
