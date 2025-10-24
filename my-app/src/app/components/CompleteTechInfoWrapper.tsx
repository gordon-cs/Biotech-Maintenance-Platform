"use client"

import { useSearchParams } from 'next/navigation'
import CompleteTechInfo from "./CompleteTechInfo"

export default function CompleteTechInfoWrapper() {
  const searchParams = useSearchParams()
  
  // Get the values from URL parameters
  const fullName = searchParams?.get('fullName') || ''
  const phone = searchParams?.get('phone') || ''
  
  // Log what we received from URL
  console.log('CompleteTechInfoWrapper params:', { fullName, phone })

  // Return the component with the search params
  return (
    <CompleteTechInfo 
      initialFull={fullName} 
      initialPhone={phone} 
    />
  )
}