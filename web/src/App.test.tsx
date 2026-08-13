import { expect, test } from 'vitest'
import App from './App'

test('App exporta un componente de React', () => {
  expect(typeof App).toBe('function')
})
