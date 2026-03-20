import { safe, normaliseDir, safeNum } from './utils.js';
import { state, allRoutes, filteredRoutes, setFilteredRoutes, filterTimer, setFilterTimer, PREFS_KEY, savePrefs } from './state.js';
import { dbg } from './api.js';
import { renderCards } from './cards.js';
import { refreshMasterMap, getMasterMap } from './map.js';
import { checkHash } from './map.js';
import { getSelectedDayWeather, renderRidePlannerForDay } from './weather.js';
import { updateClosureLayers } from './closures.js';

/* ════════════════════════════════════════════════════════════════════
   FILTERING & SORTING
   ════════════════════════════════════════════════════════════════════ */
export function applyFilters() {
  if (allRoutes.length > 0) {
    const r0 = allRoutes[0];
    dbg(`First route: "${r0.route_name}" | type:"${r0.type}" | dir:"${r0.direction}" | dist:${r0.distance_miles}`);
    const dirVals = [...new Set(allRoutes.map(r => String(r.direction || '')))];
    dbg(`All direction values in data: ${dirVals.join(', ')}`);
  }

  const filtered = allRoutes.filter(r => {
    if (state.region !== 'all') {
      const routeRegion = r.region || 'Cambridge Core';
      if (routeRegion !== state.region) return false;
    }
    if (state.type !== 'all' && r.type && r.type !== state.type) return false;
    const d = parseFloat(r.distance_miles) || 0;
    if (d < state.distMin || d > state.distMax) return false;
    const a = parseFloat(r.ascent_metres) || 0;
    if (a < state.ascentMin || a > state.ascentMax) return false;
    const dir = normaliseDir(r.direction);
    if (dir && !state.directions.has(dir)) return false;
    if (state.excludeBusway && r.busway_segment === true) return false;
    return true;
  });

  setFilteredRoutes(filtered);

  dbg(`After filters: ${filteredRoutes.length} of ${allRoutes.length} routes visible`);
  refreshMasterMap();

  filteredRoutes.sort((a, b) => {
    if (state.sort === 'fmr_score')  return (b.fmrScore||0) - (a.fmrScore||0);
    if (state.sort === 'name')       return safe(a.route_name).localeCompare(safe(b.route_name));
    if (state.sort === 'dist_asc')   return (a.distance_miles||0) - (b.distance_miles||0);
    if (state.sort === 'dist_desc')  return (b.distance_miles||0) - (a.distance_miles||0);
    if (state.sort === 'ascent')     return (a.ascent_metres||0) - (b.ascent_metres||0);
    if (state.sort === 'last_ridden') return (b.last_ridden||'').localeCompare(a.last_ridden||'');
    return 0;
  });

  renderCards();
  updateCounts();
}

function debouncedFilter() {
  clearTimeout(filterTimer);
  setFilterTimer(setTimeout(applyFilters, 120));
}

export function updateCounts() {
  const total = allRoutes.length;
  const shown = filteredRoutes.length;
  document.getElementById('resultCount').textContent = `${shown} of ${total}`;
  document.getElementById('hero-total').textContent = total;
  document.getElementById('hero-road').textContent = allRoutes.filter(r => safe(r.type).toLowerCase() === 'road').length;
  const mtbEl = document.getElementById('hero-mtb');
  if (mtbEl) mtbEl.textContent = allRoutes.filter(r => safe(r.type).toLowerCase() === 'mtb').length;
  const gravelEl = document.getElementById('hero-gravel');
  if (gravelEl) gravelEl.textContent = allRoutes.filter(r => safe(r.type).toLowerCase() === 'gravel').length;
}

