import { test, expect } from '@playwright/test';

// Helper: wait for route cards to appear after data loads
async function waitForCards(page) {
  await page.waitForSelector('.route-card', { timeout: 15000 });
}

test.describe('SOCC Route Finder', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCards(page);
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/SOCC Route Finder/);
  });

  test('route cards render after data loads', async ({ page }) => {
    const cards = page.locator('.route-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('region dropdown exists and has options', async ({ page }) => {
    const regionSelect = page.locator('#regionSelect');
    await expect(regionSelect).toBeVisible();

    const options = regionSelect.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(2); // At least default + "All Regions"

    // Verify "All Regions" option exists
    await expect(regionSelect.locator('option[value="all"]')).toHaveText('All Regions');
  });

  test('switching region to "All Regions" changes the card count', async ({ page }) => {
    const cards = page.locator('.route-card');
    const initialCount = await cards.count();

    // Switch to All Regions
    await page.selectOption('#regionSelect', 'all');

    // Wait for the card list to update
    await page.waitForTimeout(500);
    const allRegionsCount = await cards.count();

    // All Regions should show at least as many cards as the default region
    expect(allRegionsCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('filter by type (click Road toggle) filters cards', async ({ page }) => {
    // First switch to All Regions so we have a broad set
    await page.selectOption('#regionSelect', 'all');
    await page.waitForTimeout(500);

    const cards = page.locator('.route-card');
    const allCount = await cards.count();

    // Click the Road type toggle button
    await page.click('#typeToggle button[data-val="Road"]');
    await page.waitForTimeout(500);

    const roadCount = await cards.count();

    // Filtering to Road only should show fewer or equal cards
    expect(roadCount).toBeLessThanOrEqual(allCount);
    // And there should be at least some road routes
    expect(roadCount).toBeGreaterThan(0);
  });

  test('distance slider changes update the displayed value', async ({ page }) => {
    const distMinSlider = page.locator('#distMin');
    const distMinVal = page.locator('#distMinVal');

    // Read the initial displayed value
    const initialText = await distMinVal.textContent();

    // Change the slider value programmatically
    await distMinSlider.fill('20');
    await distMinSlider.dispatchEvent('input');
    await page.waitForTimeout(300);

    const updatedText = await distMinVal.textContent();
    expect(updatedText).toContain('20');
    expect(updatedText).not.toBe(initialText);
  });

  test('map view tab switches to show the map container', async ({ page }) => {
    // Initially list panel should be visible
    const listPanel = page.locator('#listPanel');
    await expect(listPanel).toBeVisible();

    // Click the Map tab
    await page.click('#tabMap');
    await page.waitForTimeout(300);

    // Map panel should now be visible
    const mapPanel = page.locator('#masterMapPanel');
    await expect(mapPanel).toBeVisible();

    // Map tab should be active
    await expect(page.locator('#tabMap')).toHaveClass(/active/);
  });

  test('list view tab switches back to show cards', async ({ page }) => {
    // Switch to map view first
    await page.click('#tabMap');
    await page.waitForTimeout(300);

    // Switch back to list view
    await page.click('#tabList');
    await page.waitForTimeout(300);

    // List panel should be visible again
    const listPanel = page.locator('#listPanel');
    await expect(listPanel).toBeVisible();

    // List tab should be active
    await expect(page.locator('#tabList')).toHaveClass(/active/);

    // Route cards should still be there
    const cards = page.locator('.route-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('weather strip renders day forecast cards', async ({ page }) => {
    // Wait for day cards to replace the loading placeholder
    await page.waitForSelector('.weather-day', { timeout: 10000 });
    const days = page.locator('.weather-day');
    const count = await days.count();
    // Open-Meteo returns 7 days
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(8);
  });

  test('Find My Ride panel opens and scores routes', async ({ page }) => {
    // Open the FMR panel
    await page.click('#findRideToggle');
    await expect(page.locator('#findRidePanel')).toBeVisible();

    // Run the scorer
    await page.click('#fmrSearch');
    await page.waitForTimeout(500);

    // Result message should describe the scored routes
    const msg = page.locator('#fmrResultMsg');
    await expect(msg).not.toBeEmpty();
    const text = await msg.textContent();
    expect(text).toMatch(/route/i);
  });

  test('comparison: add two routes, open and close modal', async ({ page }) => {
    // Click compare on the first two cards
    const compareButtons = page.locator('.compare-toggle');
    await compareButtons.nth(0).click();
    await compareButtons.nth(1).click();
    await page.waitForTimeout(200);

    // Compare bar should appear and the button should be enabled
    await expect(page.locator('#compareBar')).toBeVisible();
    await expect(page.locator('#compareBtn')).toBeEnabled();

    // Open the comparison modal
    await page.click('#compareBtn');
    await expect(page.locator('#compareOverlay')).toBeVisible();

    // Close with the ✕ button
    await page.click('#compareClose');
    await expect(page.locator('#compareOverlay')).not.toBeVisible();
  });

  test('comparison: shows toast when adding a 4th route', async ({ page }) => {
    const compareButtons = page.locator('.compare-toggle');
    const count = await compareButtons.count();
    if (count < 4) return; // Need at least 4 routes for this test

    // Add 3 routes
    for (let i = 0; i < 3; i++) {
      await compareButtons.nth(i).click();
    }
    await page.waitForTimeout(200);

    // Try to add a 4th — should show the toast
    await compareButtons.nth(3).click();
    await expect(page.locator('#socc-toast')).toBeVisible();
    const toastText = await page.locator('#socc-toast').textContent();
    expect(toastText).toMatch(/3 routes/i);
  });

  test('empty state appears when no routes match filters', async ({ page }) => {
    // Set distMin slider to an impossibly high value (200 mi) so no routes match
    await page.evaluate(() => {
      const slider = document.getElementById('distMin');
      slider.value = 200;
      slider.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(400);

    // Empty state should now be shown
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state h3')).toHaveText(/no routes match/i);

    // The reset button should be present and work
    const resetBtn = page.locator('.empty-reset');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(400);

    // Cards should be back
    await expect(page.locator('.route-card').first()).toBeVisible();
  });

  test('active filter count badge updates when filters are applied', async ({ page }) => {
    // On load, badge should show 0 (no active filters)
    const badge = page.locator('#activeFilterCount');
    const initialText = await badge.textContent();
    expect(parseInt(initialText)).toBe(0);

    // Apply a type filter
    await page.click('#typeToggle button[data-val="Road"]');
    await page.waitForTimeout(300);

    // Badge count should now be ≥ 1
    const updatedText = await badge.textContent();
    expect(parseInt(updatedText)).toBeGreaterThanOrEqual(1);
  });

  test('card "View on Map" button opens a map panel within the card', async ({ page }) => {
    // Click the map button on the first card
    const mapBtn = page.locator('.btn-map').first();
    await mapBtn.click();
    await page.waitForTimeout(500);

    // A map container should now be visible inside that card
    const cardMapEl = page.locator('.card-map-wrap, .card-map, [id^="map-"]').first();
    await expect(cardMapEl).toBeVisible();
  });

});
