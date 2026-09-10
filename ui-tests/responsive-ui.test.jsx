import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ActionSheet from '../src/components/ActionSheet'
import StockCard from '../src/components/StockCard'
import TickerChart from '../src/components/TickerChart'
import { MOBILE_PRIMARY_PATHS, isMobileMoreRoute } from '../src/components/Layout'
import { MobileTransactionCard } from '../src/pages/Transactions'
import { MobileCashCard } from '../src/pages/Cash'
import { MobileExpenseCard } from '../src/pages/Expenses'
import { ContributionRoomCard } from '../src/pages/ContributionRoom'

describe('mobile navigation', () => {
  it('keeps four primary destinations and routes secondary screens through More', () => {
    expect(MOBILE_PRIMARY_PATHS).toEqual(['/', '/transactions', '/dividends', '/watchlist'])
    expect(isMobileMoreRoute('/cash')).toBe(true)
    expect(isMobileMoreRoute('/real-estate')).toBe(true)
    expect(isMobileMoreRoute('/contribution-room')).toBe(true)
    expect(isMobileMoreRoute('/milestones')).toBe(false)
    expect(isMobileMoreRoute('/settings')).toBe(true)
    expect(isMobileMoreRoute('/watchlist')).toBe(false)
  })
})

describe('responsive controls', () => {
  it('renders action sheets as labelled accessible dialogs', () => {
    const html = renderToStaticMarkup(
      <ActionSheet open onClose={() => {}} title="Add item" description="Item details">
        <input aria-label="Name" />
      </ActionSheet>
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('max-h-[88dvh]')
  })

  it('keeps ticker periods in a mobile grid until the desktop breakpoint', () => {
    const html = renderToStaticMarkup(<TickerChart ticker="AAPL" currency="USD" />)
    expect(html).toContain('grid-cols-3')
    expect(html).toContain('lg:flex')
    expect(html).not.toContain('sm:flex sm:w-auto')
    expect((html.match(/aria-pressed=/g) || [])).toHaveLength(6)
  })

  it('makes clickable stock cards keyboard accessible and adds a trend cue', () => {
    const html = renderToStaticMarkup(
      <StockCard
        onClick={() => {}}
        variant="watchlist"
        item={{ ticker: 'AAPL', currency: 'USD', name: 'Apple', price: 100, change: 1, change_percent: 1 }}
      />
    )
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('↑ ')
  })

  it('renders dense records as cards with labelled touch actions', () => {
    const owner = { owner_name: 'Primary', owner_color: '#6366f1' }
    const transaction = renderToStaticMarkup(<MobileTransactionCard transaction={{ id: 1, ticker: 'AAPL', type: 'buy', shares: 2, price_per_share: 100, date: '2026-01-01', ...owner }} onEdit={() => {}} onDelete={() => {}} />)
    const cash = renderToStaticMarkup(<MobileCashCard position={{ id: 1, label: 'Savings', type: 'cash', currency: 'CAD', amount: 1000, interest_rate: 3, ...owner }} onEdit={() => {}} onDelete={() => {}} />)
    const expense = renderToStaticMarkup(<MobileExpenseCard expense={{ id: 1, label: 'Rent', category: 'housing', currency: 'CAD', amount: 2000, frequency: 'monthly', ...owner }} onEdit={() => {}} onDelete={() => {}} />)

    expect(transaction).toContain('aria-label="Edit AAPL transaction"')
    expect(cash).toContain('aria-label="Delete Savings"')
    expect(expense).toContain('aria-label="Edit Rent"')
    expect(transaction + cash + expense).not.toContain('<table')
  })

  it('renders contribution room with accessible progress and mobile actions', () => {
    const html = renderToStaticMarkup(
      <ContributionRoomCard
        room={{
          id: 1, account_type: 'TFSA', label: 'TFSA room', owner_name: 'Primary',
          owner_color: '#6366f1', year: 2026, currency: 'CAD', opening_room: 7000,
          adjustments: 0, available_room: 7000, contributed: 2000, withdrawn: 500,
          remaining: 5000, over_contribution: 0, used_percent: 28.57,
          entries: [{ id: 1, entry_type: 'contribution', amount: 2000, entry_date: '2026-01-10', note: 'Deposit' }],
        }}
        onAddEntry={() => {}} onEditRoom={() => {}} onDeleteRoom={() => {}}
        onEditEntry={() => {}} onDeleteEntry={() => {}}
      />
    )
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-label="Edit TFSA room"')
    expect(html).toContain('aria-label="Delete activity from 2026-01-10"')
    expect(html).toContain('Withdrawn')
  })
})
