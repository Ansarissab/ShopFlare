import { describe, it, expect } from 'vitest'
import { layout, safeArea } from '@/lib/styles'

describe('layout', () => {
  it('exposes every documented layout key as a non-empty string', () => {
    const keys = [
      'page',
      'bar',
      'formPage',
      'detailPage',
      'centeredState',
      'inlineError',
      'appHeader',
      'tabBar',
      'mobileStack',
      'formGrid2',
      'formGrid3',
    ] as const
    for (const k of keys) {
      expect(typeof layout[k]).toBe('string')
      expect(layout[k].length).toBeGreaterThan(0)
    }
  })

  it('page wrapper centers and caps width', () => {
    expect(layout.page).toContain('mx-auto')
    expect(layout.page).toContain('max-w-7xl')
  })

  it('app shell containers are sticky / fixed with backdrop', () => {
    expect(layout.appHeader).toContain('sticky')
    expect(layout.appHeader).toContain('backdrop-blur-sm')
    expect(layout.tabBar).toContain('fixed')
  })

  it('responsive grids switch column count at sm', () => {
    expect(layout.formGrid2).toBe('grid grid-cols-1 sm:grid-cols-2')
    expect(layout.formGrid3).toBe('grid grid-cols-1 sm:grid-cols-3')
  })

  it('mobileStack stacks on mobile and rows from sm', () => {
    expect(layout.mobileStack).toContain('flex-col')
    expect(layout.mobileStack).toContain('sm:flex-row')
  })
})

describe('safeArea', () => {
  it('maps each edge to its CSS safe-area var', () => {
    expect(safeArea.top).toBe('pt-[var(--safe-top)]')
    expect(safeArea.bottom).toBe('pb-[var(--safe-bottom)]')
    expect(safeArea.left).toBe('pl-[var(--safe-left)]')
    expect(safeArea.right).toBe('pr-[var(--safe-right)]')
  })

  it('x combines left + right padding', () => {
    expect(safeArea.x).toContain('--safe-left')
    expect(safeArea.x).toContain('--safe-right')
  })

  it('inset combines all four edges', () => {
    expect(safeArea.inset).toContain('--safe-top')
    expect(safeArea.inset).toContain('--safe-bottom')
    expect(safeArea.inset).toContain('--safe-left')
    expect(safeArea.inset).toContain('--safe-right')
  })
})
