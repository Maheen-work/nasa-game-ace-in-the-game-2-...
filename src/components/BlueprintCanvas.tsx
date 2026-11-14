import React, { useEffect, useRef, useState } from 'react';
import { TARGET_DESTINATIONS, TRAJECTORY_OPTIONS } from '../data/missionData';
import { getComponent } from '../engine/systemsPhysics';
import { ComputedTelemetry, MissionConfig } from '../types/mission';

interface BlueprintCanvasProps {
  config: MissionConfig;
  telemetry: ComputedTelemetry;
  onSelectPhase?: (phase: 'target' | 'spacecraft' | 'trajectory') => void;
}

interface HitRegion {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  config,
  telemetry,
  onSelectPhase,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hitRegionsRef = useRef<HitRegion[]>([]);

  const [showDimensions, setShowDimensions] = useState(true);
  const [showPowerFlow, setShowPowerFlow] = useState(true);
  const [showThermalOverlay, setShowThermalOverlay] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<HitRegion | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];
  const trajectory =
    TRAJECTORY_OPTIONS.find((tr) => tr.id === config.trajectoryId) ?? TRAJECTORY_OPTIONS[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let startTime = performance.now();

    const draw = (now: number) => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, rect.width);
      const height = Math.max(360, rect.height);

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const t = prefersReducedMotion ? 1.5 : (now - startTime) / 1000;
      const cx = width * 0.5;
      const cy = height * 0.54;
      const scale = Math.min(width / 660, height / 420, 1.15);

      const regions: HitRegion[] = [];

      // Subtle radial telemetry crosshair behind bus
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 130 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 240 * scale, cy);
      ctx.lineTo(cx + 240 * scale, cy);
      ctx.moveTo(cx, cy - 160 * scale);
      ctx.lineTo(cx, cy + 160 * scale);
      ctx.stroke();
      ctx.restore();

      // Thermal Envelope Overlay
      if (showThermalOverlay) {
        const isHot =
          trajectory.innerSolarPassAU < 0.8 ||
          (config.powerId === 'rtg' && !config.thermalIds.includes('therm-radiators'));
        const isCold =
          target.tempMinC <= -150 &&
          config.powerId !== 'rtg' &&
          !config.thermalIds.includes('therm-heaters');
        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180 * scale);
        if (isHot) {
          grad.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        } else if (isCold) {
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
        } else {
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
          grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 1. SOLAR WINGS OR MMRTG
      const busW = 86 * scale;
      const busH = 104 * scale;

      if (config.powerId === 'solar-std' || config.powerId === 'solar-ultra') {
        const isUltra = config.powerId === 'solar-ultra';
        const wingSpan = (isUltra ? 195 : 132) * scale;
        const wingH = (isUltra ? 58 : 44) * scale;
        const wingGap = busW * 0.5 + 10 * scale;

        // Draw left & right solar arrays
        [-1, 1].forEach((dir) => {
          const xStart = cx + dir * wingGap;
          const xEnd = cx + dir * (wingGap + wingSpan);
          const xMin = Math.min(xStart, xEnd);
          const yTop = cy - wingH / 2;

          // Strut mount
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 3 * scale;
          ctx.beginPath();
          ctx.moveTo(cx + dir * (busW * 0.5), cy);
          ctx.lineTo(xStart, cy);
          ctx.stroke();

          // Wing panels
          ctx.fillStyle = isUltra ? '#0F2942' : '#132238';
          ctx.strokeStyle = isUltra ? '#38BDF8' : '#64748B';
          ctx.lineWidth = 1.5;
          ctx.fillRect(xMin, yTop, wingSpan, wingH);
          ctx.strokeRect(xMin, yTop, wingSpan, wingH);

          // Photovoltaic grid lines
          const segments = isUltra ? 6 : 4;
          ctx.strokeStyle = isUltra ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1;
          for (let s = 1; s < segments; s++) {
            const gx = xMin + (wingSpan / segments) * s;
            ctx.beginPath();
            ctx.moveTo(gx, yTop);
            ctx.lineTo(gx, yTop + wingH);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(xMin, cy);
          ctx.lineTo(xMin + wingSpan, cy);
          ctx.stroke();

          // Power flow particles
          if (showPowerFlow && telemetry.sunlitPowerGenW > 0) {
            const pulse = (t * 0.9) % 1;
            const px =
              dir === -1
                ? xMin + wingSpan * pulse
                : xMin + wingSpan * (1 - pulse);
            ctx.fillStyle = '#22D3EE';
            ctx.beginPath();
            ctx.arc(px, cy, 2.8 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        const powerComp = getComponent(config.powerId);
        regions.push({
          id: config.powerId,
          label: powerComp?.shortName ?? 'Solar Arrays',
          sublabel: `${telemetry.sunlitPowerGenW} W @ ${target.orbitDistanceAU} AU · ${powerComp?.massKg} kg`,
          x: cx - wingGap - wingSpan,
          y: cy - wingH / 2,
          w: wingSpan,
          h: wingH,
        });
        regions.push({
          id: `${config.powerId}-r`,
          label: powerComp?.shortName ?? 'Solar Arrays',
          sublabel: `${telemetry.sunlitPowerGenW} W @ ${target.orbitDistanceAU} AU · ${powerComp?.massKg} kg`,
          x: cx + wingGap,
          y: cy - wingH / 2,
          w: wingSpan,
          h: wingH,
        });
      } else if (config.powerId === 'rtg') {
        // MMRTG Finned Nuclear Cylinder on Port Side
        const rtgX = cx - busW * 0.5 - 64 * scale;
        const rtgY = cy + 6 * scale;
        const rtgW = 54 * scale;
        const rtgH = 28 * scale;

        // Mounting truss
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - busW * 0.5, rtgY + rtgH / 2);
        ctx.lineTo(rtgX + rtgW, rtgY + rtgH / 2);
        ctx.stroke();

        // Cylinder body
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.6;
        ctx.fillRect(rtgX, rtgY, rtgW, rtgH);
        ctx.strokeRect(rtgX, rtgY, rtgW, rtgH);

        // Cooling fins
        for (let f = 0; f < 6; f++) {
          const fx = rtgX + 6 * scale + f * 8 * scale;
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(fx, rtgY - 5 * scale);
          ctx.lineTo(fx, rtgY + rtgH + 5 * scale);
          ctx.stroke();
        }

        if (showPowerFlow) {
          const pulse = (t * 1.1) % 1;
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(rtgX + rtgW + pulse * 14 * scale, rtgY + rtgH / 2, 2.8 * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        regions.push({
          id: 'rtg',
          label: 'MMRTG Nuclear Battery',
          sublabel: '115 W constant · +40 W heat · 46 kg',
          x: rtgX - 6,
          y: rtgY - 8,
          w: rtgW + 12,
          h: rtgH + 16,
        });
      }

      // 2. MAGNETOMETER BOOM (Starboard long lattice)
      if (config.instrumentIds.includes('magnetometer')) {
        const boomStart = cx + busW * 0.5;
        const boomLen = 148 * scale;
        const boomY = cy + 32 * scale;
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(boomStart, boomY - 4 * scale);
        ctx.lineTo(boomStart + boomLen, boomY - 2 * scale);
        ctx.moveTo(boomStart, boomY + 4 * scale);
        ctx.lineTo(boomStart + boomLen, boomY + 2 * scale);
        for (let i = 0; i < 9; i++) {
          const bx = boomStart + (boomLen / 9) * i;
          const bx2 = boomStart + (boomLen / 9) * (i + 1);
          ctx.moveTo(bx, boomY - 3 * scale);
          ctx.lineTo(bx2, boomY + 3 * scale);
        }
        ctx.stroke();

        // Fluxgate Sensor tip
        ctx.fillStyle = '#22D3EE';
        ctx.fillRect(boomStart + boomLen, boomY - 5 * scale, 12 * scale, 10 * scale);
        regions.push({
          id: 'magnetometer',
          label: 'Fluxgate Magnetometer Boom',
          sublabel: '10 W · 0.6 MB/hr · +26 Science',
          x: boomStart + 10,
          y: boomY - 12 * scale,
          w: boomLen + 18 * scale,
          h: 24 * scale,
        });
      }

      // 3. ICE-PENETRATING RADAR DIPOLE ARRAYS
      if (config.instrumentIds.includes('radar')) {
        const radarY = cy + busH * 0.5 + 16 * scale;
        const dipoleSpan = 105 * scale;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - dipoleSpan, radarY);
        ctx.lineTo(cx + dipoleSpan, radarY);
        ctx.stroke();

        // Animated radar wave pulses
        if (showPowerFlow) {
          const wavePhase = (t * 1.4) % 1;
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.65 * (1 - wavePhase)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, radarY, (18 + wavePhase * 34) * scale, 0.2 * Math.PI, 0.8 * Math.PI);
          ctx.stroke();
        }

        regions.push({
          id: 'radar',
          label: 'Subsurface Penetrating Radar',
          sublabel: '62 W · 8.2 MB/hr · +48 Science',
          x: cx - dipoleSpan,
          y: radarY - 10 * scale,
          w: dipoleSpan * 2,
          h: 20 * scale,
        });
      }

      // 4. RADIATOR FINS (Top flanks of bus)
      if (config.thermalIds.includes('therm-radiators')) {
        [-1, 1].forEach((dir) => {
          const rx = cx + dir * (busW * 0.5 + 6 * scale);
          const rw = (dir === 1 ? 18 : -18) * scale;
          const ry = cy - busH * 0.45;
          const rh = 34 * scale;
          ctx.fillStyle = '#CBD5E1';
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1;
          ctx.fillRect(Math.min(rx, rx + rw), ry, Math.abs(rw), rh);
          ctx.strokeRect(Math.min(rx, rx + rw), ry, Math.abs(rw), rh);
        });
        regions.push({
          id: 'therm-radiators',
          label: 'Deployable Ammonia Radiators',
          sublabel: '110 W Heat Rejection · 14 kg',
          x: cx + busW * 0.5 + 4 * scale,
          y: cy - busH * 0.45,
          w: 22 * scale,
          h: 34 * scale,
        });
      }

      // 5. AFT PROPULSION NOZZLE (Chemical Bell or SEP Xenon Ion Thruster)
      const nozzleY = cy + busH * 0.5;
      const isSep = config.trajectoryId === 'sep';
      if (isSep) {
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx - 22 * scale, nozzleY, 44 * scale, 16 * scale);
        ctx.strokeRect(cx - 22 * scale, nozzleY, 44 * scale, 16 * scale);

        // Ion Plasma Plume
        const flicker = 0.85 + Math.sin(t * 14) * 0.15;
        const plumeGrad = ctx.createLinearGradient(cx, nozzleY + 16 * scale, cx, nozzleY + 62 * scale);
        plumeGrad.addColorStop(0, `rgba(34, 211, 238, ${0.85 * flicker})`);
        plumeGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = plumeGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 16 * scale, nozzleY + 16 * scale);
        ctx.lineTo(cx + 16 * scale, nozzleY + 16 * scale);
        ctx.lineTo(cx + 6 * scale, nozzleY + 62 * scale);
        ctx.lineTo(cx - 6 * scale, nozzleY + 62 * scale);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12 * scale, nozzleY);
        ctx.lineTo(cx + 12 * scale, nozzleY);
        ctx.lineTo(cx + 22 * scale, nozzleY + 26 * scale);
        ctx.lineTo(cx - 22 * scale, nozzleY + 26 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // 6. MAIN SPACECRAFT BUS CHASSIS
      const hasMLI = config.thermalIds.includes('therm-passive');
      const hasVault = config.thermalIds.includes('rad-vault');
      const busX = cx - busW * 0.5;
      const busY = cy - busH * 0.5;

      // Bus Base
      ctx.fillStyle = hasMLI ? '#3B2F13' : '#1E293B';
      ctx.strokeStyle = hasMLI ? '#D97706' : '#64748B';
      ctx.lineWidth = 2;
      ctx.fillRect(busX, busY, busW, busH);
      ctx.strokeRect(busX, busY, busW, busH);

      // MLI Crinkle diagonal grid
      if (hasMLI) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.lineWidth = 1;
        for (let i = -busH; i < busW; i += 14 * scale) {
          ctx.beginPath();
          ctx.moveTo(Math.max(busX, busX + i), busY);
          ctx.lineTo(Math.min(busX + busW, busX + i + busH * 0.4), busY + busH);
          ctx.stroke();
        }
      }

      // Radiation Vault Armor Core
      if (hasVault) {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 28 * scale, cy - 28 * scale, 56 * scale, 56 * scale);
        ctx.strokeRect(cx - 28 * scale, cy - 28 * scale, 56 * scale, 56 * scale);
      }

      // Avionics Bay Indicator
      const isRadHard = config.avionicsId === 'avio-radhard';
      ctx.fillStyle = isRadHard ? '#0E7490' : '#0F172A';
      ctx.strokeStyle = isRadHard ? '#22D3EE' : '#475569';
      ctx.lineWidth = 1.4;
      ctx.fillRect(cx - 18 * scale, cy - 16 * scale, 36 * scale, 22 * scale);
      ctx.strokeRect(cx - 18 * scale, cy - 16 * scale, 36 * scale, 22 * scale);

      // Battery Pack block on lower bus
      const isHeavyBat = config.batteryId === 'bat-heavy';
      ctx.fillStyle = isHeavyBat ? '#065F46' : '#1E293B';
      ctx.strokeStyle = isHeavyBat ? '#10B981' : '#64748B';
      ctx.fillRect(cx - 20 * scale, cy + 14 * scale, isHeavyBat ? 40 * scale : 26 * scale, 18 * scale);
      ctx.strokeRect(cx - 20 * scale, cy + 14 * scale, isHeavyBat ? 40 * scale : 26 * scale, 18 * scale);

      // Active Heaters coils
      if (config.thermalIds.includes('therm-heaters')) {
        ctx.strokeStyle = '#FB923C';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const hx = cx - 24 * scale + k * 12 * scale;
          ctx.moveTo(hx, cy + 38 * scale);
          ctx.lineTo(hx + 6 * scale, cy + 44 * scale);
        }
        ctx.stroke();
      }

      regions.push({
        id: 'bus',
        label: 'Spacecraft Bus & Avionics',
        sublabel: `${telemetry.totalMassKg} kg total · ${telemetry.bufferCapacityGB} GB Buffer · ${telemetry.batteryCapacityWh} Wh`,
        x: busX,
        y: busY,
        w: busW,
        h: busH,
      });

      // 7. TOP COMMUNICATIONS ANTENNA (HGA Dish vs Low-Gain Whip)
      if (config.commsId === 'comms-hga') {
        const dishY = busY - 24 * scale;
        const dishRx = 52 * scale;
        const dishRy = 16 * scale;

        // Mast
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(cx, busY);
        ctx.lineTo(cx, dishY + 6 * scale);
        ctx.stroke();

        // Parabolic reflector
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(cx, dishY, dishRx, dishRy, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(cx, dishY, dishRx, dishRy * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tripod feed horn
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - dishRx * 0.65, dishY);
        ctx.lineTo(cx, dishY - 34 * scale);
        ctx.lineTo(cx + dishRx * 0.65, dishY);
        ctx.moveTo(cx, dishY);
        ctx.lineTo(cx, dishY - 34 * scale);
        ctx.stroke();

        ctx.fillStyle = '#22D3EE';
        ctx.beginPath();
        ctx.arc(cx, dishY - 35 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();

        // RF Transmission waves
        if (showPowerFlow) {
          const rf = (t * 1.2) % 1;
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.7 * (1 - rf)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, dishY - 35 * scale, (10 + rf * 32) * scale, -Math.PI * 0.8, -Math.PI * 0.2);
          ctx.stroke();
        }

        regions.push({
          id: 'comms-hga',
          label: 'High-Gain Parabolic Dish (Ka-Band)',
          sublabel: `${telemetry.downlinkKbps} kbps @ ${target.name} · 42 W · 28 kg`,
          x: cx - dishRx,
          y: dishY - 40 * scale,
          w: dishRx * 2,
          h: 58 * scale,
        });
      } else {
        // Low-gain whip
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2.2 * scale;
        ctx.beginPath();
        ctx.moveTo(cx, busY);
        ctx.lineTo(cx, busY - 46 * scale);
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(cx, busY - 48 * scale, 3.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        regions.push({
          id: 'comms-lga',
          label: 'Low-Gain Omnidirectional Whip',
          sublabel: `${telemetry.downlinkKbps} kbps @ ${target.name} · 8 W · 6 kg`,
          x: cx - 18 * scale,
          y: busY - 52 * scale,
          w: 36 * scale,
          h: 52 * scale,
        });
      }

      // 8. SCIENCE INSTRUMENT DECK MODULES (mounted around lower/forward shoulders)
      const deckInstruments = [
        { id: 'imager', color: '#38BDF8', label: 'HD Multispectral Imager', xOff: -34, yOff: -42 },
        { id: 'spectrometer', color: '#A78BFA', label: 'Mass/IR Spectrometer', xOff: 22, yOff: -42 },
        { id: 'lidar', color: '#34D399', label: 'Laser Altimeter (LiDAR)', xOff: -34, yOff: 24 },
      ];

      deckInstruments.forEach((inst) => {
        if (!config.instrumentIds.includes(inst.id)) return;
        const ix = cx + inst.xOff * scale;
        const iy = cy + inst.yOff * scale;
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = inst.color;
        ctx.lineWidth = 1.6;
        ctx.fillRect(ix, iy, 16 * scale, 18 * scale);
        ctx.strokeRect(ix, iy, 16 * scale, 18 * scale);

        // Lens / Aperture glint
        ctx.fillStyle = inst.color;
        ctx.beginPath();
        ctx.arc(ix + 8 * scale, iy + 9 * scale, 3.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        const comp = getComponent(inst.id);
        regions.push({
          id: inst.id,
          label: inst.label,
          sublabel: `${comp?.powerDrawW} W · ${comp?.dataGenMBHr} MB/hr · +${comp?.scienceValue} Sci`,
          x: ix - 4,
          y: iy - 4,
          w: 24 * scale,
          h: 26 * scale,
        });
      });

      // 9. CAD DIMENSION LINES & LABELS
      if (showDimensions) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.lineWidth = 1;

        const spanPx =
          config.powerId === 'solar-ultra'
            ? 245 * scale
            : config.powerId === 'solar-std'
              ? 185 * scale
              : 105 * scale;
        const dimY = height - 28;
        ctx.beginPath();
        ctx.moveTo(cx - spanPx, dimY);
        ctx.lineTo(cx + spanPx, dimY);
        ctx.moveTo(cx - spanPx, dimY - 5);
        ctx.lineTo(cx - spanPx, dimY + 5);
        ctx.moveTo(cx + spanPx, dimY - 5);
        ctx.lineTo(cx + spanPx, dimY + 5);
        ctx.stroke();

        const spanMeters =
          config.powerId === 'solar-ultra' ? '18.4 m' : config.powerId === 'solar-std' ? '11.2 m' : '3.8 m';
        ctx.textAlign = 'center';
        ctx.fillText(
          `WINGSPAN ${spanMeters}  |  DRY+WET ${telemetry.totalMassKg} kg  |  BUS LOAD ${telemetry.powerDrawW} W`,
          cx,
          dimY - 7
        );
        ctx.restore();
      }

      hitRegionsRef.current = regions;
      ctx.restore();

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [config, telemetry, showDimensions, showPowerFlow, showThermalOverlay, target, trajectory]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Search in reverse so foreground elements match first
    const match = [...hitRegionsRef.current]
      .reverse()
      .find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    setHoveredRegion(match ?? null);
  };

  const handleMouseLeave = () => {
    setHoveredRegion(null);
    setMousePos(null);
  };

  return (
    <div className="bg-[#090D16] border border-slate-800 rounded-md flex flex-col overflow-hidden">
      {/* Canvas Header HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 bg-[#0D131F]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-display font-semibold tracking-wide text-slate-100">
            Spacecraft Assembly Blueprint
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {target.name} · {target.solarFluxWm2} W/m² Solar Flux
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showDimensions
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            Dimensions
          </button>
          <button
            type="button"
            onClick={() => setShowPowerFlow((v) => !v)}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showPowerFlow
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            Signal Flow
          </button>
          <button
            type="button"
            onClick={() => setShowThermalOverlay((v) => !v)}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showThermalOverlay
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            Thermal Map
          </button>
        </div>
      </div>

      {/* Interactive Blueprint Stage */}
      <div ref={containerRef} className="relative h-[380px] sm:h-[420px] w-full blueprint-grid">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => onSelectPhase?.('spacecraft')}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Top-Left Environment Spec Callout */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 text-xs font-mono text-slate-400 bg-[#07090E]/80 border border-slate-800 px-2.5 py-2 rounded">
          <div>
            AMBIENT: <span className="text-slate-200">{target.tempMinC}°C to {target.tempMaxC}°C</span>
          </div>
          <div>
            RAD DOSE: <span className="text-slate-200">{target.radiationLabel}</span>
          </div>
          <div>
            1-WAY LAG: <span className="text-slate-200">{target.commsLatencyLabel}</span>
          </div>
        </div>

        {/* Hover Component Inspector Tooltip */}
        {hoveredRegion && mousePos && (
          <div
            className="pointer-events-none absolute z-10 bg-[#07090E]/95 border border-cyan-500/50 rounded px-2.5 py-1.5 text-xs shadow-lg max-w-[240px]"
            style={{
              left: Math.min(mousePos.x + 14, 340),
              top: Math.max(12, mousePos.y - 42),
            }}
          >
            <div className="font-semibold text-cyan-300">{hoveredRegion.label}</div>
            <div className="font-mono text-[11px] text-slate-300 mt-0.5">
              {hoveredRegion.sublabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
