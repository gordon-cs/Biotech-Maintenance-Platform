"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

type Address = {
  id: number
  lab_id: number
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  is_default: boolean
}

export default function AddressManagement() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get("returnTo") || null
  
  const [addresses, setAddresses] = useState<Address[]>([])
  const [labId, setLabId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zipcode: "",
  })

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage("You must be signed in.")
        setLoading(false)
        return
      }

      // Get user's lab
      const { data: labData, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("manager_id", user.id)
        .single()

      if (labError || !labData) {
        setMessage("No lab found for your account.")
        setLoading(false)
        return
      }

      setLabId(labData.id)

      // Load addresses for this lab
      const { data: addressData, error: addressError } = await supabase
        .from("addresses")
        .select("*")
        .eq("lab_id", labData.id)
        .order("id", { ascending: true })

      if (addressError) {
        setMessage("Failed to load addresses.")
        setLoading(false)
        return
      }

      setAddresses(addressData || [])
      setLoading(false)
    } catch (err) {
      console.error("Error loading addresses:", err)
      setMessage("An error occurred while loading addresses.")
      setLoading(false)
    }
  }

  const handleEdit = (address: Address) => {
    setEditingId(address.id)
    setFormData({
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      zipcode: address.zipcode || "",
    })
    setShowAddForm(false)
  }

  const handleAdd = () => {
    setEditingId(null)
    setFormData({
      line1: "",
      line2: "",
      city: "",
      state: "",
      zipcode: "",
    })
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setEditingId(null)
    setShowAddForm(false)
    setFormData({
      line1: "",
      line2: "",
      city: "",
      state: "",
      zipcode: "",
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!labId) {
      setMessage("No lab ID found.")
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const addressData = {
        lab_id: labId,
        line1: formData.line1 || null,
        line2: formData.line2 || null,
        city: formData.city || null,
        state: formData.state || null,
        zipcode: formData.zipcode || null,
      }

      if (editingId) {
        // Update existing address
        const { error } = await supabase
          .from("addresses")
          .update(addressData)
          .eq("id", editingId)

        if (error) {
          console.error("Update error:", error)
          throw new Error(error.message || "Failed to update address")
        }
        setMessage("Address updated successfully!")
      } else {
        // Create new address
        const { data, error } = await supabase
          .from("addresses")
          .insert(addressData)
          .select()

        if (error) {
          console.error("Insert error:", error)
          throw new Error(error.message || "Failed to add address")
        }
        console.log("Address created:", data)
        const newAddressId = data?.[0]?.id
        setMessage("Address added successfully!")
        
        // Reload addresses and redirect back if needed
        await loadAddresses()
        if (newAddressId) {
          const safeReturnTo =
            typeof returnTo === "string" &&
            returnTo.startsWith("/") &&
            !returnTo.startsWith("//")
              ? returnTo
              : null

          if (safeReturnTo) {
            const redirectUrl = new URL(safeReturnTo, window.location.origin)
            redirectUrl.searchParams.set("address_id", String(newAddressId))
            const allParams = new URLSearchParams(searchParams?.toString() || "")
            allParams.forEach((value, key) => {
              if (key !== "returnTo" && key !== "address_id") {
                redirectUrl.searchParams.set(key, value)
              }
            })
            setTimeout(() => {
              router.push(redirectUrl.pathname + redirectUrl.search)
            }, 500)
          } else {
            handleCancel()
          }
        } else {
          handleCancel()
        }
        return
      }

      // Reload addresses
      await loadAddresses()
      handleCancel()
    } catch (err) {
      console.error("Error saving address:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this address?")) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id)

      if (error) throw error
      setMessage("Address deleted successfully!")
      await loadAddresses()
    } catch (err) {
      console.error("Error deleting address:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: number) => {
    if (!labId) return

    setSaving(true)
    setMessage(null)

    try {
      // First, unset all defaults for this lab
      const { error: unsetError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("lab_id", labId)

      if (unsetError) throw unsetError

      // Then set the selected address as default
      const { error: setError } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id)

      if (setError) throw setError

      setMessage("Default address updated successfully!")
      await loadAddresses()
    } catch (err) {
      console.error("Error setting default address:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading addresses...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Manage Addresses</h3>
        {!showAddForm && !editingId && (
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            Add New Address
          </button>
        )}
      </div>

      {message && (
        <p className={`text-center mb-4 ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}

      {(showAddForm || editingId) && (
        <form onSubmit={handleSave} className="mb-6 p-6 border border-gray-200 rounded-lg bg-white">
          <h4 className="text-lg font-semibold mb-4 text-gray-900">
            {editingId ? "Edit Address" : "Add New Address"}
          </h4>

          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Address Line 1 *</label>
            <input
              type="text"
              value={formData.line1}
              onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Address Line 2</label>
            <input
              type="text"
              value={formData.line2}
              onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block mb-2 font-medium text-gray-700">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block mb-2 font-medium text-gray-700">State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Zip Code *</label>
            <input
              type="text"
              value={formData.zipcode}
              onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
              className="w-full border border-gray-300 rounded px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {addresses.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No addresses found. Add one to get started.</p>
        ) : (
          addresses.map((addr) => (
            <div key={addr.id} className="p-6 border border-gray-200 rounded-lg bg-white">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  {addr.is_default && (
                    <span className="inline-block mb-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-semibold">
                      Default
                    </span>
                  )}
                  <p className="font-medium">{addr.line1}</p>
                  {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
                  <p className="text-sm text-gray-600">
                    {[addr.city, addr.state, addr.zipcode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="px-2 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 whitespace-nowrap"
                      disabled={saving}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(addr)}
                    className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 text-center space-x-4">
        {returnTo && (
          <button
            onClick={() => {
              const returnUrl = new URL(returnTo, window.location.origin)
              // Preserve form parameters
              const allParams = new URLSearchParams(searchParams?.toString() || "")
              allParams.forEach((value, key) => {
                if (key !== "returnTo") {
                  returnUrl.searchParams.set(key, value)
                }
              })
              router.push(returnUrl.pathname + returnUrl.search)
            }}
            className="inline-flex items-center px-4 py-2.5 bg-gray-600 text-white rounded font-semibold hover:bg-gray-700 transition-colors"
          >
            Back to Form
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2.5 bg-gray-200 text-gray-800 rounded font-semibold hover:bg-gray-300 transition-colors"
        >
          Return to Homepage
        </Link>
      </div>
      </div>
    </div>
  )
}
