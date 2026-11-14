export type PhaseId = 'target' | 'spacecraft' | 'trajectory' | 'simulation';

export type StatusLevel = 'nominal' | 'marginal' | 'critical';

export interface TargetDestination {
  id: string;
  name: string;
  subtitle: string;
  orbitDistanceAU: number; // Distance from Sun in AU
  earthDistanceAU: number; // Avg comms distance from Earth in AU
  solarFluxWm2: number; // Real solar irradiance at target
  commsLatencyLabel: string;
  requiredDeltaVKms: number; // LEO to Target Orbit capture
  radiationKradYr: number;
  radiationLabel: string;
  eclipseMinutes: number;
  tempMinC: number;
  tempMaxC: number;
  defaultBudgetM: number;
  cruiseDaysDirect: number;
  colorHex: string;
  accentHex: string;
  objectives: {
    id: string;
    title: string;
    description: string;
    recommendedInstruments: string[];
    bonusScience: number;
  }[];
  realNasaNote: string;
}

export type SubsystemCategory =
  | 'power'
  | 'battery'
  | 'comms'
  | 'thermal'
  | 'avionics'
  | 'instrument';

export interface SpacecraftComponent {
  id: string;
  name: string;
  shortName: string;
  category: SubsystemCategory;
  massKg: number;
  costM: number;
  powerDrawW: number; // Positive = consumes power
  powerGen1AUW?: number; // Scales with solar flux
  powerGenConstantW?: number; // RTG constant power
  passiveHeatW?: number; // RTG waste heat
  batteryWh?: number;
  dataRateKbps1AU?: number; // Downlink rate at 1 AU
  dataBufferGB?: number;
  dataGenMBHr?: number; // Science instrument data generation
  scienceValue?: number;
  radHardness?: number; // 0 to 100
  thermalHeatingW?: number; // Prevents cryogenic freeze
  thermalCoolingW?: number; // Prevents thermal runaway
  description: string;
  tradeOffTip: string;
}

export interface LaunchVehicle {
  id: string;
  name: string;
  vehicleClass: string;
  maxPayloadKg: number; // Deep space / transfer payload capability
  costM: number;
  deltaVAssistKms: number;
  fairingDiameterM: number;
  description: string;
}

export interface TrajectoryOption {
  id: string;
  name: string;
  deltaVReductionKms: number;
  extraMassKg: number;
  extraCostM: number;
  cruisePowerDrawW: number;
  cruiseTimeMultiplier: number;
  innerSolarPassAU: number; // 1.0 AU normal, 0.72 AU for Venus flyby
  description: string;
  tradeOffTip: string;
}

export interface MissionConfig {
  targetId: string;
  objectiveId: string;
  budgetCapM: number;
  powerId: string;
  batteryId: string;
  commsId: string;
  thermalIds: string[]; // Multi-select thermal/rad protection
  avionicsId: string;
  instrumentIds: string[]; // Multi-select science payloads
  launchVehicleId: string;
  trajectoryId: string;
}

export interface EngineeringAdvisory {
  id: string;
  level: StatusLevel;
  subsystem: string;
  title: string;
  detail: string;
}

export interface ComputedTelemetry {
  totalMassKg: number;
  payloadLimitKg: number;
  massMarginKg: number;
  massStatus: StatusLevel;

  totalCostM: number;
  budgetCapM: number;
  costMarginM: number;
  costStatus: StatusLevel;

  sunlitPowerGenW: number;
  eclipsePowerGenW: number;
  powerDrawW: number;
  netSunlitPowerW: number;
  netEclipsePowerW: number;
  batteryCapacityWh: number;
  eclipseSurvivalMinutes: number;
  powerStatus: StatusLevel;

  downlinkKbps: number;
  downlinkMBHr: number;
  scienceGenMBHr: number;
  bufferCapacityGB: number;
  netBufferFillMBHr: number;
  hoursToBufferFull: number | null;
  commsStatus: StatusLevel;

  requiredDeltaVKms: number;
  effectiveDeltaVKms: number;
  deltaVStatus: StatusLevel;

  thermalStatus: StatusLevel;
  radiationStatus: StatusLevel;

  rawScienceScore: number;
  objectiveBonusActive: boolean;

  radarScores: {
    science: number;
    power: number;
    thermalRad: number;
    comms: number;
    costEfficiency: number;
  };

  advisories: EngineeringAdvisory[];
  launchReady: boolean;
  blockingIssuesCount: number;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  difficulty: 'Introductory' | 'Intermediate' | 'Advanced';
  summary: string;
  config: MissionConfig;
}

export interface SimTelemetryPoint {
  step: number;
  timeLabel: string;
  batteryPct: number;
  bufferPct: number;
  coreTempC: number;
  scienceCollected: number;
}

export interface CrisisEvent {
  id: string;
  title: string;
  description: string;
  stage: 'Ascent' | 'Cruise' | 'Orbit Ops';
  severity: 'caution' | 'critical';
  options: {
    id: string;
    label: string;
    effectSummary: string;
    batteryDelta: number;
    bufferDelta: number;
    tempDelta: number;
    scienceDelta: number;
    healthDelta: number;
  }[];
}

export interface MishapReport {
  outcome: 'triumph' | 'partial' | 'mishap';
  headline: string;
  missionGrade: 'S' | 'A' | 'B' | 'C' | 'F';
  scienceDeliveredPct: number;
  dataLostMB: number;
  rootCauseTitle: string;
  rootCauseSummary: string;
  historicalParallel: string;
  correctiveActions: string[];
  telemetryLog: string[];
}
