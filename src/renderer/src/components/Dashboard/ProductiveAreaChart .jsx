import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

const ProductiveAreaChart = ({ data }) => {
  const [selectedRange, setSelectedRange] = useState(null);
  const [aggregatedData, setAggregatedData] = useState({ productive: 0, unproductive: 0, total: 0 });

  useEffect(() => {
    if (data && data.length > 0) {
      calculateAggregatedData();
    }
  }, [data, selectedRange]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-md h-[250px] flex items-center justify-center">
        <span className="text-gray-500">No data available</span>
      </div>
    );
  }

  const calculateAggregatedData = () => {
    let startIndex = 0;
    let endIndex = data.length - 1;
    
    if (selectedRange) {
      startIndex = selectedRange.startIndex;
      endIndex = selectedRange.endIndex;
    }
    
    let totalProductive = 0;
    let totalUnproductive = 0;
    
    for (let i = startIndex; i <= endIndex; i++) {
      if (data[i]) {
        totalProductive += data[i].productive || 0;
        totalUnproductive += data[i].unproductive || 0;
      }
    }
    
    setAggregatedData({
      productive: totalProductive,
      unproductive: totalUnproductive,
      total: totalProductive + totalUnproductive
    });
  };

  const handleBrushChange = (brushData) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      setSelectedRange({
        startIndex: brushData.startIndex,
        endIndex: brushData.endIndex
      });
    } else {
      setSelectedRange(null);
    }
  };
  const formatTooltipValue = (value) => {
    if (value === 0) return "0m";
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const CustomTooltip = ({ active }) => {
    if (active) {
      const productiveTime = formatTooltipValue(aggregatedData.productive);
      const unproductiveTime = formatTooltipValue(aggregatedData.unproductive);
      const totalTime = formatTooltipValue(aggregatedData.total);
      const productivePercentage = aggregatedData.total > 0 
        ? Math.round((aggregatedData.productive / aggregatedData.total) * 100) 
        : 0;
      
      return (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <p className="text-gray-200 font-medium mb-2">
            {selectedRange ? 'Selected Range' : 'Current Day Total'}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-300">Productive: </span>
              <span className="text-white">{productiveTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-300">Unproductive: </span>
              <span className="text-white">{unproductiveTime}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-gray-600">
              <span className="text-gray-300">Total: </span>
              <span className="text-cyan-400 font-medium">{totalTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Productivity: </span>
              <span className="text-green-400 font-medium">{productivePercentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-800 p-4 rounded-md">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" stroke="#ffffff" />
          {/* <YAxis stroke="#ffffff" /> */}
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="productive"
            name="Productive"
            stroke="#82ca9d"
            fill="url(#colorProductive)"
          />
          <Area
            type="monotone"
            dataKey="unproductive"
            name="Unproductive"
            stroke="#ff6b6b"
            fill="url(#colorUnproductive)"
          />
          <Brush 
            dataKey="day" 
            height={30} 
            stroke="#06b6d4" 
            fill="#1f2937"
            onChange={handleBrushChange}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProductiveAreaChart;
