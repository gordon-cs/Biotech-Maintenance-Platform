"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Profile = {
  id: string
  role: "lab" | "technician" | null
  full_name: string | null
  phone: string | null
  email?: string | null
}

export default function CompleteProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [role, setRole] = useState<"manager" | "technician" | null>(null)
  const [selectedRole, setSelectedRole] = useState<"manager" | "technician" | null>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setMessage("You must sign in to complete your profile.")
        setLoading(false)
        return
      }

      const userId = session.user.id
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (error) {
        // no existing profile is fine
        setProfile(null)
      } else {
        setProfile(data)
        
        // If user already has a role set, redirect them to home
        if (data?.role) {
          console.log("User already has a role set, redirecting to home")
          router.push("/")
          return
        }
        
        setFullName(data?.full_name ?? "")
        setPhone(data?.phone ?? "")
        setRole(data?.role ?? "")
      }

      setLoading(false)
    }

    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setMessage("You must sign in to save your profile.")
      return
    }
    const userId = session.user.id

    if (role === "manager") {
      // Don't save yet - just pass the data to the lab info page
      // The lab info page will save everything in one call
      const searchParams = new URLSearchParams()
      searchParams.set('fullName', fullName)
      searchParams.set('phone', phone)
      
      // Log what we're passing
      console.log('Navigating with params:', { fullName, phone })
      
      // Use router.push with the URLSearchParams
      router.push(`/complete-lab?${searchParams.toString()}`)
      return
    }

    // For technicians, save basic profile then redirect to tech info
    try {
      setSaving(true)
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error("No access token found")
      }

      // Save profile via API route which uses service role
      const response = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          role: "technician",
          full_name: fullName,
          phone: phone
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save profile")
      }

      // Then go to tech info step with query parameters
      const searchParams = new URLSearchParams()
      searchParams.set('fullName', fullName)
      searchParams.set('phone', phone)
      
      // Log what we're passing
      console.log('Navigating to tech info with params:', { fullName, phone })
      
      // Use router.push with the URLSearchParams
      router.push(`/complete-tech?${searchParams.toString()}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4 border rounded bg-white w-full max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Complete Your Profile</h3>
      {message && <p className="text-sm text-center mb-4">{message}</p>}

      <form onSubmit={handleSave}>
        <div className="mb-4">
          <label className="block mb-2 font-medium">Select your role:</label>
          <div className="flex gap-4">
            <label>
              <input
                type="radio"
                name="role"
                value="manager"
                checked={role === "manager"}
                onChange={() => setRole("manager")}
                required
              />{" "}
              Lab Manager
            </label>
            <label>
              <input
                type="radio"
                name="role"
                value="technician"
                checked={role === "technician"}
                onChange={() => setRole("technician")}
                required
              />{" "}
              Technician
            </label>
          </div>
        </div>

        {role && (
          <>
            <div className="mb-4">
              <label className="block mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded font-semibold mt-4 disabled:opacity-60"
          disabled={!role || saving}
        >
          {role === "manager" ? "Next" : saving ? "Saving..." : "Submit Profile"}
        </button>
      </form>
    </div>
  )
}
