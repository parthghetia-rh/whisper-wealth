import { useState, useEffect } from 'react'

const STORAGE_KEY = 'portfolio-display-currency'

export default function CurrencySelector({ currencies, selected, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-muted mr-1">Display in</span>
      {currencies.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected === c
              ? 'bg-accent text-white'
              : 'bg-surface-3 text-text-muted hover:text-text hover:bg-surface-3/80'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

export function useDisplayCurrency(availableCurrencies) {
  const [display, setDisplay] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved || 'USD'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, display)
  }, [display])

  const all = availableCurrencies.length
    ? availableCurrencies
    : ['USD']

  if (!all.includes(display) && all.length) {
    return [all[0], setDisplay, all]
  }

  return [display, setDisplay, all]
}
