import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Screens } from './Screens'
import type { Clone } from './api/types'

const A_FOLDER_WITHOUT_GIT = '~/clones/notas-producto'

const A_MOCKUP_LOADING_STEP = 'Historial recorrido'

class CloneMother {
  static detectedAs(id: string, name: string): Clone {
    return { id, name, path: `/clones/${name}`, lastCommitAt: null, fetchedAt: null, stale: false }
  }

  static readonly DETECTED_BESIDE_THE_FOLDER: readonly Clone[] = [
    CloneMother.detectedAs('a1b2c3d', 'notas-producto'),
    CloneMother.detectedAs('e4f5a6b', 'repo-pulse'),
  ]
}

class ScreensProbe {
  static cloneButtonLabels(): string[] {
    return screen.getAllByRole('button').map((button) => button.textContent ?? '')
  }

  static cloneButton(position: number): HTMLElement {
    const button = screen.getAllByRole('button')[position]
    if (button === undefined) throw new Error(`no clone button at position ${position}`)
    return button
  }
}

test('the analysing screen names the repo it is walking and shows no step list', () => {
  render(<Screens.Analysing repoName="repo-pulse" />)

  expect(screen.getByText('Analizando repo-pulse…')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull()
  expect(screen.queryByText(A_MOCKUP_LOADING_STEP)).toBeNull()
})

test('the not-a-git-repo screen lists every detected clone as a way out', () => {
  render(
    <Screens.NotAGitRepo
      repoId={A_FOLDER_WITHOUT_GIT}
      clones={CloneMother.DETECTED_BESIDE_THE_FOLDER}
      onRepo={() => undefined}
    />,
  )

  expect(screen.getByText('Esa carpeta no es un repositorio git')).toBeTruthy()
  expect(
    screen.getByText(
      'En la carpeta ~/clones/notas-producto no hay ningún directorio .git, así que no hay historial que medir.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('clones detectados')).toBeTruthy()
  expect(ScreensProbe.cloneButtonLabels()).toEqual([
    'notas-producto · /clones/notas-producto',
    'repo-pulse · /clones/repo-pulse',
  ])
})

test('picking a clone from the not-a-git-repo list selects it', () => {
  const picked: string[] = []
  render(
    <Screens.NotAGitRepo
      repoId={A_FOLDER_WITHOUT_GIT}
      clones={CloneMother.DETECTED_BESIDE_THE_FOLDER}
      onRepo={(id) => {
        picked.push(id)
      }}
    />,
  )

  fireEvent.click(ScreensProbe.cloneButton(1))

  expect(picked).toEqual(['e4f5a6b'])
})

test('the no-commits screen says the history is empty and that it will fill itself', () => {
  render(<Screens.NoCommits repoName="repo-pulse" />)

  expect(screen.getByText('Repositorio sin commits')).toBeTruthy()
  expect(
    screen.getByText(
      'repo-pulse es un repo git válido, pero su historial está vacío. No hay pulso que contar todavía.',
    ),
  ).toBeTruthy()
  expect(
    screen.getByText('Cuando entre el primer commit, esta pantalla se llena sola.'),
  ).toBeTruthy()
})

test('the failed screen carries the code in an alert', () => {
  render(<Screens.Failed code="git-failed" />)

  expect(screen.getByRole('alert').textContent).toBe(
    'No se ha podido cargar la información (git-failed).',
  )
})
