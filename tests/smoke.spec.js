const { test, expect } = require('@playwright/test');

test('loads game UI and can draw a card', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#phaser-root')).toBeVisible();
  await expect(page.locator('#endTurnBtn')).toBeVisible();
  await expect(page.locator('#deckTopP1')).toBeVisible();

  await expect(page).toHaveTitle(/2Dカードゲーム/);

  await page.click('#deckTopP1');
  await expect(page.locator('#messageLog')).toContainText(/手札に加えました|カードを手札に/);
});

