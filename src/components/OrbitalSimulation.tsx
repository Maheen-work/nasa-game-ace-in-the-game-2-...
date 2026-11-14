import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LAUNCH_VEHICLES,
  TARGET_DESTINATIONS,
  TRAJECTORY_OPTIONS,
} from '../data/missionData';
import { generateCrisisEvents, generateMishapReport } from '../engine/systemsPhysics';
import {
  ComputedTelemetry,
  CrisisEvent,
  MishapReport,
  MissionConfig,
  SimTelemetryPoint,
} from '../types/mission';
import {
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react';

interface OrbitalSimulationProps {
  config: MissionConfig;
  telemetry: ComputedTelemetry;
  onReturnToBuilder: (phase?: 'target' | 'spacecraft' | 'trajectory') => void;
}

export const OrbitalSimulation: React.FC<OrbitalSimulationProps> = ({
  config,
  telemetry,
  onReturnToBuilder,
}) => {
  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];
  const launchVehicle =
    LAUNCH_VEHICLES.find((lv) => lv.id === config.launchVehicleId) ?? LAUNCH_VEHICLES[1];
  const trajectory =
    TRAJECTORY_OPTIONS.find((tr) => tr.id === config.trajectoryId) ?? TRAJECTORY_OPTIONS[0];

  const crisisEvents = useMemo(
    () => generateCrisisEvents(config, telemetry),
    [config, telemetry]
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [progress, setProgress] = useState(0); // 0 to 100
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 4>(1);
  const [activeCrisisIndex, setActiveCrisisIndex] = useState<number | null>(null);
  const [resolvedCrises, setResolvedCrises] = useState<number[]>([]);

  const [batteryPct, setBatteryPct] = useState(100);
  const [bufferPct, setBufferPct] = useState(8);
  const [coreTempC, setCoreTempC] = useState(22);
  const [healthPct, setHealthPct] = useState(100);
  const [scienceCollected, setScienceCollected] = useState(0);
  const [points, setPoints] = useState<SimTelemetryPoint[]>([
    { step: 0, timeLabel: 'T+00', batteryPct: 100, bufferPct: 8, coreTempC: 22, scienceCollected: 0 },
  ]);
  const [logs, setLogs] = useState<string[]>([
    `T+00:00 — ${launchVehicle.name} cleared for liftoff toward ${target.name}.`,
  ]);
  const [report, setReport] = useState<MishapReport | null>(null);

  // Refs for simulation loop
  const simStateRef = useRef({
    progress: 0,
    batteryPct: 100,
    bufferPct: 8,
    coreTempC: 22,
    peakTempC: 22,
    minTempC: 22,
    healthPct: 100,
    scienceCollected: 0,
    failedStage: null as string | null,
    failureReason: null as string | null,
    logs: [`T+00:00 — ${launchVehicle.name} cleared for liftoff toward ${target.name}.`],
    resolvedCrises: new Set<number>(),
    lastTickProgress: -1,
  });

  const resetSimulation = () => {
    simStateRef.current = {
      progress: 0,
      batteryPct: 100,
      bufferPct: 8,
      coreTempC: 22,
      peakTempC: 22,
      minTempC: 22,
      healthPct: 100,
      scienceCollected: 0,
      failedStage: null,
      failureReason: null,
      logs: [`T+00:00 — ${launchVehicle.name} cleared for liftoff toward ${target.name}.`],
      resolvedCrises: new Set<number>(),
      lastTickProgress: -1,
    };
    setProgress(0);
    setBatteryPct(100);
    setBufferPct(8);
    setCoreTempC(22);
    setHealthPct(100);
    setScienceCollected(0);
    setActiveCrisisIndex(null);
    setResolvedCrises([]);
    setReport(null);
    setPoints([
      {
        step: 0,
        timeLabel: 'T+00',
        batteryPct: 100,
        bufferPct: 8,
        coreTempC: 22,
        scienceCollected: 0,
      },
    ]);
    setLogs(simStateRef.current.logs);
    setIsPlaying(true);
  };

  // Triggered when config changes
  useEffect(() => {
    resetSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const finishMission = (st: typeof simStateRef.current) => {
    setIsPlaying(false);
    const finalReport = generateMishapReport(config, telemetry, {
      finalBatteryPct: st.batteryPct,
      finalBufferPct: st.bufferPct,
      peakTempC: st.peakTempC,
      minTempC: st.minTempC,
      finalHealthPct: st.healthPct,
      scienceCollected: st.scienceCollected,
      failedStage: st.failedStage,
      failureReason: st.failureReason,
      logs: st.logs,
    });
    setReport(finalReport);
  };

  // Simulation Ticker
  useEffect(() => {
    if (!isPlaying || activeCrisisIndex !== null || report !== null) return;

    const interval = setInterval(() => {
      const st = simStateRef.current;
      const stepIncrement = 0.8 * speedMultiplier;
      const nextProgress = Math.min(100, st.progress + stepIncrement);
      st.progress = nextProgress;

      const stage =
        nextProgress < 22 ? 'Ascent' : nextProgress < 58 ? 'Cruise' : 'Orbit Ops';

      // Check Ascent Payload Overload failure at progress ~14%
      if (nextProgress >= 14 && telemetry.massStatus === 'critical' && !st.failedStage) {
        st.failedStage = 'Ascent';
        st.healthPct = 0;
        st.failureReason = `Launch vehicle structural failure at Max-Q (${telemetry.totalMassKg} kg exceeded ${telemetry.payloadLimitKg} kg fairing limit).`;
        st.logs = [...st.logs, `T+00:02 — CRITICAL: Max-Q payload structural overload! Ascent aborted.`];
        setLogs(st.logs);
        setHealthPct(0);
        setProgress(nextProgress);
        finishMission(st);
        return;
      }

      // Check Delta-V miss at Orbit Insertion ~58%
      if (nextProgress >= 58 && telemetry.deltaVStatus === 'critical' && !st.failedStage) {
        st.failedStage = 'Orbit Insertion';
        st.healthPct = 15;
        st.failureReason = `Insufficient capture Δv (${telemetry.effectiveDeltaVKms} vs ${telemetry.requiredDeltaVKms} km/s required). Probe missed ${target.name}.`;
        st.logs = [
          ...st.logs,
          `T+${Math.round(target.cruiseDaysDirect * 0.6)}d — CRITICAL: Capture burn Δv shortfall. Hyperbolic flyby lost in space.`,
        ];
        setLogs(st.logs);
        setHealthPct(15);
        setProgress(nextProgress);
        finishMission(st);
        return;
      }

      // Dynamic physical telemetry evolution per tick
      const inEclipse = nextProgress >= 68 && nextProgress <= 82;
      let dBat = 0;
      if (stage === 'Orbit Ops' && inEclipse) {
        if (config.powerId === 'rtg') {
          dBat = 0.4;
        } else {
          const drainRate =
            (target.eclipseMinutes / Math.max(12, telemetry.eclipseSurvivalMinutes)) * 3.8;
          dBat = -drainRate * speedMultiplier;
        }
      } else if (telemetry.netSunlitPowerW < 0) {
        dBat = -2.2 * speedMultiplier;
      } else {
        dBat = 1.6 * speedMultiplier;
      }
      st.batteryPct = Math.max(0, Math.min(100, st.batteryPct + dBat));

      // Temperature evolution
      const hasHeaters =
        config.powerId === 'rtg' || config.thermalIds.includes('therm-heaters');
      const hasRadiators = config.thermalIds.includes('therm-radiators');
      let targetTemp = 20;
      if (stage === 'Cruise' && trajectory.innerSolarPassAU < 0.8) {
        targetTemp = hasRadiators ? 44 : 132;
      } else if (stage === 'Cruise' || stage === 'Orbit Ops') {
        if (config.powerId === 'rtg' && target.orbitDistanceAU <= 1.1 && !hasRadiators) {
          targetTemp = 122;
        } else if (target.tempMinC <= -150 && !hasHeaters) {
          targetTemp = -68;
        } else if (inEclipse) {
          targetTemp = hasHeaters ? 4 : -26;
        } else {
          targetTemp = 18;
        }
      }
      st.coreTempC += (targetTemp - st.coreTempC) * 0.14;
      st.peakTempC = Math.max(st.peakTempC, st.coreTempC);
      st.minTempC = Math.min(st.minTempC, st.coreTempC);

      // Buffer fill during Orbit Ops
      if (stage === 'Orbit Ops') {
        const netFillRatio =
          telemetry.netBufferFillMBHr > 0
            ? Math.min(4.2, 0.8 + telemetry.netBufferFillMBHr * 0.45)
            : 0.35;
        st.bufferPct = Math.min(100, Math.max(2, st.bufferPct + netFillRatio * 0.65 * speedMultiplier));
        st.scienceCollected = Math.min(
          100,
          st.scienceCollected + (telemetry.rawScienceScore / 34) * speedMultiplier * 0.85
        );
      }

      // Radiation / Thermal Health Check
      if (stage === 'Orbit Ops' && telemetry.radiationStatus === 'critical') {
        st.healthPct = Math.max(0, st.healthPct - 2.4 * speedMultiplier);
      }
      if (st.coreTempC > 110 || st.coreTempC < -48) {
        st.healthPct = Math.max(0, st.healthPct - 3.0 * speedMultiplier);
      }

      // Milestone logs
      const intProg = Math.floor(nextProgress);
      if (intProg !== st.lastTickProgress) {
        st.lastTickProgress = intProg;
        if (intProg === 22) {
          st.logs = [
            ...st.logs,
            `T+00:11 — Orbital insertion nominal. Deploying solar/antenna booms for ${trajectory.name}.`,
          ];
        } else if (intProg === 58) {
          st.logs = [
            ...st.logs,
            `Arrival at ${target.name}! Capture burn complete. Commencing science operations.`,
          ];
        } else if (intProg === 68) {
          st.logs = [
            ...st.logs,
            `Entering ${target.name} umbral eclipse (${target.eclipseMinutes} min shadow).`,
          ];
        }
      }

      // Trigger Interactive Crisis Events at 36%, 72%, 86%
      const triggerPoints = [36, 72, 86];
      for (let i = 0; i < triggerPoints.length; i++) {
        if (nextProgress >= triggerPoints[i] && !st.resolvedCrises.has(i) && crisisEvents[i]) {
          st.resolvedCrises.add(i);
          setResolvedCrises(Array.from(st.resolvedCrises));
          setActiveCrisisIndex(i);
          break;
        }
      }

      // Immediate Battery / Health Fatal Check
      if (st.batteryPct <= 0 && !st.failedStage) {
        st.failedStage = stage;
        st.failureReason = `Battery depleted to 0% during ${stage}. Bus computers browned out.`;
        st.logs = [...st.logs, `CRITICAL: Main bus voltage collapse (0% battery). Signal lost.`];
        setLogs(st.logs);
        setBatteryPct(0);
        setProgress(nextProgress);
        finishMission(st);
        return;
      }

      if (st.healthPct <= 10 && !st.failedStage) {
        st.failedStage = stage;
        st.failureReason = `Severe environmental damage reduced spacecraft health below survival threshold.`;
        st.logs = [...st.logs, `CRITICAL: Multiple hardware faults triggered permanent safe-mode loss.`];
        setLogs(st.logs);
        setHealthPct(Math.round(st.healthPct));
        setProgress(nextProgress);
        finishMission(st);
        return;
      }

      // Update React UI states
      setProgress(nextProgress);
      setBatteryPct(Math.round(st.batteryPct));
      setBufferPct(Math.round(st.bufferPct));
      setCoreTempC(Math.round(st.coreTempC));
      setHealthPct(Math.round(st.healthPct));
      setScienceCollected(Math.round(st.scienceCollected));
      setLogs(st.logs);

      setPoints((prev) => {
        const nextPt: SimTelemetryPoint = {
          step: prev.length,
          timeLabel: `${Math.round(nextProgress)}%`,
          batteryPct: Math.round(st.batteryPct),
          bufferPct: Math.round(st.bufferPct),
          coreTempC: Math.round(st.coreTempC),
          scienceCollected: Math.round(st.scienceCollected),
        };
        return [...prev.slice(-45), nextPt];
      });

      if (nextProgress >= 100) {
        finishMission(st);
      }
    }, 140);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeCrisisIndex, report, speedMultiplier, crisisEvents]);

  const handleCrisisChoice = (option: CrisisEvent['options'][number]) => {
    if (activeCrisisIndex === null) return;
    const ev = crisisEvents[activeCrisisIndex];
    const st = simStateRef.current;

    st.batteryPct = Math.max(0, Math.min(100, st.batteryPct + option.batteryDelta));
    st.bufferPct = Math.max(2, Math.min(100, st.bufferPct + option.bufferDelta));
    st.coreTempC += option.tempDelta;
    st.peakTempC = Math.max(st.peakTempC, st.coreTempC);
    st.minTempC = Math.min(st.minTempC, st.coreTempC);
    st.scienceCollected = Math.max(0, Math.min(100, st.scienceCollected + option.scienceDelta));
    st.healthPct = Math.max(0, Math.min(100, st.healthPct + option.healthDelta));
    st.logs = [
      ...st.logs,
      `FLIGHT CMD [${ev.title}]: Executed "${option.label}" (${option.effectSummary}).`,
    ];

    setBatteryPct(Math.round(st.batteryPct));
    setBufferPct(Math.round(st.bufferPct));
    setCoreTempC(Math.round(st.coreTempC));
    setScienceCollected(Math.round(st.scienceCollected));
    setHealthPct(Math.round(st.healthPct));
    setLogs(st.logs);
    setActiveCrisisIndex(null);
  };

  // Animated Orbital / Ascent / Target Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let rafId = 0;
    const draw = (now: number) => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, rect.width);
      const h = Math.max(300, rect.height);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Background subtle starfield
      ctx.fillStyle = '#070A12';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 42; i++) {
        const sx = ((i * 197.3) % 1) * w;
        const sy = ((i * 311.7) % 1) * h;
        ctx.fillStyle = i % 4 === 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(248, 250, 252, 0.28)';
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      const t = now / 1000;
      const p = progress;

      if (p < 22) {
        // STAGE 1: LAUNCH & ASCENT
        const frac = p / 22;
        const groundY = h - 38;
        const skyGrad = ctx.createLinearGradient(0, groundY - 120, 0, groundY);
        skyGrad.addColorStop(0, 'rgba(14, 116, 144, 0)');
        skyGrad.addColorStop(1, 'rgba(14, 116, 144, 0.24)');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, groundY - 120, w, 120);

        // Pad & Tower
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, groundY, w, 38);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.5 - 38, groundY - 96, 18, 96);

        // Rocket climbing
        const rocketY = groundY - 24 - frac * (h - 110);
        const rocketX = w * 0.5 + Math.sin(t * 18) * (telemetry.massStatus === 'critical' ? 2.8 : 0.6);

        // Exhaust plume
        const plumeH = 38 + Math.sin(t * 25) * 8;
        const plumeGrad = ctx.createLinearGradient(rocketX, rocketY, rocketX, rocketY + plumeH);
        plumeGrad.addColorStop(0, '#FDE047');
        plumeGrad.addColorStop(0.5, '#F97316');
        plumeGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = plumeGrad;
        ctx.beginPath();
        ctx.moveTo(rocketX - 8, rocketY);
        ctx.lineTo(rocketX + 8, rocketY);
        ctx.lineTo(rocketX, rocketY + plumeH);
        ctx.closePath();
        ctx.fill();

        // Rocket Body
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(rocketX - 8, rocketY - 62, 16, 62);
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.moveTo(rocketX - 8, rocketY - 62);
        ctx.lineTo(rocketX + 8, rocketY - 62);
        ctx.lineTo(rocketX, rocketY - 82);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(
          `STAGE 1 ASCENT · ALT ${Math.round(frac * 185)} km · VEL ${(frac * 7.8).toFixed(1)} km/s`,
          16,
          24
        );
      } else if (p < 58) {
        // STAGE 2: INTERPLANETARY CRUISE
        const frac = (p - 22) / 36;
        const sunX = w * 0.3;
        const sunY = h * 0.52;

        // Sun glow
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 42);
        sunGrad.addColorStop(0, '#FEF08A');
        sunGrad.addColorStop(0.4, '#F59E0B');
        sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
        ctx.fill();

        // Planetary Orbit Rings
        const orbits = [
          { r: 46, color: 'rgba(251, 191, 36, 0.2)', label: 'Venus' },
          { r: 74, color: 'rgba(56, 189, 248, 0.35)', label: 'Earth' },
          { r: 108, color: 'rgba(249, 115, 22, 0.28)', label: 'Mars' },
          { r: 148, color: 'rgba(148, 163, 184, 0.22)', label: 'Psyche' },
          { r: 210, color: 'rgba(226, 232, 240, 0.28)', label: 'Europa / Jupiter' },
        ];
        orbits.forEach((o) => {
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sunX, sunY, o.r, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Earth position
        const earthPos = { x: sunX + 74, y: sunY };
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(earthPos.x, earthPos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Target radius
        const targetRadiusMap: Record<string, number> = {
          moon: 82,
          mars: 108,
          asteroid: 148,
          europa: 210,
        };
        const tr = targetRadiusMap[target.id] ?? 108;
        const targetAngle = target.id === 'moon' ? -0.15 : -0.65;
        const destPos = {
          x: sunX + tr * Math.cos(targetAngle),
          y: sunY + tr * Math.sin(targetAngle),
        };
        ctx.fillStyle = target.colorHex;
        ctx.beginPath();
        ctx.arc(destPos.x, destPos.y, target.id === 'europa' ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(target.name, destPos.x + 12, destPos.y + 4);

        // Transfer Arc (Hohmann or VEGA inner dip)
        const ctrlX =
          trajectory.id === 'vega' ? sunX - 24 : (earthPos.x + destPos.x) * 0.5 + 35;
        const ctrlY =
          trajectory.id === 'vega' ? sunY + 55 : (earthPos.y + destPos.y) * 0.5 - 45;

        ctx.strokeStyle = '#22D3EE';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(earthPos.x, earthPos.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, destPos.x, destPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Probe interpolated along quadratic Bezier
        const u = 1 - frac;
        const px = u * u * earthPos.x + 2 * u * frac * ctrlX + frac * frac * destPos.x;
        const py = u * u * earthPos.y + 2 * u * frac * ctrlY + frac * frac * destPos.y;

        // Comms beam back to Earth
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(earthPos.x, earthPos.y);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Spacecraft marker
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(
          `STAGE 2 CRUISE · ${trajectory.name.toUpperCase()} · ${Math.round(
            frac * target.cruiseDaysDirect * trajectory.cruiseTimeMultiplier
          )} DAYS ELAPSED`,
          16,
          24
        );
      } else {
        // STAGE 3: TARGET ORBIT & ECLIPSE OPS
        const frac = (p - 58) / 42;
        const cx = w * 0.5;
        const cy = h * 0.52;
        const planetR = 46;
        const orbitRx = 148;
        const orbitRy = 68;

        // Planetary Eclipse Shadow cone to the right
        const shadowGrad = ctx.createLinearGradient(cx, cy, cx + w * 0.45, cy);
        shadowGrad.addColorStop(0, 'rgba(2, 6, 23, 0.92)');
        shadowGrad.addColorStop(1, 'rgba(2, 6, 23, 0.2)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(cx, cy - planetR, w * 0.5, planetR * 2);

        // Orbit Ring
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitRx, orbitRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Target Planet Body
        ctx.fillStyle = target.colorHex;
        ctx.beginPath();
        ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
        ctx.fill();

        // Night-side terminator shading on planet
        ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
        ctx.beginPath();
        ctx.arc(cx, cy, planetR, -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        // Orbiting Probe
        const angle = -Math.PI * 0.4 + frac * Math.PI * 2.2;
        const px = cx + orbitRx * Math.cos(angle);
        const py = cy + orbitRy * Math.sin(angle);
        const inShadow = px > cx && Math.abs(py - cy) < planetR;

        // Radar scan cone onto surface
        if (config.instrumentIds.length > 0 && !inShadow) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx - 12, cy - 12);
          ctx.lineTo(cx + 12, cy + 12);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = inShadow ? '#F59E0B' : '#22D3EE';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = inShadow ? '#FBBF24' : '#94A3B8';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(
          inShadow
            ? `STAGE 3 ORBIT OPS · UMBRAL ECLIPSE SHADOW (SOLAR 0 W)`
            : `STAGE 3 ORBIT OPS · ${target.name.toUpperCase()} SCIENCE PASS`,
          16,
          24
        );
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [progress, target, trajectory, config.instrumentIds.length, telemetry.massStatus]);

  // SVG Waveform Chart
  const buildPolyline = (getter: (pt: SimTelemetryPoint) => number, maxVal = 100, minVal = 0) => {
    if (points.length < 2) return '';
    return points
      .map((pt, i) => {
        const x = (i / Math.max(1, points.length - 1)) * 420;
        const norm = (getter(pt) - minVal) / (maxVal - minVal);
        const y = 94 - Math.max(0, Math.min(1, norm)) * 82;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-4">
      {/* Top Playback & Telemetry Bar */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={report !== null || activeCrisisIndex !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  speedMultiplier === spd
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetSimulation}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>
        </div>

        {/* Live Telemetry Counters */}
        <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
          <div>
            <span className="text-slate-400 mr-1.5">BATTERY</span>
            <span className={batteryPct < 25 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {batteryPct}%
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">BUFFER</span>
            <span className={bufferPct > 85 ? 'text-amber-400 font-semibold' : 'text-cyan-300 font-semibold'}>
              {bufferPct}%
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">CORE TEMP</span>
            <span
              className={
                coreTempC > 95 || coreTempC < -35
                  ? 'text-rose-400 font-semibold'
                  : 'text-slate-100 font-semibold'
              }
            >
              {coreTempC}°C
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">HEALTH</span>
            <span className={healthPct < 50 ? 'text-rose-400 font-semibold' : 'text-slate-100 font-semibold'}>
              {healthPct}%
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">SCIENCE</span>
            <span className="text-cyan-400 font-semibold">{scienceCollected}%</span>
          </div>
        </div>
      </div>

      {/* Main Simulation Stage + Crisis / Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Animated Orbital Canvas + Live Time-Series Graph */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div
            ref={containerRef}
            className="relative h-[320px] bg-[#070A12] border border-slate-800 rounded-md overflow-hidden"
          >
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute bottom-3 left-3 right-3 h-1.5 bg-slate-800/80 rounded-sm overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Live Dual-Channel Telemetry Graph */}
          <div className="bg-[#0D131F] border border-slate-800 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Real-Time Bus Telemetry
              </h3>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="text-emerald-400">― Battery %</span>
                <span className="text-amber-400">― Data Buffer %</span>
                <span className="text-cyan-400">- - Science %</span>
              </div>
            </div>
            <svg viewBox="0 0 420 105" className="w-full h-28 bg-[#070A12] border border-slate-800/80 rounded">
              <line x1="0" y1="26" x2="420" y2="26" stroke="#1E293B" strokeDasharray="3 3" />
              <line x1="0" y1="53" x2="420" y2="53" stroke="#1E293B" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="420" y2="80" stroke="#1E293B" strokeDasharray="3 3" />
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                points={buildPolyline((pt) => pt.batteryPct)}
              />
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                points={buildPolyline((pt) => pt.bufferPct)}
              />
              <polyline
                fill="none"
                stroke="#06B6D4"
                strokeWidth="1.8"
                strokeDasharray="4 3"
                points={buildPolyline((pt) => pt.scienceCollected)}
              />
            </svg>
          </div>
        </div>

        {/* Right: Active Crisis Decision OR Post-Mission Report OR Flight Log */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {activeCrisisIndex !== null && crisisEvents[activeCrisisIndex] ? (
            <div className="bg-[#131B2B] border border-amber-500/60 rounded-md p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Live Anomaly · {crisisEvents[activeCrisisIndex].stage}</span>
                </div>
                <h3 className="text-lg font-display font-semibold text-slate-100 mb-2">
                  {crisisEvents[activeCrisisIndex].title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {crisisEvents[activeCrisisIndex].description}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Select Flight Control Command
                </div>
                {crisisEvents[activeCrisisIndex].options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCrisisChoice(opt)}
                    className="w-full text-left p-3.5 rounded bg-[#0B101B] border border-slate-700 hover:border-cyan-400 transition-colors"
                  >
                    <div className="text-sm font-semibold text-slate-100">{opt.label}</div>
                    <div className="text-xs font-mono text-cyan-300 mt-1">{opt.effectSummary}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : report ? (
            <div
              className={`bg-[#0D131F] border rounded-md p-5 flex flex-col gap-4 ${
                report.outcome === 'triumph'
                  ? 'border-emerald-500/50'
                  : report.outcome === 'partial'
                    ? 'border-amber-500/50'
                    : 'border-rose-500/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider mb-1 ${
                      report.outcome === 'triumph'
                        ? 'text-emerald-400'
                        : report.outcome === 'partial'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {report.outcome === 'triumph' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : report.outcome === 'partial' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span>
                      {report.outcome === 'triumph'
                        ? 'Mission Triumph'
                        : report.outcome === 'partial'
                          ? 'Partial Science Return'
                          : 'Mishap Investigation Board'}
                    </span>
                  </div>
                  <h3 className="text-lg font-display font-semibold text-slate-100">
                    {report.headline}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">Grade</div>
                  <div className="text-2xl font-display font-bold text-cyan-400">
                    {report.missionGrade}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block">SCIENCE RETURNED</span>
                  <span className="text-base font-semibold text-slate-100">
                    {report.scienceDeliveredPct}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">DATA LOST / OVERFLOW</span>
                  <span
                    className={`text-base font-semibold ${
                      report.dataLostMB > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {report.dataLostMB} MB
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Root Cause Finding
                </div>
                <div className="text-sm font-semibold text-slate-100 mb-1">
                  {report.rootCauseTitle}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {report.rootCauseSummary}
                </p>
              </div>

              <div className="bg-[#080C14] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 mb-1">
                  Real NASA Parallel
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{report.historicalParallel}</p>
              </div>

              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Engineering Recommendations
                </div>
                <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                  {report.correctiveActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onReturnToBuilder('spacecraft')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Modify Spacecraft</span>
                </button>
                <button
                  type="button"
                  onClick={resetSimulation}
                  className="px-4 py-2.5 text-xs font-medium rounded border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Re-Fly
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0D131F] border border-slate-800 rounded-md p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Deep Space Network Flight Log
                </h3>
                <span className="text-xs font-mono text-cyan-400">{Math.round(progress)}% Complete</span>
              </div>
              <div className="flex-1 bg-[#070A12] border border-slate-800/80 rounded p-3 font-mono text-xs text-slate-300 space-y-2 overflow-y-auto max-h-[340px]">
                {logs.map((entry, idx) => (
                  <div
                    key={idx}
                    className={
                      entry.includes('CRITICAL')
                        ? 'text-rose-400'
                        : entry.includes('FLIGHT CMD')
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                    }
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
