import { CONFIG } from './config.js';
import { escHtml, safe } from './utils.js';
import { state } from './state.js';
import { dbg } from './api.js';

/* ════════════════════════════════════════════════════════════════════
   ROAD CLOSURES — TomTom Traffic Incidents API
   ════════════════════════════════════════════════════════════════════ */
const CLOSURE_CACHE_KEY = 'socc_closures_cache';
const CLOSURE_CACHE_TTL = 30 * 60 * 1000;
const closureCache = {};

export async function checkRouteClosure(gpxUrl, slug) {
  if (!CONFIG.ROAD_CLOSURES_ENABLED || !CONFIG.TOMTOM_API_KEY) return null;

  if (closureCache[slug] && (Date.now() - closureCache[slug].ts < CLOSURE_CACHE_TTL)) {
    return closureCache[slug].data;
  }

  try {
    const resp = await fetch(gpxUrl);
    if (!resp.ok) return null;
    const text = await resp.text();
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(text, 'application/xml');
    const trkpts = gpxDoc.querySelectorAll('trkpt');
    if (!trkpts.length) return null;

    const step = Math.max(1, Math.floor(trkpts.length / 10));
    const samples = [];
    for (let i = 0; i < trkpts.length; i += step) {
      const lat = parseFloat(trkpts[i].getAttribute('lat'));
      const lon = parseFloat(trkpts[i].getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) samples.push({ lat, lon });
    }
    const lastPt = trkpts[trkpts.length - 1];
    samples.push({
      lat: parseFloat(lastPt.getAttribute('lat')),
      lon: parseFloat(lastPt.getAttribute('lon'))
    });

    const BUFFER = 0.005;
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const s of samples) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lon < minLon) minLon = s.lon;
      if (s.lon > maxLon) maxLon = s.lon;
    }
    minLat -= BUFFER; maxLat += BUFFER;
    minLon -= BUFFER; maxLon += BUFFER;

    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
    const apiUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails`
      + `?key=${encodeURIComponent(CONFIG.TOMTOM_API_KEY)}`
      + `&bbox=${bbox}`
      + `&fields=${encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{iconCategory,from,to,startTime,endTime,delay,roadNumbers,events{description}}}}')}`
      + `&language=en-GB`
      + `&categoryFilter=6,7,8,9`
      + `&timeValidityFilter=present`;

    const apiResp = await fetch(apiUrl);
    if (!apiResp.ok) {
      dbg(`TomTom API returned ${apiResp.status}`, false);
      return null;
    }
    const data = await apiResp.json();

    const incidents = [];
    if (data.incidents) {
      for (const inc of data.incidents) {
        const props = inc.properties || {};
        const geom = inc.geometry || {};
        const incCoords = geom.coordinates || [];
        let nearRoute = false;
        for (const coord of incCoords) {
          const incLon = Array.isArray(coord[0]) ? coord[0][0] : coord[0];
          const incLat = Array.isArray(coord[0]) ? coord[0][1] : coord[1];
          for (const s of samples) {
            const dLat = Math.abs(incLat - s.lat);
            const dLon = Math.abs(incLon - s.lon);
            if (dLat < 0.002 && dLon < 0.003) {
              nearRoute = true;
              break;
            }
          }
          if (nearRoute) break;
        }

        if (nearRoute) {
          const cat = props.iconCategory;
          const isRoadwork = cat === 6 || cat === 9;
          const isClosure = cat === 7 || cat === 8;
          const desc = (props.events && props.events[0] && props.events[0].description) || 'Road incident';
          incidents.push({
            type: isClosure ? 'closure' : isRoadwork ? 'roadwork' : 'incident',
            description: escHtml(desc),
            from: escHtml(props.from || ''),
            to: escHtml(props.to || ''),
            startTime: props.startTime || null,
            endTime: props.endTime || null,
            roads: (props.roadNumbers || []).map(r => escHtml(r)).join(', '),
          });
        }
      }
    }

    const result = {
      closures: incidents.filter(i => i.type === 'closure'),
      roadworks: incidents.filter(i => i.type === 'roadwork'),
      total: incidents.length,
      checked: new Date().toISOString()
    };

    closureCache[slug] = { data: result, ts: Date.now() };
    return result;
  } catch (e) {
    dbg(`Road closure check failed: ${e.message}`, false);
    return null;
  }
}

