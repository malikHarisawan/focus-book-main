export default function StatCard({
  title,
  value,
  percentage,
  color,
}) {
  const getColor = () => {
    switch (color) {
      case "green":
        return "from-green-500 to-emerald-500"
      case "blue":
        return "from-blue-500 to-cyan-500"
      case "red":
        return "from-red-500 to-pink-500"
      default:
        return "from-slate-500 to-slate-600"
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <div className="text-sm text-slate-400 mb-1">{title}</div>
      <div className="text-xl font-mono text-slate-200 mb-2">{value}</div>

      {percentage != null ? (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-400">{percentage}% of total</div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getColor()} rounded-full`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </>
      ) : (
        <div /> 
      )}
    </div>
  )
}
