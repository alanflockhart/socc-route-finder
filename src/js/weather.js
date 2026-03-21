import { CONFIG } from './config.js';
import { escHtml, safe, safeNum, normaliseDir, slugify } from './utils.js';
import { state, allRoutes, weatherData, savePrefs } from './state.js';
import { dbg } from './api.js';

/* ════════════════════════════════════════════════════════════════════
   WEATHER — Open-Meteo API (free, no API key, CORS-enabled)
   ════════════════════════════════════════════════════════════════════ */
const WEATHER_CACHE_KEY = 'socc_weather_cache';
const WEATHER_CACHE_TTL = 30 * 60 * 1000;

const WMO_CODES = {
  0: { icon: '☀️', desc: 'Clear sky' },
  1: { icon: '🌤️', desc: 'Mainly clear' },
  2: { icon: '⛅', desc: 'Partly cloudy' },
  3: { icon: '☁️', desc: 'Overcast' },
  45: { icon: '🌫️', desc: 'Foggy' },
  48: { icon: '🌫️', desc: 'Icy fog' },
  51: { icon: '🌦️', desc: 'Light drizzle' },
  53: { icon: '🌦️', desc: 'Drizzle' },
  55: { icon: '🌧️', desc: 'Heavy drizzle' },
  61: { icon: '🌧️', desc: 'Light rain' },
  63: { icon: '🌧️', desc: 'Rain' },
  65: { icon: '🌧️', desc: 'Heavy rain' },
  66: { icon: '🌨️', desc: 'Freezing rain' },
  67: { icon: '🌨️', desc: 'Heavy freezing rain' },
  71: { icon: '🌨️', desc: 'Light snow' },
  73: { icon: '🌨️', desc: 'Snow' },
  75: { icon: '❄️', desc: 'Heavy snow' },
  77: { icon: '🌨️', desc: 'Snow grains' },
  80: { icon: '🌦️', desc: 'Light showers' },
  81: { icon: '🌧️', desc: 'Showers' },
  82: { icon: '⛈️', desc: 'Heavy showers' },
  85: { icon: '🌨️', desc: 'Snow showers' },
  86: { icon: '❄️', desc: 'Heavy snow showers' },
  95: { icon: '⛈️', desc: 'Thunderstorm' },
  96: { icon: '⛈️', desc: 'Thunderstorm + hail' },
  99: { icon: '⛈️', desc: 'Thunderstorm + heavy hail' },
};

export function degreesToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const DEMO_WEATHER = {
  daily: [
    { date: '2026-03-01', dayName: 'Sunday', tempMax: 11, tempMin: 4, windSpeed: 14, windDir: 210, windDirLabel: 'SW', rainProb: 25, weatherCode: 2, icon: '⛅', desc: 'Partly cloudy' },
    { date: '2026-03-02', dayName: 'Monday', tempMax: 9, tempMin: 3, windSpeed: 18, windDir: 240, windDirLabel: 'WSW', rainProb: 60, weatherCode: 61, icon: '🌧️', desc: 'Light rain' },
    { date: '2026-03-03', dayName: 'Tuesday', tempMax: 10, tempMin: 5, windSpeed: 12, windDir: 180, windDirLabel: 'S', rainProb: 35, weatherCode: 3, icon: '☁️', desc: 'Overcast' },
    { date: '2026-03-04', dayName: 'Wednesday', tempMax: 12, tempMin: 6, windSpeed: 8, windDir: 150, windDirLabel: 'SE', rainProb: 10, weatherCode: 1, icon: '🌤️', desc: 'Mainly clear' },
    { date: '2026-03-05', dayName: 'Thursday', tempMax: 13, tempMin: 7, windSpeed: 10, windDir: 90, windDirLabel: 'E', rainProb: 15, weatherCode: 0, icon: '☀️', desc: 'Clear sky' },
    { date: '2026-03-06', dayName: 'Friday', tempMax: 11, tempMin: 5, windSpeed: 16, windDir: 270, windDirLabel: 'W', rainProb: 45, weatherCode: 80, icon: '🌦️', desc: 'Light showers' },
    { date: '2026-03-07', dayName: 'Saturday', tempMax: 10, tempMin: 4, windSpeed: 20, windDir: 315, windDirLabel: 'NW', rainProb: 55, weatherCode: 63, icon: '🌧️', desc: 'Rain' },
  ],
  sunday: null,
  lastFetched: Date.now(),
};
DEMO_WEATHER.sunday = DEMO_WEATHER.daily[0];

