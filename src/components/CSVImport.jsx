import { useState, useRef } from 'react'
import { postApi } from '../hooks/useApi'

const NONE = ''

export default function CSVImport({ onImported }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('upload')
  const [fileType, setFileType] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [sample, setSample] = useState([])
  const [delimiter, setDelimiter] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [mode, setMode] = useState('transactions')
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const [pdfRawText, setPdfRawText] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const reset = () => {
    setStep('upload')
    setFileType(null)
    setCsvText('')
    setFileName(null)
    setHeaders([])
    setSample([])
    setMapping({})
    setPreview(null)
    setPdfRawText(null)
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
    setPdfRawText(null)

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

    if (isPdf) {
      setFileType('pdf')
      setLoading(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)
        const data = await postApi('/api/transactions/import/parse-pdf', { pdf: base64 })
        if (!data) {
          setError('No response from server')
        } else if (data.error) {
          setError(data.error)
        } else if (!data.transactions?.length) {
          setPreview(data)
          setPdfRawText(data.rawText)
          setError('No transactions found in PDF. Check the extracted text below.')
          setStep('preview')
        } else {
          setPreview(data)
          setPdfRawText(data.rawText)
          setStep('preview')
        }
      } catch (err) {
        setError(err?.message || 'Failed to process PDF')
      } finally {
        setLoading(false)
      }
    } else {
      setFileType('csv')
      setLoading(true)
      const text = await file.text()
      setCsvText(text)
      try {
        const data = await postApi('/api/transactions/import/parse', { csv: text })
        if (!data) {
          setError('No response from server')
        } else {
          setHeaders(data.headers)
          setSample(data.sample)
          setRowCount(data.rowCount)
          setDelimiter(data.delimiter)
          setMapping({})
          setStep('map')
        }
      } catch (err) {
        setError(err?.message || 'Failed to parse file')
      } finally {
        setLoading(false)
      }
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
      if (fileType === 'pdf') {
        const rows = preview.transactions.map(
          (t) => `${t.date},${t.type},${t.ticker},${t.shares},${t.price_per_share}`
        )
        const csv = `Date,Type,Symbol,Quantity,Price\n${rows.join('\n')}`
        const mapping = {
          mode: 'transactions',
          dateCol: 'Date',
          typeCol: 'Type',
          tickerCol: 'Symbol',
          sharesCol: 'Quantity',
          priceCol: 'Price',
        }
        const data = await postApi('/api/transactions/import', { csv, mapping })
        setResult(data)
      } else {
        const fullMapping = { ...mapping, mode }
        const data = await postApi('/api/transactions/import', {
          csv: csvText,
          mapping: fullMapping,
        })
        setResult(data)
      }
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
        Import File
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

      {loading && (
        <div className="border-2 border-dashed border-accent/50 rounded-lg px-6 py-10 text-center bg-accent/5">
          <svg className="animate-spin mx-auto mb-3 text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <p className="text-sm text-accent">
            {fileType === 'pdf' ? 'Extracting text from PDF...' : 'Parsing file...'}
          </p>
          <p className="text-xs text-text-muted mt-1">{fileName}</p>
        </div>
      )}

      {step === 'upload' && !loading && (
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
            accept=".csv,.tsv,.txt,.pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <p className="text-sm text-text-muted">
            Drop a CSV, TSV, or PDF file here, or click to browse
          </p>
          <p className="text-xs text-text-muted/60 mt-1">
            CSV/TSV: broker exports with column mapping. PDF: printed broker confirmation emails.
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
              label="Exchange (for suffix: TSX → .TO)"
              value={mapping.exchangeCol}
              onChange={(v) => updateMapping('exchangeCol', v)}
              headers={headers}
              hints={['exchange', 'mic', 'market', 'stock exchange']}
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
          <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
            <span>Valid: <span className="text-green font-medium">{preview.transactions.length}</span></span>
            <span>Skipped: <span className="text-text-muted font-medium">{preview.skipped?.length || 0}</span></span>
            <span className="bg-surface-3 px-2 py-0.5 rounded">
              {fileType === 'pdf' ? 'PDF import' : mode === 'holdings' ? 'Holdings import' : 'Transaction import'}
            </span>
            {fileType === 'pdf' && preview.patternsMatched?.length > 0 && (
              <span className="text-accent">
                Matched: {preview.patternsMatched.join(', ')}
              </span>
            )}
          </div>

          {fileType === 'pdf' && pdfRawText && (
            <details className="text-xs">
              <summary className="text-text-muted cursor-pointer hover:text-text">
                Extracted text preview
              </summary>
              <pre className="mt-2 p-3 bg-surface-3 rounded-lg border border-border text-[11px] text-text-muted whitespace-pre-wrap max-h-40 overflow-y-auto">
                {pdfRawText}
              </pre>
            </details>
          )}

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
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              {loading ? 'Importing...' : `Import ${preview.transactions.length} Transaction${preview.transactions.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => fileType === 'pdf' ? reset() : setStep('map')}
              className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-sm text-text-muted hover:text-text transition-colors"
            >
              {fileType === 'pdf' ? 'Start over' : 'Back to mapping'}
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
