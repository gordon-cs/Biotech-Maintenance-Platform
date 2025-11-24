# Work Order Status Updates Feature

This feature adds the ability to post comments and status updates to work orders, creating a communication timeline directly on each work order.

## What Was Created

### 1. API Route (`/api/work-order-updates/route.ts`)
- **GET**: Fetches all updates for a work order
- **POST**: Creates a new comment or status change
- Uses service role client for authorization (matching `create-profile` pattern)
- Requires Bearer token authentication

### 2. Components

#### `WorkOrderUpdates.tsx`
Displays the timeline of updates for a work order.
- Shows comments and status changes
- Displays author info (name, email, role)
- Color-coded status badges
- Formatted timestamps

#### `AddWorkOrderUpdate.tsx`
Combined component with form and display list.
- Toggle between comment and status change
- Form validation
- Success/error messaging
- Auto-refresh on post
- Matches existing form styling

## How to Use

### Already Integrated
The feature is already added to:

1. **Past Orders Page** (`/work-orders/past`)
   - Shows in the detail panel when viewing an order
   - Lab managers can comment
   - Status change button only appears for technicians

2. **Technician Dashboard** (`/`)
   - Shows when viewing work order details
   - Technicians can comment and change status

### Add to Other Pages

```tsx
import AddWorkOrderUpdate from "@/components/AddWorkOrderUpdate"

// In your component:
<AddWorkOrderUpdate 
  workOrderId={123}
  currentStatus="open"
  userRole={currentUserRole}  // pass user's role, or omit to auto-fetch
/>
```

## Permissions

The database RLS policies control who can:

**View Updates:**
- Admin
- Lab manager of that lab
- Work order creator
- Assigned technician  
- Any technician for OPEN work orders

**Post Comments:**
- Admin
- Lab manager of that lab
- Work order creator
- Assigned technician

**Change Status:**
- Technicians only (not lab managers or admins)

## Status Values

- `open` - New work order
- `claimed` - Claimed by a technician
- `completed` - Finished
- `canceled` - Canceled

## Database Schema

```sql
-- Table: work_order_updates
id              bigserial primary key
work_order_id   bigint (references work_orders)
author_id       uuid (references profiles)
update_type     'comment' | 'status_change'
new_status      work order status (if status_change)
body            text (required, trimmed)
created_at      timestamptz
```

When a status_change is posted, a trigger automatically updates the parent work order's status.

## API Examples

### Get Updates
```javascript
const response = await fetch(
  `/api/work-order-updates?work_order_id=123`
)
const { data } = await response.json()
```

### Post Comment
```javascript
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch('/api/work-order-updates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    work_order_id: 123,
    update_type: 'comment',
    body: 'Equipment has been ordered'
  })
})
```

### Post Status Change
```javascript
const response = await fetch('/api/work-order-updates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    work_order_id: 123,
    update_type: 'status_change',
    new_status: 'claimed',
    body: 'Claimed this work order'
  })
})
```

## Styling

The components match your existing design:
- Uses same color scheme as past orders page
- Same border, padding, and spacing patterns
- Consistent status badge styling
- Same form input styles as WorkOrderSubmission

## Files Created

- `/my-app/src/app/api/work-order-updates/route.ts`
- `/my-app/src/app/components/WorkOrderUpdates.tsx`
- `/my-app/src/app/components/AddWorkOrderUpdate.tsx`

## Files Modified

- `/my-app/src/app/work-orders/past/page.tsx` - Added updates to detail panel
- `/my-app/src/app/page.tsx` - Added updates to technician dashboard
