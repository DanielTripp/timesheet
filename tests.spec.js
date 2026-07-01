let { test, expect } = require('@playwright/test');
let path = require('path');
let assert = require('assert');
let { pathToFileURL } = require('url');

test('type job, time, newline', async ({ page }) => {
  let filePath = path.resolve(__dirname, 'index.html');
  let fileUrl = pathToFileURL(filePath).href;
  await page.goto(fileUrl, {waitUntil: 'load'});

  let textArea = page.locator('#textarea_input');
  await textArea.fill('');
  await textArea.pressSequentially('time=12:00\njob A 0:30\n');
  await expect(textArea).toHaveValue('time=12:00\njob A 0:30  [start=12:00, end=12:30]\n');

});
