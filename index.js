// A tiny REST API on top of a Redis database.
//
//   GET /api/key                          → the value stored under that key
//   PUT /api/key  with body { "value": … } → stores the value under that key
//
// The server remembers nothing itself: Vercel may run it on a different machine
// for every request. Anything we want to keep has to go in the database.

import express from 'express'
import { Redis } from '@upstash/redis'

const app = express()
const port = 3000

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the environment.
// Locally they come from .env; on Vercel from Settings → Environment Variables.
const redis = Redis.fromEnv()

// Turn a JSON request body into req.body
app.use(express.json())

app.get('/', (req, res) => {
  res.type('text').send(
    'Key/value store\n\n' +
    'GET /api/key                            → read the value stored under key\n' +
    'PUT /api/key  with body { "value": … }  → store a value under key\n'
  )
})

// Read a key
app.get('/api/:key', async (req, res) => {
  const { key } = req.params
  const value = await redis.get(key)
  if (value === null) {
    return res.status(404).json({ error: `Nothing stored under "${key}"` })
  }
  res.json({ key, value })
})

// Write a key
app.put('/api/:key', async (req, res) => {
  const { key } = req.params
  const value = req.body?.value
  if (value === undefined) {
    return res.status(400).json({ error: 'Send a JSON body like { "value": "something" }' })
  }
  await redis.set(key, value)
  res.json({ key, value })
})

// If anything above throws (a malformed JSON body, the database can't be reached, …),
// reply with JSON rather than Express's default HTML error page.
app.use((error, req, res, next) => {
  console.error(error)
  res.status(error.status ?? 500).json({ error: error.message })
})

app.listen(port, () => {
  console.log(`Key/value API listening at http://localhost:${port}`)
})

export default app
