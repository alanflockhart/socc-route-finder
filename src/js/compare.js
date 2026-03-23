import { CONFIG } from './config.js';
import { escHtml, safe, safeNum, normaliseDir, slugify } from './utils.js';
import { state, allRoutes } from './state.js';
import { getSelectedDayWeather, windAlignmentScore, windLabel } from './weather.js';

/* ════════════════════════════════════════════════════════════════════
   ROUTE COMPARISON
   ════════════════════════════════════════════════════════════════════ */
const compareSet = new Set();
const COMPARE_COLORS = ['#2CBCB3', '#f59e0b', '#8b5cf6'];

function showToast(msg) {
  const existing = document.getElementById('socc-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'socc-toast';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);background:var(--dark);color:#fff;padding:0.6rem 1.2rem;border-radius:2rem;font-size:0.85rem;z-index:9999;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:1;transition:opacity 0.3s ease';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function toggleCompare(slug) {
  if (compareSet.has(slug)) {
    compareSet.delete(slug);
  } else {
    if (compareSet.size >= 3) {
      showToast('Comparison is limited to 3 routes');
      return;
    }
    compareSet.add(slug);
  }
  updateCompareUI();
}

function updateCompareUI() {
  document.querySelectorAll('.compare-toggle').forEach(btn => {
    const slug = btn.id.replace('cmp-', '');
    const active = compareSet.has(slug);
    btn.classList.toggle('active', active);
    const check = btn.querySelector('.compare-check');
    if (check) check.textContent = active ? '✓' : '';
  });

  const bar = document.getElementById('compareBar');
  const chips = document.getElementById('compareChips');
  const btn = document.getElementById('compareBtn');

  if (compareSet.size > 0) {
    bar.classList.add('visible');
    chips.innerHTML = Array.from(compareSet).map(slug => {
      const route = allRoutes.find(r => slugify(r.route_name) === slug);
      const name = route ? escHtml(safe(route.route_name)) : slug;
      return `<span class="compare-chip">
        ${name}
        <button class="compare-chip-remove" onclick="window.toggleCompare('${slug}')" aria-label="Remove ${name}">✕</button>
      </span>`;
    }).join('');
    btn.disabled = compareSet.size < 2;
  } else {
    bar.classList.remove('visible');
  }
}

export function initCompare() {
  const compareBtn = document.getElementById('compareBtn');
  const closeBtn = document.getElementById('compareClose');
  const overlay = document.getElementById('compareOverlay');

  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      if (compareSet.size >= 2) showComparison();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeComparison);
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeComparison();
    });
  }
}

