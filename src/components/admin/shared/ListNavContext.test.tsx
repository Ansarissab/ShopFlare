// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { ListNavProvider, useRegisterListNav, useListNavRef } from './ListNavContext'
import type { ListNavController } from '@/lib/types/shortcuts'

type RefT = ReturnType<typeof useListNavRef>

afterEach(() => {
  cleanup()
})

// Helper: reads the shared ref from within the provider tree
function RefReader({ onRef }: { onRef: (ref: ReturnType<typeof useListNavRef>) => void }) {
  const ref = useListNavRef()
  onRef(ref)
  return null
}

// Helper: registers a controller into the shared ref
function Registrar({ controller }: { controller: ListNavController }) {
  useRegisterListNav(controller)
  return null
}

describe('ListNavProvider + useListNavRef', () => {
  it('provides a MutableRefObject (not null) inside the provider', () => {
    const box: { ref: RefT } = { ref: null }
    render(
      <ListNavProvider>
        <RefReader
          onRef={(r) => {
            box.ref = r
          }}
        />
      </ListNavProvider>,
    )
    expect(box.ref).not.toBeNull()
    // Should be a ref object with a current property
    expect(typeof box.ref?.current).toBe('object')
  })

  it('returns null for useListNavRef when used outside the provider', () => {
    const box: { ref: RefT } = { ref: null }
    render(
      <RefReader
        onRef={(r) => {
          box.ref = r
        }}
      />,
    )
    expect(box.ref).toBeNull()
  })
})

describe('useRegisterListNav', () => {
  it('writes the controller into the shared ref synchronously', () => {
    const controller: ListNavController = {
      next: () => {},
      prev: () => {},
      open: () => {},
    }
    const box: { ref: RefT } = { ref: null }

    render(
      <ListNavProvider>
        <Registrar controller={controller} />
        <RefReader
          onRef={(r) => {
            box.ref = r
          }}
        />
      </ListNavProvider>,
    )

    expect(box.ref?.current).toBe(controller)
  })

  it('clears the ref on unmount (cleanup effect)', () => {
    const controller: ListNavController = {
      next: () => {},
      prev: () => {},
      open: () => {},
    }
    const box: { ref: RefT } = { ref: null }

    const { unmount, rerender } = render(
      <ListNavProvider>
        <Registrar controller={controller} />
        <RefReader
          onRef={(r) => {
            box.ref = r
          }}
        />
      </ListNavProvider>,
    )

    // Controller is registered
    expect(box.ref?.current).toBe(controller)

    // Unmount the Registrar by re-rendering without it
    act(() => {
      rerender(
        <ListNavProvider>
          <RefReader
            onRef={(r) => {
              box.ref = r
            }}
          />
        </ListNavProvider>,
      )
    })

    // Cleanup effect should have cleared the ref
    expect(box.ref?.current).toBeNull()

    unmount()
  })

  it('is a no-op (does not throw) when used outside the provider', () => {
    const controller: ListNavController = {
      next: () => {},
      prev: () => {},
      open: () => {},
    }
    // Should not throw — ref will be null so the if(ref) guard protects
    expect(() => {
      render(<Registrar controller={controller} />)
    }).not.toThrow()
  })
})
