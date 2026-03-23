/* ════════════════════════════════════════════════════════════════════
   SOCC Route Finder — Main Orchestrator
   Imports all modules, wires cross-module deps, runs init.
   ════════════════════════════════════════════════════════════════════ */

import { CONFIG } from './config.js';
import { dbg, fetchRoutes, fetchCafes, clearCache } from './api.js';
import { setAllRoutes, setAllCafes, setWeatherData, allRoutes, allCafes } from './state.js';
import { fetchWeather, renderWeatherStrip, renderRidePlanner, adjustPlannerDist, adjustRange, setRenderCards } from './weather.js';
import { setMapRefs, loadMapClosures } from './closures.js';
import { renderCards, setCardDeps } from './cards.js';
import { refreshMasterMap, getMasterMap, getLeafletMaps, switchView, toggleMap, openMapForCard, shareRoute, checkHash, scrollToCard } from './map.js';
import { applyFilters, initControls, resetFilters, populateRegionDropdown, adjustFilterRanges } from './filters.js';
import { initFindMyRide } from './find-my-ride.js';
import { toggleCompare, initCompare } from './compare.js';

/* ── Wire cross-module lazy dependencies ────────────────────────── */
setRenderCards(renderCards);
setCardDeps(openMapForCard, checkHash);
setMapRefs(getMasterMap, getLeafletMaps);

/* ── Expose functions needed by dynamically-generated HTML ──────── */
window.scrollToCard  = scrollToCard;
window.switchView    = switchView;
window.toggleMap     = toggleMap;
window.shareRoute    = shareRoute;
window.toggleCompare = toggleCompare;
window.resetFilters  = resetFilters;

/* ── Bind UI event listeners (replaces inline onclick handlers) ── */

// Planner distance stepper buttons
document.querySelectorAll('[data-planner-step]').forEach(btn => {
  btn.addEventListener('click', () => adjustPlannerDist(Number(btn.dataset.plannerStep)));
});

// Filter range stepper buttons (distance & ascent)
document.querySelectorAll('[data-range-id]').forEach(btn => {
  btn.addEventListener('click', () => adjustRange(btn.dataset.rangeId, Number(btn.dataset.rangeStep)));
});

// Debug panel hide button
document.getElementById('debugHideBtn')?.addEventListener('click', () => {
  document.getElementById('debugPanel')?.remove();
});

// Sidebar refresh data button
document.getElementById('refreshDataBtn')?.addEventListener('click', () => clearCache());

// Mobile quick action buttons
document.getElementById('mobileResetBtn')?.addEventListener('click', () => resetFilters());
document.getElementById('mobileRefreshBtn')?.addEventListener('click', () => clearCache());

// View tab switches (List / Map)
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Mobile: close sidebar when tapping outside it
document.addEventListener('click', (e) => {
  const sidebarBody = document.getElementById('sidebarBody');
  const filterToggle = document.getElementById('filterToggle');
  if (sidebarBody?.classList.contains('open') &&
      !sidebarBody.contains(e.target) &&
      !filterToggle?.contains(e.target)) {
    sidebarBody.classList.remove('open');
  }
});

/* ── Init ────────────────────────────────────────────────────────── */
async function init() {
  initControls();
  initFindMyRide();
  initCompare();

  // Show debug panel only if flag is set
  if (CONFIG.SHOW_DEBUG) {
    const dp = document.getElementById('debugPanel');
    if (dp) dp.style.display = '';
  }

  dbg('App initialising...');

  try {
    const [routes, cafes, weather] = await Promise.all([
      fetchRoutes(),
      fetchCafes(),
      fetchWeather().catch(e => { dbg(`Weather failed: ${e.message}`, false); return null; }),
    ]);

    setAllRoutes(routes);
    setAllCafes(cafes);
    setWeatherData(weather);

    populateRegionDropdown(allRoutes);
    adjustFilterRanges(allRoutes);
    renderWeatherStrip(weather);
    renderRidePlanner(weather, allRoutes.filter(r => !r.region || r.region === 'Cambridge Core'));

    dbg(`init complete — ${allRoutes.length} routes, ${allCafes.length} cafes loaded`, allRoutes.length > 0);
    applyFilters();

    if (CONFIG.ROAD_CLOSURES_ENABLED && CONFIG.TOMTOM_API_KEY) {
      loadMapClosures().catch(() => {});
    }
  } catch (err) {
    dbg(`init failed: ${err.message}`, false);
    console.error('Failed to load routes:', err);
    document.getElementById('routesGrid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Couldn't load routes</h3>
        <p>Check the debug panel above for details.</p>
      </div>`;
  }
}

init();
