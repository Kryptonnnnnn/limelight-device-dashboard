# LimelightIT Device Stream Dashboard

Live-ish monitoring of a synthetic device stream with KPIs and auto‑insights, built for the **LimelightIT — Device Stream Challenge**.

This app replays a JSONL device stream at 1× in the browser, maintains a sliding time window, and computes power/uptime KPIs plus a small set of automatically generated insights.

---

## 1. Architecture

### Tech stack

- **Frontend:** React 18 + TypeScript + Vite
- **Charts:** [Recharts](https://recharts.org/)
- **Styling:** Custom CSS (no CSS framework), dark theme, high‑contrast colors
- **Data source:** Static JSONL file served from `/public/device.jsonl`, replayed at **1 record per second** using a custom React hook

### High‑level components

- `useDeviceStream`  
  Loads `device.jsonl`, parses it line‑by‑line, and “streams” it into the app at 1 Hz using `setInterval`. Maintains **only the last N minutes** of samples (5/15/30) in memory.

- `KpiCards`  
  Computes and renders KPIs for the **currently visible window**.

- `Charts`  
  Shows:
  - kW trend over time
  - A state band aligned with the kW chart (RUN / IDLE / OFF)
  - Phase currents: `ir`, `iy`, `ib`
  - Phase voltages: `vr`, `vy`, `vb`

- `InsightsPanel`  
  Runs simple algorithms over the current window to produce textual **auto‑insights**.

- `GapBadge`  
  Tracks the time since the last sample and shows a red “No data >10 s” badge if the stream is stale.

- `exportSamplesToCsv`  
  Exports all samples in the visible window to CSV.

---

## 2. Data model

Each line in `public/device.jsonl` is a single JSON object:

```jsonc
{
  "timestamp": "2025-01-01T10:00:00Z",
  "state": "RUN",           // "RUN" | "IDLE" | "OFF"
  "kw": 5.2,                // instantaneous real power
  "kwh_total": 120.5,       // cumulative energy counter
  "pf": 0.86,               // power factor (0–1)
  "count_total": 100,       // cumulative unit/part counter
  "ir": 10.1, "iy": 9.8, "ib": 10.3, // phase currents
  "vr": 230, "vy": 231, "vb": 229,   // phase voltages
  "alarm_code": null        // or a string code
}
```

TypeScript type: `src/types/DeviceSample.ts`.

---

## 3. KPIs (definitions and implementation)

All KPIs are computed over the **currently visible time window** (5 / 15 / 30 minutes).

### 3.1 Uptime %, Idle %, Off %

**Definition from brief**

> (sum of durations with state=RUN/IDLE/OFF) ÷ (window duration) × 100.

**Implementation**

For each pair of consecutive samples `(samples[i], samples[i+1])`:

- Compute `dt = timestamp[i+1] − timestamp[i]` (in ms).
- Add `dt` to `runMs`, `idleMs`, or `offMs` based on `samples[i].state`.
- `totalMs = runMs + idleMs + offMs`.

Percentages:

```ts
uptimePct = (runMs / totalMs) * 100
idlePct  = (idleMs / totalMs) * 100
offPct   = (offMs / totalMs) * 100
```

This is a **time‑weighted** calculation, not a simple sample count.

Implementation: `computeStateDurations` in `src/utils/kpi.ts`.

---

### 3.2 Average kW (power)

**Definition from brief**

> mean of `kw` over samples in window (or time-weighted if you resample).

**Implementation**

Data are roughly 1 second apart, so a plain arithmetic mean is appropriate:

```ts
avgKw = sum(kw) / number_of_samples
```

Implementation: `computeAverageKw` in `src/utils/kpi.ts`.

Shown on the dashboard as “Avg kW: X.XX kW”.

---

### 3.3 Energy (kWh)

**Definition from brief**

> `max(kwh_total) − min(kwh_total)` in window. (Do not sum kW; use the energy register.)

**Implementation**

```ts
energyKwh = max(samples.map(s => s.kwh_total)) -
            min(samples.map(s => s.kwh_total))
```

Implementation: `computeEnergyKwh` in `src/utils/kpi.ts`.

This assumes `kwh_total` is a monotonically increasing (or mostly monotonic) meter reading.

---

### 3.4 PF average

**Definition from brief**

> arithmetic mean of `pf` over RUN + IDLE samples (ignore OFF).

**Implementation**

```ts
const filtered = samples.filter(
  s => (s.state === 'RUN' || s.state === 'IDLE') && s.pf !== null
);

pfAvg = filtered.length
  ? sum(filtered.map(s => s.pf)) / filtered.length
  : 0;
```

Implementation: `computePfAverage` in `src/utils/kpi.ts`.

This is explicitly documented in the UI and here in the README.

---

### 3.5 Throughput (units/min)

**Definition from brief**

> `(Δcount_total) ÷ (window minutes)`.  
> Tip: show also a rolling 60 s rate (counts in last 60 s × 60).

**Implementation**

1. **Window throughput (units/min)**

```ts
const first = samples[0];
const last  = samples[samples.length - 1];

const dtMin = (t_last - t_first) / 60000;
const deltaCount = last.count_total - first.count_total;

unitsPerMin = dtMin > 0 ? deltaCount / dtMin : 0;
```

2. **Rolling 60 s rate (units/min)**

- Take all samples with `timestamp >= last.timestamp - 60s`.
- Compute `delta60 = last.count_total - first_in_that_60s.count_total`.
- Rate in units/min over 60 s is simply `delta60`.

Implementation: `computeThroughput` in `src/utils/kpi.ts`.

Displayed as:

> `X units/min · Rolling 60s: Y units/min`

---

### 3.6 Phase imbalance % (current)

**Definition from brief**

> `(max(ir,iy,ib) − min(ir,iy,ib)) ÷ avg(ir,iy,ib) × 100`.

**Implementation**

Per sample:

```ts
const currents = [ir, iy, ib];
const maxI = Math.max(...currents);
const minI = Math.min(...currents);
const avgI = (ir + iy + ib) / 3;

imbalancePercent = avgI === 0 ? 0 : ((maxI - minI) / avgI) * 100;
```

Implementation: `computePhaseImbalancePercent` in `src/utils/kpi.ts`.

The dashboard shows:

- **Latest** phase imbalance in the KPI cards.
- Uses this metric as part of one auto‑insight (phase imbalance windows).

---

## 4. Auto‑insights

The brief suggests several possible auto‑insights. This app implements **three** of them:

1. **Idle > 30 min (adaptive threshold)**
2. **Peak 15‑min demand**
3. **Phase imbalance >15% for ≥2 min**

All insight logic lives in `src/utils/insights.ts` and is rendered by `InsightsPanel`.

### 4.1 Extended Idle windows

**Original brief**

> Idle > 30 min: detect contiguous IDLE stretches ≥ 30 min (if not present in 20 min sample, allow shorter threshold and note it).

**Implementation**

- Group consecutive samples where `state === "IDLE"` into segments.
- For each segment:
  - `duration = t_last - t_first` (in that segment).
  - If `duration >= idleThresholdMinutes`, create an insight.

**Adaptive threshold**

On short windows, a strict 30‑minute threshold may never trigger. To still surface meaningful behavior, the idle threshold is:

```txt
if windowMinutes >= 30:
    idleThresholdMinutes = 30
else:
    idleThresholdMinutes = max(5, floor(windowMinutes / 2))
```

This is clearly stated in the Insights panel:

> Idle threshold scales with visible window (here: X min).

Implementation: `detectIdleStretches` in `src/utils/insights.ts`.

---

### 4.2 Peak 15‑minute demand

**Brief**

> Peak 15-min demand: rolling 15-min average of kw; report max value & timestamp.

**Implementation**

For each sample `i`:

1. Let `t_end = timestamp[i]`.
2. Consider the 15‑minute window `[t_end − 15 min, t_end]`.
3. Collect all samples whose timestamps fall into this range.
4. Compute the average `kw` in this window.
5. Keep track of the **maximum** rolling 15‑minute average and the corresponding end timestamp.

The insight is reported as:

> Highest rolling 15‑minute average demand is **X.XX kW** ending at **YYYY-MM-DDTHH:mm:ssZ**.

Implementation: `detectPeak15MinDemand` in `src/utils/insights.ts`.

Note: this is computed over **all samples currently in the visible window**.

---

### 4.3 Phase imbalance >15% for ≥2 min

**Brief**

> Phase imbalance: % imbalance > 15% for ≥ 2 min.

**Implementation**

1. For each sample, compute `imbalance = phaseImbalancePercent(sample)`.
2. Flag any sample with `imbalance > 15`.
3. Group **consecutive flagged samples** into segments.
4. For each segment:
   - Duration = `t_last - t_first`.
   - If `duration >= 2 min`, emit an insight including:
     - Start and end time.
     - Duration in minutes.
     - Maximum imbalance during the segment.

Example insight:

> Phase current imbalance > 15% from 2025‑01‑01T10:04:00Z to 2025‑01‑01T10:06:00Z (2.0 min), peak 22.3%.

Implementation: `detectPhaseImbalanceWindows` in `src/utils/insights.ts`.

---

## 5. Gap detector

The app detects when the stream goes quiet.

- `useDeviceStream` updates `lastMessageTime = Date.now()` whenever it parses a new sample.
- `GapBadge` compares `Date.now()` with `lastMessageTime`:
  - If **no data for >10 seconds**, it shows a red badge:

    > `No data > 10 s (Xs)`

  - Otherwise a green badge:

    > `Live <10 s`

This satisfies the “No data >10 s” gap detector requirement from the brief.

---

## 6. CSV export

The “Export visible window as CSV” button downloads all current samples in the sliding window as a `.csv` file.

- Fields included: **all raw fields** from `DeviceSample` (timestamp, state, kw, kwh_total, pf, count_total, ir, iy, ib, vr, vy, vb, alarm_code).
- Implementation: `exportSamplesToCsv` in `src/utils/csv.ts`.
- Logic:
  - Use the keys of the first sample as headers.
  - Stringify each value via `JSON.stringify` for basic CSV escaping.
  - Create a Blob, object URL, and trigger a download.

This gives analysts the exact raw data behind the KPIs and insights.

---

## 7. Running the project locally

### 7.1 Prerequisites

- Node.js 18+ (recommended)
- npm (comes with Node)

### 7.2 Setup

```bash
# Clone your fork / repo
git clone <your-repo-url> limelight-dashboard
cd limelight-dashboard

# Install dependencies
npm install
```

Place the provided device stream file as:

```text
public/device.jsonl
```

Each line must be a valid JSON object (no trailing commas, etc.).

### 7.3 Start dev server

```bash
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open that in your browser.

You should see:

- Top bar with:
  - Title and subtitle
  - Window selector (5 / 15 / 30 min)
  - Gap badge (“Live <10 s”)
- kW trend chart and state band
- Phase current and voltage mini‑charts
- KPI cards for state split, power & energy, PF average, throughput, phase imbalance, and current status
- Auto‑insights list at the bottom
- A button to export the visible window as CSV

### 7.4 Production build

```bash
npm run build
npm run preview
```

Use `npm run preview` to test the optimized production build locally before deploying.

---

## 8. Deployment

This app is a static SPA; it can be deployed on any static host:

- Vercel, Netlify, GitHub Pages, etc.

Typical Vercel setup:

1. Push code to GitHub.
2. Import the repo into Vercel.
3. Use defaults:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Ensure `public/device.jsonl` is committed so it’s deployed and accessible.

Note: Because this uses JSONL replay at 1×, the “stream” restarts from the beginning on every page load. This is intentional for the challenge and documented here as a **replay** mode, not a real-time device connection.

---

## 9. Performance & accessibility

The app is designed to meet the brief’s “Performance & a11y” requirements.

### Measures taken

- **Performance**
  - Minimal bundle: React + Recharts only.
  - No large images or fonts; all visuals are vector/DOM‑based.
  - Vite production build used for deployments.

- **Accessibility**
  - Semantic landmarks:
    - `<header>`, `<main>`, `<footer>` via `Layout`.
  - ARIA / roles:
    - `aria-label` on main sections and header.
    - `role="status"` and `aria-live` for the gap badge so screen readers are notified when the stream stalls.
  - Keyboard:
    - All interactive controls are `<button>` elements with proper labels.
  - Colors:
    - Dark theme with high‑contrast text and KPI cards.
    - Muted text and grid lines chosen to exceed WCAG AA contrast against the background (tuned as needed based on Lighthouse feedback).

- **Lighthouse**
  - The goal is **≥90 (Desktop)** across Performance, Accessibility, Best Practices, and SEO.
  - A Lighthouse report screenshot can be added to the repo (e.g. `docs/lighthouse.png`) as evidence.

---

## 10. Known limitations & potential extensions

**Limitations**

- Stream is a **local replay** of a static JSONL file, not a true SSE endpoint.
- The state band under the kW chart is simplified; it’s aligned in time but not a fully segmented, color‑coded strip per state sample.
- Insights run on the visible window; they do not persist over the full historical dataset across reloads.

**Potential extensions**

- Swap `useDeviceStream` to use `EventSource` and read from a real SSE endpoint (`/stream`) with the same data schema.
- Enrich the state band with per‑state color segments.
- Add alarms panel for `alarm_code` occurrence statistics.
- Add base‑load analysis (median kW during non‑RUN periods and monthly cost at configurable price).

---

## 11. Summary

This project focuses on:

- Correctly implementing **power and uptime KPIs** per the challenge definitions.
- Providing **3 meaningful auto‑insights**:
  - Extended idle periods.
  - Peak 15‑minute demand.
  - Phase current imbalance >15% for ≥2 minutes.
- Surfacing a clear **gap detector** and **CSV export** for the currently visible window.
- Meeting **performance and accessibility** targets with a clean, single‑page UI.

It is intentionally scoped and structured so that it could be extended to a real SSE or MQTT‑backed device monitoring system with minimal changes.
