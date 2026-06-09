// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RenderHtml } from './RenderHtml'

// sanitizeHtml is tested separately in html.test.ts — here we test component rendering
vi.mock('@/lib/html', () => ({
  sanitizeHtml: (html: string) => html,
}))

describe('RenderHtml', () => {
  it('renders sanitized html in a div', () => {
    const { container } = render(<RenderHtml html="<p>Hello</p>" />)
    const div = container.querySelector('div')
    expect(div?.innerHTML).toBe('<p>Hello</p>')
  })

  it('applies prose classes by default', () => {
    const { container } = render(<RenderHtml html="<p>x</p>" />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('prose')
  })

  it('appends custom className when provided', () => {
    const { container } = render(<RenderHtml html="" className="custom-class" />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('custom-class')
    expect(div?.className).toContain('prose')
  })

  it('renders empty string html without crashing', () => {
    const { container } = render(<RenderHtml html="" />)
    expect(container.querySelector('div')).toBeTruthy()
  })
})
