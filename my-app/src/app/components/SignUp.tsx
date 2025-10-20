"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Session } from "@supabase/supabase-js"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setMessage(`Error: ${signUpError.message}`)
        return
      }

      setSignupSuccess(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <div className="p-4 border rounded bg-white w-full max-w-md mx-auto mt-10 text-center">
        <h3 className="font-semibold mb-4 text-center">Signup Successful!</h3>
        <p className="text-sm">
          Please check your email and click the confirmation link to activate your account.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignUp} className="p-4 border rounded bg-white w-full max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Create an account</h3>

      <label className="block mb-2">
        <span className="text-sm">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full border px-2 py-1 rounded"
          required
        />
      </label>

      <label className="block mb-4">
        <span className="text-sm">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full border px-2 py-1 rounded"
          required
          minLength={6}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        {message && <p className="text-sm text-black">{message}</p>}
      </div>
    </form>
  )
}
