// Shared Tailwind layout class strings.
// Import and compose with cn() instead of repeating class combos across files.

export const layout = {
  // Full-width responsive page wrapper
  page: 'mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8',

  // Inner container for header/footer bar content (compose with height + justify)
  bar: 'mx-auto flex max-w-7xl items-center px-4 sm:px-6 lg:px-8',

  // Narrower page wrappers
  formPage: 'mx-auto max-w-md px-4 py-12 flex flex-col gap-6',
  detailPage: 'mx-auto max-w-2xl px-4 py-10 flex flex-col gap-6',

  // Full-height centered state screens — compose with a max-w-* class via cn()
  centeredState: 'mx-auto flex flex-col items-center justify-center gap-3 px-4 text-center min-h-[60vh]',
  inlineError: 'mx-auto flex items-center justify-center px-4 min-h-[40vh]',

  // Native app shell containers
  appHeader: 'sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60',
  tabBar: 'fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm',

  // Responsive row: stacks vertically on mobile, horizontal from sm
  mobileStack: 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',

  // Responsive form grids: single-column on mobile, multi-column from sm
  formGrid2: 'grid grid-cols-1 sm:grid-cols-2',
  formGrid3: 'grid grid-cols-1 sm:grid-cols-3',
} as const

// PWA-specific safe-area utilities (combine with Tailwind via cn())
export const safeArea = {
  top:    'pt-[var(--safe-top)]',
  bottom: 'pb-[var(--safe-bottom)]',
  left:   'pl-[var(--safe-left)]',
  right:  'pr-[var(--safe-right)]',
  x:      'pl-[var(--safe-left)] pr-[var(--safe-right)]',
  inset:  'pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]',
} as const
