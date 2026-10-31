import { test, expect } from '@playwright/test';

test.describe('DecisionVault Phase 1/2A E2E Verification', () => {
  test('direct backend health check responds on port 4000', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/status');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(body.ollama.model).toBe('gemma4:e4b');
    expect(body.ollama.reachable).toBe(false);
  });

  test('frontend API rewrite proxy forwards /api/status to backend', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/status');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(body.ollama.model).toBe('gemma4:e4b');
  });

  test('homepage renders correctly with identity and scaffold status', async ({ page }) => {
    await page.goto('/');

    // Page title and branding
    await expect(page).toHaveTitle(/DecisionVault/);
    const heading = page.locator('h1');
    await expect(heading).toContainText('DecisionVault');

    // Phase 1 badge
    const badge = page.getByText('Phase 1: Contract Freeze & Runnable Scaffold');
    await expect(badge).toBeVisible();

    // Verification of contract freeze message
    await expect(page.getByText('Contract Freeze Active')).toBeVisible();

    // Verify footer team information
    const footer = page.locator('footer');
    await expect(footer).toContainText('Team Glitch');
  });

  test('navigating to unknown route renders 404 page', async ({ page }) => {
    const response = await page.goto('/non-existent-page-test');
    expect(response?.status()).toBe(404);

    const heading = page.locator('h2');
    await expect(heading).toContainText('404');
    await expect(page.getByText('The requested page does not exist.')).toBeVisible();
  });
});
