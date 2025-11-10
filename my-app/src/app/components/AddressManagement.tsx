"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Address = {
  id: number
  lab_id: number
  address: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
}

export default function AddressManagement() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [labId, setLabId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    address: "",
    address2: "",
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
      address: address.address || "",
      address2: address.address2 || "",
      city: address.city || "",
      state: address.state || "",
      zipcode: address.zipcode || "",
    })
    setShowAddForm(false)
  }

  const handleAdd = () => {
    setEditingId(null)
    setFormData({
      address: "",
      address2: "",
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
      address: "",
      address2: "",
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
        address: formData.address || null,
        address2: formData.address2 || null,
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

        if (error) throw error
        setMessage("Address updated successfully!")
      } else {
        // Create new address
        const { error } = await supabase
          .from("addresses")
          .insert(addressData)

        if (error) throw error
        setMessage("Address added successfully!")
      }

      // Reload addresses
      await loadAddresses()
      handleCancel()
    } catch (err) {
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
    <div className="p-4 max-w-2xl mx-auto mt-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Manage Addresses</h3>
        {!showAddForm && !editingId && (
          <button
            onClick={handleAdd}
            className="px-3 py-1 bg-blue-600 text-white rounded"
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
        <form onSubmit={handleSave} className="mb-6 p-4 border rounded bg-gray-50">
          <h4 className="font-semibold mb-3">
            {editingId ? "Edit Address" : "Add New Address"}
          </h4>

          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium">Address Line 1 *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border px-2 py-1 rounded"
              required
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium">Address Line 2</label>
            <input
              type="text"
              value={formData.address2}
              onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
              className="w-full border px-2 py-1 rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block mb-1 text-sm font-medium">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full border px-2 py-1 rounded"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium">Zip Code *</label>
            <input
              type="text"
              value={formData.zipcode}
              onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
              className="w-full border px-2 py-1 rounded"
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {addresses.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No addresses found. Add one to get started.</p>
        ) : (
          addresses.map((addr) => (
            <div key={addr.id} className="p-4 border rounded bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{addr.address}</p>
                  {addr.address2 && <p className="text-sm text-gray-600">{addr.address2}</p>}
                  <p className="text-sm text-gray-600">
                    {[addr.city, addr.state, addr.zipcode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
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
    </div>
  )
}
