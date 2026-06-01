/**
 * parseBody — safely parses the JSON body of a Hono (or compatible) request context.
 * Returns `[json, null]` on success, `[null, 400 Response]` on malformed JSON.
 * Typed loosely so any Hono route context satisfies the shape without needing
 * to import Hono's generic types here.
 */
export async function parseBody(
  c: { req: { json(): Promise<unknown> } },
): Promise<[unknown, null] | [null, Response]> {
  try {
    return [await c.req.json(), null]
  } catch {
    return [
      null,
      new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    ]
  }
}
