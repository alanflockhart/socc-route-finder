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

});
