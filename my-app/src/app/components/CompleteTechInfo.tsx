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
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)

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

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type (PDF only)
      if (file.type !== 'application/pdf') {
        setMessage("Please upload a PDF file only")
        setResumeFile(null)
        e.target.value = ""
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage("Resume file must be less than 5MB")
        setResumeFile(null)
        e.target.value = ""
        return
      }
      setResumeFile(file)
      setMessage(null)
    } else {
      // No file selected; clear any previously stored resume
      setResumeFile(null)
      e.target.value = ""
    }
  }

  const uploadResume = async (userId: string): Promise<string | null> => {
    if (!resumeFile) return null

    setUploadingResume(true)
    try {
      // Create a unique filename
      const fileExt = 'pdf'
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      // Don't include bucket name in path, just the filename
      const filePath = fileName

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('resume') // Your bucket name
        .upload(filePath, resumeFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Storage upload error:', error)
        throw error
      }

      // Return just the file path (not URL) to store in database
      // URLs will be generated on-demand when viewing
      return filePath
    } catch (error) {
      console.error('Error uploading resume:', error)
      throw error
    } finally {
      setUploadingResume(false)
    }
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

      // Upload resume first if provided
      let resumeUrl: string | null = null
      if (resumeFile) {
        try {
          resumeUrl = await uploadResume(session.user.id)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error('Resume upload error:', error)
          setMessage(`Failed to upload resume: ${errorMsg}`)
          setLoading(false)
          return
        }
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
            company: company || null,
            resume_url: resumeUrl
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto">
        <h3 className="text-2xl font-bold mb-6 text-gray-900 text-center">Complete Your Technician Profile</h3>
        {message && <p className="text-red-600 text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Company (optional)</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Enter company name"
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Experience</label>
            <textarea
              value={experience}
              onChange={e => setExperience(e.target.value)}
              placeholder="Describe your experience"
              required
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              required
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Resume (PDF, max 5MB)</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleResumeChange}
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {resumeFile && (
              <p className="text-sm text-gray-600 mt-2">Selected: {resumeFile.name}</p>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Select your specialties (at least one required):</label>
            <div className="border border-gray-300 rounded p-3 max-h-48 overflow-y-auto bg-white">
              {categories.map(category => (
                <label key={category.id} className="flex items-center mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => handleCategoryChange(category.id)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploadingResume || selectedCategories.length === 0}
            className="w-full py-2.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingResume ? "Uploading Resume..." : loading ? "Saving..." : "Complete Profile"}
          </button>
        </form>
      </div>
    </div>
  )
}