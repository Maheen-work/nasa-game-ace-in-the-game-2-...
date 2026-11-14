/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { ControlDeck } from './components/ControlDeck';
import { OrbitalSimulation } from './components/OrbitalSimulation';
import { TelemetryStrip } from './components/TelemetryStrip';
import { TradeOffAdvisories } from './components/TradeOffAdvisories';
import { TradeOffRadar } from './components/TradeOffRadar';
import { DEFAULT_CONFIG, SCENARIO_PRESETS } from './data/missionData';
import { computeMissionTelemetry } from './engine/systemsPhysics';
import { MissionConfig, PhaseId } from './types/mission';

const PHASES: { id: PhaseId; label: string }[] = [
  { id: 'target', label: 'Target' },
  { id: 'spacecraft', label: 'Spacecraft' },
  { id: 'trajectory', label: 'Trajectory' },
  { id: 'simulation', label: 'Simulation' },
];

export default function App() {
  const [activePhase, setActivePhase] = useState<PhaseId>('spacecraft');
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_CONFIG);
  const [activePresetId, setActivePresetId] = useState<string>(SCENARIO_PRESETS[0].id);

  const telemetry = useMemo(() => computeMissionTelemetry(config), [config]);

  const handleSelectPreset = (presetId: string) => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setConfig(preset.config);
    setActivePresetId(preset.id);
    if (activePhase === 'simulation') {
      setActivePhase('spacecraft');
    }
  };

  const handleUpdateConfig = (updater: (prev: MissionConfig) => MissionConfig) => {
    setActivePresetId('');
    setConfig(updater);
  };

  const handleLaunchClick = () => {
    setActivePhase('simulation');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="border-b border-slate-800 bg-[#0A0E17]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActivePhase('spacecraft');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            Mission Architect
          </a>

          {/* Zone 2: 4 single-line phase navigation links */}
          <nav aria-label="Mission Phases" className="hidden md:flex items-center gap-6">
            {PHASES.map((phase, idx) => {
              const isActive = activePhase === phase.id;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setActivePhase(phase.id)}
                  className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-cyan-300 border-cyan-400'
                      : 'text-slate-400 border-transparent hover:text-slate-100'
                  }`}
                >
                  {idx + 1}. {phase.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {activePhase === 'simulation' ? (
              <button
                type="button"
                onClick={() => setActivePhase('spacecraft')}
                className="px-4 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Edit Spacecraft
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunchClick}
                className="px-4 py-2 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                Launch Mission
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Workspace Scenario Preset Strip + Mobile Phase Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#0D131F] border border-slate-800 rounded-md px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 mr-1">
              Scenarios:
            </span>
            {SCENARIO_PRESETS.map((preset) => {
              const active = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  title={preset.summary}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300 font-medium'
                      : 'bg-[#090D16] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3">
            {/* Mobile phase switcher */}
            <div className="flex md:hidden items-center gap-1 overflow-x-auto">
              {PHASES.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setActivePhase(phase.id)}
                  className={`px-2.5 py-1 text-xs rounded whitespace-nowrap shrink-0 ${
                    activePhase === phase.id
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400'
                  }`}
                >
                  {phase.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSelectPreset(SCENARIO_PRESETS[0].id)}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Live Coupled Systems Telemetry Strip */}
        <TelemetryStrip telemetry={telemetry} />

        {/* Phase View */}
        {activePhase === 'simulation' ? (
          <OrbitalSimulation
            config={config}
            telemetry={telemetry}
            onReturnToBuilder={(phase) => setActivePhase(phase ?? 'spacecraft')}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Engineering Control Column */}
            <aside className="lg:col-span-4 xl:col-span-4 bg-[#0D131F] border border-slate-800 rounded-md p-4 lg:max-h-[720px] lg:overflow-y-auto">
              <div className="flex items-center gap-1 p-1 bg-[#080C14] border border-slate-800 rounded mb-4">
                {(['target', 'spacecraft', 'trajectory'] as const).map((tabId, idx) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActivePhase(tabId)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      activePhase === tabId
                        ? 'bg-slate-800 text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {idx + 1}. {tabId === 'target' ? 'Target' : tabId === 'spacecraft' ? 'Bus' : 'Launch'}
                  </button>
                ))}
              </div>

              <ControlDeck
                activePhase={activePhase}
                config={config}
                telemetry={telemetry}
                onUpdateConfig={handleUpdateConfig}
                onAdvancePhase={(next) => setActivePhase(next)}
              />
            </aside>

            {/* Right Interactive Blueprint + Trade-Off Matrix */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-4">
              <BlueprintCanvas
                config={config}
                telemetry={telemetry}
                onSelectPhase={(p) => setActivePhase(p)}
              />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                <div className="md:col-span-5">
                  <TradeOffRadar telemetry={telemetry} />
                </div>
                <div className="md:col-span-7 flex">
                  <div className="w-full flex flex-col">
                    <TradeOffAdvisories telemetry={telemetry} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
