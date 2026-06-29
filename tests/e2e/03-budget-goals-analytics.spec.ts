import { test, expect } from '@playwright/test';

test.describe('Step 6, 7, 8: Budget, Goals & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding and disable Privacy Shield
    await page.addInitScript(() => {
      window.sessionStorage.setItem('spendwise_session_unlocked', 'true');
      window.localStorage.setItem(
        'spendwise_config_v1',
        JSON.stringify({
          initialBalance: 5000,
          currency: '₹',
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

    // Seed initial transactions for tests that need them (e.g. Reports)
    await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
    await page.evaluate(() => {
      const sw = (window as any).__SW_STORE;
      if (!sw) return;
      const state = sw.getState();
      if (state.transactions.length > 0) return;
      const today = new Date().toISOString().split('T')[0];
      const samples = [
        { merchant: 'BigBasket', category: 'Food', amount: 2500, date: today, type: 'debit' },
        { merchant: 'Uber', category: 'Transport', amount: 350, date: today, type: 'debit' },
        { merchant: 'Netflix', category: 'Subscriptions', amount: 649, date: today, type: 'debit' },
        { merchant: 'Salary', category: 'Income', amount: 60000, date: today, type: 'credit' },
        { merchant: 'Amazon', category: 'Shopping', amount: 1299, date: today, type: 'debit' },
        { merchant: 'Zomato', category: 'Food', amount: 450, date: today, type: 'debit' },
      ];
      samples.forEach((s, i) => {
        sw.getState().addTransaction({ id: `seed-${Date.now()}-${i}`, ...s });
      });
    });
    // Wait for IndexedDB persist and force state reference update
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const sw = (window as any).__SW_STORE;
      if (sw) {
        const state = sw.getState();
        sw.setState({ transactions: [...state.transactions] });
      }
    });
    await page.waitForTimeout(500);
  });

  test('6.1 to 6.4 - Budget Manager', async ({ page }) => {
    // Open Budget view
    await page
      .getByRole('tab', { name: 'Budget' })
      .or(page.getByRole('button', { name: 'Budget' }))
      .first()
      .click();

    // Add budget
    const addBudgetBtn = page.getByRole('button', { name: /\+ Add Budget/i });
    if (await addBudgetBtn.isVisible()) {
      await addBudgetBtn.click();

      // Select category (Food)
      await page.locator('select').first().selectOption({ label: 'Food' });

      // Enter limit
      await page.getByPlaceholder(/Amount/i).fill('3000');
      await page.getByRole('button', { name: /Save/i }).click();

      // Budget should appear
      await expect(page.getByText(/3,000/i)).toBeVisible();
    }
  });

  test('7.1 to 7.5 - Savings Goals', async ({ page }) => {
    // Open Goals view from More features drawer (if visible/mobile)
    const moreBtn = page.getByRole('button', { name: 'More features' });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }
    await page
      .getByRole('tab', { name: 'Goals' })
      .or(page.getByRole('button', { name: 'Goals' }))
      .first()
      .click();

    // Create new goal
    const newGoalBtn = page.getByRole('button', { name: /\+ New Goal/i });
    if (await newGoalBtn.isVisible()) {
      await newGoalBtn.click();

      await page.getByPlaceholder(/Name/i).fill('MacBook');
      await page.getByPlaceholder(/Target/i).fill('80000');
      await page.getByRole('button', { name: /Save/i }).click();

      // Check goal card
      await expect(page.getByText('MacBook')).toBeVisible();
      await expect(page.getByText(/80,000/i)).toBeVisible();
    }
  });

  test('8.1 to 8.5 - Analytics & Statistics', async ({ page }) => {
    // Open Analytics view
    await page
      .getByRole('tab', { name: 'Statistics' })
      .or(page.getByRole('button', { name: 'Statistics' }))
      .first()
      .click();

    // Check if charts container is rendering
    await expect(page.locator('.recharts-wrapper, canvas, svg').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('10.1 to 10.4 - Reports Generation', async ({ page }) => {
    // Open Reports via More Drawer (if visible/mobile)
    const moreBtn = page.getByRole('button', { name: 'More features' });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }
    await page
      .getByRole('tab', { name: 'Reports' })
      .or(page.getByRole('button', { name: 'Reports' }))
      .first()
      .click();

    // Check report generation elements
    const generateBtn = page.getByRole('button', { name: /Generate/i }).first();
    await expect(generateBtn).toBeVisible();

    // Click Generate to build report and display export controls
    await generateBtn.click();

    // Expect PDF print option and Markdown download option to be visible
    await expect(page.getByRole('button', { name: /PDF/i })).toBeVisible();
    await expect(
      page.getByLabel(/Markdown/i).or(page.locator('[title="Download as Markdown"]'))
    ).toBeVisible();
  });
});
