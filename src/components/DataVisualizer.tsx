import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, Line, 
  BarChart, Bar, 
  AreaChart, Area, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { LineChart as LineIcon, BarChart3, AreaChart as AreaIcon, Table as TableIcon } from 'lucide-react';

interface DataVisualizerProps {
  tableData: {
    id: string;
    headers: string[];
    numericKeys: string[];
    labelKey: string;
    data: any[];
  };
  theme: 'light' | 'dark';
}

export const DataVisualizer: React.FC<DataVisualizerProps> = ({ tableData, theme }) => {
  const { data, numericKeys, labelKey } = tableData;
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [activeKey, setActiveKey] = useState<string>(numericKeys[0] || '');

  if (data.length === 0 || numericKeys.length === 0) return null;

  // Modern neon matching color palettes
  const colors = [
    '#00ff9d', // Active matrix green
    '#00b8ff', // Cyber blue
    '#d946ef', // Neon magenta
    '#eab308', // Amber yellow
    '#ef4444', // Hot red
  ];

  const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tooltipStyle = theme === 'dark' 
    ? { background: '#0e0e0e', border: '1px solid #333', borderRadius: '12px', color: '#fff' }
    : { background: '#ffffff', border: '1px solid #ddd', borderRadius: '12px', color: '#000' };

  return (
    <div className={`mt-4 p-4 rounded-xl border transition-all ${
      theme === 'dark' 
        ? 'bg-black/40 border-[#222] text-white shadow-[#000_0px_10px_30px]' 
        : 'bg-[#fafafa] border-[#e2e8f0] text-[#1e293b] shadow-[0_10px_30px_rgba(0,0,0,0.03)]'
    }`}>
      {/* Control Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-inherit">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00ff9d] animate-pulse"></div>
          <span className="text-[11px] font-black uppercase tracking-widest opacity-80">Interactive Data Engine</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Key Selection */}
          {numericKeys.length > 1 && (
            <select
              value={activeKey}
              onChange={(e) => setActiveKey(e.target.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold outline-none transition-all ${
                theme === 'dark' 
                  ? 'bg-[#151515] hover:bg-[#222] border border-[#333] text-white' 
                  : 'bg-white hover:bg-gray-100 border border-[#ccc] text-black'
              }`}
            >
              {numericKeys.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}

          {/* Chart Type Toggles */}
          <div className={`flex rounded-lg p-0.5 border ${theme === 'dark' ? 'bg-[#151515] border-[#333]' : 'bg-gray-100 border-[#eee]'}`}>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1 px-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                chartType === 'bar'
                  ? (theme === 'dark' ? 'bg-[#00ff9d] text-black' : 'bg-black text-white')
                  : 'opacity-60 hover:opacity-100'
              }`}
              title="Bar Chart"
            >
              <BarChart3 size={13} />
              <span className="hidden xs:inline">Bar</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1 px-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                chartType === 'line'
                  ? (theme === 'dark' ? 'bg-[#00ff9d] text-black' : 'bg-black text-white')
                  : 'opacity-60 hover:opacity-100'
              }`}
              title="Line Chart"
            >
              <LineIcon size={13} />
              <span className="hidden xs:inline">Line</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1 px-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                chartType === 'area'
                  ? (theme === 'dark' ? 'bg-[#00ff9d] text-black' : 'bg-black text-white')
                  : 'opacity-60 hover:opacity-100'
              }`}
              title="Area Chart"
            >
              <AreaIcon size={13} />
              <span className="hidden xs:inline">Area</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[240px] w-full min-w-0 pr-4 select-none">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis 
                dataKey={labelKey} 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
              />
              <YAxis 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar 
                dataKey={activeKey || numericKeys[0]} 
                fill={theme === 'dark' ? '#00ff9d' : '#00b8ff'} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={45}
              />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis 
                dataKey={labelKey} 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
              />
              <YAxis 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line 
                type="monotone" 
                dataKey={activeKey || numericKeys[0]} 
                stroke={theme === 'dark' ? '#00ff9d' : '#00b8ff'} 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme === 'dark' ? '#00ff9d' : '#00b8ff'} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={theme === 'dark' ? '#00ff9d' : '#00b8ff'} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis 
                dataKey={labelKey} 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
              />
              <YAxis 
                stroke={theme === 'dark' ? '#888' : '#666'} 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area 
                type="monotone" 
                dataKey={activeKey || numericKeys[0]} 
                stroke={theme === 'dark' ? '#00ff9d' : '#00b8ff'} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorArea)" 
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center mt-3 text-[10px] opacity-50 font-mono">
        <span>XAxis: {labelKey}</span>
        <span>YAxis: {activeKey || numericKeys[0]} ({data.length} records)</span>
      </div>
    </div>
  );
};
