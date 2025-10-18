"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function CompleteProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  // lab fields
  const [labName, setLabName] = useState("")
  const [labAddress, setLabAddress] = useState("")

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
        name: labName,
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
    <div className="p-4 border rounded bg-white w-full max-w-md">
      <h3 className="font-semibold mb-2">Complete your profile</h3>
      {message && <p className="text-sm text-black">{message}</p>}

      <label className="block mb-2">
        <span className="text-sm">Full name</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full border px-2 py-1 rounded" />
      </label>

      <div className="flex items-center gap-2">
        <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  )
}
