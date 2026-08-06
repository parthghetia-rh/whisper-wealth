import { useState, useEffect } from 'react'

const LOCK_KEY = 'biometric-lock-enabled'
const CRED_KEY = 'biometric-cred-id'

export function isBiometricAvailable() {
  return !!(window.PublicKeyCredential && navigator.credentials)
}

export function isBiometricEnabled() {
  return localStorage.getItem(LOCK_KEY) === 'true' && !!localStorage.getItem(CRED_KEY)
}

function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuffer(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function randomChallenge() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return arr
}

export async function registerBiometric() {
  const challenge = randomChallenge()
  const userId = randomChallenge()

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'WhisperWealth', id: window.location.hostname },
      user: {
        id: userId,
        name: 'whisperwealth-user',
        displayName: 'WhisperWealth User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  })

  if (credential) {
    localStorage.setItem(CRED_KEY, bufferToBase64(credential.rawId))
    localStorage.setItem(LOCK_KEY, 'true')
    return true
  }
  return false
}

export async function verifyBiometric() {
  const credId = localStorage.getItem(CRED_KEY)
  if (!credId) throw new Error('No biometric registered')

  const challenge = randomChallenge()

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{
        type: 'public-key',
        id: base64ToBuffer(credId),
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  })

  return !!assertion
}

export function disableBiometric() {
  localStorage.removeItem(LOCK_KEY)
  localStorage.removeItem(CRED_KEY)
}

export default function BiometricLock({ onUnlock }) {
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const handleUnlock = async () => {
    setVerifying(true)
    setError(null)
    try {
      const ok = await verifyBiometric()
      if (ok) onUnlock()
      else setError('Verification failed')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Cancelled. Tap to try again.')
      } else {
        setError(err.message)
      }
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    handleUnlock()
  }, [])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
          <rect x="2" y="2" width="44" height="44" rx="12" className="fill-accent/15 stroke-accent" strokeWidth="2" />
          <path d="M16 22v-4a8 8 0 0116 0v4" className="stroke-accent" strokeWidth="2" strokeLinecap="round" fill="none" />
          <rect x="14" y="22" width="20" height="16" rx="3" className="fill-accent/30 stroke-accent" strokeWidth="2" />
          <circle cx="24" cy="30" r="2" className="fill-accent" />
        </svg>
        <h2 className="text-lg font-semibold text-text mb-1">WhisperWealth</h2>
        <p className="text-sm text-text-muted mb-6">Unlock to access your portfolio</p>

        {error && (
          <p className="text-xs text-red mb-4">{error}</p>
        )}

        <button
          onClick={handleUnlock}
          disabled={verifying}
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 mb-4"
        >
          {verifying ? 'Verifying...' : 'Unlock with Biometric'}
        </button>

        <p className="text-[10px] text-text-muted">
          Fingerprint, Face ID, or Windows Hello
        </p>
      </div>
    </div>
  )
}
