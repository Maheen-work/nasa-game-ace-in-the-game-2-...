View the web game:
[Visit webgame](https://fancy-tulumba-79a8f9.netlify.app/)



# Mission Architect — Space Systems Engineering Simulator

A browser-based NASA space mission design and systems engineering simulator where players build a spacecraft from scratch, balance coupled engineering trade-offs, launch it across the solar system, and manage real-time flight anomalies.

---

## 1. How the Game Works

The game follows an end-to-end 4-phase space mission lifecycle:

1. **Target & Objective (`1. Target`)**
   - Pick a destination (*Lunar South Pole*, *Mars Polar Orbit*, *16 Psyche*, or *Europa*) and a primary science objective, or load one of the 4 built-in **Scenario Presets**.
   - Each destination enforces real planetary constraints: solar flux ($\text{W/m}^2$), Deep Space Network latency, radiation dose ($\text{krad/yr}$), orbital eclipse duration, temperature extremes, and required $\Delta v$.

2. **Spacecraft Bus & Science Payload (`2. Spacecraft` / `2. Bus`)**
   - Assemble the spacecraft by selecting:
     - **Power**: Silicon Solar Arrays, Ultralight Solar Wings (output drops with $1/\text{AU}^2$), or an MMRTG Nuclear Battery (constant power + passive heat).
     - **Battery**: Compact vs. Deep-Space battery bank for surviving planetary eclipses.
     - **Communications**: Low-Gain Whip vs. Ka-Band High-Gain Dish (determines downlink speed vs. distance).
     - **Thermal & Radiation Shielding**: MLI thermal blankets, active heaters, ammonia radiator fins, and a tantalum radiation vault.
     - **Avionics & Science Instruments**: 64 GB or 256 GB Rad-Hard flight computer plus HD Imager, Ice-Penetrating Radar, Spectrometer, Magnetometer Boom, and Laser Altimeter.
   - As parts are toggled, the **Blueprint Canvas** draws them onto the spacecraft in real time while the **Telemetry Strip**, **5-Axis Trade-Off Radar**, and **Systems Engineering Advisories** flag overweight builds, power deficits, buffer overflows, thermal runaway, radiation risks, and budget overruns.

3. **Launch Vehicle & Trajectory (`3. Trajectory` / `3. Launch`)**
   - Pair a *SmallSat*, *Medium-Lift*, or *Heavy-Lift* rocket with a *Direct Hohmann*, *Solar Electric Ion Propulsion (SEP)*, or *Venus-Earth Gravity Assist (VEGA)* trajectory.
   - Selecting VEGA saves $\Delta v$ for outer-planet targets like Europa, but routes the probe past Venus ($0.72\text{ AU}$, $2{,}600\text{ W/m}^2$), causing thermal failure unless Radiator Fins are installed.

4. **Launch & Crisis Simulation (`Launch Mission` / `4. Simulation`)**
   - Runs a 3-stage animated simulation (**Ascent → Interplanetary Cruise → Target Orbit & Eclipse**) with `1x`/`2x`/`4x` speed controls and live Battery, Data Buffer, Core Temperature, Health, and Science telemetry.
   - Triggers 3 **Live Anomaly** events (e.g., Venus thermal spike, X-class solar flare, umbral eclipse, DSN buffer congestion) where players pick real-time Flight Control commands.
   - Ends with a **Mission Triumph** dossier or a **NASA Mishap Investigation Report** (`S`–`F` grade) detailing root causes, real NASA mission parallels, and corrective fixes.

---

## 2. How the Code Works

The application uses a reactive, single-direction data flow entirely in the browser:

```text
User clicks in ControlDeck / Presets
        │
        ▼
  App.tsx (holds MissionConfig state & active phase)
        │
        ▼
  systemsPhysics.ts → computeMissionTelemetry(config)
        │  calculates mass, 1/AU² power, eclipse minutes,
        │  DSN downlink vs. buffer fill, Δv, thermal/rad status,
        │  5-axis radar scores, and engineering advisories
        ▼
  ┌─────────────────────┬──────────────────────┬───────────────────────┐
  ▼                     ▼                      ▼                       ▼
BlueprintCanvas    TelemetryStrip        TradeOffRadar         OrbitalSimulation
(HTML5 Canvas      (4 live KPI bars      & Advisories          (3-stage Canvas flight,
 CAD assembly)      & status glyphs)     (SVG chart & alerts)   crisis events & report)
```

### File Breakdown

- **`index.html` & `src/main.tsx`**: Mounts the React application into `#root` and loads `Chakra Petch`, `IBM Plex Sans`, and `IBM Plex Mono` fonts.
- **`src/index.css`**: Configures Tailwind CSS v4 theme typography, tabular numeral formatting, and the `.blueprint-grid` background.
- **`src/types/mission.ts`**: TypeScript interfaces for targets, components, launch vehicles, trajectories, telemetry output, crisis events, and mishap reports.
- **`src/data/missionData.ts`**: Static catalog of planetary targets, spacecraft hardware specs, launch vehicles, transfer options, and scenario presets.
- **`src/engine/systemsPhysics.ts`**: Core deterministic engineering engine:
  - `computeMissionTelemetry()`: Couples subsystem mass, cost, inverse-square solar/DSN scaling, eclipse endurance, data backlog, thermal/radiation rules, and radar scores.
  - `generateCrisisEvents()`: Generates flight anomalies tailored to the chosen destination and trajectory.
  - `generateMishapReport()`: Evaluates flight telemetry to produce the final grade, root-cause findings, and NASA historical parallels.
- **`src/App.tsx`**: Manages `MissionConfig` state, phase navigation (`target`, `spacecraft`, `trajectory`, `simulation`), and scenario presets.
- **`src/components/ControlDeck.tsx`**: Renders the left-hand selection controls for destinations, spacecraft subsystems, rockets, and trajectories.
- **`src/components/BlueprintCanvas.tsx`**: HTML5 2D `<canvas>` renderer that dynamically assembles every chosen part onto the spacecraft bus with animated signal/RF pulses, CAD dimension overlays, thermal map view, and mouse hover hit-testing.
- **`src/components/TelemetryStrip.tsx`**: Displays live Launch Mass, Power Balance, DSN Downlink, and Mission Cost meters with `● Nominal`, `▲ Marginal`, and `✖ Critical` indicators.
- **`src/components/TradeOffRadar.tsx`**: Inline SVG 5-axis radar chart plotting Science, Power, Environmental Safety, Comms, and Budget Efficiency.
- **`src/components/TradeOffAdvisories.tsx`**: Displays real-time coupled warnings whenever subsystem constraints conflict.
- **`src/components/OrbitalSimulation.tsx`**: Drives the timed simulation loop, renders the 3-stage ascent/cruise/orbit `<canvas>`, draws the live SVG Battery/Buffer/Science waveform chart, handles interactive crisis choices, and renders the post-mission report.

---

## 3. What Was Used to Build It

- **React 19** — Component UI architecture and reactive state management
- **TypeScript** — Strict typing for aerospace subsystems, telemetry, and simulation state
- **Vite** — Fast module bundling and dev server
- **Tailwind CSS v4** (`@tailwindcss/vite`) — Utility-first dark-mode mission control styling
- **HTML5 2D Canvas API** — Interactive spacecraft blueprint assembly and animated rocket/orbital/eclipse visualizations
- **Inline SVG** — 5-axis trade-off radar chart and real-time multi-channel telemetry waveform graph
- **`lucide-react`** — Playback, warning, and status UI icons
- **100% Client-Side Execution** — All physics, charts, animations, and diagnostics run locally in the browser with no backend server, database, or external API keys.

