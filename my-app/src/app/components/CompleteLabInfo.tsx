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
            address: address1,
            address2: address2 || null,
            city: city,
            state: stateVal,
            zipcode: zipcode
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save lab info")
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
    <div className="p-4 max-w-md mx-auto mt-10">
      <h3 className="font-semibold mb-4 text-center">Enter Lab Information</h3>
      {message && <p className="text-red-600 text-center mb-4">{message}</p>}
      <form onSubmit={handleSubmit}>
        <input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Lab name" required className="w-full mb-3 border px-2 py-1 rounded" />
        <input value={address1} onChange={e => setAddress1(e.target.value)} placeholder="Address 1" required className="w-full mb-3 border px-2 py-1 rounded" />
        <input value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Address 2" className="w-full mb-3 border px-2 py-1 rounded" />
        <div className="grid grid-cols-2 gap-2">
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" required className="w-full mb-3 border px-2 py-1 rounded" />
          <input value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State" required className="w-full mb-3 border px-2 py-1 rounded" />
        </div>
        <input value={zipcode} onChange={e => setZipcode(e.target.value)} placeholder="Zipcode" required className="w-full mb-3 border px-2 py-1 rounded" />
        <button type="submit" disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded">
          {loading ? "Saving..." : "Save Lab Info"}
        </button>
      </form>
    </div>
  )
}