function showComparison() {
  const slugs = Array.from(compareSet);
  const routes = slugs.map(slug => allRoutes.find(r => slugify(r.route_name) === slug)).filter(Boolean);
  if (routes.length < 2) return;

  const body = document.getElementById('compareBody');
  const overlay = document.getElementById('compareOverlay');

  const metrics = [
    { label: 'Route', key: 'name' },
    { label: 'Distance', key: 'distance', unit: ' mi', best: 'closest40' },
    { label: 'Ascent', key: 'ascent', unit: ' m' },
    { label: 'Type', key: 'type' },
    { label: 'Direction', key: 'direction' },
    { label: 'Ride time', key: 'time' },
    { label: 'With coffee', key: 'coffee_time' },
    { label: 'Café', key: 'cafe' },
    { label: 'Wind', key: 'wind' },
    { label: 'Match', key: 'match' },
    { label: 'Busway', key: 'busway' },
    { label: 'Last ridden', key: 'last_ridden' },
  ];

  const getCellVal = (route, key) => {
    switch (key) {
      case 'name': return escHtml(safe(route.route_name));
      case 'distance': return safeNum(route.distance_miles) || '—';
      case 'ascent': return safeNum(route.ascent_metres) || '—';
      case 'type': return escHtml(safe(route.type) || '—');
      case 'direction': return escHtml(normaliseDir(route.direction) || '—');
      case 'time': return escHtml(safe(route.estimated_time) || '—');
      case 'coffee_time': return escHtml(safe(route.time_with_coffee) || '—');
      case 'cafe': return route.cafe_name ? escHtml(safe(route.cafe_name)) : '—';
      case 'wind': {
        const cmpDay = getSelectedDayWeather();
        if (!cmpDay) return '—';
        const ws = windAlignmentScore(normaliseDir(route.direction), cmpDay);
        const wl = windLabel(ws);
        return `<span class="compare-wind-cell ${wl.cls.replace('pick-', 'card-wind-badge ')}">${escHtml(wl.text)}</span>`;
      }
      case 'match': {
        if (route.fmrScore !== undefined) return route.fmrScore + '%';
        const cmpDayM = getSelectedDayWeather();
        if (!cmpDayM) return '—';
        const dir = normaliseDir(route.direction);
        const ws = windAlignmentScore(dir, cmpDayM);
        const dist = safeNum(route.distance_miles);
        const targetDist = state.targetDistance || CONFIG.TARGET_DISTANCE || 40;
        const distDiff = Math.abs(dist - targetDist);
        const distScore = Math.max(0, 1 - distDiff / 40);
        const hasCafe = !!(route.cafe_name || '').trim();
        const lr = safe(route.last_ridden).toLowerCase().trim();
        const total = (ws * 0.45) + (distScore * 0.35) + ((hasCafe ? 1 : 0) * 0.10) + ((lr === '' ? 0.8 : 0.5) * 0.10);
        return Math.round(Math.max(0, Math.min(100, (total + 1) / 2 * 100))) + '%';
      }
      case 'busway': return (route.busway_segment === true || route.busway_segment === 'TRUE') ? 'Yes' : 'No';
      case 'last_ridden': return escHtml(safe(route.last_ridden) || 'Never');
      default: return '—';
    }
  };

  let tableHtml = '<table class="compare-table"><tbody>';
  metrics.forEach(metric => {
    tableHtml += '<tr>';
    tableHtml += `<th>${escHtml(metric.label)}</th>`;
    routes.forEach((route) => {
      const val = getCellVal(route, metric.key);
      const unit = (metric.unit && val !== '—') ? metric.unit : '';
      const cls = metric.key === 'name' ? ' class="compare-route-name"' : '';
      tableHtml += `<td${cls}>${val}${unit}</td>`;
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody></table>';

  tableHtml += `
    <div class="compare-elev-wrap">
      <div class="compare-elev-title">Elevation Profiles (overlaid)</div>
      <div class="compare-elev-chart">
        <canvas id="compareElevChart"></canvas>
      </div>
    </div>`;

  body.innerHTML = tableHtml;
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
  loadCompareElevations(routes);
}

function loadCompareElevations(routes) {
  const canvas = document.getElementById('compareElevChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const fetchElevation = (route, i) => {
    if (!route.gpx_url) return Promise.resolve(null);
    return fetch(route.gpx_url)
      .then(r => r.text())
      .then(gpxText => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(gpxText, 'text/xml');
        const trkpts = doc.querySelectorAll('trkpt');
        const elevations = [];
        trkpts.forEach(pt => {
          const ele = pt.querySelector('ele');
          if (ele) elevations.push(parseFloat(ele.textContent));
        });
        if (elevations.length === 0) return null;
        return {
          label: safe(route.route_name),
          data: downsample(elevations, 100),
          borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
          backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + '20',
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        };
      })
      .catch(() => null);
  };

  Promise.all(routes.map((route, i) => fetchElevation(route, i)))
    .then(results => {
      const datasets = results.filter(Boolean);
      renderCompareChart(canvas, datasets);
    });
}

function downsample(arr, targetLen) {
  if (arr.length <= targetLen) return arr;
  const step = arr.length / targetLen;
  const result = [];
  for (let i = 0; i < targetLen; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}

function renderCompareChart(canvas, datasets) {
  if (datasets.length === 0) {
    canvas.parentElement.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--grey-300);font-size:0.82rem">No GPX elevation data available for these routes</div>';
    return;
  }

  const labels = datasets[0].data.map((_, i) => Math.round(i / datasets[0].data.length * 100) + '%');

  new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: { usePointStyle: true, padding: 12, font: { size: 11, family: "'Inter', sans-serif" } }
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}m` }
        }
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: '% of route', font: { size: 10 } },
          ticks: { maxTicksToShow: 5, font: { size: 9 } },
          grid: { display: false }
        },
        y: {
          display: true,
          title: { display: true, text: 'Elevation (m)', font: { size: 10 } },
          ticks: { font: { size: 9 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

function closeComparison() {
  document.getElementById('compareOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}
