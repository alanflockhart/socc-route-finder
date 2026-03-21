import { describe, it, expect } from 'vitest';
import {
  escHtml,
  safe,
  safeNum,
  normaliseDir,
  slugify,
  distBadgeClass,
  dirBadgeClass,
  hasRoadwork,
  normaliseGpxUrl,
} from '../utils.js';

/* ── escHtml ─────────────────────────────────────────────────────── */
describe('escHtml', () => {
  it('escapes ampersands', () => {
    expect(escHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles all special chars together', () => {
    expect(escHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('returns empty string for null', () => {
    expect(escHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escHtml(undefined)).toBe('');
  });

  it('returns empty string for false', () => {
    expect(escHtml(false)).toBe('');
  });

  it('converts numbers to string', () => {
    expect(escHtml(42)).toBe('42');
  });

  it('passes through plain strings unchanged', () => {
    expect(escHtml('hello world')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(escHtml('')).toBe('');
  });
});

/* ── safe ────────────────────────────────────────────────────────── */
describe('safe', () => {
  it('returns empty string for null', () => {
    expect(safe(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(safe(undefined)).toBe('');
  });

  it('returns empty string for false', () => {
    expect(safe(false)).toBe('');
  });

  it('returns empty string for true', () => {
    expect(safe(true)).toBe('');
  });

  it('trims whitespace', () => {
    expect(safe('  hello  ')).toBe('hello');
  });

  it('converts numbers to trimmed string', () => {
    expect(safe(42)).toBe('42');
  });

  it('passes through clean strings', () => {
    expect(safe('Road')).toBe('Road');
  });

  it('returns empty string for empty string', () => {
    expect(safe('')).toBe('');
  });
});

/* ── safeNum ─────────────────────────────────────────────────────── */
describe('safeNum', () => {
  it('parses integer strings', () => {
    expect(safeNum('42')).toBe(42);
  });

  it('parses float strings', () => {
    expect(safeNum('3.14')).toBe(3.14);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(safeNum('abc')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(safeNum(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(safeNum(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(safeNum('')).toBe(0);
  });

  it('passes through numbers', () => {
    expect(safeNum(99)).toBe(99);
  });

  it('parses strings with trailing text', () => {
    expect(safeNum('42.5 miles')).toBe(42.5);
  });
});

/* ── normaliseDir ────────────────────────────────────────────────── */
describe('normaliseDir', () => {
  it('uppercases direction', () => {
    expect(normaliseDir('ne')).toBe('NE');
  });

  it('strips whitespace', () => {
    expect(normaliseDir(' N E ')).toBe('NE');
  });

  it('takes first part before slash', () => {
    expect(normaliseDir('NW/SE')).toBe('NW');
  });

  it('handles null', () => {
    expect(normaliseDir(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(normaliseDir(undefined)).toBe('');
  });

  it('handles simple compass directions', () => {
    expect(normaliseDir('S')).toBe('S');
    expect(normaliseDir('SW')).toBe('SW');
  });

  it('handles lowercase with slash', () => {
    expect(normaliseDir('sw/ne')).toBe('SW');
  });
});

/* ── slugify ─────────────────────────────────────────────────────── */
describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello')).toBe('hello');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces multiple special chars with single hyphen', () => {
    expect(slugify('Foo & Bar!')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles route-like names', () => {
    expect(slugify('Ely Cathedral Loop')).toBe('ely-cathedral-loop');
  });

  it('collapses consecutive non-alphanum chars', () => {
    expect(slugify('a   b...c')).toBe('a-b-c');
  });
});

/* ── distBadgeClass ──────────────────────────────────────────────── */
describe('distBadgeClass', () => {
  it('returns green for distances under 25', () => {
    expect(distBadgeClass(10)).toBe('badge-dist-green');
    expect(distBadgeClass(24)).toBe('badge-dist-green');
    expect(distBadgeClass(0)).toBe('badge-dist-green');
  });

  it('returns amber for distances 25-40', () => {
    expect(distBadgeClass(25)).toBe('badge-dist-amber');
    expect(distBadgeClass(30)).toBe('badge-dist-amber');
    expect(distBadgeClass(40)).toBe('badge-dist-amber');
  });

  it('returns red for distances over 40', () => {
    expect(distBadgeClass(41)).toBe('badge-dist-red');
    expect(distBadgeClass(100)).toBe('badge-dist-red');
  });
});

/* ── dirBadgeClass ───────────────────────────────────────────────── */
describe('dirBadgeClass', () => {
  it('returns badge class with direction suffix', () => {
    expect(dirBadgeClass('N')).toBe('badge-dir-N');
    expect(dirBadgeClass('SW')).toBe('badge-dir-SW');
  });
});

/* ── hasRoadwork ─────────────────────────────────────────────────── */
describe('hasRoadwork', () => {
  it('detects "pothole" case-insensitively', () => {
    expect(hasRoadwork('Watch for Pothole near bridge')).toBeTruthy();
  });

  it('detects "roadworks" case-insensitively', () => {
    expect(hasRoadwork('Roadworks on A14')).toBeTruthy();
  });

  it('returns falsy for notes without roadwork keywords', () => {
    expect(hasRoadwork('Nice scenic route')).toBeFalsy();
  });

  it('returns falsy for null/undefined/empty', () => {
    expect(hasRoadwork(null)).toBeFalsy();
    expect(hasRoadwork(undefined)).toBeFalsy();
    expect(hasRoadwork('')).toBeFalsy();
  });
});

/* ── normaliseGpxUrl ─────────────────────────────────────────────── */
describe('normaliseGpxUrl', () => {
  it('converts Google Drive share link to direct download', () => {
    const input = 'https://drive.google.com/file/d/ABC123/view?usp=sharing';
    expect(normaliseGpxUrl(input)).toBe('https://drive.google.com/uc?export=download&id=ABC123');
  });

  it('converts Dropbox link to dl.dropboxusercontent.com', () => {
    const input = 'https://www.dropbox.com/s/abc/route.gpx?dl=0';
    const result = normaliseGpxUrl(input);
    expect(result).toContain('dl.dropboxusercontent.com');
    expect(result).not.toContain('www.dropbox.com');
    expect(result).not.toMatch(/[?&]dl=[01]/);
  });

  it('strips st= parameter from Dropbox URLs', () => {
    const input = 'https://www.dropbox.com/s/abc/route.gpx?dl=0&st=xyz123';
    const result = normaliseGpxUrl(input);
    expect(result).not.toContain('st=');
  });

  it('passes through direct URLs unchanged (after trim)', () => {
    const input = 'https://example.com/route.gpx';
    expect(normaliseGpxUrl(input)).toBe('https://example.com/route.gpx');
  });

  it('returns falsy input as-is', () => {
    expect(normaliseGpxUrl(null)).toBe(null);
    expect(normaliseGpxUrl('')).toBe('');
    expect(normaliseGpxUrl(undefined)).toBe(undefined);
  });

  it('trims whitespace from URLs', () => {
    expect(normaliseGpxUrl('  https://example.com/r.gpx  ')).toBe('https://example.com/r.gpx');
  });
});
