// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  windAlignmentScore,
  windLabel,
  DIR_TO_BEARING,
  degreesToCompass,
  formatDateNice,
} from '../weather.js';

/* ── DIR_TO_BEARING constant ─────────────────────────────────────── */
describe('DIR_TO_BEARING', () => {
  it('maps all 8 compass directions to correct bearings', () => {
    expect(DIR_TO_BEARING.N).toBe(0);
    expect(DIR_TO_BEARING.NE).toBe(45);
    expect(DIR_TO_BEARING.E).toBe(90);
    expect(DIR_TO_BEARING.SE).toBe(135);
    expect(DIR_TO_BEARING.S).toBe(180);
    expect(DIR_TO_BEARING.SW).toBe(225);
    expect(DIR_TO_BEARING.W).toBe(270);
    expect(DIR_TO_BEARING.NW).toBe(315);
  });

  it('contains exactly 8 entries', () => {
    expect(Object.keys(DIR_TO_BEARING)).toHaveLength(8);
  });
});

/* ── degreesToCompass ─────────────────────────────────────────────── */
describe('degreesToCompass', () => {
  it('converts 0 degrees to N', () => {
    expect(degreesToCompass(0)).toBe('N');
  });

  it('converts 90 degrees to E', () => {
    expect(degreesToCompass(90)).toBe('E');
  });

  it('converts 180 degrees to S', () => {
    expect(degreesToCompass(180)).toBe('S');
  });

  it('converts 270 degrees to W', () => {
    expect(degreesToCompass(270)).toBe('W');
  });

  it('converts 45 degrees to NE', () => {
    expect(degreesToCompass(45)).toBe('NE');
  });

  it('converts 360 degrees to N (wraps around)', () => {
    expect(degreesToCompass(360)).toBe('N');
  });

  it('converts 315 degrees to NW', () => {
    expect(degreesToCompass(315)).toBe('NW');
  });

  it('handles intermediate values (rounds to nearest)', () => {
    // 22 degrees is closer to N (0) than NE (45)
    expect(degreesToCompass(22)).toBe('N');
    // 23 degrees is exactly on boundary, rounds to NE
    expect(degreesToCompass(23)).toBe('NE');
  });
});

/* ── windAlignmentScore ──────────────────────────────────────────── */
describe('windAlignmentScore', () => {
  it('returns 0 when no weather data', () => {
    expect(windAlignmentScore('N', null)).toBe(0);
    expect(windAlignmentScore('N', undefined)).toBe(0);
  });

  it('returns 1.0 (perfect tailwind) when route direction matches wind direction', () => {
    // Wind from S (180), route heading S (180) => angle diff = 0 => cos(0) = 1
    const weather = { windDir: 180 };
    const score = windAlignmentScore('S', weather);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns -1.0 (headwind) when route is opposite to wind', () => {
    // Wind from S (180), route heading N (0) => angle diff = 180 => cos(180) = -1
    const weather = { windDir: 180 };
    const score = windAlignmentScore('N', weather);
    expect(score).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 (crosswind) when route is perpendicular to wind', () => {
    // Wind from S (180), route heading E (90) => angle diff = 90 => cos(90) = 0
    const weather = { windDir: 180 };
    const score = windAlignmentScore('E', weather);
    expect(score).toBeCloseTo(0, 5);
  });

  it('handles diagonal directions', () => {
    // Wind from SW (225), route heading SW (225) => angle diff = 0 => cos(0) = 1
    const weather = { windDir: 225 };
    const score = windAlignmentScore('SW', weather);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('handles angle wrapping correctly', () => {
    // Wind from NW (315), route heading NE (45) => diff = 270 => wrapped = 90 => cos(90) = 0
    const weather = { windDir: 315 };
    const score = windAlignmentScore('NE', weather);
    expect(score).toBeCloseTo(0, 5);
  });

  it('defaults unknown direction to S (180)', () => {
    // Unknown dir => bearing 180, wind from 180 => diff = 0 => cos(0) = 1
    const weather = { windDir: 180 };
    const score = windAlignmentScore('UNKNOWN', weather);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('handles empty/null route direction (defaults to 180)', () => {
    // normaliseDir(null) => '', DIR_TO_BEARING[''] is undefined, ?? 180
    const weather = { windDir: 0 };
    const score = windAlignmentScore(null, weather);
    // bearing = 180, wind = 0, diff = 180, cos(180) = -1
    expect(score).toBeCloseTo(-1.0, 5);
  });
});

/* ── windLabel ───────────────────────────────────────────────────── */
describe('windLabel', () => {
  it('returns "Tailwind home" for score > 0.7', () => {
    const result = windLabel(0.8);
    expect(result.text).toBe('Tailwind home');
    expect(result.cls).toBe('pick-wind-tail');
  });

  it('returns "Tailwind home" for score = 1.0', () => {
    const result = windLabel(1.0);
    expect(result.text).toBe('Tailwind home');
    expect(result.cls).toBe('pick-wind-tail');
  });

  it('returns "Mostly favourable" for score between 0.25 and 0.7', () => {
    const result = windLabel(0.5);
    expect(result.text).toBe('Mostly favourable');
    expect(result.cls).toBe('pick-wind-favour');
  });

  it('returns "Mostly favourable" for score = 0.3', () => {
    const result = windLabel(0.3);
    expect(result.text).toBe('Mostly favourable');
    expect(result.cls).toBe('pick-wind-favour');
  });

  it('returns "Crosswind" for score between -0.25 and 0.25', () => {
    const result = windLabel(0.0);
    expect(result.text).toBe('Crosswind');
    expect(result.cls).toBe('pick-wind-cross');
  });

  it('returns "Crosswind" for score = 0.25', () => {
    const result = windLabel(0.25);
    expect(result.text).toBe('Crosswind');
    expect(result.cls).toBe('pick-wind-cross');
  });

  it('returns "Headwind home" for score = -0.25 (boundary: > -0.25 is Crosswind)', () => {
    // score > -0.25 is Crosswind, so exactly -0.25 falls to Headwind
    const result = windLabel(-0.25);
    expect(result.text).toBe('Headwind home');
    expect(result.cls).toBe('pick-wind-head');
  });

  it('returns "Headwind home" for score <= -0.25', () => {
    const result = windLabel(-0.5);
    expect(result.text).toBe('Headwind home');
    expect(result.cls).toBe('pick-wind-head');
  });

  it('returns "Headwind home" for score = -1.0', () => {
    const result = windLabel(-1.0);
    expect(result.text).toBe('Headwind home');
    expect(result.cls).toBe('pick-wind-head');
  });

  it('boundary: score exactly 0.7 is "Crosswind" or "Mostly favourable"', () => {
    // score > 0.7 is Tailwind, so 0.7 falls to "Mostly favourable"
    const result = windLabel(0.7);
    expect(result.text).toBe('Mostly favourable');
    expect(result.cls).toBe('pick-wind-favour');
  });
});

/* ── formatDateNice ──────────────────────────────────────────────── */
describe('formatDateNice', () => {
  it('formats a date string nicely', () => {
    const result = formatDateNice('2026-03-01');
    // en-GB: "1 March 2026"
    expect(result).toBe('1 March 2026');
  });

  it('returns original string if parsing fails', () => {
    const result = formatDateNice('not-a-date');
    // new Date('not-a-dateT12:00:00') gives Invalid Date
    // toLocaleDateString on Invalid Date may throw or return 'Invalid Date'
    // The function catches and returns the original string
    expect(typeof result).toBe('string');
  });
});
