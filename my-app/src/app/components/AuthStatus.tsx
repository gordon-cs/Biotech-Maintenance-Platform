"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AuthStatus() {
  const [session, setSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const get = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data?.session ?? null)
    }
    get()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    router.push("/")
  }

  if (!session) {
    return (
      <div className="flex gap-4">
        <Link href="/signin" className="text-blue-600 underline">Sign in</Link>
        <Link href="/signup" className="text-blue-600 underline">Sign up</Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">Signed in as <strong>{session.user.email}</strong></span>
      <Link href="/complete-profile" className="text-blue-600 underline">Complete profile</Link>
      <button onClick={signOut} className="px-2 py-1 bg-gray-200 rounded">Sign out</button>
    </div>
  )
}
