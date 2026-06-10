interface ReadinessBadgeProps {
  status: 'READY' | 'AT_RISK' | 'NOT_READY' | 'INSUFFICIENT_DATA'
  passRate: number | null
  blockedTests: number
  openDefects: number
}

const statusConfig = {
  READY: {
    icon: '✅',
    bgColor: 'bg-green-100',
    textColor: 'text-green-900',
    badgeColor: 'bg-green-600',
    label: 'READY',
  },
  AT_RISK: {
    icon: '⚠️',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-900',
    badgeColor: 'bg-amber-600',
    label: 'AT RISK',
  },
  NOT_READY: {
    icon: '🛑',
    bgColor: 'bg-red-100',
    textColor: 'text-red-900',
    badgeColor: 'bg-red-600',
    label: 'NOT READY',
  },
  INSUFFICIENT_DATA: {
    icon: '📊',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-900',
    badgeColor: 'bg-slate-600',
    label: 'INSUFFICIENT DATA',
  },
}

export function ReadinessBadge({
  status,
  passRate,
  blockedTests,
  openDefects,
}: ReadinessBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className={`rounded-lg p-6 ${config.bgColor} ${config.textColor}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{config.icon}</span>
        <div>
          <h3 className="text-lg font-bold">{config.label}</h3>
          {status === 'INSUFFICIENT_DATA' ? (
            <p className="mt-1 text-sm">Execution data required for readiness assessment.</p>
          ) : (
            <p className="mt-1 text-sm">
              {passRate !== null ? `${passRate.toFixed(1)}% pass rate` : '-'} · {blockedTests} blocked · {openDefects} defects
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
