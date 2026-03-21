import { describe, it, expect } from 'vitest';
import { normaliseDir } from '../utils.js';

/**
 * The filter logic from applyFilters() in filters.js uses DOM/state dependencies,
 * so we extract and test the pure filtering predicate independently.
 *
 * This mirrors the filter body from:
 *   const filtered = allRoutes.filter(r => { ... });
 */
function filterRoute(route, state) {
  // Region filter
  if (state.region !== 'all') {
    const routeRegion = route.region || 'Cambridge Core';
    if (routeRegion !== state.region) return false;
  }
  // Type filter
  if (state.type !== 'all' && route.type && route.type !== state.type) return false;
  // Distance filter
  const d = parseFloat(route.distance_miles) || 0;
  if (d < state.distMin || d > state.distMax) return false;
  // Ascent filter
  const a = parseFloat(route.ascent_metres) || 0;
  if (a < state.ascentMin || a > state.ascentMax) return false;
  // Direction filter
  const dir = normaliseDir(route.direction);
  if (dir && !state.directions.has(dir)) return false;
  // Busway filter
  if (state.excludeBusway && route.busway_segment === true) return false;
  return true;
}

function defaultState(overrides = {}) {
  return {
    region: 'all',
    type: 'all',
    distMin: 0,
    distMax: 200,
    ascentMin: 0,
    ascentMax: 5000,
    directions: new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
    excludeBusway: false,
    ...overrides,
  };
}

function makeRoute(overrides = {}) {
  return {
    route_name: 'Test Route',
    type: 'Road',
    distance_miles: '30',
    ascent_metres: '200',
    direction: 'N',
    region: 'Cambridge Core',
    busway_segment: false,
    ...overrides,
  };
}

/* ── Region filtering ────────────────────────────────────────────── */
describe('filterRoute — region', () => {
  it('passes all routes when region is "all"', () => {
    const state = defaultState({ region: 'all' });
    expect(filterRoute(makeRoute({ region: 'Peak District' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ region: 'Cambridge Core' }), state)).toBe(true);
  });

  it('filters by specific region', () => {
    const state = defaultState({ region: 'Peak District' });
    expect(filterRoute(makeRoute({ region: 'Peak District' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ region: 'Cambridge Core' }), state)).toBe(false);
  });

  it('defaults missing region to "Cambridge Core"', () => {
    const state = defaultState({ region: 'Cambridge Core' });
    expect(filterRoute(makeRoute({ region: undefined }), state)).toBe(true);
    // Empty string is falsy, so `r.region || 'Cambridge Core'` yields 'Cambridge Core'
    expect(filterRoute(makeRoute({ region: '' }), state)).toBe(true);
  });
});

/* ── Type filtering ──────────────────────────────────────────────── */
describe('filterRoute — type', () => {
  it('passes all types when type is "all"', () => {
    const state = defaultState({ type: 'all' });
    expect(filterRoute(makeRoute({ type: 'Road' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ type: 'Gravel' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ type: 'MTB' }), state)).toBe(true);
  });

  it('filters by specific type', () => {
    const state = defaultState({ type: 'Road' });
    expect(filterRoute(makeRoute({ type: 'Road' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ type: 'MTB' }), state)).toBe(false);
  });

  it('passes routes with no type when filtering (type is falsy)', () => {
    const state = defaultState({ type: 'Road' });
    // When r.type is falsy, the condition `r.type && r.type !== state.type` is false
    expect(filterRoute(makeRoute({ type: '' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ type: undefined }), state)).toBe(true);
  });
});

