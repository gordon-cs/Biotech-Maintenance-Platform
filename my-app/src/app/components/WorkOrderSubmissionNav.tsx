"use client"

import Link from "next/link"

type Props = {
  label?: string
  className?: string
}

export default function WorkOrderSubmissionNav({ label = "Submit Work Order", className = "" }: Props) {
  return (
    <Link
      href="/work-orders/submission"
      className={`inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 ${className}`}
    >
      {label}
    </Link>
  )
}