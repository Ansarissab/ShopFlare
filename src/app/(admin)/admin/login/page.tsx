'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { apiPost, setAdminToken, ApiError } from '@/lib/api'
import { useT } from '@/lib/i18n/Provider'

export default function AdminLoginPage() {
  const router = useRouter()
  const dict = useT()
  const t = dict.admin
  const [password, setPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await apiPost<{ token: string }>('/api/admin/login', {
        password,
        turnstileToken,
      })
      setAdminToken(token)
      router.replace('/admin')
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t.loginInvalid : t.loginError)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.loginTitle}</CardTitle>
          <CardDescription>{t.loginSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">{t.loginPasswordLabel}</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.loginPasswordPlaceholder}
                required
                autoFocus
              />
            </div>
            <TurnstileWidget onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} />
            {!turnstileToken && <p className="text-xs text-muted-foreground">{t.loginVerifying}</p>}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading || !password || !turnstileToken}>
              {loading ? t.loginSubmitting : t.loginSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
