import { test, expect } from '@playwright/test';

test.describe('End-to-End Café Order, Settlement & Admin Flow', () => {
  test('waiter can log in, take order with live totals, and settle with cash invoice', async ({
    page,
  }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page).toHaveTitle(/XPRSO/);

    // 2. Waiter Password Login
    await page.fill('input[autocomplete="username"]', 'waiter');
    await page.fill('input[type="password"]', 'Waiter@123');
    await page.click('button[type="submit"]:has-text("Sign In")');

    // 3. Verify redirected to /order
    await page.waitForURL('**/order');
    await expect(page.locator('h1')).toContainText('XPRSO');

    // 4. Select items by heading to trigger add product
    const cappuccino = page.getByRole('heading', { name: 'Cappuccino' });
    await expect(cappuccino).toBeVisible();
    await cappuccino.click();

    // Verify item appeared in order panel
    await expect(page.locator('text=Current Order')).toBeVisible();

    // Add another item: 'Butter Croissant'
    const croissant = page.getByRole('heading', { name: 'Butter Croissant' });
    await expect(croissant).toBeVisible();
    await croissant.click();

    // 5. Verify live totals panel shows grand total
    await expect(page.locator('text=Grand Total')).toBeVisible();

    // 6. Settle Order
    const settleBtn = page.locator('button:has-text("Settle Order")');
    await expect(settleBtn).toBeVisible();
    await settleBtn.click();

    // Settle modal appears
    await expect(page.locator('text=Settle & Generate Invoice')).toBeVisible();

    // Click Cash payment mode
    const cashBtn = page.locator('button:has-text("Cash")');
    await expect(cashBtn).toBeVisible();
    await cashBtn.click();

    // Verify settlement succeeds and redirects to orders with settled bill
    await expect(page).toHaveURL(/\/orders/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Orders & Invoices');
  });

  test('admin can log in, step-up with PIN, access admin panel and view SQL analytics', async ({
    page,
  }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForURL('**/order');

    // 2. Navigate to Admin Panel
    await page.goto('/admin');

    // 3. Step-up PIN pad is presented
    await expect(page.locator('text=Admin Step-Up Security')).toBeVisible({ timeout: 8000 });

    // Enter PIN '1234' on the tactile keypad
    await page.locator('button:has-text("1")').first().click();
    await page.locator('button:has-text("2")').first().click();
    await page.locator('button:has-text("3")').first().click();
    await page.locator('button:has-text("4")').first().click();

    // 4. Elevated into Admin Menu page
    await page.waitForURL('**/admin/menu', { timeout: 8000 });
    await expect(page.locator('text=Menu, Prices & Costs')).toBeVisible();

    // 5. Navigate to Analytics Dashboard
    await page.click('a[href="/admin/analytics"]');
    await page.waitForURL('**/admin/analytics');

    // 6. Verify deterministic SQL analytics KPIs and reports
    await expect(page.locator('h1')).toContainText('Sales & Gross Profit Analytics');
    await expect(page.locator('text=Net Revenue')).toBeVisible();
    await expect(page.locator('text=Settled Orders')).toBeVisible();
  });
});
