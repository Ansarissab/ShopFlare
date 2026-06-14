// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MobileNavDrawer } from './MobileNavDrawer'
import { TProvider } from '@/lib/i18n/Provider'
import { en } from '@/lib/i18n/en'
import { ur } from '@/lib/i18n/ur'
import type { CategoryNode } from '@/lib/types/category'
import type { PrimaryNavLink } from '@/lib/nav'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onClick,
    }: {
      href: string
      children: React.ReactNode
      onClick?: () => void
    }) => createElement('a', { href, onClick }, children),
  }
})

vi.mock('lucide-react', async () => {
  const { createElement } = await import('react')
  const icon = (testid: string) => (props: Record<string, unknown>) =>
    createElement('span', { 'data-testid': testid, ...props })
  return {
    Menu: icon('menu-icon'),
    X: icon('x-icon'),
  }
})

// LocaleSwitcher — lightweight stub
vi.mock('@/components/store/LocaleSwitcher', async () => {
  const { createElement } = await import('react')
  return {
    LocaleSwitcher: () => createElement('div', { 'data-testid': 'locale-switcher' }),
  }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal links that mirror a config with all features off (track only). */
const DEFAULT_LINKS: PrimaryNavLink[] = [{ href: '/track', labelKey: 'trackOrder' }]

/** Links with landing + FAQ + blog enabled. */
const ALL_LINKS: PrimaryNavLink[] = [
  { href: '/shop', labelKey: 'shopNav' },
  { href: '/track', labelKey: 'trackOrder' },
  { href: '/faq', labelKey: 'faqNav' },
  { href: '/blog', labelKey: 'blogNav' },
]

function cat(
  over: Partial<CategoryNode> & Pick<CategoryNode, 'id' | 'name' | 'slug'>,
): CategoryNode {
  return {
    description: '',
    parentId: null,
    imageUrl: null,
    r2Key: null,
    sortOrder: 0,
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    productCount: 0,
    children: [],
    ...over,
  }
}

beforeEach(() => {
  // nothing to reset — no module-level mock state
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileNavDrawer — hamburger trigger', () => {
  it('renders a hamburger button with open-menu aria-label', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    expect(screen.getByRole('button', { name: en.store.openMenu })).toBeTruthy()
    expect(screen.getByTestId('menu-icon')).toBeTruthy()
  })

  it('hamburger has aria-expanded=false before opening', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    const btn = screen.getByRole('button', { name: en.store.openMenu })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('hamburger has aria-expanded=true after clicking', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    const btn = screen.getByRole('button', { name: en.store.openMenu })
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('hamburger has aria-haspopup="dialog"', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    const btn = screen.getByRole('button', { name: en.store.openMenu })
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('drawer is not visible before hamburger click', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    // Sheet title should not be in the document yet
    expect(screen.queryByText(en.store.menu)).toBeNull()
  })

  it('opens drawer when hamburger is clicked', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
    expect(screen.getByText(en.store.menu)).toBeTruthy()
  })
})

describe('MobileNavDrawer — close button i18n', () => {
  it('close button has localised aria-label (en)', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
    expect(screen.getByRole('button', { name: en.store.closeMenu })).toBeTruthy()
  })

  it('close button has localised aria-label (ur)', () => {
    render(
      <TProvider locale="ur">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: ur.store.openMenu }))
    expect(screen.getByRole('button', { name: ur.store.closeMenu })).toBeTruthy()
  })
})

