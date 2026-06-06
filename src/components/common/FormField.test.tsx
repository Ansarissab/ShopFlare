// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FormField } from './FormField'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  cleanup()
})

describe('FormField', () => {
  it('renders the label text', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    )
    expect(screen.getByText('Email')).toBeTruthy()
  })

  it('associates the label with the input via htmlFor', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" aria-label="email-input" />
      </FormField>,
    )
    const label = screen.getByText('Email').closest('label')
    expect(label?.getAttribute('for')).toBe('email')
  })

  it('renders the children input slot', () => {
    render(
      <FormField label="Name" htmlFor="name">
        <input id="name" placeholder="Your name" />
      </FormField>,
    )
    expect(screen.getByPlaceholderText('Your name')).toBeTruthy()
  })

  it('shows the optional marker when optional is true', () => {
    render(
      <FormField label="Phone" htmlFor="phone" optional>
        <input id="phone" />
      </FormField>,
    )
    expect(screen.getByText(en.common.optional)).toBeTruthy()
  })

  it('does not show the optional marker by default', () => {
    render(
      <FormField label="Phone" htmlFor="phone">
        <input id="phone" />
      </FormField>,
    )
    expect(screen.queryByText(en.common.optional)).toBeNull()
  })

  it('renders the error message when error is provided', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Required field">
        <input id="email" />
      </FormField>,
    )
    const err = screen.getByText('Required field')
    expect(err).toBeTruthy()
    expect(err.className).toContain('text-destructive')
  })

  it('does not render an error paragraph when error is absent', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    )
    expect(screen.queryByText(/destructive/)).toBeNull()
    // no error text node
    const para = document.querySelector('p.text-destructive')
    expect(para).toBeNull()
  })

  it('renders a HelpTip when help is provided', () => {
    render(
      <FormField label="Slug" htmlFor="slug" help="Used in the URL">
        <input id="slug" />
      </FormField>,
    )
    // HelpTip trigger uses aria-label set to the help text
    expect(screen.getByLabelText('Used in the URL')).toBeTruthy()
  })

  it('does not render a HelpTip when help is absent', () => {
    render(
      <FormField label="Slug" htmlFor="slug">
        <input id="slug" />
      </FormField>,
    )
    expect(screen.queryByLabelText('Used in the URL')).toBeNull()
  })

  it('renders both optional marker and help tip together', () => {
    render(
      <FormField label="Notes" htmlFor="notes" optional help="Internal only">
        <input id="notes" />
      </FormField>,
    )
    expect(screen.getByText(en.common.optional)).toBeTruthy()
    expect(screen.getByLabelText('Internal only')).toBeTruthy()
  })
})
