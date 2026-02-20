"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Profile = { 
  id: string
  email?: string | null
  role?: string | null
  full_name?: string | null
}

type Technician = {
  id: string
  verified: boolean | null
  experience?: string | null
  bio?: string | null
  company?: string | null
}

type TechnicianWithProfile = Technician & {
  email?: string | null
  full_name?: string | null
}

const AVAILABLE_ROLES = ["admin", "lab", "technician", "none"]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [technicians, setTechnicians] = useState<TechnicianWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'users' | 'technicians'>('users')
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("profiles").select("id, email, role, full_name")
      if (error) console.error(error)
      setUsers(data ?? [])
      
      // Load technicians with their profile info
      const { data: techData, error: techError } = await supabase
        .from("technicians")
        .select(`
          id,
          verified,
          experience,
          bio,
          company
        `)
      
      if (techError) {
        console.error(techError)
      } else {
        // Enrich technicians with profile data
        const enrichedTechs: TechnicianWithProfile[] = (techData ?? []).map(tech => {
          const profile = data?.find(p => p.id === tech.id)
          return {
            ...tech,
            email: profile?.email ?? null,
            full_name: profile?.full_name ?? null
          }
        })
        setTechnicians(enrichedTechs)
      }
      
      setLoading(false)
    }
    load()
  }, [])

  const updateRole = async (userId: string, newRole: string | null) => {
    if (!userId) return
    const confirmed = window.confirm(`Change role for ${userId} to "${newRole ?? "none"}"?`)
    if (!confirmed) return

    setUpdating((s) => ({ ...s, [userId]: true }))
    try {
      const payload: { role?: string | null } = {}
      if (!newRole || newRole === "none") payload.role = null
      else payload.role = newRole

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
      if (error) {
        alert("Update failed: " + error.message)
        return
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: payload.role ?? null } : u)))
    } catch (err) {
      console.error(err)
      alert("An unexpected error occurred")
    } finally {
      setUpdating((s) => ({ ...s, [userId]: false }))
    }
  }

  const verifyTechnician = async (techId: string, verified: boolean) => {
    const action = verified ? 'verify' : 'unverify'
    const confirmed = window.confirm(`Are you sure you want to ${action} this technician?`)
    if (!confirmed) return

    setUpdating((s) => ({ ...s, [techId]: true }))
    try {
      const { error } = await supabase
        .from("technicians")
        .update({ verified })
        .eq("id", techId)
      
      if (error) {
        alert("Update failed: " + error.message)
        return
      }

      setTechnicians((prev) => prev.map((t) => (t.id === techId ? { ...t, verified } : t)))
      alert(`Technician ${verified ? 'verified' : 'unverified'} successfully!`)
    } catch (err) {
      console.error(err)
      alert("An unexpected error occurred")
    } finally {
      setUpdating((s) => ({ ...s, [techId]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Manage Users</h2>
        {loading ? <div className="text-sm text-gray-500">Loading...</div> : null}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'users'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => setActiveTab('technicians')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'technicians'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Technician Verification
          {technicians.filter(t => t.verified === null).length > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
              {technicians.filter(t => t.verified === null).length}
            </span>
          )}
        </button>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm table-auto">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 align-top text-xs font-mono">{u.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3 align-top">{u.email ?? "-"}</td>
                  <td className="px-4 py-3 align-top">
                    <select
                      value={u.role ?? "none"}
                      onChange={(e) => {
                        const selected = e.target.value
                        setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, role: selected === "none" ? null : selected } : p)))
                      }}
                      className="px-2 py-1 border rounded"
                    >
                      {AVAILABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      onClick={() => updateRole(u.id, u.role ?? null)}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                      disabled={!!updating[u.id]}
                    >
                      {updating[u.id] ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Technicians Verification Table */}
      {activeTab === 'technicians' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Experience</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {technicians.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No technicians found
                  </td>
                </tr>
              ) : (
                technicians.map((tech) => (
                  <tr key={tech.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {tech.full_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3">{tech.email || 'N/A'}</td>
                    <td className="px-4 py-3">{tech.company || '-'}</td>
                    <td className="px-4 py-3">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:underline">View</summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-semibold mb-1">Experience:</p>
                          <p className="whitespace-pre-wrap mb-2">{tech.experience || 'N/A'}</p>
                          <p className="font-semibold mb-1">Bio:</p>
                          <p className="whitespace-pre-wrap">{tech.bio || 'N/A'}</p>
                        </div>
                      </details>
                    </td>
                    <td className="px-4 py-3">
                      {tech.verified === null ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                          Pending
                        </span>
                      ) : tech.verified ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          Verified
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        {tech.verified !== true && (
                          <button
                            onClick={() => verifyTechnician(tech.id, true)}
                            disabled={!!updating[tech.id]}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50 hover:bg-green-700"
                          >
                            {updating[tech.id] ? "..." : "Verify"}
                          </button>
                        )}
                        {tech.verified !== false && (
                          <button
                            onClick={() => verifyTechnician(tech.id, false)}
                            disabled={!!updating[tech.id]}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50 hover:bg-red-700"
                          >
                            {updating[tech.id] ? "..." : "Reject"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}