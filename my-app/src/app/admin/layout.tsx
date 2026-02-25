"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkAdminRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          if (mounted) {
            router.push("/signin")
          }
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
          console.error("Error checking admin role:", error)
          setIsAdmin(false)
          router.push("/")
          return
        }

        const userRole = (data.role || "").toString().toLowerCase()
        if (userRole === "admin") {
          setIsAdmin(true)
        } else {
          // Non-admins are redirected to homepage
          setIsAdmin(false)
          router.push("/")
        }
      } catch (err) {
        console.error("Error in admin check:", err)
        if (mounted) {
          router.push("/")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAdminRole()

    return () => {
      mounted = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Verifying permissions...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Unauthorized - Admin access required</div>
      </div>
    )
  }

  return <>{children}</>
}
