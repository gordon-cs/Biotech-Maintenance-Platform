import { Suspense } from 'react'
import CompleteTechInfoWrapper from "../components/CompleteTechInfoWrapper"

export default function CompleteTechInfoPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <CompleteTechInfoWrapper />
    </Suspense>
  )
}