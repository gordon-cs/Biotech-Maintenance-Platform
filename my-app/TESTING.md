# Testing Guide

## Running Tests

This project uses [Vitest](https://vitest.dev/) for testing.

### Commands

```bash
# Run tests in watch mode (recommended during development)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Files

Tests are located in `src/test/`:

- **email.test.ts** - Tests for email sending functionality
  - ✅ Comment notifications
  - ✅ Status change notifications
  - ✅ Boston Biotech Management branding
  - ✅ Recipient name handling

- **email-template.test.ts** - Tests for email template validation
  - ✅ Subject line generation
  - ✅ Link construction
  - ✅ Branding verification
  - ✅ Update type detection

### What's Tested

✅ **Email Service** (`lib/email.ts`)
- Sends work order update emails
- Uses correct sender: `Boston Biotech Management <no-reply@bostonbiotechmanagement.com>`
- Generates proper HTML and text email content
- Handles both comments and status changes

### Test Coverage

The tests focus on:
1. **Business Logic** - Core functionality that affects users
2. **Integration Points** - External API interactions (Resend)
3. **Configuration** - Proper branding and environment setup
4. **Error Cases** - Graceful handling of failures

### Writing New Tests

Add new test files to `src/test/` with the `.test.ts` extension:

```typescript
import { describe, it, expect } from 'vitest'

describe('My Feature', () => {
  it('should do something useful', () => {
    expect(true).toBe(true)
  })
})
```

### Mocking

- **Resend**: Mocked to avoid sending real emails during tests
- **Environment Variables**: Set in `src/test/setup.ts`
