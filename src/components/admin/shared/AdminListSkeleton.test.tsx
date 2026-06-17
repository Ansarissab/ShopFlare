// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { AdminListSkeleton } from './AdminListSkeleton'

// Skeleton renders a <div data-slot="skeleton"> — query by that attribute.

afterEach(() => {
  cleanup()
})

function getSkeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]')
}

describe('AdminListSkeleton', () => {
  it('renders exactly `rows` skeleton elements', () => {
    const { container } = render(<AdminListSkeleton rows={5} />)
    expect(getSkeletons(container)).toHaveLength(5)
  })

  it('renders 1 skeleton when rows=1', () => {
    const { container } = render(<AdminListSkeleton rows={1} />)
    expect(getSkeletons(container)).toHaveLength(1)
  })

  it('applies a custom itemClassName to every skeleton', () => {
    const { container } = render(
      <AdminListSkeleton rows={3} itemClassName="h-14 w-full rounded-md" />,
    )
    const skeletons = getSkeletons(container)
    expect(skeletons).toHaveLength(3)
    skeletons.forEach((el) => {
      expect(el.className).toContain('h-14')
      expect(el.className).toContain('rounded-md')
    })
  })

  it('uses the default itemClassName when itemClassName is omitted', () => {
    const { container } = render(<AdminListSkeleton rows={2} />)
    const skeletons = getSkeletons(container)
    expect(skeletons).toHaveLength(2)
    skeletons.forEach((el) => {
      expect(el.className).toContain('h-12')
      expect(el.className).toContain('rounded-md')
    })
  })

  it('wraps skeletons in a flex-col gap-2 container', () => {
    const { container } = render(<AdminListSkeleton rows={3} />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('flex')
    expect(wrapper?.className).toContain('flex-col')
    expect(wrapper?.className).toContain('gap-2')
  })
})
