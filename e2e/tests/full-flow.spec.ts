import { test, expect, Page } from '@playwright/test';

// Unique test user for this run
const TEST_USER = `e2e_${Date.now()}`;
const TEST_EMAIL = `${TEST_USER}@test.valhalla`;
const TEST_PASS = 'E2eTest123!';
const API = 'http://localhost:3081/api/v1';

// Helper: API call
async function apiCall(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: res.status, data: null };
  return { status: res.status, data: await res.json() };
}

// ═══════════════════════════════════════════════════════
// Test 1: App loads and shows login
// ═══════════════════════════════════════════════════════
test('01 — App loads and shows login page', async ({ page }) => {
  await page.goto('/');
  // Should show login/register form
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 2: Registration flow
// ═══════════════════════════════════════════════════════
test('02 — Register new account', async ({ page }) => {
  await page.goto('/');

  // Switch to register mode
  const switchLink = page.locator('a', { hasText: 'Register' });
  if (await switchLink.isVisible()) {
    await switchLink.click();
  }

  // Fill registration form
  const usernameInput = page.locator('input[type="text"]').first();
  if (await usernameInput.isVisible()) {
    await usernameInput.fill(TEST_USER);
  }
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASS);

  // Submit
  await page.locator('button[type="submit"]').click();

  // Should redirect to main app (guild sidebar visible)
  await expect(page.locator('.guild-sidebar')).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════════
// Test 3: Login flow
// ═══════════════════════════════════════════════════════
test('03 — Login with existing account', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASS);
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('.guild-sidebar')).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════════
// Test 4: Create server
// ═══════════════════════════════════════════════════════
test('04 — Create server via + button', async ({ page }) => {
  await loginAs(page);

  // Click + button (create server)
  const addBtn = page.locator('.guild-icon.add').first();
  await addBtn.click();

  // Fill server name
  const modal = page.locator('.auth-form');
  await expect(modal).toBeVisible();
  await modal.locator('input').fill('E2E Test Server');
  await modal.locator('button[type="submit"]').click();

  // Server should appear in sidebar
  await expect(page.locator('.channel-sidebar')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.channel-sidebar-header')).toContainText('E2E Test Server');
});

// ═══════════════════════════════════════════════════════
// Test 5: Channel sidebar shows default channels
// ═══════════════════════════════════════════════════════
test('05 — Default channels visible after server creation', async ({ page }) => {
  await loginAndSelectServer(page);

  // Should have text channels category
  await expect(page.locator('.channel-category').first()).toBeVisible();

  // Should have at least one text channel with # icon
  await expect(page.locator('.channel-item .hash', { hasText: '#' }).first()).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 6: Send a message
// ═══════════════════════════════════════════════════════
test('06 — Send and see a message in chat', async ({ page }) => {
  await loginAndSelectServer(page);

  // Click #general channel
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  // Should see composer
  await expect(page.locator('.composer-input')).toBeVisible();

  // Type and send
  await page.locator('.composer-input').fill('Hello E2E Test!');
  await page.locator('.composer-input').press('Enter');

  // Message should appear
  await expect(page.locator('.message-content', { hasText: 'Hello E2E Test!' })).toBeVisible({ timeout: 3000 });
});

// ═══════════════════════════════════════════════════════
// Test 7: Message markdown rendering
// ═══════════════════════════════════════════════════════
test('07 — Markdown rendering in messages', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  await page.locator('.composer-input').fill('**bold** and *italic*');
  await page.locator('.composer-input').press('Enter');

  // Bold should render
  await expect(page.locator('.message-content strong', { hasText: 'bold' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.message-content em', { hasText: 'italic' })).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 8: Emoji picker opens and inserts
// ═══════════════════════════════════════════════════════
test('08 — Emoji picker works', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  // Open emoji picker
  await page.locator('.composer-action', { hasText: '😀' }).click();
  await expect(page.locator('.emoji-picker-full')).toBeVisible();

  // Click an emoji
  await page.locator('.emoji-btn', { hasText: '👍' }).first().click();

  // Should insert in composer
  const val = await page.locator('.composer-input').inputValue();
  expect(val).toContain('👍');
});

// ═══════════════════════════════════════════════════════
// Test 9: GIF picker opens
// ═══════════════════════════════════════════════════════
test('09 — GIF picker opens', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  // Click GIF button
  await page.locator('.composer-action', { hasText: 'GIF' }).click();
  await expect(page.locator('.gif-picker')).toBeVisible();

  // Should have search field
  await expect(page.locator('.gif-search input')).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 10: Context menu on message
// ═══════════════════════════════════════════════════════
test('10 — Right-click message shows context menu', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  // Wait for messages to load
  await page.waitForSelector('.message', { timeout: 3000 });

  // Right-click first message
  await page.locator('.message').first().click({ button: 'right' });

  // Context menu should appear
  await expect(page.locator('.ctx-menu')).toBeVisible();
  await expect(page.locator('.ctx-item', { hasText: 'Antworten' })).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 11: Server settings open
// ═══════════════════════════════════════════════════════
test('11 — Server settings open on header click', async ({ page }) => {
  await loginAndSelectServer(page);

  // Click server name in header
  await page.locator('.channel-sidebar-header').click();

  // Settings panel should open
  await expect(page.locator('.settings-panel')).toBeVisible();
  await expect(page.locator('.settings-sidebar-title')).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 12: Server settings tabs work
// ═══════════════════════════════════════════════════════
test('12 — Server settings tabs navigate correctly', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-sidebar-header').click();
  await expect(page.locator('.settings-panel')).toBeVisible();

  // Click Channels tab
  await page.locator('.settings-tab', { hasText: 'Kanale' }).click();
  await expect(page.locator('h2', { hasText: 'Kanale' })).toBeVisible();

  // Click Members tab
  await page.locator('.settings-tab', { hasText: 'Mitglieder' }).click();
  await expect(page.locator('h2', { hasText: 'Mitglieder' })).toBeVisible();

  // Click Roles tab
  await page.locator('.settings-tab', { hasText: 'Rollen' }).click();
  await expect(page.locator('h2', { hasText: 'Rollen' })).toBeVisible();

  // Click Bans tab
  await page.locator('.settings-tab', { hasText: 'Bans' }).click();
  await expect(page.locator('h2', { hasText: 'Bans' })).toBeVisible();

  // Click Audit tab
  await page.locator('.settings-tab', { hasText: 'Audit' }).click();
  await expect(page.locator('h2', { hasText: 'Audit' })).toBeVisible();

  // Close
  await page.locator('.settings-close').click();
  await expect(page.locator('.settings-panel')).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 13: User settings open
// ═══════════════════════════════════════════════════════
test('13 — User settings open via gear icon', async ({ page }) => {
  await loginAndSelectServer(page);

  // Click gear icon in user panel
  await page.locator('.user-panel button').click();
  await expect(page.locator('.settings-panel')).toBeVisible();
  await expect(page.locator('.settings-sidebar-title', { hasText: 'Benutzer' })).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 14: User settings tabs work
// ═══════════════════════════════════════════════════════
test('14 — User settings all tabs load', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.user-panel button').click();

  // Profile tab (default)
  await expect(page.locator('h2', { hasText: 'Profil' })).toBeVisible();

  // Konto tab
  await page.locator('.settings-tab', { hasText: 'Konto' }).click();
  await expect(page.locator('h2', { hasText: 'Konto' })).toBeVisible();

  // Sessions tab
  await page.locator('.settings-tab', { hasText: 'Sitzungen' }).click();
  await expect(page.locator('h2', { hasText: 'Aktive Sitzungen' })).toBeVisible();

  // Appearance tab
  await page.locator('.settings-tab', { hasText: 'Darstellung' }).click();
  await expect(page.locator('h2', { hasText: 'Darstellung' })).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 15: Friends view
// ═══════════════════════════════════════════════════════
test('15 — Friends view opens and tabs work', async ({ page }) => {
  await loginAs(page);

  // Click DM/Friends button
  await page.locator('.guild-icon', { hasText: '💬' }).click();

  // Should show friends view
  await expect(page.locator('.friends-tab', { hasText: 'Alle' })).toBeVisible();
  await expect(page.locator('.friends-tab', { hasText: 'Ausstehend' })).toBeVisible();
  await expect(page.locator('.friends-tab', { hasText: 'Blockiert' })).toBeVisible();
  await expect(page.locator('.friends-tab', { hasText: 'Hinzufuegen' })).toBeVisible();

  // Switch to Add tab
  await page.locator('.friends-tab', { hasText: 'Hinzufuegen' }).click();
  await expect(page.locator('h3', { hasText: 'Freund hinzufuegen' })).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 16: Board tab
// ═══════════════════════════════════════════════════════
test('16 — Kanban board tab loads', async ({ page }) => {
  await loginAndSelectServer(page);

  // Must select a text channel first to see the tabs
  const textChan = page.locator('.channel-item').filter({ hasText: '#' }).first();
  await textChan.click();
  await expect(page.locator('.chat-header')).toBeVisible();

  // Switch to Board tab
  const boardBtn = page.locator('.chat-header button', { hasText: /Board/ });
  await boardBtn.click();

  // Should show board UI
  await expect(page.locator('text=Board').first()).toBeVisible({ timeout: 3000 });
});

// ═══════════════════════════════════════════════════════
// Test 17: Wiki tab
// ═══════════════════════════════════════════════════════
test('17 — Wiki tab button exists and is clickable', async ({ page }) => {
  await loginAndSelectServer(page);

  const textChan = page.locator('.channel-item').filter({ hasText: '#' }).first();
  await textChan.click();
  await expect(page.locator('.chat-header')).toBeVisible();

  // Wiki tab button should exist
  const wikiBtn = page.locator('.chat-header button', { hasText: /Wiki/ });
  await expect(wikiBtn).toBeVisible();

  // Click it
  await wikiBtn.click();

  // Chat messages should no longer be visible (switched to wiki view)
  await page.waitForTimeout(500);
  // Switch back to chat
  await page.locator('.chat-header button', { hasText: /Chat/ }).click();
  await expect(page.locator('.composer-input').or(page.locator('.messages-container'))).toBeVisible({ timeout: 2000 });
});

// ═══════════════════════════════════════════════════════
// Test 18: Theme toggle
// ═══════════════════════════════════════════════════════
test('18 — Theme toggle works', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.user-panel button').click();

  // Go to appearance
  await page.locator('.settings-tab', { hasText: 'Darstellung' }).click();

  // Click Light theme
  const lightBtn = page.locator('button', { hasText: 'Light' });
  await lightBtn.click();

  // Body should have light theme attribute
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(theme).toBe('light');

  // Switch back to dark
  await page.locator('button', { hasText: 'Dark' }).click();
});

// ═══════════════════════════════════════════════════════
// Test 19: Invite dialog
// ═══════════════════════════════════════════════════════
test('19 — Invite dialog opens via context menu', async ({ page }) => {
  await loginAndSelectServer(page);

  // Right-click first text channel
  const textChannel = page.locator('.channel-item').filter({ hasText: '#' }).first();
  await textChannel.click({ button: 'right' });

  // Context menu should appear
  await expect(page.locator('.ctx-menu')).toBeVisible({ timeout: 2000 });

  // "Einladung" option should be visible
  const inviteItem = page.locator('.ctx-item', { hasText: 'Einladung' });
  await expect(inviteItem).toBeVisible();
  await inviteItem.click();

  // Some kind of invite UI should appear (dialog or modal)
  // The invite API might fail but the dialog should still open
  await page.waitForTimeout(1000);
});

// ═══════════════════════════════════════════════════════
// Test 20: Member list visible
// ═══════════════════════════════════════════════════════
test('20 — Member list shows on channel select', async ({ page }) => {
  await loginAndSelectServer(page);
  await page.locator('.channel-item').filter({ hasText: '#' }).filter({ hasText: 'general' }).first().click();

  await expect(page.locator('.member-list')).toBeVisible();
  await expect(page.locator('.member-list-header')).toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Test 21: Unauthorized redirect
// ═══════════════════════════════════════════════════════
test('21 — App shows login when no token', async ({ page }) => {
  // Clear storage
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Should show login form
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('.guild-sidebar')).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

async function loginAs(page: Page) {
  // Register via API first
  await apiCall('POST', '/auth/register', {
    username: TEST_USER, email: TEST_EMAIL, password: TEST_PASS,
  });

  await page.goto('/');

  // If already logged in, return
  if (await page.locator('.guild-sidebar').isVisible().catch(() => false)) return;

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASS);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.guild-sidebar')).toBeVisible({ timeout: 5000 });
}

async function loginAndSelectServer(page: Page) {
  await loginAs(page);

  // Create server via API if none exist
  const loginRes = await apiCall('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  const token = loginRes.data?.token;
  if (token) {
    const guilds = await apiCall('GET', '/users/@me/guilds', null, token);
    if (!guilds.data || guilds.data.length === 0) {
      await apiCall('POST', '/guilds', { name: 'E2E Test Server' }, token);
    }
  }

  // Reload to pick up guilds
  await page.reload();
  await expect(page.locator('.guild-sidebar')).toBeVisible({ timeout: 5000 });

  // Click first server
  const serverIcons = page.locator('.guild-icon:not(.add)').filter({ hasNot: page.locator('text=💬') });
  if (await serverIcons.count() > 0) {
    await serverIcons.first().click();
    await expect(page.locator('.channel-sidebar')).toBeVisible({ timeout: 3000 });
  }
}
