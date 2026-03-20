import { CONFIG, DEMO_ROUTES, DEMO_CAFES } from './config.js';
import { escHtml, normaliseGpxUrl } from './utils.js';

/* ════════════════════════════════════════════════════════════════════
   DATA FETCHING — with localStorage cache (1 hour TTL)
   ════════════════════════════════════════════════════════════════════ */
const CACHE_KEY = 'socc_routes_cache';
const CAFES_CACHE_KEY = 'socc_cafes_cache';
const CACHE_TTL = 60 * 60 * 1000;

export function dbg(msg, ok) {
  if (!CONFIG.SHOW_DEBUG) return;
  console.log('SOCC DEBUG:', msg);
  const log = document.getElementById('debugLog');
  if (!log) return;
  const row = document.createElement('div');
  row.style.cssText = `padding:0.3rem 0.5rem;border-radius:4px;background:${ok === false ? 'rgba(224,54,54,0.2)' : ok === true ? 'rgba(29,184,122,0.15)' : 'rgba(255,255,255,0.05)'}`;
  row.innerHTML = `<span style="color:${ok === false ? '#f87171' : ok === true ? '#4ade80' : '#93c5fd'}">${ok === false ? '✗' : ok === true ? '✓' : '→'}</span> ${escHtml(msg)}`;
  log.appendChild(row);
}

export async function fetchRoutes() {
  dbg(`CONFIG.USE_DEMO_DATA = ${CONFIG.USE_DEMO_DATA}`);
  dbg(`CONFIG.SHEET_ID = ${CONFIG.SHEET_ID.slice(0,20)}...`);
  dbg(`CONFIG.SHEET_GID = ${CONFIG.SHEET_GID}`);

  if (CONFIG.USE_DEMO_DATA) {
    const demo = DEMO_ROUTES.filter(r => r.rideable !== false);
    dbg(`Demo mode — returning ${demo.length} routes`, true);
    return demo;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      const ageMins = Math.floor((Date.now() - cached.timestamp) / 60000);
      dbg(`Cache hit — ${cached.data.length} routes, ${ageMins} min old`, true);
      showCacheAge(cached.timestamp);
      return cached.data;
    } else if (cached) {
      dbg(`Cache expired — fetching fresh`);
    } else {
      dbg(`No cache found — fetching fresh`);
    }
  } catch(e) {
    dbg(`Cache read error: ${e.message}`, false);
  }

  const url = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?gid=${CONFIG.SHEET_GID}&single=true&output=csv`;
  dbg(`Fetching: ${url.slice(0,80)}...`);

  let res;
  try {
    res = await fetch(url);
    dbg(`HTTP status: ${res.status} ${res.statusText}`, res.ok);
  } catch(e) {
    if (location.protocol === 'file:') {
      dbg('✗ Running as file:// — browsers block fetch() from local files. Serve via http:// instead:', false);
      dbg('  → Option A: run  npx serve .  then open http://localhost:3000', false);
      dbg('  → Option B: run  python3 -m http.server 8080  then open http://localhost:8080', false);
      dbg('  → Option C: VS Code → right-click index.html → Open with Live Server', false);
      dbg('  → Or just deploy to Netlify — it will work fine there', false);
    } else {
      dbg(`Fetch failed (network/CORS): ${e.message}`, false);
    }
    throw e;
  }

  let csv;
  try {
    csv = await res.text();
    dbg(`Response length: ${csv.length} chars`);
    dbg(`First 120 chars: ${csv.slice(0,120).replace(/\n/g,' ')}`);
  } catch(e) {
    dbg(`Failed to read response text: ${e.message}`, false);
    throw e;
  }

  if (csv.length < 10) {
    dbg('Response is empty — sheet may not be published correctly', false);
    throw new Error('Empty CSV response');
  }
  if (csv.toLowerCase().includes('<html')) {
    dbg('Response is HTML not CSV — likely a Google sign-in redirect', false);
    throw new Error('Got HTML instead of CSV');
  }

  let parsed;
  try {
    parsed = parseCSV(csv);
    dbg(`CSV parsed — ${parsed.length} total rows`);
    if (parsed.length > 0) {
      dbg(`Columns detected: ${Object.keys(parsed[0]).join(', ')}`);
    }
  } catch(e) {
    dbg(`CSV parse error: ${e.message}`, false);
    throw e;
  }

  const rideableVals = [...new Set(parsed.map(r => String(r.rideable)))];
  dbg(`'rideable' values found: ${rideableVals.join(', ')}`);

  const data = parsed.filter(r => {
    const rv = String(r.rideable || '').toLowerCase().trim();
    if (r.rideable === false) return false;
    if (rv === '?check cafe') return false;
    if (rv !== '' && rv !== 'true' && rv !== 'yes' && rv !== 'road' && rv !== 'mtb') return false;
    return true;
  });
  // Normalise GPX URLs (Google Drive / Dropbox share links → direct download)
  data.forEach(r => { if (r.gpx_url) r.gpx_url = normaliseGpxUrl(r.gpx_url); });

  dbg(`Rideable routes: ${data.length} of ${parsed.length}`, data.length > 0);

  if (data.length === 0 && parsed.length > 0) {
    dbg("⚠️ All routes filtered out — 'rideable' column must be YES/TRUE/true. Found: " + rideableVals.join(', '), false);
  } else if (data.length < parsed.length) {
    const excluded = parsed.length - data.length;
    dbg(`ℹ️ ${excluded} rows excluded — rideable is NO/FALSE/empty/?Check cafe etc`);
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    dbg(`Cached ${data.length} routes to localStorage`, true);
  } catch(e) {
    dbg(`Cache write failed (storage full?): ${e.message}`, false);
  }

  showCacheAge(Date.now());
  return data;
}

export async function fetchCafes() {
  if (CONFIG.USE_DEMO_DATA) {
    dbg(`Demo mode — returning ${DEMO_CAFES.length} cafes`, true);
    return DEMO_CAFES;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CAFES_CACHE_KEY));
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      dbg(`Cafes cache hit — ${cached.data.length} cafes`, true);
      return cached.data;
    }
  } catch(e) { /* ignore */ }

  const url = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?gid=${CONFIG.CAFES_GID}&single=true&output=csv`;
  dbg(`Fetching cafes: ${url.slice(0,80)}...`);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    if (csv.length < 10 || csv.toLowerCase().includes('<html')) {
      throw new Error('Invalid CSV response for cafes');
    }
    const parsed = parseCSV(csv, CONFIG.CAFE_COLUMN_MAP);
    const data = parsed.filter(c => {
      const lat = parseFloat(c.lat);
      const lon = parseFloat(c.lon);
      return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
    });
    dbg(`Cafes parsed — ${parsed.length} total, ${data.length} with coordinates`, data.length > 0);

    try {
      localStorage.setItem(CAFES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    } catch(e) { /* storage full — non-fatal */ }

    return data;
  } catch(e) {
    dbg(`Cafes fetch failed: ${e.message}`, false);
    return [];
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CAFES_CACHE_KEY);
  location.reload();
}

