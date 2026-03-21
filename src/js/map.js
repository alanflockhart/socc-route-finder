import { CONFIG } from './config.js';
import { escHtml, safe, safeNum, normaliseDir, slugify } from './utils.js';
import { state, allCafes, filteredRoutes, openMaps } from './state.js';
import { dbg } from './api.js';
import { addClosuresToCardMap, loadMapClosures, updateClosureLayers, masterClosureLayer, masterRoadworkLayer } from './closures.js';

/* ════════════════════════════════════════════════════════════════════
   MAP LOGIC — Master map + individual card maps
   ════════════════════════════════════════════════════════════════════ */
export const SWAVESEY = { lat: 52.3063, lon: -0.0004 };
const DIR_BEARING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export const leafletMaps = {};
const elevCharts = {};

let masterMapInstance = null;
let masterMarkerLayer = null;
let masterCafeLayer = null;
let masterGpxLayer = null;
let currentView = 'list';

export function getMasterMap() { return masterMapInstance; }
export function getLeafletMaps() { return leafletMaps; }

/* ── View switching ── */
export function switchView(view) {
  currentView = view;
  document.getElementById('listPanel').style.display = view === 'list' ? '' : 'none';
  document.getElementById('masterMapPanel').classList.toggle('active', view === 'map');
  document.getElementById('tabList').classList.toggle('active', view === 'list');
  document.getElementById('tabMap').classList.toggle('active', view === 'map');
  if (view === 'map') refreshMasterMap();
}

/* ── Card map toggle ── */
export function toggleMap(slug, idx) {
  const panel = document.getElementById(`mapPanel-${slug}`);
  const btn = document.getElementById(`mapBtn-${slug}`);
  if (!panel || !btn) return;
  const isOpen = panel.classList.contains('open');

  if (isOpen) {
    panel.classList.remove('open');
    btn.classList.remove('active');
    btn.textContent = '📍 View on Map';
    delete openMaps[slug];
    if (leafletMaps[slug]) { leafletMaps[slug].remove(); delete leafletMaps[slug]; }
    if (elevCharts[slug]) { elevCharts[slug].destroy(); delete elevCharts[slug]; }
  } else {
    const route = filteredRoutes[idx];
    openMaps[slug] = true;
    openMapForCard(route, idx, slug);
  }
}

export function openMapForCard(route, idx, slug) {
  const panel = document.getElementById(`mapPanel-${slug}`);
  const btn = document.getElementById(`mapBtn-${slug}`);
  if (!panel || !btn) return;

  panel.classList.add('open');
  btn.classList.add('active');
  btn.textContent = '🗺 Hide Map';

  if (leafletMaps[slug]) {
    try { leafletMaps[slug].remove(); } catch(e) {}
    delete leafletMaps[slug];
  }
  if (elevCharts[slug]) {
    try { elevCharts[slug].destroy(); } catch(e) {}
    delete elevCharts[slug];
  }

  setTimeout(() => initMap(slug, route), 80);
}

/* ── Share / Hash ── */
export function shareRoute(slug) {
  const url = `${location.origin}${location.pathname}#${slug}`;
  navigator.clipboard?.writeText(url).then(() => {
    const btn = document.querySelector(`#route-${slug} .btn-share`);
    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '🔗 Share'; }, 1800); }
  }).catch(() => {
    window.location.hash = slug;
  });
  window.location.hash = slug;
}

export function checkHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;
  const el = document.getElementById(`route-${hash}`);
  if (el) {
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 1400);
    }, 200);
  }
}

export function scrollToCard(slug) {
  switchView('list');
  setTimeout(() => {
    const el = document.getElementById('route-' + slug);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlighted');
    setTimeout(() => el.classList.remove('highlighted'), 3000);
  }, 120);
}

