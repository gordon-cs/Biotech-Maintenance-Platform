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
  const [certificate, setCertificate] = useState<File | null>(null)

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
        setFullName(data?.full_name ?? "")
        setPhone(data?.phone ?? "")
        setRole(data?.role ?? "")
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
      // go to lab info step, pass fullName & phone via query
      const q = `?fullName=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`
      router.push(`/complete-lab${q}`)
      return
    }

    // technician: save profile client-side (simple upsert)
    try {
      setSaving(true)
      const payload: Profile = {
        id: userId,
        role: "technician",
        full_name: fullName,
        phone,
        email: null
      }

      // TODO: implement file upload for certificate and set certificate_url in payload
      const { data: upserted, error } = await supabase
        .from("profiles")
        .upsert([payload], { onConflict: "id" })
        .select()
        .single()

      if (error) {
        setMessage(`Save failed: ${error.message}`)
        setSaving(false)
        return
      }

      setMessage("Profile saved")
      router.replace("/")
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

        {role === "technician" && (
          <div className="mb-4">
            <label className="block mb-1">Certificate (PDF or Image)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="w-full"
            />
            {certificate && <p className="text-sm mt-1">{certificate.name}</p>}
          </div>
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
