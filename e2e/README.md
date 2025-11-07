# End-to-End Tests for RENTY Platform

## Overview

This directory contains E2E tests for the RENTY rental marketplace platform using Playwright.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

3. Make sure your `.env` file is configured with Supabase credentials.

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI (interactive mode)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug specific test
```bash
npm run test:e2e:debug
```

### View test report
```bash
npm run test:e2e:report
```

## Test Structure

```
e2e/
├── fixtures/          # Test fixtures and setup
│   └── auth.fixture.ts
├── tests/             # Test files
│   ├── auth.spec.ts              # Authentication tests
│   ├── item-listing.spec.ts      # Item listing tests
│   ├── search-browse.spec.ts     # Search and browse tests
│   ├── wallet.spec.ts            # Wallet functionality tests
│   ├── profile.spec.ts           # User profile tests
│   ├── admin.spec.ts             # Admin features tests
│   ├── responsive.spec.ts        # Responsive design tests
│   └── accessibility.spec.ts     # Accessibility tests
└── utils/             # Helper functions
    └── test-helpers.ts
```

## Test Coverage

### Authentication
- ✅ User sign up
- ✅ User sign in
- ✅ Password validation
- ✅ Error handling

### Item Listing
- ✅ Create new listing
- ✅ Form validation
- ✅ Image upload
- ✅ View listings

### Search & Browse
- ✅ Homepage display
- ✅ Search functionality
- ✅ Category filtering
- ✅ Item details view

### Wallet
- ✅ View balance
- ✅ Transaction history
- ✅ Top-up validation
- ✅ Withdrawal interface

### Profile
- ✅ View profile
- ✅ Edit profile
- ✅ Verification status
- ✅ Navigation

### Admin
- ✅ Access control
- ✅ Dashboard (skipped - requires admin setup)
- ✅ Verification management (skipped)
- ✅ Payment management (skipped)

### Responsive Design
- ✅ Mobile navigation
- ✅ Bottom navigation
- ✅ Tablet layout
- ✅ Touch interactions

### Accessibility
- ✅ Heading hierarchy
- ✅ Form labels
- ✅ Alt text
- ✅ Keyboard navigation
- ✅ Color contrast

## Writing New Tests

1. Create a new test file in `e2e/tests/`
2. Import fixtures if authentication is needed:
```typescript
import { test, expect } from '../fixtures/auth.fixture';
```

3. Write test cases:
```typescript
test.describe('My Feature', () => {
  test('should do something', async ({ page, authenticatedUser }) => {
    await page.goto('/my-page');
    // ... test code
  });
});
```

## CI/CD Integration

Tests automatically run on:
- Push to `main` or `develop` branches
- Pull requests to `main`

See `.github/workflows/e2e-tests.yml` for CI configuration.

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Use fixtures** for authentication
4. **Keep tests independent** - each test should work in isolation
5. **Use meaningful test names** - describe what is being tested
6. **Clean up after tests** - fixtures handle auth cleanup
7. **Handle loading states** - use `waitForLoadingToFinish()` helper

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify Supabase connection

### Elements not found
- Add `data-testid` attributes to components
- Use more flexible selectors (text content, roles)
- Wait for elements to appear

### Authentication issues
- Verify `.env` file is configured
- Check Supabase auth settings (auto-confirm emails)
- Review auth fixture setup

## Admin Testing

Admin tests are skipped by default as they require a pre-configured admin account. To enable:

1. Create an admin user in your database
2. Update `e2e/fixtures/auth.fixture.ts` with admin credentials
3. Remove `.skip` from admin tests in `e2e/tests/admin.spec.ts`

## Performance

- Tests run in parallel for speed
- Mobile tests run on separate devices
- Use CI workers: 1 for stability

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
