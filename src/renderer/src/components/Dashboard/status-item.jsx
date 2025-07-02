export function StatusItem({ label, value, color }) {
  const getColor = () => {
    switch (color) {
      case 'cyan':
        return 'from-cyan-500 to-blue-500'
      case 'green':
        return 'from-green-500 to-emerald-500'
      case 'blue':
        return 'from-blue-500 to-indigo-500'
      case 'purple':
        return 'from-purple-500 to-pink-500'
      default:
        return 'from-cyan-500 to-blue-500'
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xs text-slate-400">{value}%</div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getColor()} rounded-full`}
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  )
}
