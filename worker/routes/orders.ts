import { Hono } from 'hono'
const app = new Hono()
app.get('/', (c) => c.json({ todo: 'list orders' }))
app.get('/:id', (c) => c.json({ todo: 'get order' }))
app.patch('/:id/status', (c) => c.json({ todo: 'update status' }))
app.patch('/:id/tracking', (c) => c.json({ todo: 'add tracking number' }))
export default app
