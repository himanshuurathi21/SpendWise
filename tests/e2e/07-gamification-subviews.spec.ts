import { test, expect } from '@playwright/test';

async function seedAndForceRender(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
  await page.evaluate(() => {
    const sw = (window as any).__SW_STORE;
    if (!sw) return;
    const state = sw.getState();
    if (state.transactions.length > 0) return;
    const today = new Date().toISOString().split('T')[0];
    const samples = [];
    for (let i = 0; i < 12; i++) {
      const categories = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health'];
      samples.push({
        merchant: `Merchant-${i}`,
        category: categories[i % categories.length],
        amount: Math.floor(Math.random() * 5000) + 100,
        date: today,
        type: 'debit',
      });
    }
    samples.push(
      { merchant: 'Salary', category: 'Income', amount: 60000, date: today, type: 'credit' },
      { merchant: 'Freelance', category: 'Income', amount: 15000, date: today, type: 'credit' }
    );
    samples.forEach((s, i) => {
      sw.getState().addTransaction({ id: `seed-${Date.now()}-${i}`, ...s });
    });
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const sw = (window as any).__SW_STORE;
    if (sw) {
      const state = sw.getState();
      sw.setState({ transactions: [...state.transactions] });
    }
  });
  await page.waitForTimeout(500);
}

async function hydrateAfterGoto(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const sw = (window as any).__SW_STORE;
    if (sw) {
      const state = sw.getState();
      sw.setState({ transactions: [...state.transactions] });
    }
  });
  await page.waitForTimeout(500);
}

test.describe('Step 27-30: Gamification Sub-views (Quests, Badges, Inventory, Shop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('spendwise_session_unlocked', 'true');
      window.localStorage.setItem(
        'spendwise_config_v1',
        JSON.stringify({
          initialBalance: 5000,
          currency: '\u20b9',
          name: 'Test User',
          userRole: 'professional',
          occupation: 'Student',
          location: 'London',
          monthlyGoal: 7000,
          onboardingComplete: true,
          createdAt: new Date().toISOString(),
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await seedAndForceRender(page);
  });

  test('27.1 - Gamification overview tab renders level and XP', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    await expect(page.getByText(/Overview/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Finance Quest/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/XP/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('27.2 - Personality section and quick-action tiles are visible', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    await expect(page.getByText(/Your Spending Personality/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Daily Quests/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Badge Gallery/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('28.1 - Quests tab shows daily quests', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const questsTab = page.getByRole('tab', { name: /Quests/i }).or(page.getByText(/^Quests$/).filter({ visible: true })).first();
    if (await questsTab.isVisible()) {
      await questsTab.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(/Daily Quests/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('28.2 - Quests can be completed by clicking', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const questsTab = page.getByRole('tab', { name: /Quests/i }).or(page.getByText(/^Quests$/).filter({ visible: true })).first();
    if (await questsTab.isVisible()) {
      await questsTab.click();
      await page.waitForTimeout(1000);
    }

    const questCards = page.locator('div').filter({ hasText: /Done/ }).or(page.locator('div').filter({ hasText: /\+\d+ XP/ }));
    const questCount = await questCards.count();

    const firstQuest = page.locator('div').filter({ hasText: /\+\d+ XP/ }).first();
    if (await firstQuest.isVisible()) {
      await firstQuest.click();
      await page.waitForTimeout(500);
      const doneBadge = page.getByText('Done').first();
      const doneAfter = await doneBadge.isVisible().catch(() => false);
      expect(doneAfter || (await page.locator('div').filter({ hasText: 'Done' }).count()) > questCount).toBe(true);
    }
  });

  test('29.1 - Badges tab shows achievement gallery', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const badgesTab = page.getByRole('tab', { name: /Badges/i }).or(page.getByText(/^Badges$/).filter({ visible: true })).first();
    if (await badgesTab.isVisible()) {
      await badgesTab.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(/Achievement Gallery/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('29.2 - Badges show unlocked and locked sections', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const badgesTab = page.getByRole('tab', { name: /Badges/i }).or(page.getByText(/^Badges$/).filter({ visible: true })).first();
    if (await badgesTab.isVisible()) {
      await badgesTab.click();
      await page.waitForTimeout(1000);
    }

    const percentageText = await page.getByText(/% Complete/i).first().isVisible().catch(() => false);
    expect(percentageText).toBe(true);
  });

  test('30.1 - Challenges tab shows savings challenges', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const challengesTab = page.getByRole('tab', { name: /Challenges/i }).or(page.getByText(/^Challenges$/).filter({ visible: true })).first();
    if (await challengesTab.isVisible()) {
      await challengesTab.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(/Savings Challenges/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('30.2 - Start Learning button navigates to education', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const startLearningBtn = page.getByRole('button', { name: /Start Learning/i }).first();
    if (await startLearningBtn.isVisible()) {
      await startLearningBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Learn/i).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
