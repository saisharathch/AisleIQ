import { render, screen } from '@testing-library/react'
import { BudgetAlerts } from '@/components/budget/BudgetAlerts'

describe('BudgetAlerts', () => {
  it('shows all-clear message when no alerts', () => {
    render(<BudgetAlerts alerts={[]} />)
    expect(screen.getByText(/All budgets are on track/i)).toBeInTheDocument()
  })

  it('shows over-budget section for percent >= 100', () => {
    render(
      <BudgetAlerts alerts={[{ label: 'Dairy', spent: 120, budget: 100, percent: 120 }]} />,
    )
    expect(screen.getByText(/Over budget in 1 category/i)).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
    expect(screen.getByText(/\$120\.00 \/ \$100\.00/)).toBeInTheDocument()
  })

  it('shows approaching section for 80 <= percent < 100', () => {
    render(
      <BudgetAlerts alerts={[{ label: 'Produce', spent: 88, budget: 100, percent: 88 }]} />,
    )
    expect(screen.getByText(/Approaching limit in 1 category/i)).toBeInTheDocument()
    expect(screen.getByText('Produce')).toBeInTheDocument()
  })

  it('shows both sections when mixed alerts present', () => {
    render(
      <BudgetAlerts
        alerts={[
          { label: 'Dairy', spent: 110, budget: 100, percent: 110 },
          { label: 'Snacks', spent: 85, budget: 100, percent: 85 },
        ]}
      />,
    )
    expect(screen.getByText(/Over budget in 1 category/i)).toBeInTheDocument()
    expect(screen.getByText(/Approaching limit in 1 category/i)).toBeInTheDocument()
  })

  it('uses plural "categories" for multiple alerts of same kind', () => {
    render(
      <BudgetAlerts
        alerts={[
          { label: 'Dairy', spent: 110, budget: 100, percent: 110 },
          { label: 'Meat & Seafood', spent: 120, budget: 100, percent: 120 },
        ]}
      />,
    )
    expect(screen.getByText(/Over budget in 2 categories/i)).toBeInTheDocument()
  })

  it('displays formatted spent/budget amounts', () => {
    render(
      <BudgetAlerts alerts={[{ label: 'Beverages', spent: 24.5, budget: 30, percent: 81.67 }]} />,
    )
    expect(screen.getByText(/\$24\.50 \/ \$30\.00/)).toBeInTheDocument()
  })

  it('shows percentage badge for over-budget items', () => {
    render(
      <BudgetAlerts alerts={[{ label: 'Dairy', spent: 150, budget: 100, percent: 150 }]} />,
    )
    expect(screen.getByText(/\+50%/)).toBeInTheDocument()
  })
})
