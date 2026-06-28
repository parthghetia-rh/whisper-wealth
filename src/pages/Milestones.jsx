import { useApi } from '../hooks/useApi'
import { UpcomingMilestones } from '../components/MilestoneCard'

const CATEGORY_LABELS = {
  value: 'Portfolio Value',
  income: 'Income',
  holdings: 'Holdings',
  growth: 'Growth',
  streak: 'Streaks',
}

const CATEGORY_COLORS = {
  value: 'accent',
  income: 'green',
  holdings: 'accent',
  growth: 'accent',
  streak: 'red',
}

export default function Milestones() {
  const { data } = useApi('/api/milestones')

  const achieved = data?.achieved || []
  const grouped = {}
  for (const m of achieved) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Milestones</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Your portfolio achievements and progress
        </p>
      </div>

      {data?.upcoming?.length > 0 && (
        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Next goals</h3>
          <UpcomingMilestones />
        </div>
      )}

      {achieved.length === 0 ? (
        <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
          <p className="text-lg mb-2">No milestones yet</p>
          <p className="text-sm">
            Start adding transactions and watch your achievements unlock as your portfolio grows!
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-text-muted mb-3">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="space-y-2">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="bg-surface-2 rounded-xl border border-border p-4 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    CATEGORY_COLORS[category] === 'green' ? 'bg-green/15' :
                    CATEGORY_COLORS[category] === 'red' ? 'bg-red/15' : 'bg-accent/15'
                  }`}>
                    <span className="text-lg">
                      {category === 'value' ? '📈' :
                       category === 'income' ? '💰' :
                       category === 'holdings' ? '📊' :
                       category === 'growth' ? '🚀' :
                       category === 'streak' ? '🔥' : '⭐'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-text-muted">{m.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-text-muted">
                      {new Date(m.achieved_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
