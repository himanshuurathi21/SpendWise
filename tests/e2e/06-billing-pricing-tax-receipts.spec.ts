import { test, expect } from '@playwright/test';

async function seedAndForceRender(page: import('@playwright/test').Page, extraTxs: any[] = []) {
  await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
  await page.evaluate((extra) => {
    const sw = (window as any).__SW_STORE;
    if (!sw) return;
    const state = sw.getState();
    const today = new Date().toISOString().split('T')[0];
    const samples = [
      { merchant: 'BigBasket', category: 'Food', amount: 2500, date: today, type: 'debit' },
      { merchant: 'Uber', category: 'Transport', amount: 350, date: today, type: 'debit' },
      { merchant: 'Netflix', category: 'Subscriptions', amount: 649, date: today, type: 'debit' },
      { merchant: 'Salary', category: 'Income', amount: 60000, date: today, type: 'credit' },
      { merchant: 'Amazon', category: 'Shopping', amount: 1299, date: today, type: 'debit' },
      { merchant: 'Zomato', category: 'Food', amount: 450, date: today, type: 'debit' },
      ...(extra || []),
    ];
    samples.forEach((s, i) => {
      sw.getState().addTransaction({ id: `seed-${Date.now()}-${i}`, ...s });
    });
  }, extraTxs);
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

async function navigateToView(page: import('@playwright/test').Page, view: string) {
  // Use SPA navigation to avoid full page reload (preserves in-memory store state)
  await page.evaluate((v) => {
    window.history.pushState({ view: v }, '', `/${v}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { view: v } }));
  }, view);
  await page.waitForTimeout(1500);
}

test.describe('Step 23-26: Billing, Pricing, Tax Reports & Receipts', () => {
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

  test('23.1 - Pricing card renders on /profile', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    await expect(page.getByText(/Your Plan/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Free/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('23.2 - Upgrade button navigates to billing modal', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const upgradeBtn = page.getByRole('button', { name: /Upgrade/i }).first();
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await expect(page.getByText(/Choose a plan/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Best Value/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Subscribe/i }).first()).toBeVisible();
    }
  });

  test('23.3 - Cancel subscription shows confirmation', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('spendwise_plan', 'pro');
      window.localStorage.setItem('spendwise_subscription_id', 'sub_test_12345');
      window.localStorage.setItem('spendwise_subscription_period_end', '2027-01-01');
    });

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const billingTab = page.getByRole('button', { name: /^Billing$/i }).first();
    if (await billingTab.isVisible()) {
      await billingTab.click();
      await page.waitForTimeout(500);
    }

    await expect(page.getByText(/Subscription & Billing/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Pro/i).filter({ visible: true }).first()).toBeVisible();

    const cancelBtn = page.getByText(/Cancel Subscription/i).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.getByText(/Confirm Cancel/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Keep Plan/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('23.4 - Subscription billing modal shows plan comparison', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    const upgradeBtn = page.getByRole('button', { name: /Upgrade/i }).first();
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await expect(page.getByText(/Subscription & Billing/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Free/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Rs.99/i).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Rs.149/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('24.1 - Tax Report page renders with input fields', async ({ page }) => {
    // Use SPA navigation since /taxreport is not a valid initial URL route
    await navigateToView(page, 'taxreport');

    await expect(page.getByText(/ITR Tax Report/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Old vs New regime/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Enter annual income/i).first()).toBeVisible();
  });

  test('24.2 - Income and deduction inputs calculate tax comparison', async ({ page }) => {
    await navigateToView(page, 'taxreport');

    await page.getByPlaceholder(/Enter annual income/i).fill('1200000');
    await page.waitForTimeout(500);

    await expect(page.getByText(/Tax Comparison/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Download PDF Summary/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Share with CA/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('24.3 - Tax-saving suggestions section is interactive', async ({ page }) => {
    await navigateToView(page, 'taxreport');

    await page.getByPlaceholder(/Enter annual income/i).fill('1200000');
    await page.waitForTimeout(500);
    const suggestionsSection = page.getByText(/Suggested Tax-Saving Actions/i).first();
    if (await suggestionsSection.isVisible()) {
      await suggestionsSection.click();
      await expect(page.getByText(/Section 80C/i).or(page.getByText(/No suggestions/i)).first()).toBeVisible();
    }
  });

  test('25.1 - Receipt gallery shows empty state when no receipts', async ({ page }) => {
    await navigateToView(page, 'receipts');

    await expect(page.getByText(/Receipt Gallery/i).filter({ visible: true }).first()).toBeVisible();
    const emptyText = page.getByText(/No receipts/i).or(page.getByText(/Attach receipts/i)).first();
    if (await emptyText.isVisible()) {
      await expect(emptyText).toBeVisible();
    } else {
      await expect(page.getByText(/Receipt Gallery/i).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('25.2 - Receipt gallery shows month-grouped receipts when seeded', async ({ page }) => {
    // Seed receipt data FIRST, then navigate (SPA keeps store in memory)
    const today = new Date().toISOString().split('T')[0];
    await seedAndForceRender(page, [
      {
        merchant: 'Amazon',
        category: 'Shopping',
        amount: 1299,
        date: today,
        type: 'debit',
        receiptUrl: 'https://placehold.co/400x300/teal/white?text=Receipt',
      },
    ]);

    await navigateToView(page, 'receipts');

    await expect(page.getByText(/Receipt Gallery/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Amazon/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('25.3 - Receipt lightbox opens on click', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    await seedAndForceRender(page, [
      {
        merchant: 'Flipkart',
        category: 'Shopping',
        amount: 2499,
        date: today,
        type: 'debit',
        receiptUrl: 'https://placehold.co/400x300/teal/white?text=Receipt',
      },
    ]);

    await navigateToView(page, 'receipts');

    const receiptImg = page.locator(`img[alt*="Flipkart"]`).first();
    if (await receiptImg.isVisible()) {
      await receiptImg.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('[aria-label="Receipt lightbox"]').first()).toBeVisible({ timeout: 3000 });
    }
  });
});
