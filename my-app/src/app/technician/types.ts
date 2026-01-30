export type DBWorkOrderRow = {
  id: number | string
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
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
  id: number
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
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