"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

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

export default function CompleteLabInfo({ initialFull = "", initialPhone = "" }: { initialFull?: string; initialPhone?: string }) {
  const router = useRouter()
  const [labName, setLabName] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [stateVal, setStateVal] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [fullName, setFullName] = useState(initialFull)
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Log initial values to help diagnose the issue
    console.log('Initial values:', { initialFull, initialPhone })
    
    // Set the form values if we have them
    if (initialFull) setFullName(initialFull)
    if (initialPhone) setPhone(initialPhone)
    
    // Only redirect if we're absolutely sure we don't have the data
    // and we're not in the middle of loading it
    const timer = setTimeout(() => {
      if (!initialFull || !initialPhone) {
        console.log('Missing required data:', { initialFull, initialPhone })
        router.push('/complete-profile')
      }
    }, 500) // Increased timeout to ensure we have time to get the data

    return () => clearTimeout(timer)
  }, [initialFull, initialPhone, router])

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

      // Create/update profile and lab via API route
      const response = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          role: "lab",
          full_name: fullName || initialFull, // Use the initial values if no changes
          phone: phone || initialPhone,
          lab: {
            name: labName,
          },
          address: {
            line1: address1,
            line2: address2 || null,
            city: city,
            state: stateVal,
            zipcode: zipcode
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("API Error:", error)
        throw new Error(error.error || `Failed to save lab info (${response.status})`)
      }

      console.log("Lab created, redirecting to /")
      setLoading(false)

      // primary client navigation
      router.replace("/")

      // fallback in case next/router navigation doesn't happen (force full reload)
      setTimeout(() => {
        if (window.location.pathname !== "/") window.location.href = "/"
      }, 250)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("CompleteLabInfo error:", err)
      setMessage(msg)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto">
        <h3 className="text-2xl font-bold mb-6 text-gray-900 text-center">Enter Lab Information</h3>
        {message && <p className="text-red-600 text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Lab Name</label>
            <input 
              value={labName} 
              onChange={e => setLabName(e.target.value)} 
              placeholder="Enter lab name" 
              required 
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Address Line 1</label>
            <input 
              value={address1} 
              onChange={e => setAddress1(e.target.value)} 
              placeholder="Street address" 
              required 
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Address Line 2 (optional)</label>
            <input 
              value={address2} 
              onChange={e => setAddress2(e.target.value)} 
              placeholder="Apartment, suite, etc." 
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block mb-2 font-medium text-gray-700">City</label>
              <input 
                value={city} 
                onChange={e => setCity(e.target.value)} 
                placeholder="City" 
                required 
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="block mb-2 font-medium text-gray-700">State</label>
              <input 
                value={stateVal} 
                onChange={e => setStateVal(e.target.value)} 
                placeholder="State" 
                required 
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Zipcode</label>
            <input 
              value={zipcode} 
              onChange={e => setZipcode(e.target.value)} 
              placeholder="Zipcode" 
              required 
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-2.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Complete Profile"}
          </button>
        </form>
      </div>
    </div>
  )
}