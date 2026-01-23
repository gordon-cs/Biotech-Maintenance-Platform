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

    if (role === "lab") {
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