/* ── Café helpers (shared by master map + card maps) ── */
function buildCafePopupHtml(cafe) {
  const name    = escHtml(safe(cafe.cafe_name));
  const village = escHtml(safe(cafe.village));
  const rating  = cafe.rating ? '⭐'.repeat(Math.min(parseInt(cafe.rating) || 0, 5)) : '';
  const satHrs  = safe(cafe.saturday_hours);
  const sunHrs  = safe(cafe.sunday_hours);
  const hours   = (satHrs || sunHrs)
    ? `<div style="font-size:0.75rem;margin-top:0.3rem">` +
      (satHrs ? `<div>Sat: ${escHtml(satHrs)}</div>` : '') +
      (sunHrs ? `<div>Sun: ${escHtml(sunHrs)}</div>` : '') +
      `</div>` : '';
  const notes   = safe(cafe.notes) ? `<div style="font-size:0.7rem;color:#666;margin-top:0.2rem">${escHtml(cafe.notes)}</div>` : '';
  const website = safe(cafe.website)
    ? `<a href="${escHtml(cafe.website)}" target="_blank" rel="noopener noreferrer" style="display:block;font-size:0.7rem;color:#e8621a;margin-top:0.2rem">Visit website ↗</a>` : '';
  return `
    <div style="min-width:140px">
      <div style="font-weight:700;font-size:0.85rem">🍳 ${name}</div>
      ${village ? `<div style="font-size:0.75rem;color:#555">${village}</div>` : ''}
      ${rating ? `<div style="font-size:0.8rem">${rating}</div>` : ''}
      ${hours}${notes}${website}
    </div>`;
}

function addCafesToMap(map, fontSize) {
  if (!allCafes || allCafes.length === 0) return;
  const bounds = map.getBounds();
  allCafes.forEach(cafe => {
    const lat = parseFloat(cafe.lat);
    const lon = parseFloat(cafe.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    if (!bounds.contains([lat, lon])) return;
    const cafeIcon = L.icon({
      iconUrl: 'images/cafe-icon.png', shadowUrl: '',
      iconSize: [fontSize, fontSize], iconAnchor: [fontSize/2, fontSize],
      popupAnchor: [0, -fontSize], className: 'cafe-marker'
    });
    const name = escHtml(safe(cafe.cafe_name));
    L.marker([lat, lon], { icon: cafeIcon })
      .addTo(map)
      .bindPopup(buildCafePopupHtml(cafe), { maxWidth: 220 })
      .bindTooltip(`🍳 ${name}`, { sticky: true });
  });
}

/* ── Direction arrows along GPX tracks ── */
function calcBearing(a, b) {
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(b.lat * Math.PI / 180);
  const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) -
            Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function addDirectionArrows(container, gpxLayer) {
  const points = [];
  gpxLayer.eachLayer(l => {
    if (l.getLatLngs) {
      const lls = l.getLatLngs();
      if (lls.length > 0 && lls[0] instanceof L.LatLng) {
        lls.forEach(ll => points.push(ll));
      } else if (Array.isArray(lls[0])) {
        lls.forEach(arr => arr.forEach(ll => points.push(ll)));
      }
    }
  });
  if (points.length < 2) return;

  const ARROW_INTERVAL_M = 12000;
  let accumulatedDist = 0;
  const colour = gpxLayer.options.polyline_options.color || '#e8621a';

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i+1];
    const d = p1.distanceTo(p2);
    accumulatedDist += d;

    if (accumulatedDist >= ARROW_INTERVAL_M) {
      const bearing = calcBearing(p1, p2);
      const icon = L.divIcon({
        className: '',
        html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${bearing}deg); filter: drop-shadow(0 0 1.5px white); opacity:0.85; pointer-events:none; display:block;">
                 <path d="M3 10L7 6L11 10" stroke="${colour}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
               </svg>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker(p2, { icon, interactive: false }).addTo(container);
      accumulatedDist = 0;
    }
  }
}

