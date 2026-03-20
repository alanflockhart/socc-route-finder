/* ════════════════════════════════════════════════════════════════════
   HELPERS — pure utility functions with no side effects
   ════════════════════════════════════════════════════════════════════ */

export function escHtml(s) {
  if (s === null || s === undefined || s === false) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function safe(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  return String(v).trim();
}

export function safeNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function normaliseDir(d) {
  const s = safe(d).toUpperCase().replace(/\s/g,'');
  if (s.includes('/')) return s.split('/')[0];
  return s;
}

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function distBadgeClass(mi) {
  if (mi < 25) return 'badge-dist-green';
  if (mi <= 40) return 'badge-dist-amber';
  return 'badge-dist-red';
}

export function dirBadgeClass(dir) {
  return `badge-dir-${dir}`;
}

export function hasRoadwork(notes) {
  return notes && /pothole|roadworks/i.test(notes);
}

/**
 * Convert Google Drive / Dropbox share links to direct-download URLs.
 * Self-hosted and already-direct URLs pass through unchanged.
 */
export function normaliseGpxUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();

  // Google Drive share link → direct download
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  // Dropbox share link → direct download (dl=1)
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace(/[?&]dl=0/, '?dl=1').replace(/([^?])$/, '$1?dl=1');
  }

  return trimmed;
}
