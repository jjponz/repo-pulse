import { expect, test } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

test('GET /api/health responde 200 con { status: "ok" }', async () => {
  const response = await request(createApp()).get('/api/health')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ status: 'ok' })
})
