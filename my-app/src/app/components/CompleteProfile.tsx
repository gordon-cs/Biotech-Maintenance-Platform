"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function CompleteProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const [role, setRole] = useState<"manager" | "technician" | "">("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [labAddress, setLabAddress] = useState("")
  const [certificate, setCertificate] = useState<File | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setMessage("You must sign in to complete your profile.")
        setLoading(false)
        return
      }

      const userId = session.user.id
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()
      if (error) {
        setMessage(`Failed to fetch profile: ${error.message}`)
      } else {
        setProfile(data)
        setFullName(data?.full_name ?? "")
        setPhone(data?.phone ?? "")
      }

      setLoading(false)
    }

    load()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertificate(e.target.files[0])
    }
  }

  const handleSave = async () => {
    setMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setMessage("You must sign in to save your profile.")
      return
    }

    const token = session.access_token

    const payload = {
      role: profile?.role ?? null,
      full_name: fullName,
      phone,
      lab: {
        name: labAddress,
        address: labAddress,
      }
    }

    const res = await fetch('/api/create-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()
    if (!res.ok) {
      setMessage(`Save failed: ${result.error}`)
      return
    }

    setMessage('Profile updated')
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4 border rounded bg-white w-full max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Complete Your Profile</h3>
      {message && <p className="text-green-600 text-center mb-4">{message}</p>}
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
                onChange={e => setFullName(e.target.value)}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>
          </>
        )}

        {role === "manager" && (
          <div className="mb-4">
            <label className="block mb-1">Lab Address</label>
            <input
              type="text"
              value={labAddress}
              onChange={e => setLabAddress(e.target.value)}
              className="w-full border px-2 py-1 rounded"
              required
            />
          </div>
        )}

        {role === "technician" && (
          <div className="mb-4">
            <label className="block mb-1">Certificate (PDF or Image)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="w-full"
              required
            />
            {certificate && <p className="text-sm mt-1">{certificate.name}</p>}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded font-semibold mt-4"
          disabled={!role}
        >
          Submit Profile
        </button>
      </form>
    </div>
  )
}
