import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShoppingList } from '@/components/shopping/ShoppingList'

const MOCK_ITEMS = [
  { name: 'Milk', category: 'Dairy', avgPrice: 3.99, count: 5, lastBought: '2026-04-01T00:00:00.000Z', topStore: 'Walmart' },
  { name: 'Eggs', category: 'Dairy', avgPrice: 4.49, count: 3, lastBought: '2026-03-28T00:00:00.000Z', topStore: 'Costco' },
  { name: 'Bread', category: 'Bakery', avgPrice: 2.99, count: 2, lastBought: '2026-03-20T00:00:00.000Z', topStore: null },
]

const mockFetch = jest.fn()

beforeEach(() => {
  localStorage.clear()
  global.fetch = mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: MOCK_ITEMS }),
  } as Response)
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('ShoppingList', () => {
  it('shows loading state initially', () => {
    render(<ShoppingList />)
    expect(screen.getByText(/Loading your shopping history/i)).toBeInTheDocument()
  })

  it('renders items after successful fetch', async () => {
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument())
    expect(screen.getByText('Eggs')).toBeInTheDocument()
    expect(screen.getByText('Bread')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument())
    expect(screen.getByText(/Try again/i)).toBeInTheDocument()
  })

  it('shows error state on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText(/Server error 500/i)).toBeInTheDocument())
  })

  it('shows empty state when no repeat purchases exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText(/No repeat purchases found yet/i)).toBeInTheDocument())
  })

  it('shows estimated total for unchecked items', async () => {
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument())
    // 3.99 + 4.49 + 2.99 = 11.47
    expect(screen.getByText(/\$11\.47/)).toBeInTheDocument()
  })

  it('moves item to checked section on click', async () => {
    const user = userEvent.setup()
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument())
    await user.click(screen.getByText('Milk').closest('div[class*="cursor-pointer"]')!)
    await waitFor(() => expect(screen.getByText(/In Cart \(1\)/i)).toBeInTheDocument())
  })

  it('persists checked state to localStorage', async () => {
    const user = userEvent.setup()
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument())
    await user.click(screen.getByText('Milk').closest('div[class*="cursor-pointer"]')!)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('aisleiq-shopping-checked') ?? '[]') as string[]
      expect(stored).toContain('Milk')
    })
  })

  it('clears checked state from localStorage when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument())
    await user.click(screen.getByText('Milk').closest('div[class*="cursor-pointer"]')!)
    await waitFor(() => screen.getByText(/Clear all checks/i))
    await user.click(screen.getByText(/Clear all checks/i))
    expect(localStorage.getItem('aisleiq-shopping-checked')).toBeNull()
  })

  it('restores checked state from localStorage on mount', async () => {
    localStorage.setItem('aisleiq-shopping-checked', JSON.stringify(['Milk']))
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText(/In Cart \(1\)/i)).toBeInTheDocument())
  })

  it('filters items by category', async () => {
    const user = userEvent.setup()
    render(<ShoppingList />)
    // wait for filter buttons to appear (rendered when categories.length > 2)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bakery' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Bakery' }))
    expect(screen.getByText('Bread')).toBeInTheDocument()
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  })

  it('shows store name for items with topStore', async () => {
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('Walmart')).toBeInTheDocument())
  })

  it('shows avg price for items', async () => {
    render(<ShoppingList />)
    await waitFor(() => expect(screen.getByText('~$3.99')).toBeInTheDocument())
  })
})