/* ── Distance filtering ──────────────────────────────────────────── */
describe('filterRoute — distance', () => {
  it('includes routes within range', () => {
    const state = defaultState({ distMin: 20, distMax: 50 });
    expect(filterRoute(makeRoute({ distance_miles: '30' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ distance_miles: '20' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ distance_miles: '50' }), state)).toBe(true);
  });

  it('excludes routes below minimum', () => {
    const state = defaultState({ distMin: 20, distMax: 50 });
    expect(filterRoute(makeRoute({ distance_miles: '10' }), state)).toBe(false);
  });

  it('excludes routes above maximum', () => {
    const state = defaultState({ distMin: 20, distMax: 50 });
    expect(filterRoute(makeRoute({ distance_miles: '60' }), state)).toBe(false);
  });

  it('treats non-numeric distance as 0', () => {
    const state = defaultState({ distMin: 0, distMax: 50 });
    expect(filterRoute(makeRoute({ distance_miles: 'N/A' }), state)).toBe(true);
    const stateMin = defaultState({ distMin: 5, distMax: 50 });
    expect(filterRoute(makeRoute({ distance_miles: 'N/A' }), stateMin)).toBe(false);
  });
});

/* ── Ascent filtering ────────────────────────────────────────────── */
describe('filterRoute — ascent', () => {
  it('includes routes within ascent range', () => {
    const state = defaultState({ ascentMin: 100, ascentMax: 500 });
    expect(filterRoute(makeRoute({ ascent_metres: '200' }), state)).toBe(true);
  });

  it('excludes routes below ascent minimum', () => {
    const state = defaultState({ ascentMin: 100, ascentMax: 500 });
    expect(filterRoute(makeRoute({ ascent_metres: '50' }), state)).toBe(false);
  });

  it('excludes routes above ascent maximum', () => {
    const state = defaultState({ ascentMin: 100, ascentMax: 500 });
    expect(filterRoute(makeRoute({ ascent_metres: '600' }), state)).toBe(false);
  });
});

/* ── Direction filtering ─────────────────────────────────────────── */
describe('filterRoute — direction', () => {
  it('includes routes whose direction is in the set', () => {
    const state = defaultState({ directions: new Set(['N', 'S']) });
    expect(filterRoute(makeRoute({ direction: 'N' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ direction: 'S' }), state)).toBe(true);
  });

  it('excludes routes whose direction is not in the set', () => {
    const state = defaultState({ directions: new Set(['N', 'S']) });
    expect(filterRoute(makeRoute({ direction: 'E' }), state)).toBe(false);
  });

  it('normalises direction before checking (lowercase, slash)', () => {
    const state = defaultState({ directions: new Set(['NW']) });
    expect(filterRoute(makeRoute({ direction: 'nw' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ direction: 'NW/SE' }), state)).toBe(true);
  });

  it('passes routes with empty direction (no direction to exclude)', () => {
    const state = defaultState({ directions: new Set(['N']) });
    expect(filterRoute(makeRoute({ direction: '' }), state)).toBe(true);
    expect(filterRoute(makeRoute({ direction: null }), state)).toBe(true);
  });
});

/* ── Busway filtering ────────────────────────────────────────────── */
describe('filterRoute — busway exclusion', () => {
  it('includes busway routes when excludeBusway is false', () => {
    const state = defaultState({ excludeBusway: false });
    expect(filterRoute(makeRoute({ busway_segment: true }), state)).toBe(true);
  });

  it('excludes busway routes when excludeBusway is true', () => {
    const state = defaultState({ excludeBusway: true });
    expect(filterRoute(makeRoute({ busway_segment: true }), state)).toBe(false);
  });

  it('includes non-busway routes when excludeBusway is true', () => {
    const state = defaultState({ excludeBusway: true });
    expect(filterRoute(makeRoute({ busway_segment: false }), state)).toBe(true);
  });
});

