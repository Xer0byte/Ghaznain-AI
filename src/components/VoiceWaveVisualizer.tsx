import React, { useEffect, useState } from 'react';

interface VoiceWaveVisualizerProps {
  theme: 'light' | 'dark';
}

export function VoiceWaveVisualizer({ theme }: VoiceWaveVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(18).fill(30));

  useEffect(() => {
    // Generate organic undulating waves using standard JS intervals combined with spring feel
    const interval = setInterval(() => {
      setBars(prev =>
        prev.map((_, idx) => {
          const time = Date.now() / 150;
          // Create sinusoidal group behavior
          const multiplier = Math.sin(time + idx * 0.4) * 0.5 + 0.5;
          const randomNoise = Math.random() * 30;
          const height = 15 + (multiplier * 50) + randomNoise;
          return Math.max(8, Math.min(85, height));
        })
      );
    }, 70);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-[4px] px-4 py-2 border rounded-2xl animate-fade-in ${
      theme === 'dark' 
        ? 'bg-neutral-900/90 border-[#333] shadow-[0_0_20px_rgba(0,0,0,0.8)]' 
        : 'bg-white/95 border-neutral-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)]'
    }`}>
      <div className="flex items-center gap-2 mr-3 border-r pr-3 border-neutral-700/30">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className={`text-[10px] uppercase tracking-wider font-bold font-mono ${theme === 'dark' ? 'text-white/70' : 'text-neutral-700'}`}>
          Voice Agent Active
        </span>
      </div>

      <div className="flex items-center gap-[3px] h-8 w-44 justify-center">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all duration-[70ms] ease-out ${
              theme === 'dark'
                ? 'bg-gradient-to-t from-[#00ff9d] via-cyan-400 to-[#00ff9d]/80 shadow-[0_0_8px_rgba(0,255,157,0.5)]'
                : 'bg-gradient-to-t from-emerald-600 via-teal-500 to-cyan-500 shadow-[0_0_6px_rgba(5,150,105,0.3)]'
            }`}
            style={{ 
              height: `${height}%`
            }}
          />
        ))}
      </div>

      <div className={`text-[8px] font-mono tracking-tight ml-3 border-l pl-3 border-neutral-700/30 uppercase ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
        44.1 kHz
      </div>
    </div>
  );
}
