export const themes = {
  midnight: {
    label: 'Midnight',
    colors: {
      '--color-surface': '#0f1117',
      '--color-surface-2': '#161921',
      '--color-surface-3': '#1e2130',
      '--color-border': '#2a2d3a',
      '--color-accent': '#6366f1',
      '--color-accent-hover': '#818cf8',
      '--color-green': '#22c55e',
      '--color-red': '#ef4444',
      '--color-text': '#e2e8f0',
      '--color-text-muted': '#94a3b8',
    },
    swatch: '#6366f1',
  },
  carbon: {
    label: 'Carbon',
    colors: {
      '--color-surface': '#09090b',
      '--color-surface-2': '#111113',
      '--color-surface-3': '#1a1a1e',
      '--color-border': '#27272a',
      '--color-accent': '#a1a1aa',
      '--color-accent-hover': '#d4d4d8',
      '--color-green': '#4ade80',
      '--color-red': '#f87171',
      '--color-text': '#fafafa',
      '--color-text-muted': '#71717a',
    },
    swatch: '#71717a',
  },
  ocean: {
    label: 'Ocean',
    colors: {
      '--color-surface': '#0a1628',
      '--color-surface-2': '#0f1f35',
      '--color-surface-3': '#162a46',
      '--color-border': '#1e3a5f',
      '--color-accent': '#06b6d4',
      '--color-accent-hover': '#22d3ee',
      '--color-green': '#34d399',
      '--color-red': '#fb7185',
      '--color-text': '#e0f2fe',
      '--color-text-muted': '#7dd3fc',
    },
    swatch: '#06b6d4',
  },
  emerald: {
    label: 'Emerald',
    colors: {
      '--color-surface': '#071210',
      '--color-surface-2': '#0c1f1a',
      '--color-surface-3': '#132d25',
      '--color-border': '#1a3f34',
      '--color-accent': '#10b981',
      '--color-accent-hover': '#34d399',
      '--color-green': '#4ade80',
      '--color-red': '#f87171',
      '--color-text': '#ecfdf5',
      '--color-text-muted': '#6ee7b7',
    },
    swatch: '#10b981',
  },
  sunset: {
    label: 'Sunset',
    colors: {
      '--color-surface': '#1a0f0a',
      '--color-surface-2': '#251610',
      '--color-surface-3': '#332017',
      '--color-border': '#4a2e1e',
      '--color-accent': '#f59e0b',
      '--color-accent-hover': '#fbbf24',
      '--color-green': '#a3e635',
      '--color-red': '#ef4444',
      '--color-text': '#fef3c7',
      '--color-text-muted': '#d97706',
    },
    swatch: '#f59e0b',
  },
  rose: {
    label: 'Rose',
    colors: {
      '--color-surface': '#160a12',
      '--color-surface-2': '#1f1019',
      '--color-surface-3': '#2d1724',
      '--color-border': '#4a2037',
      '--color-accent': '#ec4899',
      '--color-accent-hover': '#f472b6',
      '--color-green': '#34d399',
      '--color-red': '#f87171',
      '--color-text': '#fce7f3',
      '--color-text-muted': '#f9a8d4',
    },
    swatch: '#ec4899',
  },
}

const STORAGE_KEY = 'portfolio-theme'

export function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'midnight'
}

export function applyTheme(themeId) {
  const theme = themes[themeId]
  if (!theme) return
  const root = document.documentElement
  for (const [prop, value] of Object.entries(theme.colors)) {
    root.style.setProperty(prop, value)
  }
  localStorage.setItem(STORAGE_KEY, themeId)
}
