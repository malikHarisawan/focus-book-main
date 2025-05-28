import React from "react";
import { Card, CardContent } from "./ui/card";
import { BarChart3, Flame, Clock4, Trophy } from "lucide-react";

const data = [
  { name: "Visual Studio Code", category: "Development", time: "2h 45m", productivity: "Productive", color: "text-green-400" },
  { name: "Microsoft Word", category: "Office", time: "1h 20m", productivity: "Productive", color: "text-green-400" },
  { name: "Chrome - Work", category: "Browser", time: "1h 15m", productivity: "Neutral", color: "text-yellow-400" },
  { name: "Slack", category: "Communication", time: "45m", productivity: "Neutral", color: "text-yellow-400" },
  { name: "YouTube", category: "Entertainment", time: "30m", productivity: "Distracting", color: "text-red-400" }
];

export default function Dashboard() {
  return (
    <div className="p-6 bg-[#0E101A] min-h-screen text-white font-sans">
      <h1 className="text-2xl font-semibold mb-6">Productivity Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-[#151823] text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Focus Time</p>
                <p className="text-2xl font-bold">210min</p>
                <p className="text-sm text-gray-500">3h 30m today</p>
              </div>
              <Clock4 className="text-cyan-400 w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#151823] text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Productivity</p>
                <p className="text-2xl font-bold">85%</p>
                <p className="text-sm text-gray-500">8% higher than yesterday</p>
              </div>
              <Flame className="text-pink-400 w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#151823] text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Streak</p>
                <p className="text-2xl font-bold">5days</p>
                <p className="text-sm text-gray-500">Consecutive productive days</p>
              </div>
              <Trophy className="text-blue-400 w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-[#151823] rounded-2xl shadow p-4">
        <div className="flex items-center gap-4 border-b border-gray-700 pb-2 mb-4">
          <button className="text-cyan-400 border-b-2 border-cyan-400 pb-1">Applications</button>
          <button className="text-gray-400">Categories</button>
          <button className="text-gray-400">Timeline</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-gray-400 text-sm">
                <th className="py-2">Application</th>
                <th className="py-2">Category</th>
                <th className="py-2">Time Spent</th>
                <th className="py-2">Productivity</th>
                <th className="py-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.map((app, i) => (
                <tr key={i} className="border-t border-gray-700 text-sm">
                  <td className="py-3 text-white">{app.name}</td>
                  <td className="py-3 text-gray-300">{app.category}</td>
                  <td className="py-3 text-cyan-400">{app.time}</td>
                  <td className={`py-3 font-semibold ${app.color}`}>{app.productivity}</td>
                  <td className="py-3">
                    <BarChart3 className={`${app.color} w-4 h-4`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
