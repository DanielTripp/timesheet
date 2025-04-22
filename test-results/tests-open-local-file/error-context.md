# Test info

- Name: open local file
- Location: /mnt/c/cygwin64/home/dt/code/timesheet/tests.spec.js:6:1

# Error details

```
AssertionError: Expected values to be strictly equal:

123 !== 456

    at /mnt/c/cygwin64/home/dt/code/timesheet/tests.spec.js:12:10
```

# Page snapshot

```yaml
- group: Instructions
- textbox
```

# Test source

```ts
   1 | let { test, expect } = require('@playwright/test');
   2 | let path = require('path');
   3 | let assert = require('assert');
   4 | let { pathToFileURL } = require('url');
   5 |
   6 | test('open local file', async ({ page }) => {
   7 |   let filePath = path.resolve(__dirname, 'index.html');
   8 |   let fileUrl = pathToFileURL(filePath).href;
   9 |
  10 |   await page.goto(fileUrl);
  11 |   let details = page.locator('details');
> 12 |   assert.strictEqual(123, 456);
     |          ^ AssertionError: Expected values to be strictly equal:
  13 | });
  14 |
```