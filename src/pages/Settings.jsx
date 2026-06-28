import { useApi, putApi } from '../hooks/useApi'

export default function Settings() {
  const { data: settings, refetch } = useApi('/api/settings')

  const toggle = async (key) => {
    const current = settings?.[key] === 'true'
    await putApi('/api/settings', { [key]: String(!current) })
    refetch()
  }

  if (!settings) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Portfolio behavior and calculations
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Sitting Cash</h3>
          <ToggleRow
            label="Compound interest"
            description="When enabled, projected interest income is calculated with monthly compounding. When disabled, uses simple interest. This affects the projected income on the Cash and Dividends pages."
            enabled={settings.cash_interest_compound === 'true'}
            onToggle={() => toggle('cash_interest_compound')}
          />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? 'bg-accent' : 'bg-surface-3'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            enabled ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
