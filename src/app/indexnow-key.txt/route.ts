// IndexNow key-file route — served at /indexnow-key.txt.
// Per IndexNow spec the file at keyLocation must contain exactly the key string.
// Returns 404 when indexNowKey is not configured (feature off).

import { NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import type { StoreConfig } from '@/lib/types/common'

export const revalidate = 3600

export async function GET() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  const key = config?.indexNowKey ?? ''
  if (!key) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