function showCacheAge(timestamp) {
  const el = document.getElementById('cacheAge');
  if (!el) return;
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  el.textContent = mins < 1 ? 'Data: just refreshed' : `Data: ${mins} min${mins > 1 ? 's' : ''} ago`;
}

export function parseCSV(csv, columnMap) {
  const colMap = columnMap || CONFIG.COLUMN_MAP;
  const lines = csv.trim().split('\n');
  const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

  const headers = rawHeaders.map(h => {
    const key = h.toLowerCase();
    return colMap[key] || h;
  });

  return lines.slice(1).map(line => {
    const vals = smartSplit(line);
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      let v = (vals[i] || '').replace(/^"|"$/g, '').trim();
      const vl = v.toLowerCase();
      if (vl === 'true' || vl === 'yes' || v === '1') v = true;
      else if (vl === 'false' || vl === 'no' || v === '0') v = false;
      else if (!isNaN(v) && v !== '') v = parseFloat(v);
      obj[h] = v;
    });
    if ('busway_segment' in obj) {
      const bv = String(obj.busway_segment).toLowerCase().trim();
      obj.busway_segment = (bv === 'yes' || bv === 'true' || bv === '1');
    }
    if (obj.estimated_time_raw !== undefined && obj.estimated_time_raw !== '') {
      const dh = parseFloat(obj.estimated_time_raw);
      if (!isNaN(dh)) {
        const h = Math.floor(dh);
        const m = Math.round((dh - h) * 60);
        obj.estimated_time = m > 0 ? `${h} h ${m} min` : `${h} h`;
      }
    }
    return obj;
  });
}

function smartSplit(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}
