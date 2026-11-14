import React from 'react';
import { ComputedTelemetry, StatusLevel } from '../types/mission';

interface TelemetryStripProps {
  telemetry: ComputedTelemetry;
}

function StatusGlyph({ status, label }: { status: StatusLevel; label?: string }) {
  if (status === 'nominal') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
        <span aria-hidden="true">●</span>
        <span>{label ?? 'Nominal'}</span>
      </span>
    );
  }
  if (status === 'marginal') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400">
        <span aria-hidden="true">▲</span>
        <span>{label ?? 'Marginal'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-rose-400">
      <span aria-hidden="true">✖</span>
      <span>{label ?? 'Critical'}</span>
    </span>
  );
}

function barColor(status: StatusLevel) {
  if (status === 'nominal') return 'bg-cyan-400';
  if (status === 'marginal') return 'bg-amber-400';
  return 'bg-rose-500';
}

export const TelemetryStrip: React.FC<TelemetryStripProps> = ({ telemetry }) => {
  const massPct = Math.min(100, Math.round((telemetry.totalMassKg / telemetry.payloadLimitKg) * 100));
  const powerPct =
    telemetry.powerDrawW > 0
      ? Math.min(100, Math.round((telemetry.sunlitPowerGenW / telemetry.powerDrawW) * 50))
      : 100;
  const costPct = Math.min(100, Math.round((telemetry.totalCostM / telemetry.budgetCapM) * 100));
  const commsRatio =
    telemetry.scienceGenMBHr > 0
      ? Math.min(100, Math.round((telemetry.downlinkMBHr / telemetry.scienceGenMBHr) * 50))
      : 100;

  return (
    <section
      aria-label="Coupled Systems Telemetry"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
    >
      {/* Mass */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-md p-3.5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wider uppercase text-slate-400">
            Launch Mass
          </span>
          <StatusGlyph status={telemetry.massStatus} />
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-mono font-semibold text-slate-100">
              {telemetry.totalMassKg}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">
              / {telemetry.payloadLimitKg} kg
            </span>
          </div>
          <span
            className={`text-xs font-mono ${
              telemetry.massMarginKg < 0 ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            {telemetry.massMarginKg >= 0
              ? `+${telemetry.massMarginKg} kg margin`
              : `${telemetry.massMarginKg} kg over`}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/90 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${barColor(telemetry.massStatus)}`}
            style={{ width: `${massPct}%` }}
          />
        </div>
      </div>

      {/* Power & Eclipse */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-md p-3.5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wider uppercase text-slate-400">
            Power Balance
          </span>
          <StatusGlyph status={telemetry.powerStatus} />
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span
              className={`text-2xl font-mono font-semibold ${
                telemetry.netSunlitPowerW < 0 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {telemetry.netSunlitPowerW >= 0
                ? `+${telemetry.netSunlitPowerW}`
                : telemetry.netSunlitPowerW}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">W net</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {telemetry.eclipseSurvivalMinutes >= 999
              ? 'Eclipse ∞'
              : `Eclipse ${telemetry.eclipseSurvivalMinutes}m`}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/90 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${barColor(telemetry.powerStatus)}`}
            style={{ width: `${powerPct}%` }}
          />
        </div>
      </div>

      {/* Data Link & Buffer */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-md p-3.5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wider uppercase text-slate-400">
            DSN Downlink
          </span>
          <StatusGlyph status={telemetry.commsStatus} />
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-mono font-semibold text-slate-100">
              {telemetry.downlinkKbps}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">kbps</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {telemetry.netBufferFillMBHr > 0
              ? `+${telemetry.netBufferFillMBHr} MB/h backlog`
              : `${telemetry.downlinkMBHr} MB/h clear`}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/90 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${barColor(telemetry.commsStatus)}`}
            style={{ width: `${commsRatio}%` }}
          />
        </div>
      </div>

      {/* Budget & Delta-V */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-md p-3.5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wider uppercase text-slate-400">
            Mission Cost
          </span>
          <StatusGlyph
            status={
              telemetry.costStatus === 'critical' || telemetry.deltaVStatus === 'critical'
                ? 'critical'
                : telemetry.costStatus === 'marginal' || telemetry.deltaVStatus === 'marginal'
                  ? 'marginal'
                  : 'nominal'
            }
            label={telemetry.deltaVStatus === 'critical' ? 'Low Δv' : undefined}
          />
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-mono font-semibold text-slate-100">
              ${telemetry.totalCostM}M
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">
              / ${telemetry.budgetCapM}M
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Δv {telemetry.effectiveDeltaVKms}/{telemetry.requiredDeltaVKms} km/s
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/90 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${barColor(telemetry.costStatus)}`}
            style={{ width: `${costPct}%` }}
          />
        </div>
      </div>
    </section>
  );
};
