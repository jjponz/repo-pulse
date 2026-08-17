import { createApp, createDeps } from './app.js'

const port = Number(process.env.PORT ?? 3000)

// 127.0.0.1 only: the photo of the local clones does not go out to the network.
createApp(createDeps()).listen(port, '127.0.0.1', () => {
  console.log(`repo-pulse server listening on http://localhost:${port}`)
})
