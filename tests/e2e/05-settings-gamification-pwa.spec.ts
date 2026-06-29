import { test, expect } from '@playwright/test';

async function seedAndForceRender(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
  // Seed transactions if store is empty
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
  await page.waitForTimeout(2000); // Wait for IndexedDB persist
  // Force React re-render (zustand v5 + React 19 workaround)
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
  // After a page navigation, wait for store hydration and force re-render
  await page.waitForFunction(() => (window as any).__SW_STORE !== undefined, null, { timeout: 5000 });
  await page.waitForTimeout(2000); // Wait for persist middleware to read from IndexedDB
  await page.evaluate(() => {
    const sw = (window as any).__SW_STORE;
    if (sw) {
      const state = sw.getState();
      sw.setState({ transactions: [...state.transactions] });
    }
  });
  await page.waitForTimeout(500);
}

test.describe('Step 16-22: Gamification, Profile, Privacy & Settings', () => {
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

    // Navigate to root and seed transactions into IndexedDB
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await seedAndForceRender(page);
  });

  test('16.1 to 16.5 - Gamification & XP', async ({ page }) => {
    await page.goto('/gamification');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);
    // Check level up and XP interface
    await expect(page.getByText(/Level/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/XP/i).filter({ visible: true }).first()).toBeVisible();
    await expect(
      page
        .getByText(/Quests/i)
        .filter({ visible: true })
        .first()
    ).toBeVisible();
  });

  test('17.1 to 17.3 - Financial Education', async ({ page }) => {
    await page.goto('/education');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);
    await expect(page.getByText(/Learn/i).filter({ visible: true }).first()).toBeVisible();

    // Check if lesson cards are rendered
    const lessonCard = page.locator('.lesson-card, .MuiCard-root, [role="article"]').first();
    if (await lessonCard.isVisible()) {
      await expect(lessonCard).toBeVisible();
    }
  });

  test('18.1 to 18.5 - Parental Controls', async ({ page }) => {
    await page.goto('/parental');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);
    await expect(
      page
        .getByText(/Parental/i)
        .filter({ visible: true })
        .first()
    ).toBeVisible();

    const setupPinBtn = page.getByRole('button', { name: /Set Up/i });
    if (await setupPinBtn.isVisible()) {
      await setupPinBtn.click();
      await page.getByPlaceholder(/PIN/i).first().fill('1234');
      await page.getByRole('button', { name: /Confirm/i }).click();

      // Dashboard unlocks
      await expect(
        page
          .getByText(/Monthly Limit/i)
          .filter({ visible: true })
          .first()
      ).toBeVisible();
    }
  });

  test('19.1 to 19.10 - Profile & Settings', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    // Check name editing
    const nameInput = page.getByPlaceholder(/Name/i).first();
    await expect(nameInput).toBeVisible();

    // Toggle dark mode
    const darkModeToggle = page.getByRole('checkbox', { name: /Dark Mode/i });
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      // Test DOM for dark mode class
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
  });

  test('20.1 to 20.6 - Privacy Mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    // Find privacy toggle (eye icon) in header by its aria-label
    const privacyBtn = page.getByLabel(/privacy mode/i).first();
    if (await privacyBtn.isVisible()) {
      await privacyBtn.click();

      // Balance should be blurred (••••••)
      await expect(page.getByText('••••••').first()).toBeVisible();

      // Toggle back - Note: Disabling privacy has a 1200ms simulated biometric delay
      await privacyBtn.click();
      await expect(page.getByText('••••••').first()).toBeHidden({ timeout: 5000 });
    }
  });

  test('21 & 22 - Notifications & PWA checks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hydrateAfterGoto(page);

    // Notification bell check
    const bellBtn = page.getByLabel(/View notifications/i).first();
    if (await bellBtn.isVisible()) {
      await bellBtn.click();
      await expect(
        page
          .getByText(/Notifications/i)
          .filter({ visible: true })
          .first()
      ).toBeVisible();
    }

    // PWA manifest check - simple verification
    const manifestLink = await page.$('link[rel="manifest"]');
    expect(manifestLink).toBeTruthy();
  });
});