export async function fetchWeather() {
  if (!CONFIG.WEATHER_ENABLED) return null;

  if (CONFIG.USE_DEMO_DATA) {
    dbg('Weather: using demo data', true);
    return DEMO_WEATHER;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    if (cached && (Date.now() - cached.lastFetched < WEATHER_CACHE_TTL)) {
      dbg(`Weather cache hit — ${Math.floor((Date.now() - cached.lastFetched) / 60000)} min old`, true);
      return cached;
    }
  } catch(e) { /* ignore */ }

  const lat = 52.3063, lon = -0.0004;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,weathercode`
    + `&wind_speed_unit=mph&timezone=Europe%2FLondon&forecast_days=7`;

  try {
    dbg(`Weather: fetching from Open-Meteo...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const daily = json.daily.time.map((dateStr, i) => {
      const d = new Date(dateStr + 'T12:00:00');
      const wmo = json.daily.weathercode[i];
      const wmoInfo = WMO_CODES[wmo] || { icon: '🌤️', desc: 'Unknown' };
      const windDir = Math.round(json.daily.wind_direction_10m_dominant[i] || 0);
      return {
        date: dateStr,
        dayName: dayNames[d.getDay()],
        tempMax: Math.round(json.daily.temperature_2m_max[i]),
        tempMin: Math.round(json.daily.temperature_2m_min[i]),
        windSpeed: Math.round(json.daily.wind_speed_10m_max[i]),
        windDir: windDir,
        windDirLabel: degreesToCompass(windDir),
        rainProb: Math.round(json.daily.precipitation_probability_max[i] || 0),
        weatherCode: wmo,
        icon: wmoInfo.icon,
        desc: wmoInfo.desc,
      };
    });

    const rideDay = CONFIG.DEFAULT_RIDE_DAY.charAt(0).toUpperCase() + CONFIG.DEFAULT_RIDE_DAY.slice(1);
    const sunday = daily.find(d => d.dayName === rideDay) || daily[0];
    const weather = { daily, sunday, lastFetched: Date.now() };

    try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather)); } catch(e) { /* quota */ }
    dbg(`Weather fetched — ${daily.length} days, ${rideDay}: ${sunday.icon} ${sunday.tempMax}°C, wind ${sunday.windDirLabel} ${sunday.windSpeed}mph`, true);
    return weather;
  } catch(e) {
    dbg(`Weather fetch failed: ${e.message}`, false);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════════
   WEATHER RENDERING
   ════════════════════════════════════════════════════════════════════ */
export function renderWeatherStrip(weather) {
  const strip = document.getElementById('weatherStrip');
  if (!strip) return;

  if (!weather || !weather.daily || weather.daily.length === 0) {
    strip.innerHTML = '<div class="weather-loading">Weather unavailable</div>';
    return;
  }

  const rideDay = CONFIG.DEFAULT_RIDE_DAY.charAt(0).toUpperCase() + CONFIG.DEFAULT_RIDE_DAY.slice(1);
  const selectedIdx = weather.daily.findIndex(d => d.dayName === rideDay);

  strip.innerHTML = weather.daily.map((day, idx) => {
    const isSunday = day.dayName === rideDay;
    const isSelected = idx === selectedIdx;
    const windRotation = day.windDir;
    return `<div class="weather-day${isSunday ? ' sunday-highlight' : ''}${isSelected ? ' day-selected' : ''}"
      data-day-idx="${idx}" title="${escHtml(day.desc)} — click to plan rides for this day" role="button" tabindex="0">
      <div class="weather-day-name">${isSunday ? '&#9733; ' : ''}${escHtml(day.dayName.slice(0, 3))}</div>
      <div class="weather-day-icon">${day.icon}</div>
      <div class="weather-day-temp">${day.tempMax}° <span>${day.tempMin}°</span></div>
      <div class="weather-day-wind">
        <span class="wind-arrow" style="transform:rotate(${windRotation}deg)">↓</span>
        ${escHtml(day.windDirLabel)} ${day.windSpeed}
      </div>
      <div class="weather-day-rain">${day.rainProb > 0 ? '💧 ' + day.rainProb + '%' : '&nbsp;'}</div>
    </div>`;
  }).join('');

  strip.querySelectorAll('.weather-day').forEach(el => {
    el.addEventListener('click', function() {
      const idx = parseInt(this.dataset.dayIdx, 10);
      selectPlannerDay(idx);
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
    });
  });
}

// Lazy-loaded reference to renderCards (set by main.js to break circular dep)
let _renderCards = null;
export function setRenderCards(fn) { _renderCards = fn; }

export function selectPlannerDay(dayIdx) {
  if (!weatherData || !weatherData.daily || !weatherData.daily[dayIdx]) return;
  state.selectedDayIdx = dayIdx;

  document.querySelectorAll('.weather-day').forEach((el, i) => {
    el.classList.toggle('day-selected', i === dayIdx);
  });

  renderRidePlannerForDay(weatherData.daily[dayIdx]);

  if (_renderCards) _renderCards();
}

export function renderRidePlannerForDay(dayData) {
  const heading = document.getElementById('plannerHeading');
  const advice = document.getElementById('plannerAdvice');
  const picksContainer = document.getElementById('plannerPicks');
  const weatherCard = document.getElementById('plannerWeatherCard');

  if (heading) heading.textContent = `This ${dayData.dayName}'s Ride`;

  const picksTitle = document.getElementById('plannerPicksTitle');
  if (picksTitle) picksTitle.textContent = `Top picks for ${dayData.dayName}`;

  const windFromLabel = dayData.windDirLabel;
  const optimalOutbound = degreesToCompass(dayData.windDir);
  if (advice) {
    advice.innerHTML = `Wind from the <strong>${escHtml(windFromLabel)}</strong> at <strong>${dayData.windSpeed} mph</strong> — `
      + `head <strong>${escHtml(optimalOutbound)}</strong> outbound for a tailwind home.`;
  }

  if (weatherCard) {
    weatherCard.innerHTML = `
      <div class="planner-weather-day">${escHtml(dayData.dayName)}</div>
      <div class="planner-weather-date">${formatDateNice(dayData.date)}</div>
      <div class="planner-weather-icon">${dayData.icon}</div>
      <div class="planner-weather-desc">${escHtml(dayData.desc)}</div>
      <div class="planner-weather-stats">
        <div>
          <div class="planner-weather-stat-val">${dayData.tempMax}°<span style="font-size:0.7rem;color:rgba(255,255,255,0.4)">/${dayData.tempMin}°</span></div>
          <div class="planner-weather-stat-label">Temperature</div>
        </div>
        <div>
          <div class="planner-weather-stat-val">${dayData.windSpeed}<span style="font-size:0.65rem;color:rgba(255,255,255,0.4)"> mph</span></div>
          <div class="planner-weather-stat-label">Wind ${escHtml(windFromLabel)}</div>
        </div>
        <div>
          <div class="planner-weather-stat-val">${dayData.rainProb}<span style="font-size:0.65rem;color:rgba(255,255,255,0.4)">%</span></div>
          <div class="planner-weather-stat-label">Rain chance</div>
        </div>
        <div>
          <div class="planner-weather-stat-val" style="font-size:0.85rem">${escHtml(dayData.desc)}</div>
          <div class="planner-weather-stat-label">Outlook</div>
        </div>
      </div>
      <div class="wind-compass-wrap" title="Wind from ${escHtml(windFromLabel)}">
        ${buildWindCompassSVG(dayData.windDir)}
      </div>
    `;
  }

  const targetDist = state.targetDistance || 40;
  const coreRoutes = allRoutes.filter(r => !r.region || r.region === 'Cambridge Core');
  const scored = scoreSundayRoutes(coreRoutes, weatherData, targetDist, dayData);
  renderPickCards(scored.slice(0, 3), picksContainer);
}

/* ════════════════════════════════════════════════════════════════════
   RIDE PLANNER — Scoring & Rendering
   ════════════════════════════════════════════════════════════════════ */
export const DIR_TO_BEARING = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };

