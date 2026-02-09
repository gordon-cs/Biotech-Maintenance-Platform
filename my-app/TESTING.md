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
  - Comment notifications
  - Status change notifications
  - Boston Biotech Management branding
  - Recipient name handling

- **email-template.test.ts** - Tests for email template validation
  - Subject line generation
  - Link construction
  - Branding verification
  - Update type detection

- **work-order-updates.test.ts** - Tests for the work order updates API
  - GET endpoint - fetching updates
  - POST endpoint - creating updates
  - Authentication & authorization
  - Validation (missing fields, invalid values)
  - Status change rules (technician-only, assignment required)
  - Business rule enforcement

- **billClient.test.ts** - Placeholder (Bill.com features in development)
  - Skipped - will be added when feature is complete

### What's Tested

**Email Service** (`lib/email.ts`)
- Sends work order update emails
- Uses correct sender: `Boston Biotech Management <no-reply@bostonbiotechmanagement.com>`
- Generates proper HTML and text email content
- Handles both comments and status changes

**Work Order Updates API** (`api/work-order-updates/route.ts`)
  - GET endpoint fetches updates for a work order
  - POST endpoint creates new updates (comments and status changes)
  - Validates authentication and authorization
  - EnfAPI Contracts** - Your actual API routes work correctly
**Validation Rules** 
  - Invalid data is rejected with helpful errors
**Authorization** 
  - Only authorized users can perform certain actions
**Configuration** 
  - Proper branding and environment setupders
  - Completed work orders cannot be modified
  - Status can only be changed to 'completed'
  - Returns appropriate error messages for invalid requests

**Business Rules Validation**
- All validated through API tests
- Urgency levels: low, normal, high, critical
- Status transitions: open → claimed → completed
- Update types: comment, status_change
- Role-based permissions enforced in API handlers

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

- **Supabase Client**: Mocked to avoid database operations during tests
- **Next.js Auth**: Mocked to simulate authenticated requests
- **Environment Variables**: Set in `src/test/setup.ts`

### Test Types

**API Tests** (`work-order-updates.test.ts`):
- Actually import and call your API route handlers
- Mock Supabase responses to simulate database scenarios
- Verify correct HTTP status codes and error messages
- Validate business rules are enforced

**Integration Tests** (`email.test.ts`, `email-template.test.ts`):
- Test email service integration
- Verify correct email content generation
- Mock external email API
- Validate template structure and brandingntent generation
- Mock external email APIg tests
- **Environment Variables**: Set in `src/test/setup.ts`