/* ── Combined filters ────────────────────────────────────────────── */
describe('filterRoute — combined', () => {
  it('applies all filters together', () => {
    const state = defaultState({
      region: 'Cambridge Core',
      type: 'Road',
      distMin: 20,
      distMax: 50,
      ascentMin: 0,
      ascentMax: 300,
      directions: new Set(['N', 'NE']),
      excludeBusway: true,
    });

    // Passes all filters
    expect(filterRoute(makeRoute({
      region: 'Cambridge Core',
      type: 'Road',
      distance_miles: '30',
      ascent_metres: '200',
      direction: 'N',
      busway_segment: false,
    }), state)).toBe(true);

    // Fails region
    expect(filterRoute(makeRoute({
      region: 'Peak District',
      type: 'Road',
      distance_miles: '30',
      ascent_metres: '200',
      direction: 'N',
    }), state)).toBe(false);

    // Fails type
    expect(filterRoute(makeRoute({
      type: 'MTB',
      distance_miles: '30',
      ascent_metres: '200',
      direction: 'N',
    }), state)).toBe(false);

    // Fails distance
    expect(filterRoute(makeRoute({
      distance_miles: '60',
      direction: 'N',
    }), state)).toBe(false);

    // Fails direction
    expect(filterRoute(makeRoute({
      distance_miles: '30',
      direction: 'SW',
    }), state)).toBe(false);

    // Fails busway
    expect(filterRoute(makeRoute({
      distance_miles: '30',
      direction: 'N',
      busway_segment: true,
    }), state)).toBe(false);
  });
});

/* ── Sorting logic ───────────────────────────────────────────────── */
describe('sorting comparators', () => {
  const routes = [
    { route_name: 'Beta', distance_miles: 30, ascent_metres: 200, fmrScore: 5, last_ridden: '2024-01-01' },
    { route_name: 'Alpha', distance_miles: 50, ascent_metres: 100, fmrScore: 10, last_ridden: '2024-06-01' },
    { route_name: 'Charlie', distance_miles: 20, ascent_metres: 300, fmrScore: 1, last_ridden: '' },
  ];

  function sortRoutes(arr, sortKey) {
    const safe = (v) => {
      if (v === null || v === undefined || v === false || v === true) return '';
      return String(v).trim();
    };
    return [...arr].sort((a, b) => {
      if (sortKey === 'fmr_score')   return (b.fmrScore || 0) - (a.fmrScore || 0);
      if (sortKey === 'name')        return safe(a.route_name).localeCompare(safe(b.route_name));
      if (sortKey === 'dist_asc')    return (a.distance_miles || 0) - (b.distance_miles || 0);
      if (sortKey === 'dist_desc')   return (b.distance_miles || 0) - (a.distance_miles || 0);
      if (sortKey === 'ascent')      return (a.ascent_metres || 0) - (b.ascent_metres || 0);
      if (sortKey === 'last_ridden') return (b.last_ridden || '').localeCompare(a.last_ridden || '');
      return 0;
    });
  }

  it('sorts by name alphabetically', () => {
    const sorted = sortRoutes(routes, 'name');
    expect(sorted.map(r => r.route_name)).toEqual(['Alpha', 'Beta', 'Charlie']);
  });

  it('sorts by distance ascending', () => {
    const sorted = sortRoutes(routes, 'dist_asc');
    expect(sorted.map(r => r.distance_miles)).toEqual([20, 30, 50]);
  });

  it('sorts by distance descending', () => {
    const sorted = sortRoutes(routes, 'dist_desc');
    expect(sorted.map(r => r.distance_miles)).toEqual([50, 30, 20]);
  });

  it('sorts by ascent ascending', () => {
    const sorted = sortRoutes(routes, 'ascent');
    expect(sorted.map(r => r.ascent_metres)).toEqual([100, 200, 300]);
  });

  it('sorts by FMR score descending', () => {
    const sorted = sortRoutes(routes, 'fmr_score');
    expect(sorted.map(r => r.fmrScore)).toEqual([10, 5, 1]);
  });

  it('sorts by last ridden (most recent first)', () => {
    const sorted = sortRoutes(routes, 'last_ridden');
    expect(sorted.map(r => r.route_name)).toEqual(['Alpha', 'Beta', 'Charlie']);
  });
});
