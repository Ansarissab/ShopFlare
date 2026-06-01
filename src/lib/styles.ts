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
} as const
