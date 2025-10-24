"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Category = {
  id: number
  name: string
  slug: string
  active: boolean
}

export default function CompleteTechInfo({ initialFull = "", initialPhone = "" }: { initialFull?: string; initialPhone?: string }) {
  const router = useRouter()
  const [company, setCompany] = useState("")
  const [experience, setExperience] = useState("")
  const [bio, setBio] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [fullName, setFullName] = useState(initialFull)
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Load available categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
      
      if (error) {
        console.error('Error loading categories:', error)
        return
      }

      setCategories(data || [])
    }

    loadCategories()
  }, [])

  useEffect(() => {
    // Log initial values to help diagnose the issue
    console.log('Initial values:', { initialFull, initialPhone })
    
    // Set the form values if we have them
    if (initialFull) setFullName(initialFull)
    if (initialPhone) setPhone(initialPhone)
    
    // Only redirect if we're absolutely sure we don't have the data
    const timer = setTimeout(() => {
      if (!initialFull || !initialPhone) {
        console.log('Missing required data:', { initialFull, initialPhone })
        router.push('/complete-profile')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [initialFull, initialPhone, router])

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
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setMessage("You must be signed in.")
        setLoading(false)
        return
      }

      if (!session.access_token) {
        throw new Error("No access token found")
      }

      // Create/update profile and technician info via API route
      const response = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          role: "technician",
          full_name: fullName || initialFull,
          phone: phone || initialPhone,
          tech: {
            experience,
            bio,
            company: company || null
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save technician info")
      }

      // Now insert the technician categories
      const { error: categoryError } = await supabase
        .from('technician_categories')
        .delete()
        .eq('tech_id', session.user.id)

      if (categoryError) {
        throw new Error("Failed to update categories")
      }

      // Insert new categories
      if (selectedCategories.length > 0) {
        const { error: insertError } = await supabase
          .from('technician_categories')
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

      console.log("Technician profile created, redirecting to /")
      setLoading(false)

      // primary client navigation
      router.replace("/")

      // fallback in case next/router navigation doesn't happen
      setTimeout(() => {
        if (window.location.pathname !== "/") window.location.href = "/"
      }, 250)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("CompleteTechInfo error:", err)
      setMessage(msg)
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Complete Your Technician Profile</h3>
      {message && <p className="text-red-600 text-center mb-4">{message}</p>}
      <form onSubmit={handleSubmit}>
        <input
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="Company (optional)"
          className="w-full mb-3 border px-2 py-1 rounded"
        />
        <textarea
          value={experience}
          onChange={e => setExperience(e.target.value)}
          placeholder="Experience"
          required
          className="w-full mb-3 border px-2 py-1 rounded min-h-[100px]"
        />
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Bio"
          required
          className="w-full mb-3 border px-2 py-1 rounded min-h-[100px]"
        />
        
        <div className="mb-4">
          <label className="block mb-2 font-medium">Select your specialties:</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
            {categories.map(category => (
              <label key={category.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.id)}
                  onChange={() => handleCategoryChange(category.id)}
                  className="rounded border-gray-300"
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || selectedCategories.length === 0}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Technician Info"}
        </button>
      </form>
    </div>
  )
}