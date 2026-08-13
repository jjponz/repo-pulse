import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3000)

createApp().listen(port, '127.0.0.1', () => {
  console.log(`repo-pulse server escuchando en http://localhost:${port}`)
})
