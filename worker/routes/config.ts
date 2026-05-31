import { Hono } from 'hono'
const app = new Hono()
app.get('/theme', (c) => c.json({ todo: 'get theme from D1' }))
app.get('/store', (c) => c.json({ todo: 'get store config' }))
app.put('/store', (c) => c.json({ todo: 'update store config' }))
export default app
