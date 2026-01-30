"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import TechnicianDashboard from "./technician/TechnicianDashboard"

export default function Home() {
  const router = useRouter()

  // auth/role
  const [role, setRole] = useState<"lab" | "technician" | "admin" | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // keep selection so TechnicianDashboard can inform page of the current work order
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Set page title based on role
  useEffect(() => {
    if (role === "technician") document.title = "Technician Dashboard | Biotech Maintenance"
    else if (role === "lab") document.title = "Lab Dashboard | Biotech Maintenance"
    else if (role === "admin") document.title = "Admin Dashboard | Biotech Maintenance"
    else document.title = "Biotech Maintenance Platform"
  }, [role])

  // Load role once and on auth changes
  useEffect(() => {
    let mounted = true

    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          if (mounted) {
            setRoleLoaded(true)
            setIsLoggedIn(false)
          }
          return
        }

        if (mounted) {
          setCurrentUserId(session.user.id)
          setIsLoggedIn(true)
        }
        const userId = session.user.id

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle()

        if (!mounted) return

        if (!error && data) {
          const r = (data.role || "").toString().toLowerCase()
          const userRole =
            r === "technician" ? "technician" :
            r === "lab" ? "lab" :
            r === "admin" ? "admin" : null
          setRole(userRole)

          // Auto-redirect admin and lab users
          if (userRole === "admin") {
            setIsRedirecting(true)
            window.location.href = "/admin"
            return
          }
          if (userRole === "lab") {
            setIsRedirecting(true)
            window.location.href = "/manager"
            return
          }
        }

        if (mounted) setRoleLoaded(true)
      } catch (err) {
        if (mounted) setRoleLoaded(true)
      }
    }

    loadRole()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadRole()
    })

    return () => {
      mounted = false
      try { sub?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  // wait for role load
  if (!roleLoaded) return null

  // Technician view (delegates work-order UI to TechnicianDashboard)
  if (role === "technician") {
    return <TechnicianDashboard onSelectWorkOrder={(id) => setSelectedId(id)} />
  }

  // Show loading while checking role or redirecting
  if (!roleLoaded || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRedirecting ? "Redirecting to manager dashboard..." : "Loading..."}
          </p>
        </div>
      </div>
    )
  }

  // Fallback views (Complete profile / sign in)
  if (isLoggedIn && !role) {
    return (
      <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Biotech Maintenance!</h1>
              <p className="text-gray-600">Please complete your profile to get started</p>
            </div>
            <button
              onClick={() => router.push("/complete-profile")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Complete Profile
            </button>
          </section>
        </main>
      </div>
    )
  }

  // Default view for non-logged-in users
  return (
    <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-3xl mx-auto">
        <section>
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Biotech Maintenance Platform</h1>
              <p className="text-gray-600">Please sign in to access the platform</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push("/signin")}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push("/signup")}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-green-600 border-2 border-green-600 rounded-lg font-semibold transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
