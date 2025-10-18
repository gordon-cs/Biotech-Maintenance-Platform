"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Session } from "@supabase/supabase-js"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [role, setRole] = useState<"lab" | "technician" | "">("")

  // lab fields
  const [labName, setLabName] = useState("")
  const [labAddress, setLabAddress] = useState("")
  const [labCity, setLabCity] = useState("")
  const [labState, setLabState] = useState("")
  const [labZip, setLabZip] = useState("")

  // technician fields
  const [techExperience, setTechExperience] = useState("")
  const [techBio, setTechBio] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")

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

      // get current session (may be null if email confirmation required)
      const { data: sessionData } = await supabase.auth.getSession()
      const session: Session | null = signUpData.session ?? sessionData.session ?? null

      if (session && session.user?.id) {
        const userId = session.user.id

        // profiles upsert
        const profileInsert = {
          id: userId,
          role: role || null,
          full_name: fullName || null,
          phone: phone || null,
          email: email || null,
        }

        const { error: profileError } = await supabase.from("profiles").upsert(profileInsert)
        if (profileError) {
          setMessage(`Profile creation failed: ${profileError.message}`)
          return
        }

        if (role === "lab") {
          const labInsert = {
            manager_id: userId,
            name: labName || null,
            address: labAddress || null,
            city: labCity || null,
            state: labState || null,
            zipcode: labZip || null,
          }
          const { error: labError } = await supabase.from("labs").insert(labInsert)
          if (labError) {
            setMessage(`Lab creation failed: ${labError.message}`)
            return
          }
        } else if (role === "technician") {
          const techInsert = {
            profile_id: userId,
            experience: techExperience || null,
            bio: techBio || null,
          }
          const { error: techError } = await supabase.from("technicians").insert(techInsert)
          if (techError) {
            setMessage(`Technician creation failed: ${techError.message}`)
            return
          }
        }

        setMessage("Signup successful — profile created. Check your inbox to confirm your email (if enabled).")
      } else {
        setMessage("Check your email to confirm, then sign in to complete your profile.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignUp} className="p-4 border rounded bg-white w-full max-w-md">
      <h3 className="font-semibold mb-2">Create an account</h3>

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

      <label className="block mb-2">
        <span className="text-sm">Full name</span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 block w-full border px-2 py-1 rounded"
          required
        />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Phone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block w-full border px-2 py-1 rounded"
        />
      </label>

      <div className="mb-4">
        <span className="text-sm">Role</span>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="lab" checked={role === "lab"} onChange={() => setRole("lab")} />
            <span>Lab</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="technician" checked={role === "technician"} onChange={() => setRole("technician")} />
            <span>Technician</span>
          </label>
        </div>
      </div>

      {/* Role specific fields */}
      {role === "lab" && (
        <div className="mb-4">
          <h4 className="font-medium">Lab details</h4>
          <label className="block mt-2">
            <span className="text-sm">Lab name</span>
            <input value={labName} onChange={(e) => setLabName(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
          </label>
          <label className="block mt-2">
            <span className="text-sm">Address</span>
            <input value={labAddress} onChange={(e) => setLabAddress(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
          </label>
          <div className="flex gap-2 mt-2">
            <input placeholder="City" value={labCity} onChange={(e) => setLabCity(e.target.value)} className="block w-1/2 border px-2 py-1 rounded" />
            <input placeholder="State" value={labState} onChange={(e) => setLabState(e.target.value)} className="block w-1/4 border px-2 py-1 rounded" />
            <input placeholder="Zip" value={labZip} onChange={(e) => setLabZip(e.target.value)} className="block w-1/4 border px-2 py-1 rounded" />
          </div>
        </div>
      )}

      {role === "technician" && (
        <div className="mb-4">
          <h4 className="font-medium">Technician details</h4>
          <label className="block mt-2">
            <span className="text-sm">Experience</span>
            <input value={techExperience} onChange={(e) => setTechExperience(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
          </label>
          <label className="block mt-2">
            <span className="text-sm">Bio</span>
            <textarea value={techBio} onChange={(e) => setTechBio(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
          </label>
        </div>
      )}

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
