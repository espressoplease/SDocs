const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

const previewUrl = '/public/cloud-business-invite.html?preview=signin&name=Dex&company=HumanLayer' +
  '&inviter=Joshua&email=dexter%40humanlayer.dev';

test('Business invitation starts with sign-in and keeps every section in one narrow column', async ({ page }) => {
  await page.goto(previewUrl);

  await expect(page.getByRole('heading', { name: 'Welcome to SmallDocs, Dex' })).toBeVisible();
  await expect(page.getByText('Joshua invited you to try SmallDocs with HumanLayer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accept your invitation' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue('dexter@humanlayer.dev');
  await expect(page.locator('#invite-accept')).toBeHidden();
  await expect(page.locator('.preview-note')).toContainText('does not create an account');
  await expect(page.getByRole('heading', { name: 'Build SmallDocs into HumanLayer' })).toBeVisible();

  const measurements = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    widths: ['.invite-intro', '.business-auth-card', '.product-story', '.example-section',
      '.invite-details'].map(selector =>
      Math.round(document.querySelector(selector).getBoundingClientRect().width)),
    openSections: Array.from(document.querySelectorAll('.invite-details details'))
      .filter(section => section.open).length,
    detailBorder: getComputedStyle(document.querySelector('.invite-details details')).borderTopWidth,
    authBorder: getComputedStyle(document.querySelector('.business-auth-card')).borderTopWidth,
  }));
  expect(measurements.overflow).toBe(false);
  expect(new Set(measurements.widths).size).toBe(1);
  expect(measurements.openSections).toBe(0);
  expect(measurements.detailBorder).toBe('0px');
  expect(measurements.authBorder).toBe('1px');

  const exampleLinks = page.locator('.example-link');
  await expect(exampleLinks).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(exampleLinks.nth(index)).toHaveAttribute('href', /^https:\/\/smalldocs\.org\/docs#md=/);
  }
  await expect(page.getByRole('link', { name: /Read the SDK guide/ }))
    .toHaveAttribute('href', '/developers');
  await page.getByText('How agents create and update sdocs', { exact: true }).click();
  await expect(page.getByRole('link', { name: /Explore every supported content block/ }))
    .toHaveAttribute('href', '/developers/examples');
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

  await page.goto(previewUrl);
  await page.getByRole('button', { name: 'Email me a code' }).click();

  await expect(page.getByRole('heading', { name: 'Enter the code from your email' })).toBeVisible();
  expect(submitted).toEqual({
    email: 'dexter@humanlayer.dev',
    return_to: '/public/cloud-business-invite.html?preview=signin&name=Dex&company=HumanLayer' +
      '&inviter=Joshua&email=dexter%40humanlayer.dev',
  });
});

test('Business invitation remains narrow without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(previewUrl);
  await page.getByText('How agents create and update sdocs', { exact: true }).click();

  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    widths: ['.invite-intro', '.business-auth-card', '.product-story', '.example-section',
      '.invite-details'].map(selector =>
      Math.round(document.querySelector(selector).getBoundingClientRect().width)),
  }));
  expect(result.overflow).toBe(false);
  expect(new Set(result.widths).size).toBe(1);
});
