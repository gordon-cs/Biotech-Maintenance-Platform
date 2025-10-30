"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import AuthStatus from "./components/AuthStatus"
import WorkOrderSubmissionNav from "./components/WorkOrderSubmissionNav"
import { supabase } from "./lib/supabaseClient"

type UserMetadata = { role?: string }
type ProfileRow = { role?: string | null }

export default function Home() {
  const [role, setRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      setLoadingRole(true)
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        const user = authData?.user ?? null

        let r: string | null = null
        if (user) {
          const metadata = (user.user_metadata as UserMetadata | undefined)
          r = metadata?.role ?? null

          if (!r) {
            const { data, error: profileErr } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single()
            if (profileErr) throw profileErr
            const profile = data as ProfileRow | null
            r = profile?.role ?? null
          }
        }

        if (mounted) setRole(r)
      } catch (err: unknown) {
        console.error(err)
      } finally {
        if (mounted) setLoadingRole(false)
      }
    }

    loadRole()
    return () => {
      mounted = false
    }
  }, [])

  const isLab = !!role && role.toLowerCase().includes("lab")

  return (
    <div className="font-sans min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
          </div>
          <AuthStatus />
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Get started</h2>
          <p className="mb-4">Use the links to sign in or sign up.</p>
          <div className="flex gap-4 items-center">
            <Link href="/signin" className="text-blue-600 underline">Sign in</Link>
            <Link href="/signup" className="text-blue-600 underline">Create account</Link>
            {!loadingRole && isLab && <WorkOrderSubmissionNav />}
          </div>
        </section>
      </main>
    </div>
  )
}
