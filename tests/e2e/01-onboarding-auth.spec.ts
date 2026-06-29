import { test, expect } from '@playwright/test';

test.describe('Step 1 & 2: Onboarding & Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Inject sessionStorage key to prevent Privacy Shield from popping up during testing
    await page.addInitScript(() => {
      window.sessionStorage.setItem('spendwise_session_unlocked', 'true');
    });
  });

  test('1.1.1 & 1.1.2 - Onboarding appears on fresh start and step 1 works', async ({ page }) => {
    await page.goto('/');

    // Check if onboarding modal is visible
    await expect(page.getByText("Let's get started")).toBeVisible();

    // Fill step 1 (Current Balance)
    await page.locator('#balance-input').fill('5000');

    // Select Role button should be enabled
    const selectRoleBtn = page.getByRole('button', { name: /Select Role/i });
    await expect(selectRoleBtn).toBeEnabled();
    await selectRoleBtn.click();

    // Step 1 transitions to family step (Who is this for?)
    await expect(page.getByText(/Who is this for/i)).toBeVisible();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Should proceed to step 2 (Persona / Role Selection)
    await expect(page.getByText(/Choose your Persona/i)).toBeVisible();
  });

  test('1.1.3 - Step 1 Validation', async ({ page }) => {
    await page.goto('/');

    // Attempt to click Select Role with empty balance
    const selectRoleBtn = page.getByRole('button', { name: /Select Role/i });
    await expect(selectRoleBtn).toBeDisabled();
  });

  test('1.1.4 to 1.1.8 - Complete full onboarding flow', async ({ page }) => {
    await page.goto('/');

    // Step 1: Balance & Currency
    await page.locator('#balance-input').fill('5000');
    await page.getByRole('button', { name: /Select Role/i }).click();

    // Family Step: Who is this for?
    await expect(page.getByText(/Who is this for/i)).toBeVisible();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 2: Choose Persona
    await expect(page.getByText(/Choose your Persona/i)).toBeVisible();
    await page.getByRole('button', { name: /Almost There/i }).click();

    // Step 3: Finalize Profile
    await expect(page.getByText(/Finalize Profile/i)).toBeVisible();

    // Fill required step 3 fields
    await page.getByPlaceholder(/John Doe/i).fill('Imanshu');
    await page.getByPlaceholder(/e.g. Software Engineer|e.g. University Student/i).fill('Student');
    await page.getByPlaceholder(/e.g. London/i).fill('Akola');
    await page.getByPlaceholder(/5000/i).fill('7000');

    await page.getByRole('button', { name: /Go to Dashboard/i }).click();

    // Should land on dashboard
    await expect(
      page
        .getByText(/Imanshu/i)
        .filter({ visible: true })
        .first()
    ).toBeVisible();
    await expect(page.getByText(/₹0/i).first()).toBeVisible();
  });
});
