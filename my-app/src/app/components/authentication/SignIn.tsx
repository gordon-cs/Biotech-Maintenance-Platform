"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(`Error: ${error.message}`)
      else {
        // redirect to home to reflect signed-in state
        router.push("/")
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignIn} className="p-4 border rounded bg-white w-full max-w-md">
      <h3 className="font-semibold mb-2">Sign in</h3>
      <label className="block mb-2">
        <span className="text-sm">Email</span>
        <input className="mt-1 block w-full border px-2 py-1 rounded" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block mb-4">
        <span className="text-sm">Password</span>
        <input type="password" className="mt-1 block w-full border px-2 py-1 rounded" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>{loading ? 'Signing...' : 'Sign in'}</button>
        {message && <p className="text-sm text-black">{message}</p>}
      </div>
    </form>
  )
}
