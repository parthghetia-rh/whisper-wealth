import { useEffect, useId } from 'react'

export default function ActionSheet({ open, onClose, title, description, children, size = '2xl' }) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const maxWidth = size === '3xl' ? 'sm:max-w-3xl' : size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-2xl'

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface-2 shadow-2xl sm:rounded-2xl ${maxWidth}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface-2/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-button -mr-2 -mt-1" aria-label={`Close ${title}`}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M5 5l8 8M13 5l-8 8" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </section>
    </div>
  )
}
