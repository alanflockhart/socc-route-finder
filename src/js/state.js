import { CONFIG } from './config.js';

/* ════════════════════════════════════════════════════════════════════
   STATE — shared mutable state and data containers
   ════════════════════════════════════════════════════════════════════ */
export let allRoutes = [];
export let filteredRoutes = [];
export let allCafes = [];
export let weatherData = null;
export let openMaps = {};
export let filterTimer = null;

export function setAllRoutes(v)      { allRoutes = v; }
export function setFilteredRoutes(v) { filteredRoutes = v; }
export function setAllCafes(v)       { allCafes = v; }
export function setWeatherData(v)    { weatherData = v; }
export function setFilterTimer(v)    { filterTimer = v; }

export const state = {
  region: 'Cambridge Core',
  type: 'all',
  distMin: 0, distMax: 160,
  ascentMin: 0, ascentMax: 2500,
  directions: new Set(['N','NE','E','SE','S','SW','W','NW']),
  mapDisplay: 'all',
  excludeBusway: false,
  closureMode: 'closures',
  sort: 'name',
  targetDistance: CONFIG.TARGET_DISTANCE,
  selectedDayIdx: null,
};

/* ════════════════════════════════════════════════════════════════════
   PREFERENCES — persist filter settings across sessions
   ════════════════════════════════════════════════════════════════════ */
export const PREFS_KEY = 'socc_user_prefs';

export function savePrefs() {
  try {
    const prefs = {
      targetDistance: state.targetDistance,
      excludeBusway: state.excludeBusway,
      closureMode: state.closureMode,
      directions: [...state.directions],
      sort: state.sort,
      region: state.region,
      type: state.type,
      distMin: state.distMin,
      distMax: state.distMax,
      ascentMin: state.ascentMin,
      ascentMax: state.ascentMax
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) { /* localStorage full or disabled */ }
}
