import {
  LAUNCH_VEHICLES,
  SPACECRAFT_COMPONENTS,
  TARGET_DESTINATIONS,
  TRAJECTORY_OPTIONS,
} from '../data/missionData';
import {
  ComputedTelemetry,
  CrisisEvent,
  EngineeringAdvisory,
  MishapReport,
  MissionConfig,
  SpacecraftComponent,
  StatusLevel,
} from '../types/mission';

const BASE_CHASSIS_MASS_KG = 42;
const BASE_CHASSIS_COST_M = 12;
const BASE_AVIONICS_HOUSEKEEPING_W = 12;

export function getComponent(id: string): SpacecraftComponent | undefined {
  return SPACECRAFT_COMPONENTS.find((c) => c.id === id);
}

export function computeMissionTelemetry(config: MissionConfig): ComputedTelemetry {
  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];
  const objective =
    target.objectives.find((o) => o.id === config.objectiveId) ?? target.objectives[0];
  const launchVehicle =
    LAUNCH_VEHICLES.find((lv) => lv.id === config.launchVehicleId) ?? LAUNCH_VEHICLES[1];
  const trajectory =
    TRAJECTORY_OPTIONS.find((tr) => tr.id === config.trajectoryId) ?? TRAJECTORY_OPTIONS[0];

  const powerComp = getComponent(config.powerId);
  const batteryComp = getComponent(config.batteryId);
  const commsComp = getComponent(config.commsId);
  const avionicsComp = getComponent(config.avionicsId);
  const thermalComps = config.thermalIds
    .map(getComponent)
    .filter((c): c is SpacecraftComponent => Boolean(c));
  const instruments = config.instrumentIds
    .map(getComponent)
    .filter((c): c is SpacecraftComponent => Boolean(c));

  const selectedComponents = [
    powerComp,
    batteryComp,
    commsComp,
    avionicsComp,
    ...thermalComps,
    ...instruments,
  ].filter((c): c is SpacecraftComponent => Boolean(c));

  // 1. Mass & Payload Limit
  const subsystemMassKg = selectedComponents.reduce((sum, c) => sum + c.massKg, 0);
  const totalMassKg = Math.round(
    BASE_CHASSIS_MASS_KG + subsystemMassKg + trajectory.extraMassKg
  );
  const payloadLimitKg = launchVehicle.maxPayloadKg;
  const massMarginKg = payloadLimitKg - totalMassKg;
  const massStatus: StatusLevel =
    massMarginKg < 0 ? 'critical' : massMarginKg < 25 ? 'marginal' : 'nominal';

  // 2. Cost & Budget Cap
  const subsystemCostM = selectedComponents.reduce((sum, c) => sum + c.costM, 0);
  const totalCostM = Math.round(
    BASE_CHASSIS_COST_M + subsystemCostM + launchVehicle.costM + trajectory.extraCostM
  );
  const budgetCapM = config.budgetCapM;
  const costMarginM = budgetCapM - totalCostM;
  const costStatus: StatusLevel =
    costMarginM < 0 ? 'critical' : costMarginM < 15 ? 'marginal' : 'nominal';

  // 3. Power Balance (1 / AU^2 solar flux law)
  const solarMultiplier = target.solarFluxWm2 / 1361; // 1.0 at Earth/Moon, 0.433 at Mars, 0.0367 at Europa
  const sunlitPowerGenW = Math.round(
    (powerComp?.powerGen1AUW ?? 0) * solarMultiplier + (powerComp?.powerGenConstantW ?? 0)
  );
  const eclipsePowerGenW = Math.round(powerComp?.powerGenConstantW ?? 0);

  const subsystemDrawW = selectedComponents.reduce((sum, c) => sum + c.powerDrawW, 0);
  const powerDrawW = Math.round(BASE_AVIONICS_HOUSEKEEPING_W + subsystemDrawW);

  const netSunlitPowerW = sunlitPowerGenW - powerDrawW;
  const netEclipsePowerW = eclipsePowerGenW - powerDrawW;

  const batteryCapacityWh = batteryComp?.batteryWh ?? 400;
  const eclipseSurvivalMinutes =
    netEclipsePowerW >= 0
      ? 999
      : Math.max(0, Math.round((batteryCapacityWh / Math.abs(netEclipsePowerW)) * 60));

  let powerStatus: StatusLevel = 'nominal';
  if (netSunlitPowerW < 0 || eclipseSurvivalMinutes < target.eclipseMinutes) {
    powerStatus = 'critical';
  } else if (netSunlitPowerW < 25 || eclipseSurvivalMinutes < target.eclipseMinutes * 1.35) {
    powerStatus = 'marginal';
  }

  // 4. Comms & Data Buffer Balance
  // Realistic DSN inverse-square scaling with minimum lunar floor
  const effectiveCommsAU = Math.max(0.18, target.earthDistanceAU);
  const base1AUKbps = commsComp?.dataRateKbps1AU ?? 3.5;
  const downlinkKbps =
    target.id === 'moon'
      ? Number((base1AUKbps * 1.4).toFixed(1))
      : Number((base1AUKbps / (effectiveCommsAU * effectiveCommsAU)).toFixed(2));

  // Assume 10 hours effective DSN contact per 24h day (42% duty cycle)
  const downlinkMBHr = Number((((downlinkKbps * 3600) / 8 / 1000) * 0.45).toFixed(2));
  const scienceGenMBHr = Number(
    instruments.reduce((sum, i) => sum + (i.dataGenMBHr ?? 0), 0).toFixed(2)
  );
  const bufferCapacityGB = avionicsComp?.dataBufferGB ?? 64;
  const netBufferFillMBHr = Number((scienceGenMBHr - downlinkMBHr).toFixed(2));
  const hoursToBufferFull =
    netBufferFillMBHr > 0
      ? Math.round((bufferCapacityGB * 1000) / netBufferFillMBHr)
      : null;

  let commsStatus: StatusLevel = 'nominal';
  if (instruments.length > 0 && downlinkKbps < 0.8) {
    commsStatus = 'critical';
  } else if (hoursToBufferFull !== null && hoursToBufferFull < 72) {
    commsStatus = 'critical';
  } else if (hoursToBufferFull !== null && hoursToBufferFull < 240) {
    commsStatus = 'marginal';
  }

  // 5. Delta-V & Trajectory
  const requiredDeltaVKms = Number(
    Math.max(1.5, target.requiredDeltaVKms - trajectory.deltaVReductionKms).toFixed(1)
  );
  const effectiveDeltaVKms = launchVehicle.deltaVAssistKms;
  const deltaVMargin = effectiveDeltaVKms - requiredDeltaVKms;
  const deltaVStatus: StatusLevel =
    deltaVMargin < -0.1 ? 'critical' : deltaVMargin < 0.6 ? 'marginal' : 'nominal';

  // 6. Thermal & Radiation Environment
  const totalHeatingW =
    (powerComp?.passiveHeatW ?? 0) +
    thermalComps.reduce((sum, c) => sum + (c.thermalHeatingW ?? 0), 0);
  const totalCoolingW = thermalComps.reduce((sum, c) => sum + (c.thermalCoolingW ?? 0), 0);
  const totalRadHardness =
    (avionicsComp?.radHardness ?? 0) +
    thermalComps.reduce((sum, c) => sum + (c.radHardness ?? 0), 0);

  const hasHeatersOrRTG =
    powerComp?.id === 'rtg' || config.thermalIds.includes('therm-heaters');
  const hasRadiators = config.thermalIds.includes('therm-radiators');
  const hasPassiveMLI = config.thermalIds.includes('therm-passive');

  let thermalStatus: StatusLevel = 'nominal';
  // Deep cold check
  if (target.tempMinC <= -150 && !hasHeatersOrRTG) {
    thermalStatus = 'critical';
  } else if (target.tempMinC <= -120 && !hasPassiveMLI && !hasHeatersOrRTG) {
    thermalStatus = 'critical';
  }
  // Venus flyby or inner heat + RTG check
  if (trajectory.innerSolarPassAU < 0.8 && !hasRadiators) {
    thermalStatus = 'critical';
  } else if (powerComp?.id === 'rtg' && target.orbitDistanceAU <= 1.1 && !hasRadiators) {
    thermalStatus = 'critical';
  } else if (totalHeatingW < 15 && target.orbitDistanceAU >= 2.0) {
    thermalStatus = thermalStatus === 'critical' ? 'critical' : 'marginal';
  }

  let radiationStatus: StatusLevel = 'nominal';
  if (target.radiationKradYr >= 100 && totalRadHardness < 80) {
    radiationStatus = 'critical';
  } else if (target.radiationKradYr >= 10 && totalRadHardness < 45) {
    radiationStatus = 'marginal';
  }

  // 7. Science Score
  const hasRecommended = objective.recommendedInstruments.every((id) =>
    config.instrumentIds.includes(id)
  );
  const baseScience = instruments.reduce((sum, i) => sum + (i.scienceValue ?? 0), 0);
  const rawScienceScore = Math.min(
    100,
    baseScience + (hasRecommended ? objective.bonusScience : 0)
  );

  // 8. Build Coupled Trade-Off Advisories
  const advisories: EngineeringAdvisory[] = [];

  if (massStatus === 'critical') {
    advisories.push({
      id: 'adv-mass',
      level: 'critical',
      subsystem: 'Structures / Launch',
      title: `Payload Overweight by ${Math.abs(massMarginKg)} kg`,
      detail: `${totalMassKg} kg spacecraft exceeds ${launchVehicle.name} capacity (${payloadLimitKg} kg). Upgrade launch vehicle or trim instruments.`,
    });
  } else if (massStatus === 'marginal') {
    advisories.push({
      id: 'adv-mass-warn',
      level: 'marginal',
      subsystem: 'Structures / Launch',
      title: `Tight Mass Margin (${massMarginKg} kg remaining)`,
      detail: `Close to ${launchVehicle.name} fairing limit; very little structural contingency.`,
    });
  }

  if (deltaVStatus === 'critical') {
    advisories.push({
      id: 'adv-dv',
      level: 'critical',
      subsystem: 'Astrodynamics',
      title: `Insufficient Δv (${effectiveDeltaVKms} vs ${requiredDeltaVKms} km/s needed)`,
      detail: `Probe will miss ${target.name} capture orbit. Select a heavier rocket, SEP Ion drive, or VEGA gravity assist.`,
    });
  }

  if (netSunlitPowerW < 0) {
    advisories.push({
      id: 'adv-power-sun',
      level: 'critical',
      subsystem: 'Power EPS',
      title: `Power Deficit in Sunlight (${netSunlitPowerW} W)`,
      detail: `At ${target.orbitDistanceAU} AU (${target.solarFluxWm2} W/m²), generation is ${sunlitPowerGenW} W vs ${powerDrawW} W load.`,
    });
  } else if (eclipseSurvivalMinutes < target.eclipseMinutes) {
    advisories.push({
      id: 'adv-eclipse',
      level: 'critical',
      subsystem: 'Power / Eclipse',
      title: `Battery Depletes Before Eclipse Ends (${eclipseSurvivalMinutes}m / ${target.eclipseMinutes}m)`,
      detail: `Batteries hit 0% during ${target.name}'s ${target.eclipseMinutes}-minute shadow pass. Add Deep-Space Battery Bank or MMRTG.`,
    });
  }

  if (trajectory.id === 'sep' && netSunlitPowerW < 45) {
    advisories.push({
      id: 'adv-sep-power',
      level: 'marginal',
      subsystem: 'Propulsion / EPS',
      title: 'Low Cruise Power Margin for Ion Thrusters',
      detail: `SEP Hall thrusters draw 48 W continuously during outer-system cruise.`,
    });
  }

  if (commsStatus === 'critical') {
    advisories.push({
      id: 'adv-comms',
      level: 'critical',
      subsystem: 'Telecommunications',
      title: `Buffer Overflow Imminent (${downlinkKbps} kbps downlink)`,
      detail: `Instruments produce ${scienceGenMBHr} MB/hr while DSN link clears only ${downlinkMBHr} MB/hr. Upgrade to High-Gain Dish.`,
    });
  } else if (commsStatus === 'marginal') {
    advisories.push({
      id: 'adv-comms-warn',
      level: 'marginal',
      subsystem: 'Telecommunications',
      title: `Data Backlog Accumulating (+${netBufferFillMBHr} MB/hr)`,
      detail: `Onboard ${bufferCapacityGB} GB recorder will saturate in ~${hoursToBufferFull} hours without duty-cycling.`,
    });
  }

  if (target.tempMinC <= -150 && !hasHeatersOrRTG) {
    advisories.push({
      id: 'adv-cold',
      level: 'critical',
      subsystem: 'Thermal Control',
      title: `Cryogenic Freeze Risk (${target.tempMinC}°C ambient)`,
      detail: `Propellant valves and batteries will freeze at ${target.name} without Active Heaters or MMRTG waste heat.`,
    });
  }

  if (
    (trajectory.innerSolarPassAU < 0.8 ||
      (powerComp?.id === 'rtg' && target.orbitDistanceAU <= 1.1)) &&
    !hasRadiators
  ) {
    advisories.push({
      id: 'adv-heat',
      level: 'critical',
      subsystem: 'Thermal Rejection',
      title: 'Thermal Runaway Hazard (Missing Radiator Fins)',
      detail:
        trajectory.innerSolarPassAU < 0.8
          ? 'Venus Gravity Assist passes at 0.72 AU (2,600 W/m²). Deployable Ammonia Radiators are mandatory.'
          : 'MMRTG internal heat in inner solar space requires Radiator Fins to protect electronics.',
    });
  }

  if (radiationStatus === 'critical') {
    advisories.push({
      id: 'adv-rad',
      level: 'critical',
      subsystem: 'Radiation Protection',
      title: `Lethal Jovian Radiation Dose (${target.radiationLabel})`,
      detail: `Electronics require both a Tantalum Radiation Vault and Rad-Hard CPU to survive Europa belts.`,
    });
  }

  if (costStatus === 'critical') {
    advisories.push({
      id: 'adv-cost',
      level: 'critical',
      subsystem: 'Program Budget',
      title: `Over Budget by $${Math.abs(costMarginM)}M`,
      detail: `Mission cost ($${totalCostM}M) exceeds $${budgetCapM}M program allocation.`,
    });
  }

  if (instruments.length === 0) {
    advisories.push({
      id: 'adv-no-sci',
      level: 'critical',
      subsystem: 'Science Payload',
      title: 'No Science Instruments Installed',
      detail: 'Add at least one scientific instrument to fulfill mission objectives.',
    });
  } else if (!hasRecommended) {
    const missingNames = objective.recommendedInstruments
      .filter((id) => !config.instrumentIds.includes(id))
      .map((id) => getComponent(id)?.shortName ?? id)
      .join(' + ');
    advisories.push({
      id: 'adv-obj',
      level: 'marginal',
      subsystem: 'Science Objective',
      title: `Missing Primary Objective Instrument (${missingNames})`,
      detail: `Add ${missingNames} to unlock the +${objective.bonusScience} objective science bonus.`,
    });
  }

  // Radar Normalized 0..100 Scores
  const powerScore = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        55 +
          Math.min(25, netSunlitPowerW * 0.25) +
          (eclipseSurvivalMinutes >= target.eclipseMinutes ? 20 : -35)
      )
    )
  );
  const thermalRadScore = Math.max(
    10,
    Math.min(
      100,
      (thermalStatus === 'nominal' ? 50 : thermalStatus === 'marginal' ? 30 : 10) +
        (radiationStatus === 'nominal' ? 50 : radiationStatus === 'marginal' ? 28 : 8)
    )
  );
  const commsScore =
    instruments.length === 0
      ? 50
      : Math.max(
          10,
          Math.min(
            100,
            Math.round(
              (downlinkMBHr / Math.max(0.5, scienceGenMBHr)) * 65 +
                (bufferCapacityGB >= 256 ? 25 : 10)
            )
          )
        );
  const costScore = Math.max(
    10,
    Math.min(100, Math.round(70 + (costMarginM / Math.max(50, budgetCapM)) * 90))
  );

  const blockingIssuesCount = advisories.filter((a) => a.level === 'critical').length;

  return {
    totalMassKg,
    payloadLimitKg,
    massMarginKg,
    massStatus,
    totalCostM,
    budgetCapM,
    costMarginM,
    costStatus,
    sunlitPowerGenW,
    eclipsePowerGenW,
    powerDrawW,
    netSunlitPowerW,
    netEclipsePowerW,
    batteryCapacityWh,
    eclipseSurvivalMinutes,
    powerStatus,
    downlinkKbps,
    downlinkMBHr,
    scienceGenMBHr,
    bufferCapacityGB,
    netBufferFillMBHr,
    hoursToBufferFull,
    commsStatus,
    requiredDeltaVKms,
    effectiveDeltaVKms,
    deltaVStatus,
    thermalStatus,
    radiationStatus,
    rawScienceScore,
    objectiveBonusActive: hasRecommended,
    radarScores: {
      science: Math.max(10, rawScienceScore),
      power: powerScore,
      thermalRad: thermalRadScore,
      comms: commsScore,
      costEfficiency: costScore,
    },
    advisories,
    launchReady: blockingIssuesCount === 0,
    blockingIssuesCount,
  };
}

