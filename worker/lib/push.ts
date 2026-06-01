// Web Push (VAPID) helper (Agent O) — Workers-native, no Node deps.
//
// APPROACH: payload-less "tickle" push (RFC 8030 §5) authenticated with a VAPID
// JWT (ES256, WebCrypto P-256). We send NO request body.
//
// Why no payload: a message body MUST be encrypted per RFC 8291 (aes128gcm) —
// push services (FCM/autopush) reject or drop unencrypted bodies. Correct
// encryption needs ECDH key agreement with each subscriber's p256dh key
// (~150 LOC of WebCrypto). For a merchant "new order" ping that just needs to
// open the admin panel, a payload-less tickle is simpler, guaranteed-delivered,
// and leaks zero PII. The service worker shows a generic notification (it
// already falls back when event.data is null) and the click opens /admin/orders.
//
// `payload` is still accepted for API stability and a future encrypted-payload
// upgrade, but is intentionally not transmitted today.
//
// VAPID references:
//   RFC 8030  — Generic Event Delivery Using HTTP Push (tickle = no body)
//   RFC 8292  — VAPID (Authorization: vapid t=<JWT>, k=<pubkey>)
//   RFC 8291  — Message Encryption for Web Push (required for payloads)

import { eq } from 'drizzle-orm'
import type { Bindings } from '../types'
import type { Database } from '../db/index'
import * as schema from '../db/schema'

export interface PushPayload {
  title: string
  body: string
  /** Deep link opened when the notification is clicked. */
  url?: string
}

// ─── base64url helpers ────────────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// ─── VAPID JWT builder (ES256, P-256) ────────────────────────────────────────
//
// VAPID JWT structure:
//   header  = { typ: "JWT", alg: "ES256" }
//   payload = { aud: <origin>, exp: <now+12h>, sub: "mailto:<email>" }
//   signature = ES256 (ECDSA P-256 + SHA-256) over "header.payload"
//
// NOTE: The W3C WebCrypto API returns ECDSA signatures in the IEEE-P1363 raw
// r||s form (64 bytes for P-256) — NOT DER/ASN.1. JWS (RFC 7515) also requires
// raw r||s, so the signature is used as-is with no conversion.

async function buildVapidJwt(
  audience: string,
  privateKeyB64Url: string,
  subject: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  )
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 43200, sub: subject }),
    ),
  )

  const signingInput = `${header}.${payload}`

  // Import the raw private key (PKCS#8 / raw P-256 scalar in base64url)
  // The VAPID_PRIVATE_KEY env var is the base64url-encoded raw 32-byte private key.
  const rawPrivateKeyBytes = base64UrlToBytes(privateKeyB64Url)

  // Wrap the raw 32-byte key in a minimal PKCS#8 DER structure so WebCrypto
  // can import it (WebCrypto requires pkcs8 format for importKey with ECDSA P-256).
  // PKCS#8 for P-256:
  //   30 41 — SEQUENCE
  //     02 01 00         — INTEGER version=0
  //     30 13            — SEQUENCE (algorithm)
  //       06 07 2a 86 48 ce 3d 02 01  — OID ecPublicKey
  //       06 08 2a 86 48 ce 3d 03 01 07 — OID prime256v1
  //     04 27            — OCTET STRING (privateKey)
  //       30 25          — SEQUENCE (ECPrivateKey)
  //         02 01 01     — INTEGER version=1
  //         04 20        — OCTET STRING (private key bytes)
  //           <32 bytes>
  const pkcs8 = new Uint8Array([
    0x30, 0x41,
    0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27,
    0x30, 0x25,
    0x02, 0x01, 0x01,
    0x04, 0x20,
    ...rawPrivateKeyBytes,
  ])

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const signatureDer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  // WebCrypto already returns raw r||s — use directly (see note above).
  const signature = bytesToBase64Url(new Uint8Array(signatureDer))

  return `${signingInput}.${signature}`
}

// ─── sendPushToAll ────────────────────────────────────────────────────────────

/**
 * Sends `payload` to every stored push subscription (merchant devices).
 * Prunes subscriptions that return 404/410 (expired). Returns the number of
 * successful deliveries. No-op + 0 when VAPID keys are unset.
 *
 * Push payload is sent as plaintext JSON (non-sensitive merchant notification).
 * The SW receives it via event.data.json() and renders a rich notification.
 */
export async function sendPushToAll(
  db: Database,
  env: Bindings,
  payload: PushPayload,
): Promise<number> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return 0

  const subs = await db.select().from(schema.pushSubscriptions).all()
  if (subs.length === 0) return 0

  // VAPID "sub" claim — use a mailto from FRONTEND_URL domain or a safe default
  const vapidSub = env.FRONTEND_URL
    ? `mailto:push@${new URL(env.FRONTEND_URL).hostname}`
    : 'mailto:push@localhost'

  // Payload-less tickle — no body is transmitted (see header note). `payload`
  // is intentionally unused on the wire today.
  void payload

  let successCount = 0
  const toDelete: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const endpointUrl = new URL(sub.endpoint)
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`

        const jwt = await buildVapidJwt(audience, env.VAPID_PRIVATE_KEY, vapidSub)

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            TTL: '60',
          },
        })

        if (res.status === 201 || res.status === 200 || res.status === 202) {
          successCount++
        } else if (res.status === 404 || res.status === 410) {
          toDelete.push(sub.endpoint)
        } else {
          console.warn('[push] unexpected push service status', res.status, sub.endpoint)
        }
      } catch (err) {
        console.warn('[push] send error for endpoint', sub.endpoint, err)
      }
    }),
  )

  // Prune expired subscriptions
  for (const endpoint of toDelete) {
    try {
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    } catch (err) {
      console.warn('[push] failed to delete expired subscription', endpoint, err)
    }
  }

  return successCount
}