describe('MobileNavDrawer — drawer content', () => {
  function openDrawer(links: PrimaryNavLink[] = DEFAULT_LINKS, categories: CategoryNode[] = []) {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={links} categories={categories} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
  }

  it('always shows Track Order link', () => {
    openDrawer()
    expect(screen.getByText(en.store.trackOrder)).toBeTruthy()
    expect(screen.getByText(en.store.trackOrder).getAttribute('href')).toBe('/track')
  })

  it('shows Shop link when included in links prop', () => {
    openDrawer(ALL_LINKS)
    expect(screen.getByText(en.store.shopNav)).toBeTruthy()
  })

  it('hides Shop link when not in links prop', () => {
    openDrawer(DEFAULT_LINKS)
    expect(screen.queryByText(en.store.shopNav)).toBeNull()
  })

  it('shows FAQ link when included in links prop', () => {
    openDrawer(ALL_LINKS)
    expect(screen.getByText(en.store.faqNav)).toBeTruthy()
  })

  it('hides FAQ link when not in links prop', () => {
    openDrawer(DEFAULT_LINKS)
    expect(screen.queryByText(en.store.faqNav)).toBeNull()
  })

  it('shows Blog link when included in links prop', () => {
    openDrawer(ALL_LINKS)
    expect(screen.getByText(en.store.blogNav)).toBeTruthy()
  })

  it('hides Blog link when not in links prop', () => {
    openDrawer(DEFAULT_LINKS)
    expect(screen.queryByText(en.store.blogNav)).toBeNull()
  })

  it('shows category section heading when categories present', () => {
    openDrawer(DEFAULT_LINKS, [cat({ id: '1', name: 'Shoes', slug: 'shoes' })])
    expect(screen.getByText(en.store.categoriesNav)).toBeTruthy()
  })

  it('renders a category link with correct href', () => {
    openDrawer(DEFAULT_LINKS, [cat({ id: '1', name: 'Shoes', slug: 'shoes' })])
    const link = screen.getByText('Shoes')
    expect(link.getAttribute('href')).toBe('/category/shoes')
  })

  it('renders child category links indented after parent', () => {
    openDrawer(DEFAULT_LINKS, [
      cat({
        id: 'p1',
        name: 'Apparel',
        slug: 'apparel',
        children: [cat({ id: 'c1', name: 'Shirts', slug: 'shirts', parentId: 'p1' })],
      }),
    ])
    expect(screen.getByText('Apparel')).toBeTruthy()
    expect(screen.getByText('Shirts')).toBeTruthy()
    expect(screen.getByText('Shirts').getAttribute('href')).toBe('/category/shirts')
  })

  it('hides categories section heading when categories empty', () => {
    openDrawer([])
    expect(screen.queryByText(en.store.categoriesNav)).toBeNull()
  })

  it('renders LocaleSwitcher inside the drawer', () => {
    openDrawer()
    expect(screen.getByTestId('locale-switcher')).toBeTruthy()
  })
})

describe('MobileNavDrawer — close behaviour', () => {
  it('closes drawer when a primary nav link is clicked', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
    // drawer is open: menu title visible
    expect(screen.getByText(en.store.menu)).toBeTruthy()

    fireEvent.click(screen.getByText(en.store.trackOrder))
    // drawer closed: title unmounted
    expect(screen.queryByText(en.store.menu)).toBeNull()
  })

  it('closes drawer when a category link is clicked', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer
          links={DEFAULT_LINKS}
          categories={[cat({ id: '1', name: 'Shoes', slug: 'shoes' })]}
        />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
    expect(screen.getByText(en.store.menu)).toBeTruthy()

    fireEvent.click(screen.getByText('Shoes'))
    expect(screen.queryByText(en.store.menu)).toBeNull()
  })
})

describe('MobileNavDrawer — RTL side', () => {
  it('SheetContent side="right" for RTL locale (ur)', () => {
    render(
      <TProvider locale="ur">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    // aria-label is localised to Urdu when the TProvider is 'ur'
    fireEvent.click(screen.getByRole('button', { name: ur.store.openMenu }))
    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content?.getAttribute('data-side')).toBe('right')
  })

  it('SheetContent side="left" for LTR locale (en)', () => {
    render(
      <TProvider locale="en">
        <MobileNavDrawer links={DEFAULT_LINKS} categories={[]} />
      </TProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: en.store.openMenu }))
    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content?.getAttribute('data-side')).toBe('left')
  })
})
