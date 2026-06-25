import { useState, useRef } from 'react'
import { postApi } from '../hooks/useApi'

const NONE = ''

export default function CSVImport({ onImported }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('upload')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [sample, setSample] = useState([])
  const [delimiter, setDelimiter] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [mode, setMode] = useState('transactions')
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const reset = () => {
    setStep('upload')
    setCsvText('')
    setFileName(null)
    setHeaders([])
    setSample([])
    setMapping({})
    setPreview(null)
    setResult(null)
    setError(null)
    setMode('transactions')
  }

  const handleFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setError(null)
    setResult(null)
    setPreview(null)

    const text = await file.text()
    setCsvText(text)

    try {
      const data = await postApi('/api/transactions/import/parse', { csv: text })
      setHeaders(data.headers)
      setSample(data.sample)
      setRowCount(data.rowCount)
      setDelimiter(data.delimiter)
      setMapping({})
      setStep('map')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const updateMapping = (key, value) => {
    setMapping((m) => ({ ...m, [key]: value || NONE }))
  }

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const fullMapping = { ...mapping, mode }
      const data = await postApi('/api/transactions/import/preview', {
        csv: csvText,
        mapping: fullMapping,
      })
      setPreview(data)
      setStep('preview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    try {
      const fullMapping = { ...mapping, mode }
      const data = await postApi('/api/transactions/import', {
        csv: csvText,
        mapping: fullMapping,
      })
      setResult(data)
      setStep('done')
      onImported?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canPreview =
    mapping.tickerCol &&
    mapping.sharesCol &&
    (mode === 'holdings'
      ? mapping.bookValueCol || mapping.priceCol
      : mapping.priceCol)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-muted hover:text-text hover:border-accent transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1v8M4 5l3-3 3 3M2 10v2h10v-2" />
        </svg>
        Import CSV / TSV
      </button>
    )
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Import Transactions</h3>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="text-text-muted hover:text-text p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="text-red text-xs bg-red/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {step === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <p className="text-sm text-text-muted">
            Drop any CSV or TSV file here, or click to browse
          </p>
          <p className="text-xs text-text-muted/60 mt-1">
            Works with Wealthsimple, Questrade, or any broker export
          </p>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="bg-surface-3 px-2 py-0.5 rounded font-medium text-text">
              {fileName}
            </span>
            <span>{rowCount} rows</span>
            <span>{delimiter === 'tab' ? 'Tab-separated' : 'Comma-separated'}</span>
            <span>{headers.length} columns</span>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">Import mode</label>
            <div className="flex rounded-lg border border-border overflow-hidden w-fit">
              <button
                onClick={() => setMode('transactions')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'transactions' ? 'bg-accent text-white' : 'bg-surface-3 text-text-muted hover:text-text'
                }`}
              >
                Transaction History
              </button>
              <button
                onClick={() => setMode('holdings')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'holdings' ? 'bg-accent text-white' : 'bg-surface-3 text-text-muted hover:text-text'
                }`}
              >
                Current Holdings
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <MappingSelect
              label="Ticker / Symbol *"
              value={mapping.tickerCol}
              onChange={(v) => updateMapping('tickerCol', v)}
              headers={headers}
              hints={['symbol', 'ticker', 'stock']}
            />
            <MappingSelect
              label="Shares / Quantity *"
              value={mapping.sharesCol}
              onChange={(v) => updateMapping('sharesCol', v)}
              headers={headers}
              hints={['quantity', 'shares', 'qty', 'units']}
            />
            {mode === 'holdings' ? (
              <>
                <MappingSelect
                  label="Book Value (total cost)"
                  value={mapping.bookValueCol}
                  onChange={(v) => updateMapping('bookValueCol', v)}
                  headers={headers}
                  hints={['book value', 'cost', 'total cost']}
                />
                <MappingSelect
                  label="Price (fallback if no book value)"
                  value={mapping.priceCol}
                  onChange={(v) => updateMapping('priceCol', v)}
                  headers={headers}
                  hints={['market price', 'price', 'last price']}
                />
              </>
            ) : (
              <>
                <MappingSelect
                  label="Price per Share *"
                  value={mapping.priceCol}
                  onChange={(v) => updateMapping('priceCol', v)}
                  headers={headers}
                  hints={['price', 'market price', 'unit price', 'cost']}
                />
                <MappingSelect
                  label="Date"
                  value={mapping.dateCol}
                  onChange={(v) => updateMapping('dateCol', v)}
                  headers={headers}
                  hints={['date', 'trade date', 'transaction date', 'settlement']}
                />
                <MappingSelect
                  label="Type (buy/sell)"
                  value={mapping.typeCol}
                  onChange={(v) => updateMapping('typeCol', v)}
                  headers={headers}
                  hints={['type', 'action', 'side', 'transaction type']}
                />
              </>
            )}
          </div>

          {sample.length > 0 && (
            <details className="text-xs">
              <summary className="text-text-muted cursor-pointer hover:text-text">
                Preview first {sample.length} rows
              </summary>
              <div className="mt-2 overflow-x-auto bg-surface-3 rounded-lg border border-border">
                <table className="text-[11px] min-w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {headers.map((h) => (
                        <th key={h} className="text-left p-1.5 px-2 text-text-muted whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sample.map((row, i) => (
                      <tr key={i} className="border-b border-border/30">
                        {headers.map((h) => (
                          <td key={h} className="p-1.5 px-2 whitespace-nowrap truncate max-w-[150px]">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={!canPreview || loading}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Parsing...' : 'Preview'}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text-muted hover:text-text transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Valid: <span className="text-green font-medium">{preview.transactions.length}</span></span>
            <span>Skipped: <span className="text-text-muted font-medium">{preview.skipped.length}</span></span>
            <span className="bg-surface-3 px-2 py-0.5 rounded">{mode === 'holdings' ? 'Holdings import' : 'Transaction import'}</span>
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
                {preview.skipped.length} rows skipped
              </summary>
              <div className="mt-2 space-y-1">
                {preview.skipped.map((s, i) => (
                  <div key={i} className="text-text-muted">Row {s.row}: {s.reason}</div>
                ))}
              </div>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={loading || !preview.transactions.length}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Importing...' : `Import ${preview.transactions.length} Transaction${preview.transactions.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setStep('map')}
              className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text-muted hover:text-text transition-colors"
            >
              Back to mapping
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="text-green text-sm bg-green/10 rounded-lg px-4 py-3">
            Imported {result.imported} transaction{result.imported !== 1 ? 's' : ''} successfully
            {result.skipped > 0 && ` (${result.skipped} rows skipped)`}
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text-muted hover:text-text transition-colors"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}

function MappingSelect({ label, value, onChange, headers, hints }) {
  const autoDetected = !value && hints
    ? headers.find((h) => hints.some((hint) => h.toLowerCase().includes(hint)))
    : null

  const effectiveValue = value || autoDetected || NONE

  if (!value && autoDetected) {
    setTimeout(() => onChange(autoDetected), 0)
  }

  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <select
        value={effectiveValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
      >
        <option value="">— Skip —</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  )
}
