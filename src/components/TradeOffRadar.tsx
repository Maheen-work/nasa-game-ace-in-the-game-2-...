import React from 'react';
import { ComputedTelemetry } from '../types/mission';

interface TradeOffRadarProps {
  telemetry: ComputedTelemetry;
}

export const TradeOffRadar: React.FC<TradeOffRadarProps> = ({ telemetry }) => {
  const axes = [
    { key: 'science', label: 'SCIENCE', value: telemetry.radarScores.science },
    { key: 'power', label: 'POWER', value: telemetry.radarScores.power },
    { key: 'thermalRad', label: 'ENV SAFE', value: telemetry.radarScores.thermalRad },
    { key: 'comms', label: 'COMMS', value: telemetry.radarScores.comms },
    { key: 'costEfficiency', label: 'BUDGET', value: telemetry.radarScores.costEfficiency },
  ];

  const cx = 135;
  const cy = 112;
  const radius = 72;
  const angleStep = (Math.PI * 2) / axes.length;

  const getPoint = (index: number, pct: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = (radius * pct) / 100;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const rings = [25, 50, 75, 100];
  const dataPoints = axes.map((a, idx) => getPoint(idx, a.value));
  const polygonStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="bg-[#0D131F] border border-slate-800 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium tracking-wider uppercase text-slate-400">
          Trade-Off Matrix
        </h3>
        <span className="font-mono text-xs text-cyan-400">
          Science Yield: {telemetry.rawScienceScore}/100
        </span>
      </div>

      <div className="flex items-center justify-center">
        <svg
          viewBox="0 0 270 225"
          className="w-full max-w-[260px] h-auto"
          role="img"
          aria-label="5-axis mission engineering trade-off radar chart"
        >
          {/* Concentric polygonal grid */}
          {rings.map((ring) => {
            const pts = axes
              .map((_, i) => {
                const p = getPoint(i, ring);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={ring}
                points={pts}
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
              />
            );
          })}

          {/* Radial axes */}
          {axes.map((_, idx) => {
            const outer = getPoint(idx, 100);
            return (
              <line
                key={idx}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="#1E293B"
                strokeWidth="1"
              />
            );
          })}

          {/* Active Data Polygon */}
          <polygon
            points={polygonStr}
            fill="rgba(6, 182, 212, 0.18)"
            stroke="#06B6D4"
            strokeWidth="2"
          />

          {/* Vertices */}
          {dataPoints.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="3.2"
              fill="#22D3EE"
              stroke="#07090E"
              strokeWidth="1"
            />
          ))}

          {/* Labels */}
          {axes.map((axis, idx) => {
            const labelPos = getPoint(idx, 127);
            return (
              <g key={axis.key}>
                <text
                  x={labelPos.x}
                  y={labelPos.y - 3}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94A3B8"
                  fontSize="9.5"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {axis.label}
                </text>
                <text
                  x={labelPos.x}
                  y={labelPos.y + 9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#F1F5F9"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {axis.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