export function generateCrisisEvents(
  config: MissionConfig,
  telemetry: ComputedTelemetry
): CrisisEvent[] {
  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];
  const trajectory =
    TRAJECTORY_OPTIONS.find((tr) => tr.id === config.trajectoryId) ?? TRAJECTORY_OPTIONS[0];
  const events: CrisisEvent[] = [];

  // Event 1: Ascent / Cruise Stress
  if (trajectory.innerSolarPassAU < 0.8) {
    events.push({
      id: 'ev-venus-heat',
      title: 'Venus Perihelion Thermal Spike (0.72 AU)',
      description:
        'Solar irradiance surges to 2,600 W/m² during the Venus gravity assist slingshot. Attitude and radiator louvers are at peak thermal load.',
      stage: 'Cruise',
      severity: telemetry.thermalStatus === 'critical' ? 'critical' : 'caution',
      options: [
        {
          id: 'opt-roll',
          label: 'Use HGA Dish as Sunshade',
          effectSummary: 'Drops core temp -18°C, pauses comms downlink briefly',
          batteryDelta: -4,
          bufferDelta: 6,
          tempDelta: -18,
          scienceDelta: 0,
          healthDelta: 0,
        },
        {
          id: 'opt-push',
          label: 'Maintain Nominal Attitude',
          effectSummary: 'Full science calibration, +16°C thermal soak',
          batteryDelta: 2,
          bufferDelta: 0,
          tempDelta: 16,
          scienceDelta: 5,
          healthDelta: telemetry.thermalStatus === 'critical' ? -35 : -5,
        },
      ],
    });
  } else {
    events.push({
      id: 'ev-solar-flare',
      title: 'Coronal Mass Ejection (X-Class Solar Flare)',
      description:
        'High-energy proton storm sweeps across the interplanetary transfer corridor, inducing memory bit-flips and temporary sensor noise.',
      stage: 'Cruise',
      severity: target.radiationKradYr > 20 ? 'critical' : 'caution',
      options: [
        {
          id: 'opt-safe',
          label: 'Enter Autonomous Safe Mode',
          effectSummary: 'Protects avionics (+0% damage), -8% battery draw',
          batteryDelta: -8,
          bufferDelta: 2,
          tempDelta: -4,
          scienceDelta: 0,
          healthDelta: 5,
        },
        {
          id: 'opt-measure',
          label: 'Keep Instruments Recording Flare',
          effectSummary: '+8 bonus science, risks avionics upset if unshielded',
          batteryDelta: -4,
          bufferDelta: 10,
          tempDelta: 6,
          scienceDelta: 8,
          healthDelta: telemetry.radiationStatus === 'nominal' ? -2 : -22,
        },
      ],
    });
  }

  // Event 2: Orbit Eclipse Crisis
  events.push({
    id: 'ev-eclipse',
    title: `${target.name} Umbral Eclipse (${target.eclipseMinutes} min)`,
    description:
      config.powerId === 'rtg'
        ? 'Probe crosses into deep planetary shadow. MMRTG power remains steady, while external ambient temperature plunges.'
        : `Solar input drops to 0 W for ${target.eclipseMinutes} minutes. Bus loads draw exclusively from your ${telemetry.batteryCapacityWh} Wh battery bank.`,
    stage: 'Orbit Ops',
    severity: telemetry.powerStatus === 'critical' ? 'critical' : 'caution',
    options: [
      {
        id: 'opt-shed',
        label: 'Shed Science Payload Load',
        effectSummary: 'Conserves +22% battery through shadow, -6 science yield',
        batteryDelta: 22,
        bufferDelta: -4,
        tempDelta: -6,
        scienceDelta: -6,
        healthDelta: 4,
      },
      {
        id: 'opt-full-ops',
        label: 'Run Full Night-Side Science',
        effectSummary: '+10 night-side science, heavy battery & thermal strain',
        batteryDelta: config.powerId === 'rtg' ? 0 : -28,
        bufferDelta: 12,
        tempDelta: -10,
        scienceDelta: 10,
        healthDelta: telemetry.powerStatus === 'critical' ? -28 : -4,
      },
    ],
  });

  // Event 3: Downlink / Buffer Congestion
  events.push({
    id: 'ev-buffer',
    title: 'Deep Space Network Window & Buffer Check',
    description: `Goldstone 70m dish acquires carrier signal (${target.commsLatencyLabel} 1-way lag). Current downlink rate is ${telemetry.downlinkKbps} kbps.`,
    stage: 'Orbit Ops',
    severity: telemetry.commsStatus === 'critical' ? 'critical' : 'caution',
    options: [
      {
        id: 'opt-compress',
        label: 'Lossless Compression + Priority Downlink',
        effectSummary: 'Flushes -28% data buffer, +12W transmitter draw',
        batteryDelta: -10,
        bufferDelta: -28,
        tempDelta: 4,
        scienceDelta: 4,
        healthDelta: 2,
      },
      {
        id: 'opt-burst',
        label: 'Continue High-Rate Science Capture',
        effectSummary: '+12 raw science, buffer jumps +24% (overflow risk)',
        batteryDelta: -6,
        bufferDelta: 24,
        tempDelta: 2,
        scienceDelta: 12,
        healthDelta: 0,
      },
    ],
  });

  return events;
}

