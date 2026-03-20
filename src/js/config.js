// Hide debug panel immediately if SHOW_DEBUG is false — avoids flash of panel on load
  // (CONFIG is defined later in the main script block, so we check a data attribute instead)
  document.getElementById('debugPanel').dataset.managed = '1';

/* ════════════════════════════════════════════════════════════════════
   CONFIG — All tuneable settings live here. See ADMIN_GUIDE.md for details.
   ════════════════════════════════════════════════════════════════════ */
const CONFIG = {

  // ── Google Sheets data source ──────────────────────────────────────
  // The app reads route and café data from a publicly-published Google Sheet.
  // To find these values:
  //   1. Open the Google Sheet → File → Share → Publish to the web → CSV
  //   2. SHEET_ID  — the long ID in the published URL between /e/ and /pub
  //   3. SHEET_GID — the gid= parameter in the URL (each tab has a unique GID)
  //   4. CAFES_GID — same, but for the Cafés tab
  // The sheet must be published (not just shared) for CSV fetch to work.
  SHEET_ID:      '2PACX-1vQflvwcr6Nf1NVyvv45Jt7YWF3fxZO0ecaN8JwMYU4gQeghoYR7eLmkGS7zfSqdlA8VuiIhkQ4eCAYz',
  SHEET_NAME:    'Routes',       // Display name only — not used for fetching
  SHEET_GID:     '429694098',    // GID for the Routes tab
  CAFES_GID:     '2092417686',   // GID for the Cafés tab

  // ── Development & debugging ────────────────────────────────────────
  USE_DEMO_DATA: false,          // true = ignore Google Sheet, use hardcoded demo routes (for offline dev)
  SHOW_DEBUG:    false,          // true = show diagnostics panel at bottom of page

  // ── Weather forecast ───────────────────────────────────────────────
  // Uses Open-Meteo API (free, no key needed, CORS-enabled).
  // Forecast is for Swavesey (52.3063, -0.0004) — 7-day, cached 30 min.
  WEATHER_ENABLED: true,         // false = hide weather strip and ride planner entirely

  // ── Ride planner ───────────────────────────────────────────────────
  DEFAULT_RIDE_DAY: 'sunday',    // Day the club typically rides — used to highlight the weather strip
  TARGET_DISTANCE: 40,           // Default target distance (miles) for the ride-match scoring slider

  // ── Road closures & roadworks (TomTom Traffic API) ─────────────────
  // Free tier: 2,500 requests/day. Sign up at https://developer.tomtom.com
  // Shows road closure icons on master map + coloured overlays on card maps.
  // Roadworks are hidden by default; user toggles them on via sidebar switch.
  TOMTOM_API_KEY: 'gfJ7YgzD1qiK52uAs0WP2zzb5769eMBC',
  ROAD_CLOSURES_ENABLED: true,   // false = disable ALL TomTom features (no API calls made)

  // ── Routes tab column mapping ──────────────────────────────────────
  // Maps Google Sheet column headers (lowercase) → internal field names.
  // If a sheet column header is NOT listed here, it passes through as-is
  // (e.g. 'gpx_url' in the sheet becomes route.gpx_url automatically).
  COLUMN_MAP: {
    'region':                          'region',           // Grouping (e.g. Cambridge Core, Mallorca)
    'type':                            'type',                  // Road / MTB / Gravel
    'ridable':                        'rideable',               // true/false — hide unrideable routes
    'route name':                     'route_name',             // Display name shown on cards
    'distance miles':                 'distance_miles',         // Total distance in miles
    'ascent (per garmin)':            'ascent_metres',          // Total ascent in metres
    'garmin connect link':            'garmin_link',            // Full URL to Garmin Connect route
    'last ride':                      'last_ridden',            // Date text e.g. "10 Jan"
    'busway segment':                 'busway_segment',         // yes/no — uses guided busway
    'speed':                          'recommended_speed_mph',  // Suggested average speed (mph)
    'time':                           'estimated_time_raw',     // Decimal hours e.g. 1.746 → "1 h 45 min"
    'time inc 30 minute coffee stop': 'time_with_coffee',       // Pre-formatted time string
    'roy group':                      'roy_group',              // Route author/group
    'new routes number':              'route_number',           // Numeric ID shown on cards e.g. (27)
    'debrief':                        'notes_debrief',          // Post-ride notes
    'direction':                      'direction',              // Compass: N/NE/E/SE/S/SW/W/NW
    'notes':                          'notes',                  // General notes
    'source':                         'source',                 // Who created the route
    'comparison':                     'comparison',             // Comparison notes
    'start_lat':                      'start_lat',              // Start latitude (decimal degrees)
    'start_long':                     'start_lon',              // Start longitude (decimal degrees)
    // Unmapped columns pass through as-is. Key ones from the sheet:
    //   'gpx_url'  — full URL to GPX file hosted in /gpx/ folder on same domain
  },

  // ── Cafés tab column mapping ───────────────────────────────────────
  CAFE_COLUMN_MAP: {
    'n1':                    'route_ref',       // Route number this café is on
    'village':               'village',          // Village/town name
    'name':                  'cafe_name',        // Café display name
    'rating':                'rating',           // Star rating
    'notes':                 'notes',            // Extra info
    'saturday':              'saturday_hours',   // Saturday opening hours
    'sunday opening time':   'sunday_hours',     // Sunday opening hours
    'lat':                   'lat',              // Café latitude
    'long':                  'lon',              // Café longitude
    'website':               'website',          // Café website URL
  },
};

