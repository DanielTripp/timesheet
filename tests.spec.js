let { test, expect } = require('@playwright/test');
let path = require('path');
let assert = require('assert');
let { pathToFileURL } = require('url');

test('open local file', async ({ page }) => {
  let filePath = path.resolve(__dirname, 'index.html');
  let fileUrl = pathToFileURL(filePath).href;

  await page.goto(fileUrl);
  let details = page.locator('details');
  assert.strictEqual(123, 456);
});
