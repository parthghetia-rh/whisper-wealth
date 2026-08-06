import { useState } from 'react'
import { useApi, putApi } from '../hooks/useApi'
import {
  isBiometricAvailable, isBiometricEnabled,
  registerBiometric, disableBiometric,
} from '../components/BiometricLock'

export default function Settings() {
  const { data: settings, refetch } = useApi('/api/settings')
  const [bioEnabled, setBioEnabled] = useState(isBiometricEnabled)
  const [bioError, setBioError] = useState(null)
  const bioAvailable = isBiometricAvailable()

  const toggle = async (key) => {
    const current = settings?.[key] === 'true'
    await putApi('/api/settings', { [key]: String(!current) })
    refetch()
  }

  const handleBiometricToggle = async () => {
    setBioError(null)
    if (bioEnabled) {
      disableBiometric()
      setBioEnabled(false)
    } else {
      try {
        const ok = await registerBiometric()
        setBioEnabled(ok)
        if (!ok) setBioError('Registration failed')
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setBioError('Cancelled by user')
        } else {
          setBioError(err.message)
        }
      }
    }
  }

  if (!settings) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Portfolio behavior and security
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Security</h3>
          <ToggleRow
            label="Biometric lock"
            description={
              bioAvailable
                ? 'Require fingerprint, Face ID, or Windows Hello to open WhisperWealth. The app locks every time you open it.'
                : 'Biometric authentication is not available on this device or browser.'
            }
            enabled={bioEnabled}
            onToggle={handleBiometricToggle}
            disabled={!bioAvailable}
          />
          {bioError && (
            <p className="text-xs text-red mt-2">{bioError}</p>
          )}
        </div>

        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Sitting Cash</h3>
          <ToggleRow
            label="Compound interest"
            description="When enabled, projected interest income is calculated with monthly compounding. When disabled, uses simple interest."
            enabled={settings.cash_interest_compound === 'true'}
            onToggle={() => toggle('cash_interest_compound')}
          />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, enabled, onToggle, disabled }) {
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
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          disabled ? 'opacity-30 cursor-not-allowed' : ''
        } ${enabled ? 'bg-accent' : 'bg-surface-3'}`}
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
