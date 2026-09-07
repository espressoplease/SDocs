const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

test('Business invitation starts with sign-in and keeps every section in one narrow column', async ({ page }) => {
  await page.goto('/public/cloud-business-invite.html?preview=signin');

  await expect(page.getByRole('heading', { name: 'Start your 14-day trial' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in or create your account' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.locator('#invite-accept')).toBeHidden();
  await expect(page.locator('.preview-note')).toContainText('does not create or start a trial');

  const measurements = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    widths: ['.invite-intro', '.business-auth-card', '.invite-details'].map(selector =>
      Math.round(document.querySelector(selector).getBoundingClientRect().width)),
    openSections: Array.from(document.querySelectorAll('.invite-details details'))
      .filter(section => section.open).length,
  }));
  expect(measurements.overflow).toBe(false);
  expect(new Set(measurements.widths).size).toBe(1);
  expect(measurements.openSections).toBe(0);

  await page.getByText('How to use SmallDocs', { exact: true }).click();
  await expect(page.getByRole('link', { name: /See example sdocs/ }))
    .toHaveAttribute('href', '/#learn');
  await expect(page.getByRole('link', { name: /See what an sdoc can contain/ }))
    .toHaveAttribute('href', '/developers/examples');
  await page.getByText('For developers: add sdocs to your application', { exact: true }).click();
  await expect(page.getByRole('link', { name: /Read the SDK guide/ }))
    .toHaveAttribute('href', '/developers');
});

test('embedded email sign-in returns to the full private invitation URL', async ({ page }) => {
  let submitted;
  await page.route('**/api/cloud/auth/email/request', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: {
      ok: true,
      challenge_id: 'challenge-business-preview',
      expires_at: '2026-09-08T12:10:00.000Z',
    } });
  });

  await page.goto('/public/cloud-business-invite.html?preview=signin');
  await page.getByLabel('Email address').fill('alex@northstar.studio');
  await page.getByRole('button', { name: 'Email me a code' }).click();

  await expect(page.getByRole('heading', { name: 'Enter the code from your email' })).toBeVisible();
  expect(submitted).toEqual({
    email: 'alex@northstar.studio',
    return_to: '/public/cloud-business-invite.html?preview=signin',
  });
});

test('Business invitation remains narrow without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/public/cloud-business-invite.html?preview=signin');
  await page.getByText('How to use SmallDocs', { exact: true }).click();

  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    widths: ['.invite-intro', '.business-auth-card', '.invite-details'].map(selector =>
      Math.round(document.querySelector(selector).getBoundingClientRect().width)),
  }));
  expect(result.overflow).toBe(false);
  expect(new Set(result.widths).size).toBe(1);
});
