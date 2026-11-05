import { describe, expect, it } from 'vitest'

describe('test tooling', () => {
  it('runs under jsdom', () => {
    expect(document).toBeDefined()
    expect(document.createElement('div').tagName).toBe('DIV')
  })

  it('has the jest-dom matchers registered', () => {
    const el = document.createElement('p')
    el.textContent = 'woof'
    document.body.appendChild(el)
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('woof')
  })
})