export function generateMishapReport(
  config: MissionConfig,
  telemetry: ComputedTelemetry,
  simResult: {
    finalBatteryPct: number;
    finalBufferPct: number;
    peakTempC: number;
    minTempC: number;
    finalHealthPct: number;
    scienceCollected: number;
    failedStage: string | null;
    failureReason: string | null;
    logs: string[];
  }
): MishapReport {
  const target =
    TARGET_DESTINATIONS.find((t) => t.id === config.targetId) ?? TARGET_DESTINATIONS[0];
  const launchVehicle =
    LAUNCH_VEHICLES.find((lv) => lv.id === config.launchVehicleId) ?? LAUNCH_VEHICLES[1];

  const correctiveActions: string[] = [];
  if (telemetry.massStatus === 'critical') {
    correctiveActions.push(
      `Reduce spacecraft mass by ${Math.abs(telemetry.massMarginKg)} kg or upgrade from ${launchVehicle.name}.`
    );
  }
  if (telemetry.deltaVStatus === 'critical') {
    correctiveActions.push(
      `Increase transfer Δv by adding Solar Electric Propulsion (SEP), VEGA flyby, or Heavy-Lift rocket.`
    );
  }
  if (telemetry.powerStatus === 'critical') {
    correctiveActions.push(
      target.orbitDistanceAU >= 3
        ? 'Switch to MMRTG Nuclear Battery or Ultralight Solar Wings for outer-planet sunlight.'
        : 'Upgrade to Deep-Space Battery Bank or reduce high-wattage instruments.'
    );
  }
  if (telemetry.thermalStatus === 'critical') {
    correctiveActions.push(
      'Install Active Cryogenic Heaters for deep space cold or Deployable Radiator Fins for high heat loads.'
    );
  }
  if (telemetry.radiationStatus === 'critical') {
    correctiveActions.push(
      'Equip both the Tantalum Radiation Vault and Rad-Hard CPU to survive Jovian radiation.'
    );
  }
  if (telemetry.commsStatus === 'critical') {
    correctiveActions.push(
      'Upgrade to High-Gain Parabolic Dish (Ka-Band) to prevent onboard science buffer overflow.'
    );
  }
  if (telemetry.costStatus === 'critical') {
    correctiveActions.push(
      `Trim $${Math.abs(telemetry.costMarginM)}M in hardware or launch costs to meet the $${telemetry.budgetCapM}M cap.`
    );
  }

  // Determine outcome
  if (simResult.failedStage || simResult.finalHealthPct <= 15 || simResult.finalBatteryPct <= 0) {
    let rootCauseTitle = 'Spacecraft Bus Failure';
    let rootCauseSummary = simResult.failureReason ?? 'Multiple coupled subsystem limits exceeded.';
    let historicalParallel =
      'Mars Climate Orbiter (1999) — Uncaught systems integration mismatch led to total loss during orbital insertion.';

    if (telemetry.massStatus === 'critical') {
      rootCauseTitle = 'Launch Vehicle Structural Overload & Ascent Abort';
      rootCauseSummary = `Your ${telemetry.totalMassKg} kg probe exceeded the ${launchVehicle.name}'s ${telemetry.payloadLimitKg} kg transfer limit, causing Max-Q structural failure during second-stage burn.`;
      historicalParallel =
        'Ariane 5 Flight 501 / Payload Envelope Lessons — Exceeding launcher structural margins leads to immediate ascent termination.';
    } else if (telemetry.deltaVStatus === 'critical') {
      rootCauseTitle = 'Hyperbolic Flyby — Insufficient Capture Δv';
      rootCauseSummary = `The propulsion stack delivered ${telemetry.effectiveDeltaVKms} km/s against ${telemetry.requiredDeltaVKms} km/s required, sending the probe sailing past ${target.name} into heliocentric drift.`;
      historicalParallel =
        'NEAR Shoemaker First Rendezvous Burn Abort (1998) — Delta-V shortfalls force costly recovery trajectories or missed captures.';
    } else if (simResult.peakTempC > 115) {
      rootCauseTitle = 'Thermal Runaway & Avionics Over-Temperature';
      rootCauseSummary = `Core temperatures reached ${Math.round(simResult.peakTempC)}°C without Radiator Cooling Fins, warping optics and tripping flight computer shutdown.`;
      historicalParallel =
        'Skylab Thermal Shield Anomaly (1973) — Unmitigated solar heating rapidly pushes spacecraft interiors past survival limits.';
    } else if (simResult.minTempC < -45) {
      rootCauseTitle = 'Cryogenic Propellant Freeze in Deep Space';
      rootCauseSummary = `Internal bus temperature dropped to ${Math.round(simResult.minTempC)}°C at ${target.name} without Active Heaters or RTG waste heat, freezing hydrazine lines.`;
      historicalParallel =
        'Philae Lander Deep-Freeze (2014) — Without active thermal maintenance in shadow, batteries and electronics cannot wake up.';
    } else if (telemetry.radiationStatus === 'critical') {
      rootCauseTitle = 'Total Ionizing Dose Latch-Up (Radiation Failure)';
      rootCauseSummary = `${target.radiationLabel} corrupted unshielded flight memory, causing unrecoverable triple-fault safe-mode lock.`;
      historicalParallel =
        'Galileo & Juno Radiation Vaults — NASA encloses Jovian electronics inside thick titanium/tantalum vaults to survive Jupiter belts.';
    } else if (simResult.finalBatteryPct <= 0) {
      rootCauseTitle = 'Total Power Depletion During Umbral Eclipse';
      rootCauseSummary = `Solar output dropped to 0 W during ${target.name}'s ${target.eclipseMinutes}-minute shadow, draining the ${telemetry.batteryCapacityWh} Wh battery completely.`;
      historicalParallel =
        'Lunar Flashlight / CubeSat Eclipse Budgets — Power-negative eclipse operations permanently brown out flight computers.';
    }

    return {
      outcome: 'mishap',
      headline: `NASA Mishap Investigation Report: ${target.name}`,
      missionGrade: 'F',
      scienceDeliveredPct: Math.max(0, Math.round(simResult.scienceCollected * 0.2)),
      dataLostMB: Math.round(simResult.finalBufferPct * 12),
      rootCauseTitle,
      rootCauseSummary,
      historicalParallel,
      correctiveActions:
        correctiveActions.length > 0
          ? correctiveActions
          : ['Review flight command decisions during peak crisis events.'],
      telemetryLog: simResult.logs,
    };
  }

  // Buffer overflow or budget overrun or partial health
  const dataLostMB =
    simResult.finalBufferPct >= 92 ? Math.round((simResult.finalBufferPct - 85) * 18) : 0;
  const scienceDeliveredPct = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        simResult.scienceCollected * (dataLostMB > 0 ? 0.72 : 1.0) * (simResult.finalHealthPct / 100)
      )
    )
  );

  const isPartial =
    dataLostMB > 0 ||
    telemetry.costStatus === 'critical' ||
    scienceDeliveredPct < 75 ||
    simResult.finalHealthPct < 75;

  if (isPartial) {
    return {
      outcome: 'partial',
      headline: `Mission Partial Success: ${target.name}`,
      missionGrade: scienceDeliveredPct >= 65 ? 'B' : 'C',
      scienceDeliveredPct,
      dataLostMB,
      rootCauseTitle:
        dataLostMB > 0
          ? 'Onboard Memory Buffer Overflow & Data Loss'
          : telemetry.costStatus === 'critical'
            ? `Program Cost Overrun ($${telemetry.totalCostM}M / $${telemetry.budgetCapM}M)`
            : 'Degraded Science Return Under Subsystem Strain',
      rootCauseSummary:
        dataLostMB > 0
          ? `Spacecraft survived ${target.name} orbit, but low downlink bandwidth caused ${dataLostMB} MB of science observations to be overwritten.`
          : telemetry.costStatus === 'critical'
            ? `Technical objectives achieved, but mission exceeded Congressional budget cap by $${Math.abs(telemetry.costMarginM)}M.`
            : `Spacecraft returned ${scienceDeliveredPct}% of target science, limited by subsystem margins or missing objective instruments.`,
      historicalParallel:
        'Galileo High-Gain Antenna Failure (1991) — When primary downlink is constrained, engineers must rely on aggressive compression and sacrifice science volume.',
      correctiveActions:
        correctiveActions.length > 0
          ? correctiveActions
          : ['Add objective-matched instruments or boost downlink capacity for an S/A grade.'],
      telemetryLog: simResult.logs,
    };
  }

  return {
    outcome: 'triumph',
    headline: `Mission Triumph: ${target.name} Science Complete`,
    missionGrade: scienceDeliveredPct >= 92 && telemetry.costMarginM >= 10 ? 'S' : 'A',
    scienceDeliveredPct,
    dataLostMB: 0,
    rootCauseTitle: 'All Systems Coupled Within Nominal Engineering Margins',
    rootCauseSummary: `Your ${telemetry.totalMassKg} kg spacecraft launched cleanly, survived ${target.name}'s thermal/radiation environment, and downlinked ${scienceDeliveredPct}% of mission science within the $${telemetry.budgetCapM}M budget.`,
    historicalParallel:
      'Juno & Mars Reconnaissance Orbiter — Disciplined mass, power, and DSN link budgets enable decades of continuous planetary discovery.',
    correctiveActions: [
      'Try an Advanced scenario preset like Europa Ocean Clipper or cut budget further to test tighter margins.',
    ],
    telemetryLog: simResult.logs,
  };
}