export function resetFilters() {
  state.type = 'all';
  state.distMin = 0; state.distMax = 160;
  state.ascentMin = 0; state.ascentMax = 2500;
  state.directions = new Set(['N','NE','E','SE','S','SW','W','NW']);
  state.mapDisplay = 'all';
  state.excludeBusway = false;
  state.closureMode = 'closures';

  localStorage.removeItem(PREFS_KEY);

  const masterMapInstance = getMasterMap();
  if (masterMapInstance) masterMapInstance._userMoved = false;

  document.getElementById('distMin').value = 0;
  document.getElementById('distMax').value = 160;
  document.getElementById('ascentMin').value = 0;
  document.getElementById('ascentMax').value = 2500;
  document.getElementById('distMinVal').textContent = '0 mi';
  document.getElementById('distMaxVal').textContent = '160 mi';
  document.getElementById('ascentMinVal').textContent = '0 m';
  document.getElementById('ascentMaxVal').textContent = '2500 m';
  document.getElementById('buswayToggle').checked = false;
  document.querySelectorAll('#closureModeToggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'closures'));
  updateClosureLayers();
  document.querySelectorAll('#dirChecks input[type=checkbox]').forEach(cb => cb.checked = true);
  document.querySelectorAll('#typeToggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'all'));
  document.querySelectorAll('#mapDisplayToggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'all'));

  applyFilters();
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);

    if (typeof prefs.targetDistance === 'number' && prefs.targetDistance >= 10 && prefs.targetDistance <= 130) {
      state.targetDistance = prefs.targetDistance;
      const slider = document.getElementById('plannerDist');
      if (slider) { slider.value = prefs.targetDistance; }
      const label = document.getElementById('plannerDistVal');
      if (label) label.textContent = prefs.targetDistance + ' mi';
    }

    if (typeof prefs.distMin === 'number') {
      state.distMin = prefs.distMin;
      const el = document.getElementById('distMin');
      if (el) el.value = prefs.distMin;
      const label = document.getElementById('distMinVal');
      if (label) label.textContent = prefs.distMin + ' mi';
    }
    if (typeof prefs.distMax === 'number') {
      state.distMax = prefs.distMax;
      const el = document.getElementById('distMax');
      if (el) el.value = prefs.distMax;
      const label = document.getElementById('distMaxVal');
      if (label) label.textContent = prefs.distMax + ' mi';
    }

    if (typeof prefs.ascentMin === 'number') {
      state.ascentMin = prefs.ascentMin;
      const el = document.getElementById('ascentMin');
      if (el) el.value = prefs.ascentMin;
      const label = document.getElementById('ascentMinVal');
      if (label) label.textContent = prefs.ascentMin + ' m';
    }
    if (typeof prefs.ascentMax === 'number') {
      state.ascentMax = prefs.ascentMax;
      const el = document.getElementById('ascentMax');
      if (el) el.value = prefs.ascentMax;
      const label = document.getElementById('ascentMaxVal');
      if (label) label.textContent = prefs.ascentMax + ' m';
    }

    if (typeof prefs.excludeBusway === 'boolean') {
      state.excludeBusway = prefs.excludeBusway;
      const cb = document.getElementById('buswayToggle');
      if (cb) cb.checked = prefs.excludeBusway;
    }

    if (['off', 'closures', 'all'].includes(prefs.closureMode)) {
      state.closureMode = prefs.closureMode;
      document.querySelectorAll('#closureModeToggle .toggle-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.val === prefs.closureMode));
    }

    if (Array.isArray(prefs.directions) && prefs.directions.length > 0) {
      const valid = ['N','NE','E','SE','S','SW','W','NW'];
      const dirs = prefs.directions.filter(d => valid.includes(d));
      if (dirs.length > 0) {
        state.directions = new Set(dirs);
        document.querySelectorAll('#dirChecks input[type=checkbox]').forEach(cb => {
          cb.checked = dirs.includes(cb.value);
        });
      }
    }

    if (typeof prefs.sort === 'string') {
      state.sort = prefs.sort;
      const sel = document.getElementById('sortSelect');
      if (sel) sel.value = prefs.sort;
    }

    if (typeof prefs.region === 'string') {
      state.region = prefs.region;
      const el = document.getElementById('regionSelect');
      if (el) el.value = prefs.region;
    }
    if (typeof prefs.type === 'string') {
      state.type = prefs.type;
      document.querySelectorAll('#typeToggle .toggle-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.val === prefs.type));
    }
  } catch (e) { /* corrupt data — ignore */ }
}

export function populateRegionDropdown(routes) {
  const select = document.getElementById('regionSelect');
  if (!select) return;

  const regions = new Set();
  routes.forEach(r => {
    const region = (r.region || '').trim();
    if (region) regions.add(region);
  });

  const sorted = [...regions].sort((a, b) => a.localeCompare(b));

  select.innerHTML = '';
  const localOpt = document.createElement('option');
  localOpt.value = 'Cambridge Core';
  localOpt.textContent = 'Cambridge Core';
  select.appendChild(localOpt);

  sorted.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All Regions';
  select.appendChild(allOpt);

  if (state.region && [...select.options].some(o => o.value === state.region)) {
    select.value = state.region;
  } else {
    select.value = 'Cambridge Core';
    state.region = 'Cambridge Core';
  }
}

export function initControls() {
  loadPrefs();

  document.getElementById('regionSelect').addEventListener('change', e => {
    state.region = e.target.value;
    savePrefs();
    applyFilters();
  });

  document.querySelectorAll('#typeToggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#typeToggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.type = btn.dataset.val;
      savePrefs();
      applyFilters();
    });
  });

  ['distMin','distMax','ascentMin','ascentMax'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      const v = e.target.value;
      const labelId = id + 'Val';
      const unit = id.startsWith('dist') ? ' mi' : ' m';
      document.getElementById(labelId).textContent = v + unit;
      state[id] = parseInt(v);
      savePrefs();
      debouncedFilter();
    });
  });

  document.querySelectorAll('#dirChecks input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('#dirChecks input:checked')].map(c => c.value);
      state.directions = new Set(checked);
      savePrefs();
      debouncedFilter();
    });
  });

  document.querySelectorAll('#mapDisplayToggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mapDisplayToggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mapDisplay = btn.dataset.val;
      applyFilters();
    });
  });

  document.getElementById('buswayToggle').addEventListener('change', e => {
    state.excludeBusway = e.target.checked;
    savePrefs();
    applyFilters();
    const dayW = getSelectedDayWeather();
    if (dayW) renderRidePlannerForDay(dayW);
  });

  document.querySelectorAll('#closureModeToggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#closureModeToggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.closureMode = btn.dataset.val;
      savePrefs();
      updateClosureLayers();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    state.sort = e.target.value;
    savePrefs();
    applyFilters();
  });

  document.getElementById('resetBtn').addEventListener('click', resetFilters);

  document.getElementById('filterToggle').addEventListener('click', () => {
    const body = document.getElementById('sidebarBody');
    body.classList.toggle('open');
  });

  window.addEventListener('hashchange', () => checkHash());
}
