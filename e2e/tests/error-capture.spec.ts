/**
 * Error Capture Test — Systematically tests every UI flow and captures ALL browser console errors.
 * Results are written to /home/urza/valhalla/e2e/browser-errors.log
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const LOG_FILE = '/home/urza/valhalla/e2e/browser-errors.log';
const TEST_USER = `e2e_${Date.now()}`;
const TEST_EMAIL = `${TEST_USER}@test.valhalla`;
const TEST_PASS = 'E2eTest2024!';
const API = 'http://localhost:3081/api/v1';

interface LogEntry {
  flow: string;
  type: 'error' | 'warning' | 'pageerror' | 'requestfailed';
  message: string;
  timestamp: string;
}

const allErrors: LogEntry[] = [];

function setupConsoleCapture(page: Page, flow: string) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Skip browser extension noise
      if (text.includes('listener indicated an asynchronous response')) return;
      if (text.includes('favicon.ico')) return;
      allErrors.push({
        flow,
        type: msg.type() === 'error' ? 'error' : 'warning',
        message: text,
        timestamp: new Date().toISOString(),
      });
    }
  });
  page.on('pageerror', (error) => {
    allErrors.push({
      flow,
      type: 'pageerror',
      message: error.toString(),
      timestamp: new Date().toISOString(),
    });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('favicon.ico')) return;
    allErrors.push({
      flow,
      type: 'requestfailed',
      message: `${request.method()} ${url} — ${request.failure()?.errorText || 'unknown'}`,
      timestamp: new Date().toISOString(),
    });
  });
}

async function apiCall(method: string, path: string, body?: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  return res.json();
}

test.describe('Systematic Error Capture', () => {
  let token: string;
  let guildId: string;
  let channelId: string;

  test.beforeAll(async () => {
    // Register test user
    const res = await apiCall('POST', '/auth/register', {
      username: TEST_USER, email: TEST_EMAIL, password: TEST_PASS,
    });
    token = res.token;

    // Create a test guild
    const guildRes = await apiCall('POST', '/guilds', { name: 'ErrorTestServer' }, token);
    guildId = guildRes.guild.id;

    // Get channels
    const channels = await apiCall('GET', `/guilds/${guildId}/channels`, undefined, token);
    channelId = channels.find((c: any) => c.type === 0)?.id || channels[0]?.id;

    // Send a test message
    if (channelId) {
      await apiCall('POST', `/channels/${channelId}/messages`, { content: 'Test message from e2e' }, token);
    }
  });

  test('Flow 1: Login page renders without errors', async ({ page }) => {
    setupConsoleCapture(page, 'login-page-render');
    await page.goto('/');
    // Wait for either login form or main app
    await page.waitForTimeout(3000);
    const hasLoginForm = await page.locator('form').count() > 0;
    const hasMainApp = await page.locator('[role="application"], [style*="100vh"]').count() > 0;
    expect(hasLoginForm || hasMainApp).toBeTruthy();
  });

  test('Flow 2: Login with credentials', async ({ page }) => {
    setupConsoleCapture(page, 'login');
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Clear any existing session
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(2000);

    // Should see login form now
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(TEST_EMAIL);
      const passInput = page.locator('input[type="password"]');
      await passInput.fill(TEST_PASS);
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test('Flow 3: Guild list loads after login', async ({ page }) => {
    setupConsoleCapture(page, 'guild-list');
    // Login via localStorage
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    // Check for server icons in sidebar
    const serverIcons = page.locator('[role="button"][title]');
    const count = await serverIcons.count();
    console.log(`Found ${count} server icons`);
  });

  test('Flow 4: Channel selection and messages', async ({ page }) => {
    setupConsoleCapture(page, 'channel-selection');
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    // Click first server icon (skip DM button)
    const serverBtns = page.locator('[role="button"]');
    const btnCount = await serverBtns.count();
    if (btnCount > 1) {
      await serverBtns.nth(2).click(); // Skip DM + separator
      await page.waitForTimeout(2000);
    }

    // Click first channel
    const channels = page.locator('[style*="cursor: pointer"]');
    if (await channels.count() > 0) {
      await channels.first().click();
      await page.waitForTimeout(2000);
    }
  });

  test('Flow 5: Message composer interaction', async ({ page }) => {
    setupConsoleCapture(page, 'composer');
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    // Navigate to guild + channel
    const serverBtns = page.locator('[role="button"]');
    if (await serverBtns.count() > 2) {
      await serverBtns.nth(2).click();
      await page.waitForTimeout(2000);
    }

    // Try typing in composer
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      await textarea.first().fill('Test typing');
      await page.waitForTimeout(500);
      // Test slash command
      await textarea.first().fill('/');
      await page.waitForTimeout(500);
      // Clear
      await textarea.first().fill('');
    }
  });

  test('Flow 6: Friends panel', async ({ page }) => {
    setupConsoleCapture(page, 'friends-panel');
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    // Click DM/Friends button (first server icon)
    const dmBtn = page.locator('[title="Freunde & DMs"]');
    if (await dmBtn.count() > 0) {
      await dmBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('Flow 7: Create server dialog', async ({ page }) => {
    setupConsoleCapture(page, 'create-server');
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    // Click + button
    const addBtn = page.locator('[title="Server erstellen"]');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      // Close without creating
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Flow 8: Join server dialog', async ({ page }) => {
    setupConsoleCapture(page, 'join-server');
    await page.goto('/');
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    await page.reload();
    await page.waitForTimeout(3000);

    const joinBtn = page.locator('[title="Server beitreten"]');
    if (await joinBtn.count() > 0) {
      await joinBtn.click();
      await page.waitForTimeout(1000);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test.afterAll(async () => {
    // Write all captured errors to file
    const report = [
      `=== BROWSER ERROR REPORT ===`,
      `Generated: ${new Date().toISOString()}`,
      `Test User: ${TEST_USER}`,
      `Total Errors: ${allErrors.length}`,
      ``,
      ...allErrors.map((e, i) =>
        `[${i + 1}] ${e.type.toUpperCase()} in "${e.flow}"\n    ${e.message}\n    Time: ${e.timestamp}\n`
      ),
      allErrors.length === 0 ? 'NO ERRORS FOUND - ALL FLOWS CLEAN!' : '',
    ].join('\n');

    fs.writeFileSync(LOG_FILE, report, 'utf-8');
    console.log(`\n=== ERROR REPORT WRITTEN TO ${LOG_FILE} ===`);
    console.log(`Total errors captured: ${allErrors.length}`);
    if (allErrors.length > 0) {
      console.log('Errors by flow:');
      const byFlow: Record<string, number> = {};
      for (const e of allErrors) {
        byFlow[e.flow] = (byFlow[e.flow] || 0) + 1;
      }
      for (const [flow, count] of Object.entries(byFlow)) {
        console.log(`  ${flow}: ${count} errors`);
      }
    }
  });
});