export function renderClosureHtml(closureData) {
  if (!closureData) return '';

  if (closureData.total === 0) {
    return `<div class="card-closure-row clear">
      <span class="closure-icon">✅</span>
      <div class="closure-details">No road closures or roadworks detected on this route</div>
    </div>`;
  }

  const items = [];
  for (const c of closureData.closures) {
    let dates = '';
    if (c.startTime || c.endTime) {
      const fmt = d => { try { return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short'}); } catch(e) { return ''; } };
      const start = c.startTime ? fmt(c.startTime) : '';
      const end = c.endTime ? fmt(c.endTime) : '';
      dates = start && end ? ` (${start} – ${end})` : start ? ` (from ${start})` : end ? ` (until ${end})` : '';
    }
    items.push(`<div class="closure-item">
      <span class="closure-desc">🚫 ${c.description}</span>
      ${c.from || c.to ? `<br><span class="closure-dates">${c.from}${c.to ? ' → ' + c.to : ''}${dates}</span>` : dates ? `<br><span class="closure-dates">${dates}</span>` : ''}
    </div>`);
  }
  for (const r of closureData.roadworks) {
    let dates = '';
    if (r.startTime || r.endTime) {
      const fmt = d => { try { return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short'}); } catch(e) { return ''; } };
      const start = r.startTime ? fmt(r.startTime) : '';
      const end = r.endTime ? fmt(r.endTime) : '';
      dates = start && end ? ` (${start} – ${end})` : start ? ` (from ${start})` : end ? ` (until ${end})` : '';
    }
    items.push(`<div class="closure-item">
      <span class="closure-desc">🚧 ${r.description}</span>
      ${r.from || r.to ? `<br><span class="closure-dates">${r.from}${r.to ? ' → ' + r.to : ''}${dates}</span>` : dates ? `<br><span class="closure-dates">${dates}</span>` : ''}
    </div>`);
  }

  const icon = closureData.closures.length > 0 ? '⚠️' : '🚧';
  return `<div class="card-closure-row">
    <span class="closure-icon">${icon}</span>
    <div class="closure-details">${items.join('')}</div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════════════
   MAP CLOSURE LAYERS — region-wide TomTom data for master + card maps
   ════════════════════════════════════════════════════════════════════ */
export let masterClosureLayer = null;
export let masterRoadworkLayer = null;
let _closuresLoaded = false;
let _closureIncidents = [];
let _pendingClosureMaps = [];

function formatClosureDates(props) {
  if (!props.startTime && !props.endTime) return '';
  const fmt = d => { try { return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}); } catch(e) { return ''; } };
  const s = props.startTime ? fmt(props.startTime) : '';
  const e = props.endTime ? fmt(props.endTime) : '';
  return s && e ? `${s} – ${e}` : s ? `From ${s}` : e ? `Until ${e}` : '';
}

function buildClosurePopup(inc) {
  const props = inc.properties || {};
  const isClosure = inc._isClosure;
  const desc = inc._desc;
  const from = escHtml(props.from || '');
  const to = escHtml(props.to || '');
  const dateStr = formatClosureDates(props);
  const icon = isClosure ? '🚫' : '🚧';
  return `<div style="min-width:160px;font-size:0.82rem">
    <div style="font-weight:700;font-size:0.9rem">${icon} ${escHtml(desc)}</div>
    ${from ? `<div style="margin-top:0.3rem;color:#555">${from}${to ? ' → ' + to : ''}</div>` : ''}
    ${dateStr ? `<div style="margin-top:0.2rem;font-size:0.75rem;color:#888">${dateStr}</div>` : ''}
  </div>`;
}

export async function loadMapClosures() {
  if (_closuresLoaded) return;

  if (masterClosureLayer) { masterClosureLayer.clearLayers(); }
  else { masterClosureLayer = L.layerGroup(); }
  if (masterRoadworkLayer) { masterRoadworkLayer.clearLayers(); }
  else { masterRoadworkLayer = L.layerGroup(); }

  try {
    const bbox = '-0.55,52.0,0.45,52.55';
    const apiUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails`
      + `?key=${encodeURIComponent(CONFIG.TOMTOM_API_KEY)}`
      + `&bbox=${bbox}`
      + `&fields=${encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{iconCategory,from,to,startTime,endTime,events{description}}}}')}`
      + `&language=en-GB`
      + `&categoryFilter=6,7,8,9`
      + `&timeValidityFilter=present`;

    const resp = await fetch(apiUrl);
    if (!resp.ok) { dbg(`TomTom map closures: HTTP ${resp.status}`, false); return; }
    const data = await resp.json();

    if (!data.incidents || data.incidents.length === 0) {
      dbg('TomTom: no incidents in area', true);
      _closuresLoaded = true;
      return;
    }

    _closureIncidents = data.incidents.map(inc => {
      const props = inc.properties || {};
      const geom = inc.geometry || {};
      const coords = geom.coordinates || [];
      const cat = props.iconCategory;
      if (![6, 7, 8, 9].includes(cat)) return null;
      if (coords.length === 0) return null;
      const isClosure = cat === 7 || cat === 8;
      const desc = (props.events && props.events[0] && props.events[0].description) || 'Road incident';
      const midIdx = Math.floor(coords.length / 2);
      return {
        ...inc,
        _isClosure: isClosure,
        _desc: desc,
        _midLat: coords[midIdx][1],
        _midLon: coords[midIdx][0],
        _latLngs: coords.map(c => [c[1], c[0]])
      };
    }).filter(Boolean);

    let closureCount = 0, roadworkCount = 0;
    _closureIncidents.forEach(inc => {
      const emoji = inc._isClosure ? '🚫' : '🚧';
      const markerCls = inc._isClosure ? 'closure-marker-closure' : 'closure-marker-roadwork';
      const size = 22;
      const icon = L.divIcon({
        className: '',
        html: `<div class="closure-marker ${markerCls}" style="width:${size}px;height:${size}px">${emoji}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([inc._midLat, inc._midLon], { icon, interactive: true });
      marker.bindPopup(buildClosurePopup(inc), { maxWidth: 260 });
      marker.bindTooltip(`${emoji} ${escHtml(inc._desc)}`, { sticky: true });
      if (inc._isClosure) {
        marker.addTo(masterClosureLayer);
        closureCount++;
      } else {
        marker.addTo(masterRoadworkLayer);
        roadworkCount++;
      }
    });

    dbg(`TomTom: ${closureCount} closures + ${roadworkCount} roadworks loaded`, true);
    _closuresLoaded = true;

    if (_pendingClosureMaps.length > 0) {
      _pendingClosureMaps.forEach(m => { try { addClosuresToCardMap(m); } catch(e) {} });
      _pendingClosureMaps = [];
    }
  } catch (e) {
    dbg(`Map closures failed: ${e.message}`, false);
    _closuresLoaded = true;
  }
}

export function addClosuresToCardMap(map) {
  if (!_closureIncidents || _closureIncidents.length === 0) {
    if (!_closuresLoaded) _pendingClosureMaps.push(map);
    return;
  }

  const routePoints = [];
  map.eachLayer(l => {
    if (l instanceof L.GPX || (l instanceof L.FeatureGroup && l.getLayers)) {
      (l.getLayers ? l.getLayers() : [l]).forEach(sub => {
        if (sub.getLatLngs) {
          const lls = sub.getLatLngs();
          if (lls.length > 0 && lls[0] instanceof L.LatLng) {
            lls.forEach(ll => routePoints.push(ll));
          } else if (Array.isArray(lls[0])) {
            lls.forEach(arr => arr.forEach(ll => routePoints.push(ll)));
          }
        }
      });
    }
  });
  if (routePoints.length === 0) return;

  const step = Math.max(1, Math.floor(routePoints.length / 200));
  const sampled = routePoints.filter((_, i) => i % step === 0);

  function distM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const PROXIMITY_M = 500;
  let added = 0;

  _closureIncidents.forEach(inc => {
    if (state.closureMode === 'closures' && !inc._isClosure) return;
    const nearRoute = sampled.some(rp => distM(inc._midLat, inc._midLon, rp.lat, rp.lng) < PROXIMITY_M);
    if (!nearRoute) return;

    const colour = inc._isClosure ? '#dc2626' : '#f59e0b';
    const emoji = inc._isClosure ? '🚫' : '🚧';

    const glow = L.polyline(inc._latLngs, { color: '#000', weight: 12, opacity: 0.3, lineCap: 'round' });
    glow._isClosureOverlay = true;
    glow.addTo(map);

    const line = L.polyline(inc._latLngs, {
      color: colour, weight: 7, opacity: 0.95,
      dashArray: inc._isClosure ? null : '10 6', lineCap: 'round',
    });
    line.bindPopup(buildClosurePopup(inc), { maxWidth: 260 });
    line.bindTooltip(`${emoji} ${escHtml(inc._desc)}`, { sticky: true });
    line._isClosureOverlay = true;
    line.on('mouseover', function() { this.setStyle({ weight: 10, opacity: 1 }); });
    line.on('mouseout', function() { this.setStyle({ weight: 7, opacity: 0.95 }); });
    line.addTo(map);
    added++;
  });

  if (added > 0) dbg(`Card map: ${added} closures near route`, true);
}

// Lazy-loaded reference to masterMapInstance (set by map.js)
let _getMasterMap = () => null;
let _getLeafletMaps = () => ({});
export function setMapRefs(getMasterMap, getLeafletMaps) {
  _getMasterMap = getMasterMap;
  _getLeafletMaps = getLeafletMaps;
}

export function updateClosureLayers() {
  const masterMapInstance = _getMasterMap();
  if (!masterMapInstance) return;
  if (state.closureMode === 'off') {
    if (masterClosureLayer && masterMapInstance.hasLayer(masterClosureLayer)) masterMapInstance.removeLayer(masterClosureLayer);
    if (masterRoadworkLayer && masterMapInstance.hasLayer(masterRoadworkLayer)) masterMapInstance.removeLayer(masterRoadworkLayer);
  } else if (state.closureMode === 'closures') {
    if (masterClosureLayer && !masterMapInstance.hasLayer(masterClosureLayer)) masterMapInstance.addLayer(masterClosureLayer);
    if (masterRoadworkLayer && masterMapInstance.hasLayer(masterRoadworkLayer)) masterMapInstance.removeLayer(masterRoadworkLayer);
  } else {
    if (masterClosureLayer && !masterMapInstance.hasLayer(masterClosureLayer)) masterMapInstance.addLayer(masterClosureLayer);
    if (masterRoadworkLayer && !masterMapInstance.hasLayer(masterRoadworkLayer)) masterMapInstance.addLayer(masterRoadworkLayer);
  }
  const leafletMaps = _getLeafletMaps();
  Object.keys(leafletMaps).forEach(slug => {
    const map = leafletMaps[slug];
    if (map) refreshCardMapClosures(map);
  });
}

function refreshCardMapClosures(map) {
  const toRemove = [];
  map.eachLayer(l => { if (l._isClosureOverlay) toRemove.push(l); });
  toRemove.forEach(l => map.removeLayer(l));
  if (state.closureMode !== 'off') addClosuresToCardMap(map);
}
