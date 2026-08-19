import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Vitest runs with `globals: false`, so Testing Library never gets a chance
 * to hook its own cleanup: it does that through the ambient `afterEach`
 * global, which does not exist here. Registering it explicitly is what
 * unmounts rendered components between tests and undoes every
 * `vi.stubGlobal` (e.g. a stubbed `fetch`) so tests stay isolated.
 */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
