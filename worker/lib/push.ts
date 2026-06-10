// Web Push (VAPID) helper (Agent O) — Workers-native, no Node deps.
//
// TWO MODES:
//
// 1. Tickle (sendPushToAll) — payload-less "tickle" push (RFC 8030 §5).
//    No request body. Used for merchant "new order" pings that just need to
//    open the admin panel. Simple, zero-PII, guaranteed-delivered.
//    The SW shows a generic notification (falls back when event.data is null).
//
// 2. Encrypted payload (sendPushToCustomers, sendPushToRestockSubscribers) —
//    full RFC 8291 (aes128gcm) encryption via encryptWebPush(). Uses ECDH
//    key agreement with each subscriber's p256dh + auth keys so the SW can
//    read event.data.json() and show order-specific text.
//
// VAPID references:
//   RFC 8030  — Generic Event Delivery Using HTTP Push
//   RFC 8292  — VAPID (Authorization: vapid t=<JWT>, k=<pubkey>)
//   RFC 8291  — Message Encryption for Web Push (aes128gcm)
//   RFC 8188  — Encrypted Content-Encoding (content-encoding header format)

import { eq, and, inArray } from 'drizzle-orm'
import type { Bindings } from 'worker/types'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'

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

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

/**
 * Encrypts a Web Push payload per RFC 8291 (aes128gcm content coding) using
 * WebCrypto — no Node.js dependency. Returns the encrypted body ready to be
 * sent as the POST body to a push endpoint.
 *
 * @param plaintext  - UTF-8 string payload (JSON)
 * @param sub        - subscriber's auth + p256dh keys (base64url-encoded)
 */
async function encryptWebPush(
  plaintext: string,
  sub: { auth: string; p256dh: string },
): Promise<Uint8Array> {
  const authSecret = base64UrlToBytes(sub.auth)
  const receiverPublicKeyBytes = base64UrlToBytes(sub.p256dh)

  // 1. Generate ephemeral sender ECDH P-256 key pair
  // Cast to CryptoKeyPair — CF Workers types return CryptoKey|CryptoKeyPair from generateKey.
  const senderKeyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const senderPublicKeyRaw = (await crypto.subtle.exportKey(
    'raw',
    senderKeyPair.publicKey,
  )) as ArrayBuffer
  const senderPublicKey = new Uint8Array(senderPublicKeyRaw)

  // 2. Import subscriber's public key for ECDH
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // 3. ECDH shared secret (32 bytes)
  // CF Workers types use '$public' but the runtime property name is 'public' (RFC spec).
  const ecdhSecretBits = await crypto.subtle.deriveBits(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: 'ECDH', public: receiverPublicKey } as any,
    senderKeyPair.privateKey,
    256,
  )
  const ecdhSecret = new Uint8Array(ecdhSecretBits)

  // 4. Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // 5. RFC 8291 §3.3 — derive IKM via HKDF(salt=auth_secret, IKM=ecdh_secret)
  //    info = "WebPush: info\0" || ua_public (65 bytes) || as_public (65 bytes)
  const infoWebPush = concatBytes(
    new TextEncoder().encode('WebPush: info\x00'),
    receiverPublicKeyBytes,
    senderPublicKey,
  )
  const ecdhKey = await crypto.subtle.importKey('raw', ecdhSecret, { name: 'HKDF' }, false, [
    'deriveBits',
  ])
  const ikmBytes = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: infoWebPush },
    ecdhKey,
    32 * 8,
  )
  const ikm = new Uint8Array(ikmBytes)

  // 6. CEK (16 bytes): HKDF(salt=salt, IKM=ikm, info="Content-Encoding: aes128gcm\0")
  const cekKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])
  const cekBytes = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00'),
    },
    cekKey,
    16 * 8,
  )
  const cek = new Uint8Array(cekBytes)

  // 7. Nonce (12 bytes): HKDF(salt=salt, IKM=ikm, info="Content-Encoding: nonce\0")
  const nonceKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, [
    'deriveBits',
  ])
  const nonceBytes = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('Content-Encoding: nonce\x00'),
    },
    nonceKey,
    12 * 8,
  )
  const nonce = new Uint8Array(nonceBytes)

  // 8. AES-128-GCM encrypt: plaintext || 0x02 (last-record delimiter per RFC 8188)
  const record = concatBytes(new TextEncoder().encode(plaintext), new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt'],
  )
  const ciphertextBits = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record)
  const ciphertext = new Uint8Array(ciphertextBits)

  // 9. Build RFC 8188 content-encoding header:
  //    salt (16) | rs uint32be (4) | idlen uint8 (1) | sender_public_key (65) | ciphertext
  const rs = 4096
  const rsBytes = new Uint8Array([rs >> 24, (rs >> 16) & 0xff, (rs >> 8) & 0xff, rs & 0xff])
  return concatBytes(
    salt,
    rsBytes,
    new Uint8Array([senderPublicKey.length]),
    senderPublicKey,
    ciphertext,
  )
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
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })),
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
    0x30,
    0x41,
    0x02,
    0x01,
    0x00,
    0x30,
    0x13,
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01,
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07,
    0x04,
    0x27,
    0x30,
    0x25,
    0x02,
    0x01,
    0x01,
    0x04,
    0x20,
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

