"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Set page title
  useEffect(() => {
    document.title = "Admin Dashboard | Biotech Maintenance"
  }, [])

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/login")
          return
        }
        const userId = session.user.id
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle()

        if (!mounted) return
        if (error || !data) {
          setMessage("Unable to verify role")
          setIsAdmin(false)
        } else {
          setIsAdmin(((data.role || "").toString().toLowerCase() === "admin"))
          if (((data.role || "").toString().toLowerCase() !== "admin")) {
            // non-admins redirected to homepage
            router.push("/")
          }
        }
      } catch (err) {
        console.error(err)
        setMessage("Error checking admin role")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center">Checking permissions...</div>
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center">Unauthorized</div>

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-6xl mx-auto space-y-6">
        {message && <div className="text-red-600">{message}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button onClick={() => router.push("/admin/users")} className="p-4 border rounded-lg text-left">Manage Users</button>
          <button onClick={() => router.push("/admin/workorders")} className="p-4 border rounded-lg text-left">Manage Work Orders</button>
          <button onClick={() => router.push("/admin/categories")} className="p-4 border rounded-lg text-left">Manage Categories</button>
          <button onClick={() => router.push("/admin/assign-work-orders")} className="p-4 border rounded-lg text-left">Assign Work Orders</button>
        </div>

        {/* simplified: no quick actions for now */}
      </main>
    </div>
  )
}