export type DBWorkOrderRow = {
  id: number | string
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  due_date?: string | null
  assigned_to?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_id?: number | null
  address_id?: number | null
}

export type DBWorkOrderUpdateRow = {
  id: number | string
  work_order_id: number | string
  author_id?: string | null
  update_type?: string | null
  new_status?: string | null
  body?: string | null
  created_at?: string | null
}

export type WorkOrderUpdate = {
  id: number
  work_order_id: number
  author_id?: string | null
  update_type?: string | null
  new_status?: string | null
  body?: string | null
  created_at?: string | null
}

export type WorkOrder = {
  id: number | string
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  urgency?: string | null
  category?: string | null
  status?: string | null
  date?: string | null
  due_date?: string | null
  assigned_to?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_id?: number | null
  address_id?: number | null
  address?: string | null
  labName?: string | null
  categoryName?: string | null
  updates?: WorkOrderUpdate[]
}

export type TechnicianDetailProps = {
  order: WorkOrder | null
  currentUserId?: string | null
  onAccept: (id: number | string) => void
  onCancel: (id: number | string) => void
  activeTab: "open" | "mine"
  onStatusChange?: (newStatus: string) => void
}