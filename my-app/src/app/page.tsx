"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import AuthStatus from "./components/AuthStatus"

export default function Home() {
  const router = useRouter()
  const [serviceArea, setServiceArea] = useState("")
  const [date, setDate] = useState<string>("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoriesList, setCategoriesList] = useState<Array<{id:number, slug:string, name:string}>>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      router.push("/signin")
      return
    }
    const userId = session.user.id

    // fetch profile and confirm role is "lab"
    let profRes = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
    if (profRes.error) {
      setMessage("Unable to verify profile. Please complete your profile.")
      return
    }
    if (!profRes.data) {
      setMessage("No profile found. Please complete your profile.")
      return
    }

    const role = profRes.data.role
    if (role !== "lab") {
      setMessage("Only users with the 'lab' role can submit work orders. Complete your profile as a lab user.")
      return
    }

    // find the lab row that references this profile id via manager_id
    const labRes = await supabase
      .from("labs")
      .select("id")
      .eq("manager_id", userId)
      .maybeSingle()
    if (labRes.error) {
      setMessage("Unable to find your lab. Please complete lab info.")
      return
    }
    const labId = labRes.data?.id ?? null
    if (!labId) {
      setMessage("No lab associated with your profile. Redirecting to complete lab info...")
      router.push("/complete-lab-info")
      return
    }

    try {
      setLoading(true)

      // resolve category id: dropdown can return a slug or an id
      let categoryId: number | null = null
      if (category) {
        if (/^\d+$/.test(category)) {
          categoryId = parseInt(category, 10)
        } else {
          const catRes = await supabase
            .from("categories")
            .select("id")
            .eq("slug", category)
            .maybeSingle()
          if (catRes.error) {
            setMessage("Unable to resolve category.")
            setLoading(false)
            return
          }
          categoryId = catRes.data?.id ?? null
        }
      }

      const { data, error } = await supabase.from("work_orders").insert([{
        title: serviceArea || "Service request",
        description: `Category: ${category}\nDate: ${date}`,
        created_by: userId,
        lab: labId,
        date: date || null,
        category_id: categoryId
      }]).select()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      setSuccess("Work order submitted.")
      setServiceArea("")
      setDate("")
      setCategory("")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("categories").select("id,slug,name")
      if (!error && data) setCategoriesList(data as any)
    }
    load()
  }, [])

  return (
    <div className="font-sans min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
          <AuthStatus />
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Work Order</h2>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Large service area input */}
              <label className="block">
                <div className="flex items-center gap-3 border rounded-xl px-4 py-6">
                  <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15 8H9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 14H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 18H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>

                  <input
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    placeholder="Service Area"
                    className="flex-1 bg-transparent outline-none text-lg placeholder-gray-500"
                    required
                  />
                </div>
              </label>

              {/* Row: Date and Category */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <div className="flex items-center gap-3 border rounded-xl px-4 py-4">
                    <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 11H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-transparent outline-none text-sm"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="flex items-center gap-3 border rounded-xl px-4 py-4">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-transparent outline-none text-sm w-full"
                      required
                    >
                      <option value="" disabled>Category</option>
                      {categoriesList.map((cat) => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              {/* Submit button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold"
                >
                  {loading ? "Submitting..." : "Submit Order"}
                </button>
                {message && <p className="text-red-600 text-sm mt-2">{message}</p>}
                {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
