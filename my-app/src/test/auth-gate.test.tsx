import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthGate from '@/components/AuthGate'

const replaceMock = vi.fn()
const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
let authListener: ((event: string, session: unknown) => void) | null = null

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authListener = cb
        return onAuthStateChangeMock(cb)
      },
    },
  },
}))

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authListener = null
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
  })

  it('renders children when session exists', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    render(
      <AuthGate>
        <div>Secure Content</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(screen.getByText('Secure Content')).toBeInTheDocument()
    })
  })

  it('redirects to login when there is no session', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
    })

    render(
      <AuthGate>
        <div>Hidden</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects when auth state changes to signed out', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    render(
      <AuthGate>
        <div>Secure Content</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(screen.getByText('Secure Content')).toBeInTheDocument()
    })

    expect(authListener).toBeTruthy()
    authListener?.('SIGNED_OUT', null)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login')
    })
  })
})
