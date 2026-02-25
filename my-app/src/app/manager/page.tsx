import { Suspense } from "react"
import ManagerClient from "./ManagerClient"

export default function ManagerPage() {
  return (
    <Suspense fallback={null}>
      <ManagerClient />
    </Suspense>
  )
}
