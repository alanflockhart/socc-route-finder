import { CONFIG } from './config.js';
import { escHtml, safe, safeNum, normaliseDir, slugify, distBadgeClass, dirBadgeClass, hasRoadwork } from './utils.js';
import { state, filteredRoutes, openMaps } from './state.js';
import { getSelectedDayWeather, windAlignmentScore, windLabel } from './weather.js';

// Lazy-loaded references (set by main.js to break circular deps)
let _openMapForCard = null;
let _checkHash = null;
export function setCardDeps(openMapForCard, checkHash) {
  _openMapForCard = openMapForCard;
  _checkHash = checkHash;
}

/* ════════════════════════════════════════════════════════════════════
   RENDER — Route card list
   ════════════════════════════════════════════════════════════════════ */
export function renderCards() {
  const grid = document.getElementById('routesGrid');

  if (filteredRoutes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚴</div>
        <h3>No routes match your filters</h3>
        <p>Try widening your distance or ascent range, or deselecting some directions.</p>
        <button class="empty-reset" onclick="window.resetFilters()">↺ Reset all filters</button>
      </div>`;
    return;
  }

  grid.innerHTML = filteredRoutes.map((route, idx) => buildCard(route, idx)).join('');

  filteredRoutes.forEach((route, idx) => {
    const slug = slugify(route.route_name);
    if (openMaps[slug]) {
      setTimeout(() => _openMapForCard && _openMapForCard(route, idx, slug), 50);
    }
  });

  if (_checkHash) _checkHash();
}

function buildCard(route, idx) {
  const slug = slugify(route.route_name);
  const dist = parseFloat(route.distance_miles) || 0;
  const ascent = parseFloat(route.ascent_metres) || 0;
  const gpxDisabled = !route.gpx_url ? 'disabled data-tip="GPX not yet available"' : '';

  let weatherRowHtml = '';
  const selectedDayW = getSelectedDayWeather();
  if (selectedDayW) {
    const sun = selectedDayW;
    const dir = normaliseDir(route.direction);
    const ws = windAlignmentScore(dir, sun);
    const wl = windLabel(ws);

    const targetDist = state.targetDistance || CONFIG.TARGET_DISTANCE || 40;
    const distDiff = Math.abs(dist - targetDist);
    const distScore = Math.max(0, 1 - distDiff / 40);
    const hasCafe = !!(route.cafe_name || '').trim();
    const cafeScore = hasCafe ? 1 : 0;
    const lr = safe(route.last_ridden).toLowerCase().trim();
    const recencyScore = lr === '' ? 0.8 : 0.5;
    const total = (ws * 0.45) + (distScore * 0.35) + (cafeScore * 0.10) + (recencyScore * 0.10);
    const matchPct = Math.round(Math.max(0, Math.min(100, (total + 1) / 2 * 100)));

    const windBlowTo = (sun.windDir + 180) % 360;
    const windArrowSvg = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${windBlowTo}, 8, 8)">
        <line x1="8" y1="13" x2="8" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <polyline points="5,6 8,3 11,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>`;

    const windDotHtml = ws > 0.7 ? '🟢' : ws > 0.25 ? '🟡' : ws > -0.25 ? '🟠' : '🔴';

    weatherRowHtml = `
      <div class="card-weather-row">
        <span class="card-weather-icon">${escHtml(sun.icon)}</span>
        <span class="card-weather-temp">${escHtml(String(sun.tempMax))}°C</span>
        <span class="card-weather-wind">
          ${windArrowSvg}
          ${escHtml(sun.windDirLabel)} ${escHtml(String(sun.windSpeed))} mph
        </span>
        <span class="card-wind-badge ${wl.cls}">${windDotHtml} ${escHtml(wl.text)}</span>
        <span class="card-match-score"><span class="match-num">${matchPct}%</span> match</span>
      </div>`;
  }

  const rw = hasRoadwork(safe(route.notes));
  const warningHtml = safe(route.notes) ? `
    <div class="warning-banner ${rw ? 'has-roadwork' : ''}">
      ⚠️ <span>${escHtml(route.notes)}${rw ? '<span class="roadwork-badge">🚧 HAZARD</span>' : ''}</span>
    </div>` : '';

  const cafeHtml = safe(route.cafe_name) ? `
    <div class="cafe-row">
      <span class="cafe-icon">☕</span>
      <div>
        <div class="cafe-name">
          ${route.cafe_maps_url
            ? `<a href="${escHtml(route.cafe_maps_url)}" target="_blank" rel="noopener noreferrer">${escHtml(route.cafe_name)}</a>`
            : escHtml(route.cafe_name)}
        </div>
        ${route.cafe_hours ? `<div class="cafe-hours">${escHtml(route.cafe_hours)}</div>` : ''}
      </div>
    </div>` : '';

  const lastRidden = safe(route.last_ridden)
    ? `<div class="last-ridden">Last ridden: <span>${escHtml(safe(route.last_ridden))}</span></div>`
    : `<div class="last-ridden" style="color:var(--grey-300)">Never ridden</div>`;

  const buswayBadge = (route.busway_segment === true || route.busway_segment === 'TRUE')
    ? `<span class="badge badge-busway">🚌 Busway</span>` : '';

  return `
    <article class="route-card" id="route-${slug}">
      <div class="card-main">
        <div class="card-top">
          <div>
            <div class="route-name">${escHtml(route.route_name)}</div>
            ${route.source ? `<div class="route-source">${escHtml(route.source)}</div>` : ''}
          </div>
          <div class="badges">
            <span class="badge ${distBadgeClass(dist)}">📏 ${dist} mi</span>
            <span class="badge badge-ascent">⛰ ${ascent} m</span>
            ${safe(route.type) ? `<span class="badge badge-type-${safe(route.type).toLowerCase() === 'gravel' ? 'gravel' : 'road'}">${safe(route.type).toLowerCase() === 'gravel' ? '🏕' : '🚴'} ${escHtml(safe(route.type))}</span>` : ''}
            ${normaliseDir(route.direction) ? `<span class="badge ${dirBadgeClass(normaliseDir(route.direction))}">🧭 ${escHtml(normaliseDir(route.direction))}</span>` : ''}
            ${buswayBadge}
          </div>
        </div>

        ${weatherRowHtml}

        <div class="card-meta">
          <div class="meta-item">
            <div class="meta-key">⏱ Ride time</div>
            <div class="meta-val">${escHtml(safe(route.estimated_time) || '—')}</div>
          </div>
          <div class="meta-item">
            <div class="meta-key">☕ inc. coffee</div>
            <div class="meta-val">${escHtml(safe(route.time_with_coffee) || '—')}</div>
          </div>
          <div class="meta-item">
            <div class="meta-key">💨 Speed</div>
            <div class="meta-val mono">${safeNum(route.recommended_speed_mph) || '—'} mph</div>
          </div>
        </div>

        ${cafeHtml}
        ${lastRidden}
        ${warningHtml}

        <div class="card-actions">
          <button class="action-btn btn-map" onclick="window.toggleMap('${slug}', ${idx})" id="mapBtn-${slug}">
            📍 View on Map
          </button>
          <a class="action-btn btn-gpx tooltip" ${gpxDisabled}
            ${route.gpx_url ? `href="${escHtml(route.gpx_url)}" download` : ''}
            style="${!route.gpx_url ? 'pointer-events:none;opacity:0.5' : ''}">
            ⬇️ Download GPX
          </a>
          ${route.garmin_link ? `<a class="action-btn btn-garmin" href="${escHtml(route.garmin_link)}" target="_blank" rel="noopener noreferrer">🔗 Garmin Connect</a>` : ''}
          <button class="action-btn btn-share" onclick="window.shareRoute('${slug}')" title="Copy share link">🔗 Share</button>
          <button class="compare-toggle" onclick="window.toggleCompare('${slug}')" id="cmp-${slug}" title="Add to comparison">
            <span class="compare-check"></span> Compare
          </button>
        </div>
      </div>

      <!-- Map panel (hidden until toggled) -->
      <div class="map-panel" id="mapPanel-${slug}">
        <div class="stats-bar" id="statsBar-${slug}">
          <div class="stats-bar-item">
            <span class="stats-bar-icon">📏</span>
            <div class="stats-bar-val">${dist}</div>
            <div class="stats-bar-key">miles</div>
          </div>
          <div class="stats-bar-item">
            <span class="stats-bar-icon">⛰</span>
            <div class="stats-bar-val">${ascent}</div>
            <div class="stats-bar-key">metres ascent</div>
          </div>
          <div class="stats-bar-item">
            <span class="stats-bar-icon">⏱</span>
            <div class="stats-bar-val">${safe(route.estimated_time).replace(' h ','h ').replace(' min','m') || '—'}</div>
            <div class="stats-bar-key">ride time</div>
          </div>
          <div class="stats-bar-item">
            <span class="stats-bar-icon">☕</span>
            <div class="stats-bar-val">${safe(route.time_with_coffee).replace(' h ','h ').replace(' min','m') || '—'}</div>
            <div class="stats-bar-key">w/ coffee</div>
          </div>
          <div class="stats-bar-item">
            <span class="stats-bar-icon">🧭</span>
            <div class="stats-bar-val">${normaliseDir(route.direction) || '—'}</div>
            <div class="stats-bar-key">direction</div>
          </div>
          <div class="stats-bar-item">
            <span class="stats-bar-icon">💨</span>
            <div class="stats-bar-val">${safeNum(route.recommended_speed_mph) || '—'}</div>
            <div class="stats-bar-key">rec. mph</div>
          </div>
        </div>
        <div class="map-container" id="map-${slug}"></div>
        <div class="elevation-wrap">
          <div class="elevation-label">Elevation Profile</div>
          <div class="elevation-chart-wrap">
            <canvas id="elev-${slug}"></canvas>
          </div>
        </div>
      </div>
    </article>
  `;
}
