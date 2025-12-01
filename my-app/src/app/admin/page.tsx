"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

function AuthStatus() {
  // Minimal inline AuthStatus fallback to avoid missing module; replace with your real component if available.
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error(error)
        return
      }
      // redirect client-side after sign-out
      window.location.href = "/"
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="text-sm">
      <button
        onClick={handleSignOut}
        className="px-2 py-1 border rounded"
      >
        Sign out
      </button>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    <div className="min-h-screen p-8 bg-white text-black">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <AuthStatus />
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {message && <div className="text-red-600">{message}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button onClick={() => router.push("/admin/users")} className="p-4 border rounded-lg text-left">Manage Users</button>
          <button onClick={() => router.push("/admin/work-orders")} className="p-4 border rounded-lg text-left">Manage Work Orders</button>
          <button onClick={() => router.push("/admin/labs")} className="p-4 border rounded-lg text-left">Manage Labs</button>
          <button onClick={() => router.push("/admin/categories")} className="p-4 border rounded-lg text-left">Manage Categories</button>
          <button onClick={() => router.push("/admin/addresses")} className="p-4 border rounded-lg text-left">Manage Addresses</button>
          <button onClick={() => router.push("/admin/audit-logs")} className="p-4 border rounded-lg text-left">Audit Logs</button>
        </div>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Quick actions</h2>
          <div className="flex gap-3">
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => router.push("/admin/invite")}>Invite Admin/User</button>
            <button className="px-3 py-2 border rounded" onClick={() => router.push("/admin/export")}>Export Data (CSV)</button>
          </div>
        </section>
      </main>
    </div>
  )
}