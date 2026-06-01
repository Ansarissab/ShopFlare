'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { en } from '@/lib/i18n/en'

export function TrackingForm() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!orderNumber.trim()) {
      setError(en.errors.required.replace('{field}', en.tracking.orderNumber))
      return
    }
    if (!contact.trim()) {
      setError(en.errors.required.replace('{field}', en.tracking.email))
      return
    }

    // Navigate to tracking page — Worker route validates contact
    router.push(`/track/${orderNumber.trim()}`)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Order Number */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="track-order-number">{en.tracking.orderNumber}</Label>
        <Input
          id="track-order-number"
          placeholder="ORD-XXXXXX"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>

      {/* Email or Phone */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="track-contact">{en.tracking.email}</Label>
        <Input
          id="track-contact"
          type="text"
          placeholder="email@example.com or +1 555 0100"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" className="w-full">
        {en.tracking.track}
      </Button>
    </form>
  )
}
