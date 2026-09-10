export default function RecordListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading records">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2"><div className="h-4 w-28 rounded bg-surface-3" /><div className="h-3 w-20 rounded bg-surface-3" /></div>
            <div className="h-9 w-20 rounded-lg bg-surface-3" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/50 pt-3">
            <div className="h-8 rounded bg-surface-3" /><div className="h-8 rounded bg-surface-3" /><div className="h-8 rounded bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  )
}
