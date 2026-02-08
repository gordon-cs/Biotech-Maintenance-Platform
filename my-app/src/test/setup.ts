import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Set environment variables before any imports
process.env.RESEND_API_KEY = 'test-api-key'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

