import { useState, useRef } from 'react'
import { postApi } from '../hooks/useApi'

const BROKERS = [
  { id: 'wealthsimple', label: 'Wealthsimple' },
  { id: 'questrade', label: 'Questrade' },
  { id: 'generic', label: 'Generic / Other' },
]

export default function CSVImport({ onImported }) {
  const [open, setOpen] = useState(false)
  const [broker, setBroker] = useState('wealthsimple')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const reset = () => {
    setCsvText('')
    setFileName(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    setError(null)
    setResult(null)
    setPreview(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      setCsvText(e.target.result)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    } else {
      setError('Please drop a CSV file')
    }
  }

  const handlePreview = async () => {
    setError(null)
    setResult(null)
    try {
      const data = await postApi('/api/transactions/import/preview', {
        csv: csvText,
        broker,
      })
      setPreview(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const data = await postApi('/api/transactions/import', {
        csv: csvText,
        broker,
      })
      setResult(data)
      setPreview(null)
      onImported?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-muted hover:text-text hover:border-accent transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1v8M4 5l3-3 3 3M2 10v2h10v-2" />
        </svg>
        Import CSV
      </button>
    )
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Import Transactions from CSV</h3>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="text-text-muted hover:text-text p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-48">
          <label className="block text-xs text-text-muted mb-1">Broker</label>
          <select
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            {BROKERS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-text-muted mb-1">CSV File</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-accent bg-accent/5'
                : fileName
                  ? 'border-green/50 bg-green/5'
                  : 'border-border hover:border-accent/50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {fileName ? (
              <span className="text-sm text-green">{fileName}</span>
            ) : (
              <span className="text-sm text-text-muted">
                Drop CSV here or click to browse
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red text-xs bg-red/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="text-green text-xs bg-green/10 rounded-lg px-3 py-2">
          Imported {result.imported} transaction{result.imported !== 1 ? 's' : ''}
          {result.skipped > 0 && ` (${result.skipped} rows skipped — dividends, deposits, etc.)`}
        </div>
      )}

      {csvText && !preview && !result && (
        <button
          onClick={handlePreview}
          className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text hover:bg-surface-3/80 transition-colors"
        >
          Preview
        </button>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Broker: <span className="text-text font-medium">{preview.broker}</span></span>
            <span>Valid: <span className="text-green font-medium">{preview.transactions.length}</span></span>
            <span>Skipped: <span className="text-text-muted font-medium">{preview.skipped.length}</span></span>
          </div>

          {preview.transactions.length > 0 && (
            <div className="bg-surface-3 rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                    <th className="text-left p-2 pl-3">Date</th>
                    <th className="text-left p-2">Ticker</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Shares</th>
                    <th className="text-right p-2 pr-3">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="p-2 pl-3 tabular-nums">{t.date}</td>
                      <td className="p-2 font-medium">{t.ticker}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t.type === 'buy' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                        }`}>
                          {t.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right p-2 tabular-nums">{t.shares}</td>
                      <td className="text-right p-2 pr-3 tabular-nums">${t.price_per_share.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.transactions.length > 20 && (
                <div className="text-xs text-text-muted text-center py-2">
                  ... and {preview.transactions.length - 20} more
                </div>
              )}
            </div>
          )}

          {preview.skipped.length > 0 && (
            <details className="text-xs">
              <summary className="text-text-muted cursor-pointer hover:text-text">
                {preview.skipped.length} rows skipped (click to see why)
              </summary>
              <div className="mt-2 space-y-1">
                {preview.skipped.map((s, i) => (
                  <div key={i} className="text-text-muted">
                    Row {s.row}: {s.reason}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing || !preview.transactions.length}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${preview.transactions.length} Transaction${preview.transactions.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
