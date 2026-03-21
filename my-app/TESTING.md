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

## Install Verification (Did Setup Work?)

Use this checklist on a fresh machine or after dependency changes.

### 1) Install dependencies

```bash
npm ci
```

Expected result:
- Install completes with no errors.

### 2) Verify the app builds

```bash
npm run build
```

Expected result:
- Next.js production build succeeds.

### 3) Verify tests run

```bash
npm run test:run
```

Expected result:
- Test run completes successfully.

### 4) Optional runtime smoke check

```bash
npm run dev
```

Then confirm these routes load in a browser:
- `/signin`
- `/signup`
- `/work-orders/submission`
- `/work-orders/past`

Expected result:
- App starts and core pages render.

## Breakage Detection (Did a Change Break Something?)

Run this sequence before pushing code:

```bash
npm run build
npm run test:run
```

If either command fails, treat it as a regression until fixed.

Recommended targeted checks while developing:

```bash
# Watch mode for fast feedback
npm test

# Run only one suite while iterating
npx vitest run src/test/work-order-updates.test.ts
```

CI recommendation:
- Run `npm ci`, `npm run build`, and `npm run test:run` on every pull request.
- Block merges when any of those checks fail.

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
  - Success flows with email notification routing
  - Resilience when email delivery fails

- **work-order-submission.test.tsx** - Tests for work order creation UI
  - Address selection behavior (including `add_new` routing)
  - Category slug resolution before insert
  - Successful submit feedback

- **work-order-completion.test.tsx** - Tests for work order completion UI
  - Completing without payment request
  - Completing with payment request and invoice creation payload

- **create-profile.test.ts** - Tests for account/profile creation API
  - Missing token handling
  - Lab profile + default address creation flow
  - Technician profile upsert flow

- **auth-gate.test.tsx** - Tests for auth guard behavior
  - Loading state and authenticated render
  - Redirect when no session exists
  - Redirect on auth sign-out event

- **address-management.test.tsx** - Tests for address CRUD UI
  - Add address flow
  - Delete address flow

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
- Ensures API contracts: your actual API routes work correctly

**Work Order Creation UI** (`components/WorkOrderSubmission.tsx`)
- Ensures manager workflow creates work orders with valid payloads
- Verifies category/address handling and form behavior

**Work Order Completion UI** (`components/WorkOrderCompletion.tsx`)
- Validates completion status update behavior
- Verifies optional payment request + invoice record creation path

**Account Creation API** (`api/create-profile/route.ts`)
- Enforces token-based authentication
- Handles lab and technician onboarding flows

**Auth Guard** (`components/AuthGate.tsx`)
- Redirects unauthenticated users to login
- Responds to auth state changes

**Address Management UI** (`components/AddressManagement.tsx`)
- Covers create/delete address actions and success messages

### Test Coverage

The tests focus on:
1. **Business Logic** - Core functionality that affects users
2. **Integration Points** - External API interactions (Resend)
3. **Configuration** - Proper branding and environment setup
4. **Error Cases** - Graceful handling of failures

### Coverage Boundaries (Important)

Current tests are mostly mocked unit/integration tests. They are strong for regression detection in covered modules, but they do not fully validate live infrastructure (real Supabase, live external services) by themselves.

For full system confidence, pair this suite with:
- Production build verification (`npm run build`)
- Runtime smoke check (`npm run dev`)
- Optional environment-specific integration checks against test infrastructure

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

**API Tests** (`create-profile.test.ts`):
- Exercise real route handler logic for profile onboarding
- Verify role-specific persistence flows

**Integration Tests** (`email.test.ts`, `email-template.test.ts`):
- Test email service integration
- Verify correct email content generation
- Mock external email API

**Component Tests** (`*.test.tsx`):
- Render client components in JSDOM
- Mock `next/navigation` and Supabase client behavior
- Validate UI behavior and side effects from user actions

**Environment Variables**: Set in `src/test/setup.ts`
