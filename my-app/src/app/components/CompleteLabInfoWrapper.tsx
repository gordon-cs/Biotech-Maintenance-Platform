"use client"

import { useSearchParams } from 'next/navigation'
import CompleteLabInfo from "./CompleteLabInfo"

export default function CompleteLabInfoWrapper() {
  const searchParams = useSearchParams()
  
  // Get the values from URL parameters
  const fullName = searchParams?.get('fullName') || ''
  const phone = searchParams?.get('phone') || ''
  
  // Log what we received from URL
  console.log('CompleteLabInfoWrapper params:', { fullName, phone })

  // Return the component with the search params
  return (
    <CompleteLabInfo 
      initialFull={fullName} 
      initialPhone={phone} 
    />
  )
}