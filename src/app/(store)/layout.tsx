import { StorefrontHeader } from '@/components/store/StorefrontHeader'
import { StorefrontFooter } from '@/components/store/StorefrontFooter'
import { ThemeProvider } from '@/components/store/ThemeProvider'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </ThemeProvider>
  )
}