/* ════════════════════════════════════════════════════════════════════
   DEMO DATA — Representative sample for development / preview
   ════════════════════════════════════════════════════════════════════ */
const DEMO_ROUTES = [
  {
    route_name: "Johnson's Old Hurst",
    region: "Cambridge Core", type: "Road", direction: "NW",
    distance_miles: 27.07, ascent_metres: 119,
    estimated_time: "1 h 45 min", time_with_coffee: "2 h 15 min",
    recommended_speed_mph: 15.5,
    cafe_name: "Johnson's Coffee Shop",
    cafe_hours: "Tue–Fri 7am–4pm, Sat–Sun 9am–2pm, Closed Mon",
    cafe_maps_url: "https://maps.google.com/?q=52.36,-0.09",
    garmin_link: "https://connect.garmin.com",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "10 Jan", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Roy's route", date_added: "2024-01-01",
  },
  {
    route_name: "Ely Cathedral Loop",
    type: "Road", direction: "N",
    distance_miles: 38.4, ascent_metres: 85,
    estimated_time: "2 h 30 min", time_with_coffee: "3 h 00 min",
    recommended_speed_mph: 15,
    cafe_name: "Peacocks Tea Room",
    cafe_hours: "Mon–Sun 9am–5pm",
    cafe_maps_url: "https://maps.google.com/?q=52.398,0.264",
    garmin_link: "https://connect.garmin.com",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "3 Feb", rideable: true,
    busway_segment: true,
    notes: "Pothole on the A10 approach near Stretham — keep right",
    source: "Club route", date_added: "2024-02-01",
  },
  {
    route_name: "St Ives Riverside",
    type: "Road", direction: "NW",
    distance_miles: 22.5, ascent_metres: 60,
    estimated_time: "1 h 30 min", time_with_coffee: "2 h 00 min",
    recommended_speed_mph: 14,
    cafe_name: "The Bridge Café",
    cafe_hours: "Sat–Sun 8am–3pm only",
    cafe_maps_url: "https://maps.google.com/?q=52.33,-0.07",
    garmin_link: "",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "", rideable: true,
    busway_segment: true,
    notes: "Roadworks at Fen Drayton junction until end of March",
    source: "Roy's route", date_added: "2024-03-01",
  },
  {
    route_name: "Gog Magog Gravel",
    type: "Gravel", direction: "SE",
    distance_miles: 31.2, ascent_metres: 310,
    estimated_time: "2 h 20 min", time_with_coffee: "2 h 50 min",
    recommended_speed_mph: 13,
    cafe_name: "Gog Farm Shop Café",
    cafe_hours: "Mon–Sun 9am–4pm",
    cafe_maps_url: "https://maps.google.com/?q=52.16,0.18",
    garmin_link: "https://connect.garmin.com",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "18 Jan", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Club route", date_added: "2024-03-15",
  },
  {
    route_name: "Huntingdon Flat 50",
    type: "Road", direction: "W",
    distance_miles: 51.8, ascent_metres: 145,
    estimated_time: "3 h 20 min", time_with_coffee: "3 h 55 min",
    recommended_speed_mph: 15.5,
    cafe_name: "",
    cafe_hours: "",
    cafe_maps_url: "",
    garmin_link: "https://connect.garmin.com",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "22 Dec", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Roy's route", date_added: "2023-12-01",
  },
  {
    route_name: "Grafham Water Circuit",
    type: "Gravel", direction: "W",
    distance_miles: 19.8, ascent_metres: 95,
    estimated_time: "1 h 25 min", time_with_coffee: "1 h 55 min",
    recommended_speed_mph: 13.5,
    cafe_name: "Grafham Visitor Centre Café",
    cafe_hours: "Sat–Sun 10am–4pm",
    cafe_maps_url: "https://maps.google.com/?q=52.29,-0.29",
    garmin_link: "",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "5 Jan", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Club route", date_added: "2024-01-05",
  },
  {
    route_name: "Newmarket Heath Blast",
    type: "Road", direction: "E",
    distance_miles: 44.3, ascent_metres: 180,
    estimated_time: "2 h 50 min", time_with_coffee: "3 h 25 min",
    recommended_speed_mph: 16,
    cafe_name: "The National Stud Café",
    cafe_hours: "Mon–Fri 9am–3pm",
    cafe_maps_url: "https://maps.google.com/?q=52.23,0.39",
    garmin_link: "https://connect.garmin.com",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "12 Nov", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Roy's route", date_added: "2023-11-01",
  },
  {
    route_name: "Wicken Fen Explorer",
    type: "Gravel", direction: "NE",
    distance_miles: 28.9, ascent_metres: 48,
    estimated_time: "2 h 10 min", time_with_coffee: "2 h 40 min",
    recommended_speed_mph: 13,
    cafe_name: "Wicken Fen Visitor Centre",
    cafe_hours: "Mon–Sun 10am–4pm (seasonal)",
    cafe_maps_url: "https://maps.google.com/?q=52.30,0.30",
    garmin_link: "",
    gpx_url: "",
    start_lat: 52.3063, start_lon: -0.0005,
    last_ridden: "8 Feb", rideable: true,
    busway_segment: false,
    notes: "",
    source: "Club route", date_added: "2024-02-08",
  },
];

const DEMO_CAFES = [
  { route_ref: "5 Miles from Anywhere (58)", village: "upware", cafe_name: "5 Miles from Anywhere", rating: "", notes: "", saturday_hours: "11:00", sunday_hours: "11:00", lat: 52.307786, lon: 0.252429, website: "http://www.fivemilesinn.com/" },
  { route_ref: "Amor Cafe-Hardwick", village: "Hardwick", cafe_name: "Amor", rating: 4, notes: "", saturday_hours: "09:00", sunday_hours: "09:00", lat: 52.217456, lon: 0.01047, website: "https://amorcoffeecompany.co.uk/" },
  { route_ref: "Ambience Cafe (50)", village: "St Neots", cafe_name: "Ambience", rating: "", notes: "", saturday_hours: "09:00", sunday_hours: "09:00", lat: 52.226005, lon: -0.274664, website: "http://www.ambiancecafe.co.uk/" },
];

/* ════════════════════════════════════════════════════════════════════
   WEATHER — Open-Meteo API (free, no API key, CORS-enabled)
   ════════════════════════════════════════════════════════════════════ */

export { CONFIG, DEMO_ROUTES, DEMO_CAFES };
