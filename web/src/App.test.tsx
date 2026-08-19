import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the app title in a DOM', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Repo Pulse' })).toBeTruthy()
})