export function getSelectedDayWeather() {
  if (!weatherData || !weatherData.daily) return null;
  if (state.selectedDayIdx != null && weatherData.daily[state.selectedDayIdx]) {
    return weatherData.daily[state.selectedDayIdx];
  }
  return weatherData.sunday || null;
}

export function windAlignmentScore(routeDir, sundayWeather) {
  if (!sundayWeather) return 0;
  const routeBearing = DIR_TO_BEARING[normaliseDir(routeDir)] ?? 180;
  const windFrom = sundayWeather.windDir;
  let angleDiff = Math.abs(routeBearing - windFrom);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;
  return Math.cos(angleDiff * Math.PI / 180);
}

export function windLabel(score) {
  if (score > 0.7)  return { text: 'Tailwind home',     cls: 'pick-wind-tail' };
  if (score > 0.25) return { text: 'Mostly favourable', cls: 'pick-wind-favour' };
  if (score > -0.25) return { text: 'Crosswind',        cls: 'pick-wind-cross' };
  return                     { text: 'Headwind home',    cls: 'pick-wind-head' };
}

export function scoreSundayRoutes(routes, weather, targetDist, dayWeather) {
  const day = dayWeather || (weather && weather.sunday);
  if (!day) return routes.filter(r => (safe(r.type)||'Road').toLowerCase() === 'road').slice(0, 3);

  const roadRoutes = routes.filter(r => {
    if ((safe(r.type)||'Road').toLowerCase() !== 'road') return false;
    if (state.excludeBusway && r.busway_segment === true) return false;
    return true;
  });

  return roadRoutes.map(route => {
    const dist = safeNum(route.distance_miles);
    const dir = normaliseDir(route.direction);
    const ws = windAlignmentScore(dir, day);
    const distDiff = Math.abs(dist - targetDist);
    const distScore = Math.max(0, 1 - distDiff / 40);
    const hasCafe = !!(route.cafe_name || '').trim();
    const cafeScore = hasCafe ? 1 : 0;
    const lr = safe(route.last_ridden).toLowerCase().trim();
    const recencyScore = lr === '' ? 0.8 : 0.5;
    const total = (ws * 0.45) + (distScore * 0.35) + (cafeScore * 0.10) + (recencyScore * 0.10);
    const matchPct = Math.round(Math.max(0, Math.min(100, (total + 1) / 2 * 100)));
    const wl = windLabel(ws);
    return { ...route, matchPct, windScore: ws, windLabelText: wl.text, windLabelCls: wl.cls };
  }).sort((a, b) => b.matchPct - a.matchPct);
}

