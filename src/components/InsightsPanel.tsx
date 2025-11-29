import { DeviceSample } from '../types/DeviceSample';
import {
  detectIdleStretches,
  detectPeak15MinDemand,
  detectPhaseImbalanceWindows,
  Insight
} from '../utils/insights';

interface InsightsPanelProps {
  samples: DeviceSample[];
  windowMinutes: number;
}

export function InsightsPanel({
  samples,
  windowMinutes
}: InsightsPanelProps) {
  if (!samples.length) {
    return (
      <section className="insights" aria-label="Auto insights">
        <h2>Auto‑insights</h2>
        <p>No data yet.</p>
      </section>
    );
  }

  const effectiveIdleThreshold =
    windowMinutes >= 30 ? 30 : Math.max(5, Math.floor(windowMinutes / 2));

  const insights: Insight[] = [
    ...detectIdleStretches(samples, effectiveIdleThreshold),
    ...detectPeak15MinDemand(samples),
    ...detectPhaseImbalanceWindows(samples, 15, 2)
  ];

  const limited = insights.slice(0, 6);

  return (
    <section className="insights" aria-label="Auto insights">
      <h2>Auto‑insights</h2>
      <p className="insights-note">
        Implemented: extended IDLE windows, peak 15‑minute demand, and phase
        imbalance &gt;15% for ≥2 min. Idle threshold scales with visible window
        (here: {effectiveIdleThreshold} min).
      </p>
      {limited.length === 0 ? (
        <p>No notable patterns detected in the current window.</p>
      ) : (
        <ul>
          {limited.map((insight) => (
            <li
              key={insight.id}
              className={`insight-item insight-${insight.severity}`}
            >
              <h3>{insight.title}</h3>
              <p>{insight.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}