export default function StatCard({ title, value, percentage, color }) {
  const getColor = () => {
    switch (color) {
      case 'green':
        return 'from-green-500 to-emerald-500'
      case 'blue':
        return 'from-blue-500 to-cyan-400'
      case 'red':
        return 'from-red-500 to-pink-500'
      default:
        return 'from-slate-500 to-slate-600'
    }
  }

  return (
    <div className="rounded-lg p-3 transition-all duration-200 bg-white border border-[#E8EDF1] dark:bg-[#0B1220]/60 dark:border-[#1E293B]/70 dark:backdrop-blur-md dark:hover:border-[#22D3EE]/30 dark:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_4px_16px_rgba(34,211,238,0.08)]">
      <div className="text-sm text-[#768396] dark:text-[#94A3B8] mb-1">{title}</div>
      <div className="text-lg font-mono text-[#232360] dark:text-slate-100 mb-1.5">{value}</div>

      {percentage != null ? (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-[#5A6678] dark:text-[#CBD5E1]">{percentage}% of total</div>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-[#E8EDF1] dark:bg-[#1E293B]">
            <div
              className={`h-full bg-gradient-to-r ${getColor()} rounded-full transition-all duration-500`}
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
