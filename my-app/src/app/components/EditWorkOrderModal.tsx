"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type EditWorkOrderProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (updated: {
    id: string;
    title: string;
    description: string;
    date?: string | null;
    urgency?: string | null;
    equipment?: string | null;
    category_id?: number | null;
    address_id?: number | null;
  }) => void;
  workOrder: {
    id: string;
    title: string;
    description: string;
    date?: string | null;
    urgency?: string | null;
    equipment?: string | null;
    category_id?: number | null | string;
    address_id?: number | null | string;
  };
};

type CategoryRow = { id: number; slug: string; name: string };
type AddressRow = { id: number; line1: string | null; city: string | null; state: string | null; zipcode: string | null };

export default function EditWorkOrderModal({
  open,
  onClose,
  onSaved,
  workOrder,
}: EditWorkOrderProps) {
  const [title, setTitle] = useState(workOrder.title);
  const [description, setDescription] = useState(workOrder.description);
  const [date, setDate] = useState<string | null>(workOrder.date ?? null);
  const [urgency, setUrgency] = useState<string | null>(workOrder.urgency ?? null);
  const [equipment, setEquipment] = useState<string | null>(workOrder.equipment ?? null);
  const [categoryId, setCategoryId] = useState<string | number | null>((workOrder.category_id ?? null) as string | number | null);
  const [addressId, setAddressId] = useState<string | number | null>((workOrder.address_id ?? null) as string | number | null);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When modal opens or workOrder prop changes, sync state
  useEffect(() => {
    setTitle(workOrder.title);
    setDescription(workOrder.description);
    setDate(workOrder.date ?? null);
    setUrgency(workOrder.urgency ?? null);
    setEquipment(workOrder.equipment ?? null);
    setCategoryId(workOrder.category_id ?? null);
    setAddressId(workOrder.address_id ?? null);
  }, [workOrder, open]);

  // load categories and addresses for current manager's lab (addresses limited to their lab)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: catData, error: catError } = await supabase.from("categories").select("id,slug,name");
      if (!catError && catData && mounted) setCategories(catData as CategoryRow[]);

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        // find lab for manager
        const { data: labData } = await supabase.from("labs").select("id").eq("manager_id", userId).maybeSingle();
        if (!labData?.id) return;

        const { data: addrData, error: addrError } = await supabase
          .from("addresses")
          .select("id, line1, city, state, zipcode")
          .eq("lab_id", labData.id);

        if (!addrError && addrData && mounted) setAddresses(addrData as AddressRow[]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("EditWorkOrderModal load error:", err);
      }
    };
    if (open) load();
    return () => {
      mounted = false;
    };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const idNum = Number(workOrder.id);
      if (!Number.isFinite(idNum)) throw new Error("Invalid work order id");

      // normalize category/address to numbers or null
      const catNum = categoryId === null || categoryId === "" ? null : Number(categoryId);
      const addrNum = addressId === null || addressId === "" ? null : Number(addressId);
      if (categoryId !== null && categoryId !== "" && !Number.isFinite(catNum)) {
        setError("Please select a valid category.");
        setLoading(false);
        return;
      }
      if (addressId !== null && addressId !== "" && !Number.isFinite(addrNum)) {
        setError("Please select a valid service area (address).");
        setLoading(false);
        return;
      }

      const payload = {
        title: title?.trim() || null,
        description: description?.trim() || null,
        date: date ?? null,
        urgency: urgency ?? null,
        equipment: equipment ?? null,
        category_id: catNum,
        address_id: addrNum,
      };

      const { error: updateErr } = await supabase.from("work_orders").update(payload).eq("id", idNum);

      if (updateErr) {
        setError(updateErr.message || "Update failed");
      } else {
        onSaved({
          id: workOrder.id,
          title: payload.title ?? "",
          description: payload.description ?? "",
          date: payload.date,
          urgency: payload.urgency,
          equipment: payload.equipment,
          category_id: payload.category_id ?? null,
          address_id: payload.address_id ?? null,
        });
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: AddressRow) => {
    const parts = [addr.line1, addr.city, addr.state, addr.zipcode].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg w-full max-w-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Edit Work Order</h3>

        {error && <div className="text-red-600 mb-2">{error}</div>}

        <label className="block mb-3">
          <div className="text-sm mb-1">Title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border px-2 py-2 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Description</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border px-2 py-2 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Equipment</div>
          <input value={equipment ?? ""} onChange={(e) => setEquipment(e.target.value || null)} className="w-full border px-2 py-1 rounded" />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <div className="text-sm mb-1">Date</div>
            <input type="date" value={date ?? ""} onChange={(e) => setDate(e.target.value || null)} className="w-full border px-2 py-1 rounded" />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Urgency</div>
            <select value={urgency ?? ""} onChange={(e) => setUrgency(e.target.value || null)} className="w-full border px-2 py-1 rounded">
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>

        <label className="block mb-3">
          <div className="text-sm mb-1">Category</div>
          <select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || null)} className="w-full border px-2 py-1 rounded">
            <option value="">(no change)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Service Area (Address)</div>
          <select value={addressId ?? ""} onChange={(e) => setAddressId(e.target.value || null)} className="w-full border px-2 py-1 rounded">
            <option value="">(no change)</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAddress(a)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}