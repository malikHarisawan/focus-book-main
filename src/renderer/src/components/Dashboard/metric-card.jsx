import React from "react";
import { TrendingUp, TrendingDown, Minus } from "../shared/icons";

export function MetricCard({ title, value, icon: Icon, trend, color, detail, suffix }) {
  const getGradient = () => {
    switch (color) {
      case "cyan":
        return "from-cyan-500 to-blue-500";
      case "purple":
        return "from-purple-500 to-pink-500";
      case "blue":
        return "from-blue-500 to-indigo-500";
      case "green":
        return "from-green-500 to-emerald-500";
      default:
        return "from-gray-500 to-slate-500";
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable":
        return <Minus className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-slate-800/50 rounded-lg ${getGradient()} p-4 relative overflow-hidden`}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm text-slate-400">{title}</div>
      <Icon className={`h-5 w-5 text-${color}-500`} />
    </div>
    <div className="text-2xl font-bold mb-1 bg-gradient-to-r bg-clip-text text-transparent from-slate-100 to-slate-300">
      {value}
      {suffix}
    </div>
    <div className="text-xs text-slate-500">{detail}</div>
    <div className="absolute bottom-2 right-2 flex items-center">{getTrendIcon()}</div>
    <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-r opacity-20 blur-xl from-cyan-500 to-blue-500"></div>
  </div>
)
}