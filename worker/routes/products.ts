import { Hono } from 'hono'
const app = new Hono()
app.get('/', (c) => c.json({ todo: 'list products' }))
app.post('/', (c) => c.json({ todo: 'create product' }))
app.put('/:id', (c) => c.json({ todo: 'update product' }))
app.delete('/:id', (c) => c.json({ todo: 'delete product' }))
app.post('/sync-stripe', (c) => c.json({ todo: 'sync to stripe' }))
export default app
