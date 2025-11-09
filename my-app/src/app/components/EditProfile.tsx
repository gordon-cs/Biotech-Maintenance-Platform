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

type Lab = {
  id: string
  name: string
  address: string
  address2?: string
  city: string
  state: string
  zipcode: string
  manager_id: string
}

type Technician = {
  id: string
  experience: string | null
  bio: string | null
  company: string | null
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
  
  // Lab-specific fields
  const [labName, setLabName] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [stateVal, setStateVal] = useState("")
  const [zipcode, setZipcode] = useState("")
  
  // Technician-specific fields
  const [company, setCompany] = useState("")
  const [experience, setExperience] = useState("")
  const [bio, setBio] = useState("")
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
            .select("*")
            .eq("manager_id", userId)
            .single()

          if (!labError && labData) {
            setLabName(labData.name ?? "")
            setAddress1(labData.address ?? "")
            setAddress2(labData.address2 ?? "")
            setCity(labData.city ?? "")
            setStateVal(labData.state ?? "")
            setZipcode(labData.zipcode ?? "")
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
          address: string
          address2: string | null
          city: string
          state: string
          zipcode: string
        }
        tech?: {
          experience: string
          bio: string
          company: string | null
        }
      }

      const requestBody: RequestBody = {
        role: profile?.role ?? null,
        full_name: fullName,
        phone: phone
      }

      if (profile?.role === "lab") {
        requestBody.lab = {
          name: labName,
          address: address1,
          address2: address2 || null,
          city: city,
          state: stateVal,
          zipcode: zipcode
        }
      } else if (profile?.role === "technician") {
        requestBody.tech = {
          experience,
          bio,
          company: company || null
        }
      }

      // Update profile via API route
      const response = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update profile")
      }

      // Update technician categories if applicable
      if (profile?.role === "technician") {
        // Delete existing categories
        const { error: deleteError } = await supabase
          .from("technician_categories")
          .delete()
          .eq("tech_id", session.user.id)

        if (deleteError) {
          throw new Error("Failed to update categories")
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
            throw new Error("Failed to save categories")
          }
        }
      }

      setMessage("Profile updated successfully!")
      setSaving(false)

      // Redirect to home immediately
      router.push("/")
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
    <div className="p-4 max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Edit Your Profile</h3>
      {message && (
        <p className={`text-center mb-4 ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Role Display (Read-only) */}
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <label className="block text-sm font-medium mb-1">Role (cannot be changed)</label>
          <p className="font-semibold capitalize">
            {profile.role === "lab" ? "Lab Manager" : "Technician"}
          </p>
        </div>

        {/* Common Fields */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border px-2 py-1 rounded"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border px-2 py-1 rounded"
            required
          />
        </div>

        {/* Lab-specific fields */}
        {profile.role === "lab" && (
          <>
            <h4 className="font-semibold mt-6 mb-3">Lab Information</h4>
            <input
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="Lab name"
              required
              className="w-full mb-3 border px-2 py-1 rounded"
            />
            <input
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              placeholder="Address 1"
              required
              className="w-full mb-3 border px-2 py-1 rounded"
            />
            <input
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              placeholder="Address 2"
              className="w-full mb-3 border px-2 py-1 rounded"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                required
                className="w-full mb-3 border px-2 py-1 rounded"
              />
              <input
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                placeholder="State"
                required
                className="w-full mb-3 border px-2 py-1 rounded"
              />
            </div>
            <input
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="Zipcode"
              required
              className="w-full mb-3 border px-2 py-1 rounded"
            />
          </>
        )}

        {/* Technician-specific fields */}
        {profile.role === "technician" && (
          <>
            <h4 className="font-semibold mt-6 mb-3">Technician Information</h4>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company (optional)"
              className="w-full mb-3 border px-2 py-1 rounded"
            />
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Experience"
              required
              className="w-full mb-3 border px-2 py-1 rounded min-h-[100px]"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
              required
              className="w-full mb-3 border px-2 py-1 rounded min-h-[100px]"
            />

            <div className="mb-4">
              <label className="block mb-2 font-medium">Categories (select at least one)</label>
              <div className="border rounded p-3 max-h-48 overflow-y-auto">
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

        <div className="flex gap-2 mt-6">
          <button
            type="submit"
            disabled={saving || (profile.role === "technician" && selectedCategories.length === 0)}
            className="flex-1 py-2 bg-blue-600 text-white rounded font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 py-2 bg-gray-300 text-gray-700 rounded font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