export function formatDateNice(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dateStr; }
}

function buildWindCompassSVG(windDir) {
  const rotation = (windDir + 180) % 360;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(44,188,179,0.3)" stroke-width="2" stroke-dasharray="8 4"/>
    <text x="50" y="14" fill="rgba(255,255,255,0.3)" font-size="8" text-anchor="middle" font-weight="700">N</text>
    <text x="50" y="96" fill="rgba(255,255,255,0.3)" font-size="8" text-anchor="middle" font-weight="700">S</text>
    <text x="8" y="54" fill="rgba(255,255,255,0.3)" font-size="8" text-anchor="middle" font-weight="700">W</text>
    <text x="92" y="54" fill="rgba(255,255,255,0.3)" font-size="8" text-anchor="middle" font-weight="700">E</text>
    <g transform="rotate(${rotation} 50 50)">
      <line x1="50" y1="18" x2="50" y2="70" stroke="#2CBCB3" stroke-width="3" stroke-linecap="round"/>
      <polygon points="50,16 44,28 56,28" fill="#2CBCB3"/>
    </g>
  </svg>`;
}

export function adjustPlannerDist(delta) {
  const slider = document.getElementById('plannerDist');
  if (!slider) return;
  const newVal = Math.min(Math.max(parseInt(slider.min), parseInt(slider.value) + delta), parseInt(slider.max));
  slider.value = newVal;
  slider.dispatchEvent(new Event('input'));
}

export function adjustRange(id, delta) {
  const slider = document.getElementById(id);
  if (!slider) return;
  const newVal = Math.min(Math.max(parseInt(slider.min), parseInt(slider.value) + delta), parseInt(slider.max));
  slider.value = newVal;
  slider.dispatchEvent(new Event('input'));
}

export function renderRidePlanner(weather, routes) {
  const advice = document.getElementById('plannerAdvice');
  const picksContainer = document.getElementById('plannerPicks');
  const weatherCard = document.getElementById('plannerWeatherCard');
  const plannerDistSlider = document.getElementById('plannerDist');

  if (!weather || !weather.sunday) {
    if (advice) advice.textContent = 'Weather data unavailable — showing routes by distance match only.';
    if (weatherCard) weatherCard.innerHTML = '<div class="planner-no-weather">Weather unavailable</div>';
    const targetDist = state.targetDistance || 40;
    const roadRoutes = routes.filter(r => {
      if ((safe(r.type)||'Road').toLowerCase() !== 'road') return false;
      if (state.excludeBusway && r.busway_segment === true) return false;
      return true;
    });
    const sorted = roadRoutes.slice().sort((a, b) => {
      return Math.abs(safeNum(a.distance_miles) - targetDist) - Math.abs(safeNum(b.distance_miles) - targetDist);
    }).slice(0, 3);
    renderPickCards(sorted, picksContainer);
    return;
  }

  const rideDay = CONFIG.DEFAULT_RIDE_DAY.charAt(0).toUpperCase() + CONFIG.DEFAULT_RIDE_DAY.slice(1);
  if (state.selectedDayIdx == null) {
    state.selectedDayIdx = weather.daily.findIndex(d => d.dayName === rideDay);
    if (state.selectedDayIdx < 0) state.selectedDayIdx = 0;
  }

  renderRidePlannerForDay(weather.daily[state.selectedDayIdx]);

  if (plannerDistSlider && !plannerDistSlider._bound) {
    plannerDistSlider._bound = true;
    plannerDistSlider.addEventListener('input', function() {
      state.targetDistance = parseInt(this.value, 10);
      const valEl = document.getElementById('plannerDistVal');
      if (valEl) valEl.textContent = state.targetDistance + ' mi';
      savePrefs();
      const dayWeather = getSelectedDayWeather();
      const coreRoutes = allRoutes.filter(r => !r.region || r.region === 'Cambridge Core');
      const scored2 = scoreSundayRoutes(coreRoutes, weatherData, state.targetDistance, dayWeather);
      renderPickCards(scored2.slice(0, 3), document.getElementById('plannerPicks'));
    });
  }
}

function renderPickCards(picks, container) {
  if (!container) return;
  if (!picks || picks.length === 0) {
    container.innerHTML = '<div class="planner-no-weather">No routes match your criteria</div>';
    return;
  }

  container.innerHTML = picks.map(route => {
    const slug = slugify(route.route_name);
    const dist = safeNum(route.distance_miles);
    const dir = normaliseDir(route.direction);
    const cafe = safe(route.cafe_name);
    const matchPct = route.matchPct || 0;
    const windCls = route.windLabelCls || 'pick-wind-cross';
    const windText = route.windLabelText || 'Unknown';

    return `<div class="pick-card" onclick="window.scrollToCard('${slug}')">
      <div class="pick-card-match">${matchPct}% match</div>
      <div class="pick-card-name">${escHtml(safe(route.route_name))}</div>
      <div class="pick-card-meta">
        <span>${dist} mi</span>
        <span>${escHtml(dir)}</span>
        <span>${escHtml(safe(route.type))}</span>
      </div>
      <div class="pick-card-wind ${windCls}">${escHtml(windText)}</div>
      ${cafe ? `<div class="pick-card-cafe">☕ ${escHtml(cafe)}</div>` : ''}
    </div>`;
  }).join('');
}
