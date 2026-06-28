import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'

const ICONS = {
  chart: ChartIcon,
  dollar: DollarIcon,
  grid: GridIcon,
  rocket: RocketIcon,
  flame: FlameIcon,
}

export function MilestoneBanner() {
  const { data } = useApi('/api/milestones')
  if (!data?.latest) return null

  const m = data.latest
  const Icon = ICONS[m.icon] || ChartIcon

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 animate-pulse-once">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-accent">{m.title}</p>
          <p className="text-xs text-text-muted">{m.description}</p>
        </div>
        <Link
          to="/milestones"
          className="text-[10px] text-accent hover:text-accent-hover shrink-0"
        >
          View all
        </Link>
      </div>
    </div>
  )
}

export function MilestoneChips() {
  const { data } = useApi('/api/milestones')
  if (!data?.achieved?.length) return null

  const recent = data.achieved.slice(0, 5)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {recent.map((m) => {
        const Icon = ICONS[m.icon] || ChartIcon
        return (
          <div
            key={m.id}
            className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-full px-2.5 py-1"
            title={m.description}
          >
            <Icon size={10} />
            <span className="text-[10px] font-medium text-text-muted">{m.title}</span>
          </div>
        )
      })}
      {data.achieved.length > 5 && (
        <Link to="/milestones" className="text-[10px] text-accent hover:text-accent-hover">
          +{data.achieved.length - 5} more
        </Link>
      )}
    </div>
  )
}

export function UpcomingMilestones() {
  const { data } = useApi('/api/milestones')
  if (!data?.upcoming?.length) return null

  return (
    <div className="space-y-2">
      {data.upcoming.map((m) => {
        const Icon = ICONS[m.icon] || ChartIcon
        return (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center shrink-0">
              <Icon size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium">{m.title}</span>
                <span className="text-[10px] text-text-muted tabular-nums">
                  {Math.round(m.progress * 100)}%
                </span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${m.progress * 100}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChartIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <path d="M2 11l3-4 3 2 4-5" />
    </svg>
  )
}

function DollarIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 3.5v7M5.5 5.5h2a1 1 0 010 2h-2M5.5 7.5h2a1 1 0 110 2h-2" />
    </svg>
  )
}

function GridIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <rect x="2" y="2" width="4" height="4" rx="0.5" />
      <rect x="8" y="2" width="4" height="4" rx="0.5" />
      <rect x="2" y="8" width="4" height="4" rx="0.5" />
      <rect x="8" y="8" width="4" height="4" rx="0.5" />
    </svg>
  )
}

function RocketIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <path d="M7 12V6M4 9l3-3 3 3M5 3.5C5.5 2.5 6.2 2 7 2s1.5.5 2 1.5" />
    </svg>
  )
}

function FlameIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red">
      <path d="M7 1.5c0 2-2 3-2 5a3 3 0 006 0c0-2-2-3-2-5" />
    </svg>
  )
}
