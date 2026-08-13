import express from 'express'
import type { Express } from 'express'

export function createApp(): Express {
  const app = express()

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}
