interface MetricCardProps {
  label: string
  value: string | number
  suffix?: string
  subtitle?: string
  color?: 'green' | 'red' | 'orange' | 'blue' | 'grey'
}

const colorMap = {
  green: 'bg-green-50 border-green-200 text-green-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  orange: 'bg-orange-50 border-orange-200 text-orange-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  grey: 'bg-gray-50 border-gray-200 text-gray-900',
}

const valueColorMap = {
  green: 'text-green-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
  blue: 'text-blue-600',
  grey: 'text-gray-600',
}

export function MetricCard({
  label,
  value,
  suffix,
  subtitle,
  color = 'blue',
}: MetricCardProps) {
  return (
    <div className={`border rounded-lg p-5 ${colorMap[color]}`}>
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <p className={`text-4xl font-bold ${valueColorMap[color]}`}>
          {value}
        </p>
        {suffix && <span className="text-lg font-medium">{suffix}</span>}
      </div>
      {subtitle && <p className="mt-2 text-xs text-gray-700">{subtitle}</p>}
    </div>
  )
}
