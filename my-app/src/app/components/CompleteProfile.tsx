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

  const [role, setRole] = useState<"lab" | "technician" | null>(null)
  const [selectedRole, setSelectedRole] = useState<"lab" | "technician" | null>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")

  // helper: keep digits only
  const sanitizePhone = (raw: string): string => {
    return (raw ?? "").replace(/[^\d]/g, "")
  }

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.user) {
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
            router.push("/")
            return
          }

          setFullName(data?.full_name ?? "")
          setPhone(data?.phone ?? "")
          setRole(data?.role ?? "")
        }
      } catch {
        setMessage("Unable to load your session. Please sign in again.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const normalizedPhone = sanitizePhone(phone)
    if (normalizedPhone.length < 7) {
      setMessage("Please enter a valid phone number.")
      return
    }

    let sessionToken: string | null = null
    let userId: string | null = null
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user) {
        setMessage("You must sign in to save your profile.")
        return
      }
      sessionToken = session.access_token ?? null
      userId = session.user.id
    } catch {
      setMessage("Unable to verify your session. Please sign in again.")
      return
    }

    if (!userId) {
      setMessage("You must sign in to save your profile.")
      return
    }

    if (role === "lab") {
      // Don't save yet - just pass the data to the lab info page
      // The lab info page will save everything in one call
      const searchParams = new URLSearchParams()
      searchParams.set('fullName', fullName)
      searchParams.set('phone', normalizedPhone)

      // Use router.push with the URLSearchParams
      router.push(`/complete-lab?${searchParams.toString()}`)
      return
    }

    // For technicians, save basic profile then redirect to tech info
    try {
      setSaving(true)
      
      // Get the auth token
      if (!sessionToken) {
        throw new Error("No access token found")
      }

      // Save profile via API route which uses service role
      const response = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          role: "technician",
          full_name: fullName,
          phone: normalizedPhone
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save profile")
      }

      // Then go to tech info step with query parameters
      const searchParams = new URLSearchParams()
      searchParams.set('fullName', fullName)
      searchParams.set('phone', normalizedPhone)

      // Use router.push with the URLSearchParams
      router.push(`/complete-tech?${searchParams.toString()}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto text-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto">
        <h3 className="text-2xl font-bold mb-6 text-gray-900 text-center">Complete Your Profile</h3>
        {message && (
          <p className={`text-center mb-4 ${message.includes("sign in") ? "text-red-600" : "text-gray-700"}`}>
            {message}
          </p>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Select your role:</label>
            <div className="flex gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="lab"
                  checked={role === "lab"}
                  onChange={() => setRole("lab")}
                  className="mr-2"
                  required
                />
                <span className="text-gray-700">Lab Manager</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="technician"
                  checked={role === "technician"}
                  onChange={() => setRole("technician")}
                  className="mr-2"
                  required
                />
                <span className="text-gray-700">Technician</span>
              </label>
            </div>
          </div>

          {role && (
            <>
              <div className="mb-6">
                <label className="block mb-2 font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  title="Digits only"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            disabled={!role || saving}
          >
            {saving ? "Saving..." : "Next"}
          </button>
        </form>
      </div>
    </div>
  )
}
