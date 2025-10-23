import { Suspense } from 'react'
import CompleteLabInfoWrapper from "../components/CompleteLabInfoWrapper"

export default function CompleteLabInfoPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <CompleteLabInfoWrapper />
    </Suspense>
  )
}