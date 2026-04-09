"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Profile = {
  id: string
  role: "admin" | "lab" | "technician" | null
  full_name: string | null
  phone: string | null
  email?: string | null
}

type Lab = {
  id: number
  name: string
  manager_id: string
}

type Technician = {
  id: string
  experience: string | null
  bio: string | null
  company: string | null
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
}

type Category = {
  id: number
  name: string
  slug: string
  active: boolean
}

export default function EditProfile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")

  // helper: keep digits only (no plus, no letters)
  const sanitizePhone = (raw: string): string => {
    return (raw ?? "").replace(/[^\d]/g, "")
  }
  
  // Lab-specific fields
  const [labName, setLabName] = useState("")
  
  // Technician-specific fields
  const [company, setCompany] = useState("")
  const [experience, setExperience] = useState("")
  const [bio, setBio] = useState("")
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/signin")
          return
        }

        const userId = session.user.id

        // Load profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (profileError) {
          setMessage("Failed to load profile")
          setLoading(false)
          return
        }

        setProfile(profileData)
        setFullName(profileData.full_name ?? "")
        setPhone(profileData.phone ?? "")

        // Load role-specific data
        if (profileData.role === "lab") {
          const { data: labData, error: labError } = await supabase
            .from("labs")
            .select("id, name")
            .eq("manager_id", userId)
            .single()

          if (!labError && labData) {
            setLabName(labData.name ?? "")
          }
        } else if (profileData.role === "technician") {
          // Load technician data
          const { data: techData, error: techError } = await supabase
            .from("technicians")
            .select("*")
            .eq("id", userId)
            .single()

          if (!techError && techData) {
            setCompany(techData.company ?? "")
            setExperience(techData.experience ?? "")
            setBio(techData.bio ?? "")
            setLine1(techData.line1 ?? "")
            setLine2(techData.line2 ?? "")
            setCity(techData.city ?? "")
            setState(techData.state ?? "")
            setZipcode(techData.zipcode ?? "")
          }

          // Load categories
          const { data: allCategories } = await supabase
            .from("categories")
            .select("*")
            .eq("active", true)

          if (allCategories) {
            setCategories(allCategories)
          }

          // Load user's selected categories
          const { data: userCategories } = await supabase
            .from("technician_categories")
            .select("category_id")
            .eq("tech_id", userId)

          if (userCategories) {
            setSelectedCategories(userCategories.map(c => c.category_id))
          }
        }

        setLoading(false)
      } catch (err) {
        console.error("Error loading profile:", err)
        setMessage("An error occurred while loading your profile")
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleCategoryChange = (categoryId: number) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId)
      } else {
        return [...prev, categoryId]
      }
    })
  }

  const postJson = async <T,>(url: string, token: string, body: unknown): Promise<T> => {
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
    } catch (networkErr) {
      console.error(`Network error calling ${url}:`, networkErr)
      throw new Error("Server connection failed. Start the app from my-app using 'npm run dev' and try again.")
    }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const errorPayload = payload as { error?: string; message?: string } | null
      throw new Error(errorPayload?.error || errorPayload?.message || `Request failed (${response.status})`)
    }

    return (payload ?? {}) as T
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setMessage("You must be signed in.")
        setSaving(false)
        return
      }

      const normalizedPhone = sanitizePhone(phone)
      if (normalizedPhone.length < 7) {
        setMessage("Please enter a valid phone number.")
        setSaving(false)
        return
      }
      setPhone(normalizedPhone)

      if (!session.access_token) {
        throw new Error("No access token found")
      }

      // Prepare the request body based on role
      type RequestBody = {
        role: "lab" | "technician" | null
        full_name: string
        phone: string
        lab?: {
          name: string
        }
        tech?: {
          experience: string
          bio: string
          company: string | null
          line1: string | null
          line2: string | null
          city: string | null
          state: string | null
          zipcode: string | null
        }
      }

      const requestBody: RequestBody = {
        role: profile?.role === "lab" || profile?.role === "technician" ? profile.role : null,
        full_name: fullName,
        phone: normalizedPhone
      }

      if (profile?.role === "lab") {
        requestBody.lab = {
          name: labName
        }
      } else if (profile?.role === "technician") {
        requestBody.tech = {
          experience,
          bio,
          company: company || null,
          line1: line1 || null,
          line2: line2 || null,
          city: city || null,
          state: state || null,
          zipcode: zipcode || null,
        }
      }

      // Update profile via API route
      await postJson<{ ok: boolean }>("/api/create-profile", session.access_token, requestBody)

      // Update technician categories if applicable
      let categoryUpdateFailed = false;
      let vendorSyncWarning: string | null = null;
      if (profile?.role === "technician") {
        try {
          // Delete existing categories
          const { error: deleteError } = await supabase
            .from("technician_categories")
            .delete()
            .eq("tech_id", session.user.id)

          if (deleteError) {
            categoryUpdateFailed = true;
            throw new Error("Failed to update categories");
          }

          // Insert new categories
          if (selectedCategories.length > 0) {
            const { error: insertError } = await supabase
              .from("technician_categories")
              .insert(
                selectedCategories.map(categoryId => ({
                  tech_id: session.user.id,
                  category_id: categoryId,
                }))
              )

            if (insertError) {
              categoryUpdateFailed = true;
              throw new Error("Failed to save categories");
            }
          }
        } catch (catErr) {
          // Log the error, but continue to show partial success
          console.error("Category update error:", catErr);
          categoryUpdateFailed = true;
        }

        try {
          await postJson<{ ok: boolean }>(
            "/api/bill/vendors/sync",
            session.access_token,
            { technicianId: session.user.id }
          )
        } catch (syncErr) {
          console.error("Vendor sync error:", syncErr)
          vendorSyncWarning =
            syncErr instanceof Error
              ? `Profile updated, but vendor sync failed. ${syncErr.message}`
              : "Profile updated, but vendor sync failed."
        }
      }

      if (categoryUpdateFailed && vendorSyncWarning) {
        setMessage(`Profile updated, but failed to update categories and vendor sync. ${vendorSyncWarning}`)
      } else if (categoryUpdateFailed) {
        setMessage("Profile updated, but failed to update categories.");
      } else if (vendorSyncWarning) {
        setMessage(vendorSyncWarning)
      } else {
        setMessage("Profile updated successfully!")
      }
      setSaving(false)

      if (!categoryUpdateFailed && !vendorSyncWarning) {
        router.push("/")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("Error updating profile:", err)
      setMessage(msg)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (!profile) {
    return <div className="p-4">No profile found. Please complete your profile first.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold mb-6 text-gray-900">Edit Your Profile</h3>
      {message && (
        <p className={`text-center mb-4 ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Common Fields */}
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
          <label className="block mb-2 font-medium text-gray-700">Phone</label>
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

        {/* Lab-specific fields */}
        {profile.role === "lab" && (
          <>
            <h4 className="text-lg font-semibold mt-6 mb-4 text-gray-900">Lab Information</h4>
            <div className="mb-6">
              <label htmlFor="lab-name" className="block font-medium mb-2 text-gray-700">Lab Name</label>
              <input
                id="lab-name"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Lab name"
                required
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {/* Technician-specific fields */}
        {profile.role === "technician" && (
          <>
            <h4 className="text-lg font-semibold mt-6 mb-4 text-gray-900">Technician Information</h4>
            <div className="mb-6">
              <label htmlFor="company" className="block mb-2 font-medium text-gray-700">Company (optional)</label>
              <input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company (optional)"
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="line1" className="block mb-2 font-medium text-gray-700">Address Line 1</label>
              <input
                id="line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Street address"
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="line2" className="block mb-2 font-medium text-gray-700">Address Line 2 (optional)</label>
              <input
                id="line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Suite, apt, unit"
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label htmlFor="city" className="block mb-2 font-medium text-gray-700">City</label>
                <input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="state" className="block mb-2 font-medium text-gray-700">State</label>
                <input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="zipcode" className="block mb-2 font-medium text-gray-700">Zipcode</label>
                <input
                  id="zipcode"
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mb-6">
              <label htmlFor="experience" className="block mb-2 font-medium text-gray-700">Experience</label>
              <textarea
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Experience"
                required
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="bio" className="block mb-2 font-medium text-gray-700">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                required
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-medium text-gray-700">Categories (select at least one)</label>
              <div className="border border-gray-300 rounded p-3 max-h-48 overflow-y-auto bg-white">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => handleCategoryChange(category.id)}
                      className="mr-2"
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 mt-8">
          <button
            type="submit"
            disabled={saving || (profile.role === "technician" && selectedCategories.length === 0)}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}