/* ── Card-level map initialization ── */
function initMap(slug, route) {
  if (leafletMaps[slug]) {
    leafletMaps[slug].invalidateSize();
    return;
  }

  const mapEl = document.getElementById(`map-${slug}`);
  if (!mapEl) return;

  const lat = parseFloat(route.start_lat) || SWAVESEY.lat;
  const lon = parseFloat(route.start_lon) || SWAVESEY.lon;

  const map = L.map(mapEl).setView([lat, lon], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  leafletMaps[slug] = map;

  const startIcon = L.divIcon({
    html: `<div style="background:var(--green);border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10], className: ''
  });
  L.marker([lat, lon], { icon: startIcon })
    .addTo(map)
    .bindPopup(`<b>Start:</b> ${escHtml(safe(route.route_name))} — ${safeNum(route.distance_miles)} miles`);

  if (route.gpx_url) {
    new L.GPX(route.gpx_url, {
      async: true,
      marker_options: { startIconUrl: '', endIconUrl: '', shadowUrl: '', wptIconUrls: { '': '' } },
      polyline_options: { color: '#e8621a', weight: 3.5, opacity: 0.9 }
    }).on('loaded', function(e) {
      map.fitBounds(e.target.getBounds());
      buildElevationChart(slug, e.target);
      addDirectionArrows(map, e.target);
      map.once('moveend', function() {
        addCafesToMap(map, 22);
        addClosuresToCardMap(map);
      });
      e.target.eachLayer(function(layer) {
        if (layer.setStyle) {
          layer.on('mouseover', function() { this.setStyle({ weight: 5, opacity: 1.0 }); });
          layer.on('mouseout', function() { this.setStyle({ weight: 3.5, opacity: 0.9 }); });
        }
      });
    }).addTo(map);
  } else {
    buildDemoElevationChart(slug, route);
  }

  map.invalidateSize();
}

/* ── Elevation charts ── */
function buildElevationChart(slug, gpxLayer) {
  const canvas = document.getElementById(`elev-${slug}`);
  if (!canvas) return;
  let elevArr = [];
  try { elevArr = gpxLayer.get_elevation_data() || []; } catch(e) {}
  if (elevArr.length === 0) { buildDemoElevationChart(slug); return; }
  const step = Math.max(1, Math.floor(elevArr.length / 200));
  const data = elevArr.filter((_, i) => i % step === 0).map(pt => pt[1]);
  if (data.length === 0) { buildDemoElevationChart(slug); return; }
  createElevChart(slug, data);
}

function buildDemoElevationChart(slug, route) {
  const base = 10;
  const pts = 30;
  const ascent = parseFloat((route||{}).ascent_metres) || 80;
  const data = Array.from({length: pts}, (_, i) => {
    return base + Math.sin(i / pts * Math.PI * 2) * (ascent / 4) + Math.random() * 8;
  });
  createElevChart(slug, data);
}

function createElevChart(slug, data) {
  if (elevCharts[slug]) elevCharts[slug].destroy();
  const canvas = document.getElementById(`elev-${slug}`);
  if (!canvas) return;

  const labels = data.map(() => '');
  elevCharts[slug] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#e8621a',
        backgroundColor: 'rgba(232,98,26,0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          display: true,
          ticks: { font: { size: 9 }, color: '#8c97a8', maxTicksLimit: 4 },
          grid: { color: '#eef0f4' }
        }
      }
    }
  });
}

/* ── Route position estimation ── */
function routeApproxCoords(route) {
  const lat = parseFloat(route.start_lat);
  const lon = parseFloat(route.start_lon);
  if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
    return { lat, lon, exact: true };
  }
  const dir = normaliseDir(route.direction);
  const bearing = DIR_BEARING[dir] ?? 180;
  const dist = safeNum(route.distance_miles) || 20;
  const reach = dist * 0.35;
  const bearingRad = bearing * Math.PI / 180;
  const latPerMile = 1 / 69.0;
  const lonPerMile = 1 / (69.0 * Math.cos(SWAVESEY.lat * Math.PI / 180));
  return {
    lat: SWAVESEY.lat + reach * Math.cos(bearingRad) * latPerMile,
    lon: SWAVESEY.lon + reach * Math.sin(bearingRad) * lonPerMile,
    exact: false
  };
}

function markerColour(miles) {
  if (miles < 25)  return '#22a05a';
  if (miles <= 40) return '#d97706';
  return '#dc2626';
}

/* ── Master map popup ── */
function buildRoutePopupHtml(route, slug) {
  const dist      = safeNum(route.distance_miles);
  const dir       = normaliseDir(route.direction) || '\u2014';
  const timeStr   = safe(route.estimated_time) || '\u2014';
  const ascentStr = safeNum(route.ascent_metres) ? safeNum(route.ascent_metres) + ' m' : '\u2014';
  const coords    = routeApproxCoords(route);
  const exactNote = coords.exact ? '' : '<div style="font-size:0.7rem;color:#999;margin-top:0.3rem">\u26a0\ufe0f Approximate position</div>';

  return `
    <div class="map-route-popup">
      <div class="pop-name">${escHtml(safe(route.route_name))}</div>
      <div class="pop-stats">
        <span>\ud83d\udccf ${dist} mi</span>
        <span>\u26f0 ${ascentStr}</span>
        <span>\u23f1 ${timeStr}</span>
        <span>\ud83e\udded ${dir}</span>
      </div>
      ${safe(route.garmin_link) ? `<a href="${escHtml(safe(route.garmin_link))}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;margin-bottom:0.4rem;font-size:0.75rem;color:#e8621a">Open in Garmin Connect \u2197</a>` : ''}
      <button class="pop-btn" onclick="window.scrollToCard('${slug}')">
        View full details \u2192
      </button>
      ${exactNote}
    </div>`;
}

/* ── Master map ── */
export async function refreshMasterMap({ skipGpx = false } = {}) {
  if (currentView !== 'map') return;

  const mapEl = document.getElementById('masterMap');

  if (!masterMapInstance) {
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
    masterMapInstance = L.map(mapEl).setView([SWAVESEY.lat, SWAVESEY.lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      crossOrigin: true
    }).addTo(masterMapInstance);
    L.marker([SWAVESEY.lat, SWAVESEY.lon], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;background:#1a2e4a;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7]
      })
    }).addTo(masterMapInstance).bindTooltip('🏠 Swavesey HQ', { permanent: false });
    masterMapInstance._userMoved = false;
    masterMapInstance.on('dragend zoomend', function() {
      if (!masterMapInstance._programmaticMove) masterMapInstance._userMoved = true;
    });
    masterMapInstance.invalidateSize();
  }

  if (masterGpxLayer)    { masterGpxLayer.clearLayers(); }
  else { masterGpxLayer  = L.layerGroup().addTo(masterMapInstance); }
  if (masterCafeLayer)   { masterCafeLayer.clearLayers(); }
  else { masterCafeLayer = L.layerGroup().addTo(masterMapInstance); }
  if (masterMarkerLayer) { masterMarkerLayer.clearLayers(); }
  else { masterMarkerLayer = L.layerGroup().addTo(masterMapInstance); }

  const showCafes = (state.mapDisplay === 'all' || state.mapDisplay === 'cafes');
  const showRoutes = (state.mapDisplay === 'all' || state.mapDisplay === 'routes');

  if (showCafes && allCafes.length > 0) {
    allCafes.forEach(cafe => {
      const lat = parseFloat(cafe.lat);
      const lon = parseFloat(cafe.lon);
      if (isNaN(lat) || isNaN(lon)) return;
      const cafeIcon = L.icon({
        iconUrl: 'images/cafe-icon.png', shadowUrl: '',
        iconSize: [36, 36], iconAnchor: [18, 36],
        popupAnchor: [0, -36], className: 'cafe-marker'
      });
      const name = escHtml(safe(cafe.cafe_name));
      L.marker([lat, lon], { icon: cafeIcon })
        .addTo(masterCafeLayer)
        .bindPopup(buildCafePopupHtml(cafe), { maxWidth: 220 })
        .bindTooltip(`🍳 ${name}`, { sticky: true });
    });
  }

  if (!showRoutes) {
    if (allCafes.length > 0) {
      const cafeBounds = allCafes
        .filter(c => !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lon)))
        .map(c => [parseFloat(c.lat), parseFloat(c.lon)]);
      if (cafeBounds.length > 0) masterMapInstance.fitBounds(cafeBounds, { padding: [40, 40], maxZoom: 12 });
    }
    masterMapInstance.invalidateSize(true);
    return;
  }

  if (filteredRoutes.length === 0) {
    masterMapInstance.setView([SWAVESEY.lat, SWAVESEY.lon], 10);
    return;
  }

  const isLocalRegion = !state.region || state.region === 'Cambridge Core' || state.region === 'all';
  const bounds = isLocalRegion ? [[SWAVESEY.lat, SWAVESEY.lon]] : [];

  const GPX_PALETTE = ['#e8621a','#2563eb','#16a34a','#9333ea','#dc2626','#0891b2','#d97706','#be185d','#059669','#7c3aed'];
  const GPX_DASHES = [null, '12 6', '4 6', '12 4 4 4'];

  filteredRoutes.forEach((route, idx) => {
    const coords = routeApproxCoords(route);
    const dist = safeNum(route.distance_miles);
    const colour = markerColour(dist);
    const slug = slugify(safe(route.route_name));
    const radius = 5 + Math.min(dist / 20, 5);

    const marker = L.circleMarker([coords.lat, coords.lon], {
      radius: Math.max(radius, 10),
      color: '#ffffff', fillColor: colour, fillOpacity: 0.9, weight: 2, opacity: 1, interactive: true,
    });
    marker.bindPopup(buildRoutePopupHtml(route, slug), { maxWidth: 240 });
    marker.bindTooltip(escHtml(safe(route.route_name)), { sticky: true });
    marker.on('click', () => marker.openPopup());
    marker.addTo(masterMarkerLayer);
    bounds.push([coords.lat, coords.lon]);

    const gpxColour = GPX_PALETTE[idx % GPX_PALETTE.length];
    const gpxDash = GPX_DASHES[Math.floor(idx / GPX_PALETTE.length) % GPX_DASHES.length];

    if (!skipGpx && safe(route.gpx_url)) {
      new L.GPX(safe(route.gpx_url), {
        async: true,
        polyline_options: { color: gpxColour, opacity: 0.7, weight: 4, dashArray: gpxDash },
        marker_options: { startIconUrl: '', endIconUrl: '', shadowUrl: '', wptIconUrls: { '': '' } }
      }).on('loaded', function(e) {
        const popupHtml = buildRoutePopupHtml(route, slug);
        const routeLabel = escHtml(safe(route.route_name));
        e.target.eachLayer(function(layer) {
          if (layer.bindPopup) layer.bindPopup(popupHtml, { maxWidth: 240 });
          if (layer.bindTooltip) layer.bindTooltip(routeLabel, { sticky: true });
          if (layer.setStyle) {
            layer.on('mouseover', function() { this.setStyle({ weight: 7, opacity: 1.0, dashArray: gpxDash }); });
            layer.on('mouseout', function() { this.setStyle({ weight: 4, opacity: 0.7, dashArray: gpxDash }); });
          }
        });
        masterGpxLayer.addLayer(e.target);
        addDirectionArrows(masterGpxLayer, e.target);
      }).on('error', function() {});
    }
  });

  if (!masterMapInstance._userMoved) {
    const isDefaultView = isLocalRegion && state.type === 'all' && state.distMin === 0 && state.distMax >= 160;
    masterMapInstance._programmaticMove = true;
    if (isDefaultView) {
      masterMapInstance.setView([SWAVESEY.lat, SWAVESEY.lon], 10);
    } else if (bounds.length > 0) {
      masterMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
    setTimeout(() => { masterMapInstance._programmaticMove = false; }, 500);
  }

  masterMapInstance.invalidateSize(true);

  if (CONFIG.ROAD_CLOSURES_ENABLED && CONFIG.TOMTOM_API_KEY) {
    loadMapClosures().then(() => {
      updateClosureLayers();
    }).catch(() => {});
  }
}
