import { DeviceSample } from '../types/DeviceSample';
import {
  computeAverageKw,
  computeEnergyKwh,
  computePfAverage,
  computeStateDurations,
  computeThroughput,
  computePhaseImbalancePercent,
  round
} from '../utils/kpi';

interface KpiCardsProps {
  samples: DeviceSample[];
}

export function KpiCards({ samples }: KpiCardsProps) {
  const durations = computeStateDurations(samples);
  const avgKw = computeAverageKw(samples);
  const energy = computeEnergyKwh(samples);
  const pfAvg = computePfAverage(samples);
  const throughput = computeThroughput(samples);
  const latest = samples[samples.length - 1];

  let uptimePct = 0;
  let idlePct = 0;
  let offPct = 0;

  if (durations.totalMs > 0) {
    uptimePct = (durations.runMs / durations.totalMs) * 100;
    idlePct = (durations.idleMs / durations.totalMs) * 100;
    offPct = (durations.offMs / durations.totalMs) * 100;
  }

  const phaseImbalanceLatest =
    latest !== undefined ? computePhaseImbalancePercent(latest) : 0;

  return (
    <section className="kpi-grid" aria-label="Key performance indicators">
      <article className="kpi-card">
        <h2>State split</h2>
        <p className="kpi-main">
          Uptime {round(uptimePct)}% / Idle {round(idlePct)}% / Off{' '}
          {round(offPct)}%
        </p>
        <p className="kpi-note">
          Computed as time‑weighted share of RUN / IDLE / OFF over the visible
          window.
        </p>
      </article>

      <article className="kpi-card">
        <h2>Power &amp; energy</h2>
        <p className="kpi-main">
          Avg kW: {round(avgKw, 2)} kW · Energy: {round(energy, 2)} kWh
        </p>
        <p className="kpi-note">
          Energy uses kWh register: max(kwh_total) − min(kwh_total) in window.
        </p>
      </article>

      <article className="kpi-card">
        <h2>Power factor</h2>
        <p className="kpi-main">PF avg: {round(pfAvg, 3)}</p>
        <p className="kpi-note">
          Arithmetic mean over RUN + IDLE samples; OFF ignored.
        </p>
      </article>

      <article className="kpi-card">
        <h2>Throughput</h2>
        <p className="kpi-main">
          {round(throughput.unitsPerMin, 2)} units/min · Rolling 60s:{' '}
          {round(throughput.rolling60sUnitsPerMin, 2)} units/min
        </p>
        <p className="kpi-note">
          Window throughput uses Δcount_total ÷ window minutes; rolling 60s is
          counts in last 60s.
        </p>
      </article>

      <article className="kpi-card">
        <h2>Phase imbalance</h2>
        <p className="kpi-main">
          Latest current imbalance: {round(phaseImbalanceLatest, 1)}%
        </p>
        <p className="kpi-note">
          (max(Ir, Iy, Ib) − min(Ir, Iy, Ib)) ÷ avg(Ir, Iy, Ib) × 100.
        </p>
      </article>

      {latest && (
        <article className="kpi-card">
          <h2>Current status</h2>
          <p className="kpi-main">
            State: {latest.state} · {round(latest.kw, 2)} kW · count:{' '}
            {latest.count_total}
          </p>
          <p className="kpi-note">
            Last sample at {latest.timestamp}
            {latest.alarm_code ? ` · Alarm: ${latest.alarm_code}` : ' · No alarm'}
          </p>
        </article>
      )}
    </section>
  );
}