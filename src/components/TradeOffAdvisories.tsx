import React from 'react';
import { ComputedTelemetry } from '../types/mission';

interface TradeOffAdvisoriesProps {
  telemetry: ComputedTelemetry;
}

export const TradeOffAdvisories: React.FC<TradeOffAdvisoriesProps> = ({ telemetry }) => {
  return (
    <div className="bg-[#0D131F] border border-slate-800 rounded-md p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-medium tracking-wider uppercase text-slate-400">
          Systems Engineering Advisories
        </h3>
        {telemetry.launchReady ? (
          <span className="font-mono text-xs text-emerald-400">● Launch Ready</span>
        ) : (
          <span className="font-mono text-xs text-rose-400">
            ✖ {telemetry.blockingIssuesCount} Critical Risk
            {telemetry.blockingIssuesCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {telemetry.advisories.length === 0 ? (
        <div className="bg-[#080D16] border border-emerald-500/30 rounded p-3.5 text-xs text-slate-300 leading-relaxed">
          <div className="font-semibold text-emerald-400 mb-1">
            ● All Subsystems Coupled Within Margin
          </div>
          Mass, power, eclipse endurance, Deep Space Network bandwidth, thermal protection, and program budget are balanced. Ready for orbital launch simulation.
        </div>
      ) : (
        <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
          {telemetry.advisories.map((adv) => {
            const isCritical = adv.level === 'critical';
            return (
              <div
                key={adv.id}
                className={`rounded p-3 border text-xs ${
                  isCritical
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-amber-950/20 border-amber-500/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-semibold ${
                      isCritical ? 'text-rose-300' : 'text-amber-300'
                    }`}
                  >
                    {isCritical ? '✖ ' : '▲ '}
                    {adv.title}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {adv.subsystem}
                  </span>
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed">{adv.detail}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
