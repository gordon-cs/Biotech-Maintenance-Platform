"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "./lib/supabaseClient"
import AuthStatus from "./components/AuthStatus"
import WorkOrderSubmissionNav from "./components/WorkOrderSubmissionNav"

export default function Home() {
  const [role, setRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      setLoadingRole(true)
      const { data } = await supabase.auth.getUser()
      const user = data?.user ?? null
      let r: string | null = null

      if (user) {
        // prefer role in user_metadata if present
        r = (user.user_metadata as any)?.role ?? null

        // fallback to profiles table if needed
        if (!r) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
          r = (profile as any)?.role ?? null
        }
      }

      if (mounted) {
        setRole(r)
        setLoadingRole(false)
      }
    }

    loadRole()
    return () => {
      mounted = false
    }
  }, [])

  // treat any role string containing "lab" as lab role (case-insensitive)
  const isLab = !!role && role.toLowerCase().includes("lab")

  return (
    <div className="font-sans min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
          <AuthStatus />
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Get started</h2>
          <p className="mb-4">Use the links to sign in or sign up.</p>
          <div className="flex gap-4 items-center">
            <Link href="/signin" className="text-blue-600 underline">Sign in</Link>
            <Link href="/signup" className="text-blue-600 underline">Create account</Link>

            {/* show navigation only for lab role */}
            {!loadingRole && isLab && <WorkOrderSubmissionNav />}
          </div>
        </section>
      </main>
    </div>
  )
}
