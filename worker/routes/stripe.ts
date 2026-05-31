import { Hono } from 'hono'
const app = new Hono()
app.post('/webhook', (c) => c.json({ todo: 'stripe webhook' }))
app.post('/checkout-session', (c) => c.json({ todo: 'create checkout session' }))
export default app
