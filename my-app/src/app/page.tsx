"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import AuthStatus from "./components/AuthStatus"
import Link from "next/link" // <-- added for technician links

export default function Home() {
  const router = useRouter()
  const [serviceArea, setServiceArea] = useState("")
  const [date, setDate] = useState<string>("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoriesList, setCategoriesList] = useState<Array<{id:number, slug:string, name:string}>>([])

  // NEW: track the user's role
  const [role, setRole] = useState<"lab" | "technician" | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        if (mounted) setRoleLoaded(true)
        return
      }
      const userId = session.user.id
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle()
      if (!mounted) return
      if (!error && data) {
        // normalize to avoid case mismatches and ensure exact match
        const r = (data.role || "").toString().toLowerCase()
        setRole(r === "technician" ? "technician" : r === "lab" ? "lab" : null)
      }
     if (mounted) setRoleLoaded(true)
    }
    loadRole()
    return () => { mounted = false }
  }, [])

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
    const profRes = await supabase
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

      const { error } = await supabase.from("work_orders").insert([{
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
      if (!error && data) setCategoriesList(data as Array<{id:number, slug:string, name:string}>)
    }
    load()
  }, [])

  // CONDITIONAL RENDER: technician view
  if (!roleLoaded) {
    // wait for role load (prevents showing lab UI while role is unknown)
    return null
  }
  if (role === "technician") {
    return (
      <div className="font-sans min-h-screen p-8 bg-white text-black">
        <main className="max-w-5xl mx-auto">
          {/* KEEP TOP PART IDENTICAL: title + AuthStatus */}
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
            <AuthStatus />
          </header>

          {/* Technician UI: top browse button + work orders panel */}
          <section className="space-y-8">
            <div className="flex justify-center">
              <Link
                href="/work-orders"
                className="w-full max-w-4xl text-center inline-block px-6 py-3 bg-gradient-to-r from-green-700 to-green-500 text-white font-semibold rounded-full shadow-lg"
                aria-label="Browse Open Request"
              >
                Browse Open Request
              </Link>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 shadow-sm">
              <h2 className="text-center text-xl font-semibold mb-6">Work Orders</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {/* Replace the array with real work orders */}
                {[1, 2, 3, 4].map((i) => (
                  <article
                    key={i}
                    className="w-64 border-2 border-gray-300 rounded-xl p-5 bg-white flex flex-col justify-between"
                    role="article"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-base font-medium">Title</p>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="text-sm text-gray-600">Category</p>
                      </div>
                      <span className="ml-2 px-3 py-1 rounded-full bg-gray-200 text-xs">Status</span>
                    </div>

                    <p className="text-sm text-gray-500 my-6 text-center flex-1">Detailed Description</p>

                    <div className="mt-4 flex justify-center">
                      <Link
                        href={`/work-orders/${i}`}
                        className="px-4 py-2 bg-gray-200 text-sm rounded-full hover:bg-gray-300"
                      >
                        View Order Details
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex justify-center mt-8">
                <button className="px-10 py-3 bg-green-600 text-white rounded-full font-semibold shadow">
                  View All Orders
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

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
            {/* navigate to submission page instead of submitting here */}
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
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

               {/* Navigate to the full submission page */}
               <div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/work-orders/submission?category=${encodeURIComponent(
                        category
                      )}&date=${encodeURIComponent(date)}`
                    )
                  }
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold"
                >
                  Submit Work Order
                </button>
              </div>
             </form>
           </div>
         </section>
       </main>
     </div>
   )
}
