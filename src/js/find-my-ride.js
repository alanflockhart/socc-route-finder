import { safe, normaliseDir, slugify, escHtml } from './utils.js';
import { state, allRoutes, filteredRoutes } from './state.js';
import { getSelectedDayWeather, windAlignmentScore } from './weather.js';
import { applyFilters } from './filters.js';

/* ════════════════════════════════════════════════════════════════════
   FIND MY RIDE — Smart Scoring Engine
   ════════════════════════════════════════════════════════════════════ */
export function initFindMyRide() {
  const toggle = document.getElementById('findRideToggle');
  const panel = document.getElementById('findMyRide');
  const distSlider = document.getElementById('fmrDist');
  const distVal = document.getElementById('fmrDistVal');
  const timeSlider = document.getElementById('fmrTime');
  const timeVal = document.getElementById('fmrTimeVal');
  const searchBtn = document.getElementById('fmrSearch');
  const resetBtn = document.getElementById('fmrReset');
  const resultMsg = document.getElementById('fmrResultMsg');

  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', panel.classList.contains('open'));
  });

  distSlider.addEventListener('input', () => {
    distVal.textContent = distSlider.value + ' mi';
  });
  timeSlider.addEventListener('input', () => {
    const v = parseFloat(timeSlider.value);
    timeVal.textContent = v === 1 ? '1 hr' : v % 1 === 0 ? v + ' hrs' : v + ' hrs';
  });

  document.querySelectorAll('.find-ride-options').forEach(group => {
    group.querySelectorAll('.find-ride-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.find-ride-opt').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      });
    });
  });

  searchBtn.addEventListener('click', () => {
    searchBtn.disabled = true;
    const originalText = searchBtn.textContent;
    searchBtn.textContent = 'Scoring…';
    const prefs = getFindMyRidePrefs();
    // Defer scoring by one frame so the button state renders before the work begins
    requestAnimationFrame(() => {
      applyFindMyRide(prefs);
      searchBtn.disabled = false;
      searchBtn.textContent = originalText;
    });
  });

  resetBtn.addEventListener('click', () => {
    distSlider.value = 40;
    distVal.textContent = '40 mi';
    timeSlider.value = 3;
    timeVal.textContent = '3 hrs';
    document.querySelectorAll('.find-ride-options').forEach(group => {
      group.querySelectorAll('.find-ride-opt').forEach((btn, i) => {
        btn.classList.toggle('active', i === 0 || (group.id === 'fmrDifficulty' && btn.dataset.val === 'moderate'));
        btn.setAttribute('aria-checked', btn.classList.contains('active'));
      });
    });
    const diffGroup = document.getElementById('fmrDifficulty');
    if (diffGroup) {
      diffGroup.querySelectorAll('.find-ride-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.val === 'moderate');
        b.setAttribute('aria-checked', b.dataset.val === 'moderate' ? 'true' : 'false');
      });
    }
    resultMsg.textContent = '';
    state.sort = 'name';
    const sortSel = document.getElementById('sortSelect');
    if (sortSel) sortSel.value = 'name';
    applyFilters();
  });
}

function getFindMyRidePrefs() {
  return {
    distance: parseInt(document.getElementById('fmrDist').value) || 40,
    timeHours: parseFloat(document.getElementById('fmrTime').value) || 3,
    cafe: getActiveVal('fmrCafe') || 'any',
    difficulty: getActiveVal('fmrDifficulty') || 'moderate',
    type: getActiveVal('fmrType') || 'any',
    busway: getActiveVal('fmrBusway') || 'any',
  };
}

function getActiveVal(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return null;
  const active = group.querySelector('.find-ride-opt.active');
  return active ? active.dataset.val : null;
}

function scoreRouteForPrefs(route, prefs) {
  const dist = parseFloat(route.distance_miles) || 0;
  const ascent = parseFloat(route.ascent_metres) || 0;
  const hasCafe = !!(route.cafe_name || '').trim();
  const routeType = (safe(route.type) || 'Road').trim();
  const isBusway = (route.busway_segment === true || route.busway_segment === 'TRUE');
  const lr = safe(route.last_ridden).toLowerCase().trim();

  let score = 0;

  const distDiff = Math.abs(dist - prefs.distance);
  const distScore = Math.exp(-(distDiff * distDiff) / (2 * 15 * 15));
  score += 0.25 * distScore;

  let windScore = 0.5;
  const selectedDayFmr = getSelectedDayWeather();
  if (selectedDayFmr) {
    const dir = normaliseDir(route.direction);
    const ws = windAlignmentScore(dir, selectedDayFmr);
    windScore = (ws + 1) / 2;
  }
  score += 0.25 * windScore;

  if (prefs.cafe === 'yes') {
    score += 0.15 * (hasCafe ? 1 : 0);
  } else if (prefs.cafe === 'no') {
    score += 0.15 * (hasCafe ? 0.3 : 1);
  } else {
    score += 0.15 * 0.8;
  }

  let ascentTarget, ascentSigma;
  if (prefs.difficulty === 'easy') {
    ascentTarget = 100; ascentSigma = 80;
  } else if (prefs.difficulty === 'hard') {
    ascentTarget = 500; ascentSigma = 200;
  } else {
    ascentTarget = 250; ascentSigma = 120;
  }
  const ascentDiff = Math.abs(ascent - ascentTarget);
  const ascentScore = Math.exp(-(ascentDiff * ascentDiff) / (2 * ascentSigma * ascentSigma));
  score += 0.15 * ascentScore;

  const estHours = dist / 15;
  const timeDiff = Math.abs(estHours - prefs.timeHours);
  const timeScore = Math.exp(-(timeDiff * timeDiff) / (2 * 1.2 * 1.2));
  score += 0.10 * timeScore;

  const recencyScore = lr === '' ? 0.9 : 0.4;
  score += 0.10 * recencyScore;

  if (prefs.type !== 'any' && routeType.toLowerCase() !== prefs.type.toLowerCase()) {
    score *= 0.15;
  }

  if (prefs.busway === 'avoid' && isBusway) {
    score *= 0.3;
  }

  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

function applyFindMyRide(prefs) {
  allRoutes.forEach(route => {
    route.fmrScore = scoreRouteForPrefs(route, prefs);
  });

  state.sort = 'fmr_score';
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    if (!sortSel.querySelector('option[value="fmr_score"]')) {
      const opt = document.createElement('option');
      opt.value = 'fmr_score';
      opt.textContent = 'Best match';
      sortSel.insertBefore(opt, sortSel.firstChild);
    }
    sortSel.value = 'fmr_score';
  }

  applyFilters();

  filteredRoutes.forEach(route => {
    const slug = slugify(route.route_name);
    const card = document.getElementById('route-' + slug);
    if (card) {
      const matchEl = card.querySelector('.card-match-score');
      if (matchEl) {
        matchEl.innerHTML = `<span class="match-num">${escHtml(String(route.fmrScore))}%</span> match`;
      }
    }
  });

  const msg = document.getElementById('fmrResultMsg');
  if (msg) {
    const topScore = filteredRoutes[0] ? filteredRoutes[0].fmrScore : 0;
    msg.textContent = `${filteredRoutes.length} routes scored — best match ${topScore}%`;
  }

  const listTab = document.querySelector('.view-tabs');
  if (listTab) listTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
