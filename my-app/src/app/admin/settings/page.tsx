"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function AdminSettingsPage() {
  const [feePercent, setFeePercent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    document.title = "Platform Settings | Admin"
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("platform_fee_percent")
        .eq("id", 1)
        .maybeSingle()

      if (!error && data) {
        setFeePercent(String(data.platform_fee_percent ?? 0))
      }
      setLoading(false)
    }
    void load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(feePercent)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      setMessage({ type: "error", text: "Enter a valid percentage between 0 and 100." })
      return
    }

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, platform_fee_percent: parsed, updated_at: new Date().toISOString() })

    if (error) {
      setMessage({ type: "error", text: "Failed to save: " + error.message })
    } else {
      setMessage({ type: "success", text: "Platform fee updated successfully." })
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Platform Settings</h1>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <form onSubmit={handleSave} className="bg-white border rounded-lg p-6 space-y-6">
            <div>
              <label htmlFor="fee" className="block text-sm font-semibold text-gray-700 mb-1">
                Platform Usage Fee (%)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                This percentage is added on top of the technician&apos;s charge when generating the
                customer invoice. For example, a 10% fee on a $200 service charge results in a
                $220 customer invoice.
              </p>
              <div className="relative w-40">
                <input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 text-sm">%</span>
              </div>
            </div>

            {message && (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