// ─── sendPushToCustomers ──────────────────────────────────────────────────────

/**
 * Sends a push notification to customer subscriptions matching `orderNumber`.
 * Used for order-status updates (shipped, delivered).
 * Prunes expired subscriptions (404/410). No-op when VAPID keys unset.
 */
export async function sendPushToCustomers(
  db: Database,
  env: Bindings,
  orderNumber: string,
  payload: PushPayload,
): Promise<number> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return 0

  const subs = await db
    .select()
    .from(schema.customerPushSubscriptions)
    .where(
      and(
        eq(schema.customerPushSubscriptions.orderNumber, orderNumber),
        eq(schema.customerPushSubscriptions.kind, 'order'),
      ),
    )
    .all()

  if (subs.length === 0) return 0

  const vapidSub = env.FRONTEND_URL
    ? `mailto:push@${new URL(env.FRONTEND_URL).hostname}`
    : 'mailto:push@localhost'

  let successCount = 0
  const toDelete: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const endpointUrl = new URL(sub.endpoint)
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`
        const jwt = await buildVapidJwt(audience, env.VAPID_PRIVATE_KEY, vapidSub)

        const encryptedBody = await encryptWebPush(JSON.stringify(payload), sub)

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            TTL: '86400',
          },
          body: encryptedBody,
        })

        if (res.status === 201 || res.status === 200 || res.status === 202) {
          successCount++
        } else if (res.status === 404 || res.status === 410) {
          toDelete.push(sub.endpoint)
        } else {
          console.warn('[push] customer unexpected status', res.status, sub.endpoint)
        }
      } catch (err) {
        console.warn('[push] customer send error', sub.endpoint, err)
      }
    }),
  )

  if (toDelete.length > 0) {
    await db
      .delete(schema.customerPushSubscriptions)
      .where(inArray(schema.customerPushSubscriptions.endpoint, toDelete))
      .catch(() => {})
  }

  return successCount
}

// ─── sendPushToRestockSubscribers ─────────────────────────────────────────────

/**
 * Sends push to customer subscriptions for a back-in-stock size option.
 */
export async function sendPushToRestockSubscribers(
  db: Database,
  env: Bindings,
  sizeOptionId: string,
  payload: PushPayload,
): Promise<number> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return 0

  const subs = await db
    .select()
    .from(schema.customerPushSubscriptions)
    .where(
      and(
        eq(schema.customerPushSubscriptions.sizeOptionId, sizeOptionId),
        eq(schema.customerPushSubscriptions.kind, 'restock'),
      ),
    )
    .all()

  if (subs.length === 0) return 0

  const vapidSub = env.FRONTEND_URL
    ? `mailto:push@${new URL(env.FRONTEND_URL).hostname}`
    : 'mailto:push@localhost'

  let successCount = 0
  const toDelete: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const endpointUrl = new URL(sub.endpoint)
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`
        const jwt = await buildVapidJwt(audience, env.VAPID_PRIVATE_KEY, vapidSub)

        const encryptedBody = await encryptWebPush(JSON.stringify(payload), sub)

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            TTL: '86400',
          },
          body: encryptedBody,
        })

        if (res.status === 201 || res.status === 200 || res.status === 202) {
          successCount++
        } else if (res.status === 404 || res.status === 410) {
          toDelete.push(sub.endpoint)
        } else {
          console.warn('[push] restock unexpected status', res.status, sub.endpoint)
        }
      } catch (err) {
        console.warn('[push] restock send error', sub.endpoint, err)
      }
    }),
  )

  if (toDelete.length > 0) {
    await db
      .delete(schema.customerPushSubscriptions)
      .where(inArray(schema.customerPushSubscriptions.endpoint, toDelete))
      .catch(() => {})
  }

  return successCount
}
