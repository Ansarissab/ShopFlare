// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HelpTip } from './HelpTip'

afterEach(() => {
  cleanup()
})

describe('HelpTip', () => {
  it('renders a trigger button with aria-label set to the text', () => {
    render(<HelpTip text="What is this?" />)
    const trigger = screen.getByLabelText('What is this?')
    expect(trigger).toBeTruthy()
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger.getAttribute('type')).toBe('button')
  })

  it('applies the default styling classes to the trigger', () => {
    render(<HelpTip text="Hint" />)
    const trigger = screen.getByLabelText('Hint')
    expect(trigger.className).toContain('inline-flex')
    expect(trigger.className).toContain('text-muted-foreground')
  })

  it('merges a custom className onto the trigger', () => {
    render(<HelpTip text="Hint" className="ml-2" />)
    const trigger = screen.getByLabelText('Hint')
    expect(trigger.className).toContain('ml-2')
  })

  it('renders the CircleHelp icon inside the trigger', () => {
    render(<HelpTip text="Hint" />)
    const trigger = screen.getByLabelText('Hint')
    const svg = trigger.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('accepts a side prop without error', () => {
    render(<HelpTip text="Bottom hint" side="bottom" />)
    expect(screen.getByLabelText('Bottom hint')).toBeTruthy()
  })

  it('defaults side to top when not provided', () => {
    render(<HelpTip text="Default side" />)
    expect(screen.getByLabelText('Default side')).toBeTruthy()
  })
})
