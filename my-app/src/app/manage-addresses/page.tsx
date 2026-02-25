import { Suspense } from "react"
import AddressManagement from "../components/AddressManagement"

export const metadata = {
  title: "Manage Addresses",
}

export default function ManageAddressesPage() {
  return (
    <Suspense fallback={null}>
      <AddressManagement />
    </Suspense>
  )
}
