# SOCC Route Finder — User Guide

A quick guide to getting the most out of the Swavesey & Over Cycling Club route finder.

---

## Opening the App

Visit the site in any modern browser (Chrome, Safari, Firefox, Edge).
Everything loads in one page — no login, no account needed.

---

## Weather & Ride Planning

The **weather strip** at the top shows a 7-day forecast for Swavesey. The club ride day (Sunday) is highlighted with a star.

**Click any day** to plan a ride for that date:

- The **Ride Planner** panel expands, showing wind direction, temperature, and conditions.
- **Top Picks** appear — routes scored against the weather (tailwind out, headwind home = best).
- Use the **Target Distance** slider to adjust how far you want to ride. Routes closest to your target score highest.
- A **wind compass** shows which direction the wind is blowing — the app automatically favours routes that give you a tailwind on the outward leg.

---

## Browsing Routes

### List View

The default view shows route **cards** with key info at a glance:

| Field | What it means |
|-------|--------------|
| Distance (mi) | Total route distance in miles |
| Ascent (m) | Total climbing in metres |
| Type | Road, MTB, or Gravel |
| Direction | Compass direction from Swavesey (N/E/S/W) |
| Ride time | Estimated time at suggested speed |
| Inc. coffee | Time including a 30-minute coffee stop |
| Speed | Suggested average speed in mph |

**Click a card** to expand it and see:

- An interactive **map** showing the route, nearby cafes, and any road closures.
- An **elevation profile** chart.
- Buttons to **View on Map**, **Download GPX**, open in **Garmin Connect**, or **Share** the route.

### Map View

Click the **Map** tab to see all routes on a single map. Each route has:

- A **coloured circle marker** at its start point — click for a popup summary.
- A **coloured track line** showing the full GPX route.
- Hover over a track to see its name; click for details.

The map starts centred on the club HQ (Swavesey). If you filter to a specific type (e.g. MTB), it zooms to show those routes.

Once you pan or zoom manually, the map **stays where you put it** even when toggling filters. Hit **Reset all filters** to return to the default view.

---

## Filtering Routes

Open the **Filter Routes** sidebar to narrow down what you see:

| Filter | How it works |
|--------|-------------|
| **Type** | All, Road, MTB, or Gravel |
| **Distance** | Min/max range slider (miles) |
| **Ascent** | Min/max range slider (metres) |
| **Direction** | N / E / S / W checkboxes. Each covers 3 compass points (e.g. N = NW + N + NE) |
| **Exclude Busway** | Hides routes that use the guided busway |
| **Show Roadworks** | Toggles amber roadwork markers on the master map (off by default) |

The **badge** on the filter header shows how many filters are active. The count (e.g. "14 of 14") updates live.

**Reset all filters** clears everything back to defaults.

---

## Comparing Routes

1. Tick the **Compare** checkbox on two or more route cards.
2. A **comparison panel** appears at the bottom showing the selected routes side by side.
3. An **overlay elevation chart** lets you visually compare the climbing profiles.

---

## Road Closures & Roadworks

The app fetches live road closure data from TomTom:

- **Red markers** on the master map = road closures (always visible).
- **Amber markers** = roadworks (hidden by default — toggle on in the sidebar).
- On **card maps**, closures and roadworks near the route are shown as bold coloured lines overlaid on the route.

---

## Sharing a Route

Click the **Share** button on any route card to copy a direct link. Send it to a fellow rider and they'll see that route highlighted when they open it.

---

## Tips for Getting the Best Out of It

1. **Plan around the wind** — click Sunday on the weather strip and let the app suggest routes with a tailwind out.
2. **Set your target distance** — slide the distance target to your preferred ride length for more accurate match scores.
3. **Use the map** — zoom into an area to spot routes you might not have noticed in the list.
4. **Compare before you choose** — tick 2-3 similar routes and compare elevation profiles.
5. **Check closures** — expand a route card before riding to see if any roads are closed along the way.
6. **Download the GPX** — load it onto your Garmin or bike computer for turn-by-turn navigation.
7. **Refresh data** — hit "Refresh data" if you know the route sheet has been updated recently (data is cached for 1 hour).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Map shows grey/blank tiles | Check your internet connection; tiles load from OpenStreetMap |
| Routes not showing | Click "Refresh data" to clear the cache and re-fetch from the Google Sheet |
| Weather strip empty | Weather data comes from Open-Meteo; may be temporarily unavailable |
| GPX download button greyed out | That route doesn't have a GPX file uploaded yet |
| Elevation profile looks flat | The GPX file may not contain elevation data |
