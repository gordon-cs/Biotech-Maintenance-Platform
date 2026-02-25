"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const router = useRouter()

  // Set page title
  useEffect(() => {
    document.title = "Admin Dashboard | Biotech Maintenance"
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={() => router.push("/admin/users")} 
            className="p-6 bg-white border rounded-lg text-left hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">Manage Users</h2>
            <p className="text-gray-600 text-sm">View and manage user roles and technician verification</p>
          </button>
          <button 
            onClick={() => router.push("/admin/workorders")} 
            className="p-6 bg-white border rounded-lg text-left hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">Manage Work Orders</h2>
            <p className="text-gray-600 text-sm">View and manage all work orders</p>
          </button>
          <button 
            onClick={() => router.push("/admin/categories")} 
            className="p-6 bg-white border rounded-lg text-left hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">Manage Categories</h2>
            <p className="text-gray-600 text-sm">Add, edit, or remove technician specialties</p>
          </button>
        </div>
      </main>
    </div>
  )
}