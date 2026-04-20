import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider'

function ThemeDisplay() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
})

describe('ThemeProvider', () => {
  it('defaults to system theme', () => {
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('restores saved theme from localStorage', async () => {
    localStorage.setItem('aisleiq-theme', 'dark')
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    // wait for useEffect to read localStorage
    await act(async () => {})
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('ignores invalid values in localStorage', async () => {
    localStorage.setItem('aisleiq-theme', 'invalid-value')
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await act(async () => {})
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('adds dark class when theme is set to dark', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await user.click(screen.getByText('Dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes dark class when theme is set to light', async () => {
    document.documentElement.classList.add('dark')
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await user.click(screen.getByText('Light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme to localStorage when changed', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await user.click(screen.getByText('Dark'))
    expect(localStorage.getItem('aisleiq-theme')).toBe('dark')
  })

  it('resolves to light when system preference is light', async () => {
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await act(async () => {})
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('resolves to dark when system preference is dark', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
    render(<ThemeProvider><ThemeDisplay /></ThemeProvider>)
    await act(async () => {})
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })
})
