import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

function isInvalidRefreshTokenMessage(message: string): boolean {
	const m = message.toLowerCase()
	return (
		m.includes('invalid refresh token') ||
		m.includes('refresh token not found') ||
		m.includes('jwt expired')
	)
}

function clearSupabaseStorage() {
	if (typeof window === 'undefined') return

	try {
		const toRemove: string[] = []
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key && key.startsWith('sb-')) toRemove.push(key)
		}
		toRemove.forEach((key) => window.localStorage.removeItem(key))
	} catch {
		// no-op
	}
}

export async function recoverInvalidRefreshToken(errorOrMessage: unknown): Promise<boolean> {
	const message =
		typeof errorOrMessage === 'string'
			? errorOrMessage
			: errorOrMessage instanceof Error
			? errorOrMessage.message
			: (errorOrMessage as { message?: string } | null)?.message ?? ''

	if (!isInvalidRefreshTokenMessage(message)) return false

	try {
		await supabase.auth.signOut({ scope: 'local' })
	} catch {
		// ignore signOut failures and force local cleanup
	}

	clearSupabaseStorage()
	return true
}

export async function getSessionSafe() {
	try {
		const result = await supabase.auth.getSession()
		if (result.error) {
			await recoverInvalidRefreshToken(result.error)
		}
		return result
	} catch (err) {
		const recovered = await recoverInvalidRefreshToken(err)
		if (recovered) {
			return { data: { session: null }, error: null }
		}
		throw err
	}
}

export async function getUserSafe() {
	try {
		const result = await supabase.auth.getUser()
		if (result.error) {
			await recoverInvalidRefreshToken(result.error)
		}
		return result
	} catch (err) {
		const recovered = await recoverInvalidRefreshToken(err)
		if (recovered) {
			return { data: { user: null }, error: null }
		}
		throw err
	}
}
