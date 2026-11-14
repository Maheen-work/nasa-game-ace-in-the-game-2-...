import React from 'react';
import {
  LAUNCH_VEHICLES,
  SPACECRAFT_COMPONENTS,
  TARGET_DESTINATIONS,
  TRAJECTORY_OPTIONS,
} from '../data/missionData';
import { ComputedTelemetry, MissionConfig, SubsystemCategory } from '../types/mission';

interface ControlDeckProps {
  activePhase: 'target' | 'spacecraft' | 'trajectory';
  config: MissionConfig;
  telemetry: ComputedTelemetry;
  onUpdateConfig: (updater: (prev: MissionConfig) => MissionConfig) => void;
  onAdvancePhase: (next: 'target' | 'spacecraft' | 'trajectory' | 'simulation') => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  activePhase,
  config,
  telemetry,
  onUpdateConfig,
  onAdvancePhase,
}) => {
  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];

  const byCategory = (cat: SubsystemCategory) =>
    SPACECRAFT_COMPONENTS.filter((c) => c.category === cat);

  const toggleMulti = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  if (activePhase === 'target') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-slate-200 mb-3">
            01. Destination Selection
          </h2>
          <div className="space-y-2.5">
            {TARGET_DESTINATIONS.map((dest) => {
              const selected = dest.id === config.targetId;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      targetId: dest.id,
                      objectiveId: dest.objectives[0].id,
                      budgetCapM: dest.defaultBudgetM,
                    }))
                  }
                  className={`w-full text-left p-3.5 rounded border transition-colors ${
                    selected
                      ? 'bg-[#121C2E] border-cyan-500/70'
                      : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">{dest.name}</span>
                    <span className="font-mono text-xs text-cyan-400">
                      {dest.orbitDistanceAU} AU
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{dest.subtitle}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 font-mono text-[11px] text-slate-400">
                    <span>Flux {dest.solarFluxWm2} W/m²</span>
                    <span aria-hidden="true">·</span>
                    <span>Δv {dest.requiredDeltaVKms} km/s</span>
                    <span aria-hidden="true">·</span>
                    <span>Cap ${dest.defaultBudgetM}M</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2.5">
            Primary Science Objective
          </h3>
          <div className="space-y-2">
            {target.objectives.map((obj) => {
              const selected = obj.id === config.objectiveId;
              return (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig((prev) => ({ ...prev, objectiveId: obj.id }))
                  }
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selected
                      ? 'bg-[#121C2E] border-cyan-500/70'
                      : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">{obj.title}</span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      +{obj.bonusScience} Sci
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{obj.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0B101B] border border-slate-800 rounded p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="budget-slider"
              className="text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Program Budget Cap
            </label>
            <span className="font-mono text-sm font-semibold text-cyan-300">
              ${config.budgetCapM}M
            </span>
          </div>
          <input
            id="budget-slider"
            type="range"
            min={90}
            max={420}
            step={10}
            value={config.budgetCapM}
            onChange={(e) =>
              onUpdateConfig((prev) => ({ ...prev, budgetCapM: Number(e.target.value) }))
            }
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[10px] text-slate-500 mt-1">
            <span>$90M (SmallSat)</span>
            <span>$420M (Flagship)</span>
          </div>
        </div>

        <div className="bg-[#0B101B] border border-slate-800 rounded p-3.5 text-xs text-slate-300 leading-relaxed">
          <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-400 mb-1">
            Planetary Physics Brief
          </div>
          {target.realNasaNote}
        </div>

        <button
          type="button"
          onClick={() => onAdvancePhase('spacecraft')}
          className="w-full py-2.5 px-4 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors"
        >
          Continue to Spacecraft Assembly
        </button>
      </div>
    );
  }

  if (activePhase === 'spacecraft') {
    const renderSingleGroup = (
      title: string,
      category: SubsystemCategory,
      selectedId: string,
      onSelect: (id: string) => void
    ) => (
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</h3>
        <div className="space-y-1.5">
          {byCategory(category).map((comp) => {
            const active = comp.id === selectedId;
            return (
              <button
                key={comp.id}
                type="button"
                onClick={() => onSelect(comp.id)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  active
                    ? 'bg-[#121C2E] border-cyan-500/70'
                    : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100">{comp.name}</span>
                  <span className="font-mono text-[11px] text-cyan-300 shrink-0">
                    ${comp.costM}M
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400 mt-1">
                  <span>{comp.massKg} kg</span>
                  {comp.powerGen1AUW && <span>· {comp.powerGen1AUW} W @ 1AU</span>}
                  {comp.powerGenConstantW && <span>· {comp.powerGenConstantW} W const</span>}
                  {comp.batteryWh && <span>· {comp.batteryWh} Wh</span>}
                  {comp.dataRateKbps1AU && <span>· {comp.dataRateKbps1AU} kbps @ 1AU</span>}
                  {comp.dataBufferGB && <span>· {comp.dataBufferGB} GB</span>}
                  {comp.powerDrawW > 0 && <span>· -{comp.powerDrawW} W load</span>}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{comp.tradeOffTip}</div>
              </button>
            );
          })}
        </div>
      </div>
    );

    const currentObjective =
      target.objectives.find((o) => o.id === config.objectiveId) ?? target.objectives[0];

    return (
      <div className="space-y-5">
        {renderSingleGroup('01. Power Generation', 'power', config.powerId, (id) =>
          onUpdateConfig((prev) => ({ ...prev, powerId: id }))
        )}

        {renderSingleGroup('02. Energy Storage', 'battery', config.batteryId, (id) =>
          onUpdateConfig((prev) => ({ ...prev, batteryId: id }))
        )}

        {renderSingleGroup('03. Deep Space Comms', 'comms', config.commsId, (id) =>
          onUpdateConfig((prev) => ({ ...prev, commsId: id }))
        )}

        {/* Thermal & Radiation (Multi-Toggle) */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
            04. Thermal & Radiation Shielding
          </h3>
          <div className="space-y-1.5">
            {byCategory('thermal').map((comp) => {
              const active = config.thermalIds.includes(comp.id);
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      thermalIds: toggleMulti(prev.thermalIds, comp.id),
                    }))
                  }
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    active
                      ? 'bg-[#121C2E] border-cyan-500/70'
                      : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {active ? '✓ ' : '+ '}
                      {comp.name}
                    </span>
                    <span className="font-mono text-[11px] text-cyan-300 shrink-0">
                      ${comp.costM}M
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 mt-1">
                    {comp.massKg} kg {comp.powerDrawW > 0 ? `· -${comp.powerDrawW} W` : '· Passive'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{comp.tradeOffTip}</div>
                </button>
              );
            })}
          </div>
        </div>

        {renderSingleGroup('05. Flight Avionics & Buffer', 'avionics', config.avionicsId, (id) =>
          onUpdateConfig((prev) => ({ ...prev, avionicsId: id }))
        )}

        {/* Science Payloads (Multi-Toggle) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              06. Science Payload Suite
            </h3>
            <span className="font-mono text-[11px] text-cyan-400">
              {config.instrumentIds.length} Mounted
            </span>
          </div>
          <div className="space-y-1.5">
            {byCategory('instrument').map((comp) => {
              const active = config.instrumentIds.includes(comp.id);
              const isObjectiveMatch = currentObjective.recommendedInstruments.includes(comp.id);
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      instrumentIds: toggleMulti(prev.instrumentIds, comp.id),
                    }))
                  }
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    active
                      ? 'bg-[#121C2E] border-cyan-500/70'
                      : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {active ? '✓ ' : '+ '}
                      {comp.name}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 shrink-0">
                      +{comp.scienceValue} Sci
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 mt-1">
                    {comp.massKg} kg · ${comp.costM}M · -{comp.powerDrawW} W · {comp.dataGenMBHr} MB/h
                    {isObjectiveMatch ? ' · Objective Key' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAdvancePhase('trajectory')}
          className="w-full py-2.5 px-4 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors"
        >
          Continue to Launch & Trajectory
        </button>
      </div>
    );
  }

  // Phase 3: Launch Vehicle & Trajectory
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-slate-200 mb-3">
          01. Launch Vehicle Selection
        </h2>
        <div className="space-y-2.5">
          {LAUNCH_VEHICLES.map((lv) => {
            const active = lv.id === config.launchVehicleId;
            const overCapacity = telemetry.totalMassKg > lv.maxPayloadKg;
            return (
              <button
                key={lv.id}
                type="button"
                onClick={() =>
                  onUpdateConfig((prev) => ({ ...prev, launchVehicleId: lv.id }))
                }
                className={`w-full text-left p-3.5 rounded border transition-colors ${
                  active
                    ? 'bg-[#121C2E] border-cyan-500/70'
                    : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-100">{lv.name}</span>
                  <span className="font-mono text-xs text-cyan-300">${lv.costM}M</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{lv.vehicleClass}</div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] mt-2">
                  <span className={overCapacity ? 'text-rose-400' : 'text-emerald-400'}>
                    Max {lv.maxPayloadKg} kg
                  </span>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-300">Δv {lv.deltaVAssistKms} km/s</span>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-400">{lv.fairingDiameterM}m fairing</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  {lv.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2.5">
          02. Interplanetary Transfer Trajectory
        </h3>
        <div className="space-y-2.5">
          {TRAJECTORY_OPTIONS.map((tr) => {
            const active = tr.id === config.trajectoryId;
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() =>
                  onUpdateConfig((prev) => ({ ...prev, trajectoryId: tr.id }))
                }
                className={`w-full text-left p-3.5 rounded border transition-colors ${
                  active
                    ? 'bg-[#121C2E] border-cyan-500/70'
                    : 'bg-[#0B101B] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100">{tr.name}</span>
                  <span className="font-mono text-[11px] text-cyan-300">
                    {tr.extraCostM > 0 ? `+$${tr.extraCostM}M` : 'Baseline'}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400 mt-1">
                  {tr.deltaVReductionKms > 0
                    ? `-${tr.deltaVReductionKms} km/s Δv required`
                    : 'Full Δv required'}{' '}
                  {tr.extraMassKg > 0 ? `· +${tr.extraMassKg} kg` : ''}
                  {tr.cruisePowerDrawW > 0 ? ` · -${tr.cruisePowerDrawW} W cruise` : ''}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  {tr.tradeOffTip}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdvancePhase('simulation')}
        className="w-full py-2.5 px-4 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
      >
        Launch Mission Simulation
      </button>
    </div>
  );
};
