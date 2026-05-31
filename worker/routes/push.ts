import { Hono } from 'hono'
const app = new Hono()
app.post('/subscribe', (c) => c.json({ todo: 'save push subscription' }))
app.post('/send', (c) => c.json({ todo: 'send push notification' }))
export default app
