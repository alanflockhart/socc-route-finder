// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { state, savePrefs, PREFS_KEY } from '../state.js';

/**
 * Tests for filter preference persistence (savePrefs / loadPrefs round-trip).
 *
 * loadPrefs() lives in filters.js which pulls in map/weather/closures modules
 * that depend on the browser's Leaflet global — untestable in jsdom.
 * Instead we test:
 *   1. savePrefs() writes the correct JSON to localStorage
 *   2. The serialisation format is stable (keys, types, defaults)
 * The loadPrefs() restore logic is verified by the E2E suite which runs
 * against the full app in Chromium.
 */

describe('savePrefs', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset state to defaults before each test
    state.region = 'Cambridge Core';
    state.type = 'all';
    state.distMin = 0;
    state.distMax = 160;
    state.ascentMin = 0;
    state.ascentMax = 4000;
    state.directions = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    state.excludeBusway = false;
    state.closureMode = 'closures';
    state.sort = 'name';
    state.targetDistance = 40;
  });

  it('writes preferences to localStorage under the correct key', () => {
    savePrefs();
    const stored = localStorage.getItem(PREFS_KEY);
    expect(stored).not.toBeNull();
  });

  it('serialises default state correctly', () => {
    savePrefs();
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));

    expect(prefs.region).toBe('Cambridge Core');
    expect(prefs.type).toBe('all');
    expect(prefs.distMin).toBe(0);
    expect(prefs.distMax).toBe(160);
    expect(prefs.ascentMin).toBe(0);
    expect(prefs.ascentMax).toBe(4000);
    expect(prefs.excludeBusway).toBe(false);
    expect(prefs.closureMode).toBe('closures');
    expect(prefs.sort).toBe('name');
    expect(prefs.targetDistance).toBe(40);
  });

  it('serialises directions as an array (JSON-safe)', () => {
    savePrefs();
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
    expect(Array.isArray(prefs.directions)).toBe(true);
    expect(prefs.directions).toHaveLength(8);
    expect(prefs.directions).toContain('N');
    expect(prefs.directions).toContain('SW');
  });

  it('persists modified state values', () => {
    state.type = 'Road';
    state.distMin = 20;
    state.distMax = 50;
    state.excludeBusway = true;
    state.sort = 'dist_asc';
    state.region = 'all';

    savePrefs();
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));

    expect(prefs.type).toBe('Road');
    expect(prefs.distMin).toBe(20);
    expect(prefs.distMax).toBe(50);
    expect(prefs.excludeBusway).toBe(true);
    expect(prefs.sort).toBe('dist_asc');
    expect(prefs.region).toBe('all');
  });

  it('persists a partial direction set correctly', () => {
    state.directions = new Set(['N', 'NE', 'E']);
    savePrefs();
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));

    expect(prefs.directions).toHaveLength(3);
    expect(prefs.directions).toContain('N');
    expect(prefs.directions).toContain('NE');
    expect(prefs.directions).toContain('E');
    expect(prefs.directions).not.toContain('S');
  });

  it('overwrites a previous save with updated values', () => {
    state.type = 'Road';
    savePrefs();

    state.type = 'MTB';
    savePrefs();

    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
    expect(prefs.type).toBe('MTB');
  });

  it('includes all expected keys in the stored object', () => {
    savePrefs();
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
    const expectedKeys = [
      'targetDistance', 'excludeBusway', 'closureMode',
      'directions', 'sort', 'region', 'type',
      'distMin', 'distMax', 'ascentMin', 'ascentMax',
    ];
    for (const key of expectedKeys) {
      expect(prefs).toHaveProperty(key);
    }
  });
});
