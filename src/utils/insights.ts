import { DeviceSample } from '../types/DeviceSample';
import { computePhaseImbalancePercent } from './kpi';

export interface Insight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  startTime?: string;
  endTime?: string;
}

function groupByState(
  samples: DeviceSample[],
  targetState: DeviceSample['state']
) {
  const segments: { startIdx: number; endIdx: number }[] = [];
  let start = -1;

  samples.forEach((s, i) => {
    if (s.state === targetState) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      segments.push({ startIdx: start, endIdx: i - 1 });
      start = -1;
    }
  });

  if (start !== -1) {
    segments.push({ startIdx: start, endIdx: samples.length - 1 });
  }

  return segments;
}

export function detectIdleStretches(
  samples: DeviceSample[],
  minMinutes: number
): Insight[] {
  if (!samples.length) return [];
  const segments = groupByState(samples, 'IDLE');
  const thresholdMs = minMinutes * 60_000;
  const insights: Insight[] = [];

  segments.forEach((seg, idx) => {
    const start = samples[seg.startIdx];
    const end = samples[seg.endIdx];
    const durationMs =
      new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime();
    if (durationMs >= thresholdMs) {
      const minutes = durationMs / 60000;
      insights.push({
        id: `idle-${idx}`,
        title: 'Extended idle period',
        description: `Machine idle from ${start.timestamp} to ${end.timestamp} (${minutes.toFixed(
          1
        )} min). Consider schedule or changeover optimization.`,
        severity: 'info',
        startTime: start.timestamp,
        endTime: end.timestamp
      });
    }
  });

  return insights;
}

export function detectPeak15MinDemand(
  samples: DeviceSample[]
): Insight[] {
  if (!samples.length) return [];

  let bestAvg = 0;
  let bestEnd: DeviceSample | null = null;

  const fifteenMs = 15 * 60_000;

  for (let i = 0; i < samples.length; i++) {
    const end = samples[i];
    const endTime = new Date(end.timestamp).getTime();
    const windowStart = endTime - fifteenMs;
    const window = samples.filter(
      (s) => new Date(s.timestamp).getTime() >= windowStart && new Date(s.timestamp).getTime() <= endTime
    );
    if (!window.length) continue;
    const avg =
      window.reduce((acc, s) => acc + s.kw, 0) / window.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestEnd = end;
    }
  }

  if (!bestEnd) return [];

  return [
    {
      id: 'peak-15min-kw',
      title: 'Peak 15‑minute demand',
      description: `Highest rolling 15‑minute average demand is ${bestAvg.toFixed(
        2
      )} kW ending at ${bestEnd.timestamp}.`,
      severity: 'warning',
      endTime: bestEnd.timestamp
    }
  ];
}

export function detectPhaseImbalanceWindows(
  samples: DeviceSample[],
  thresholdPercent: number,
  minMinutes: number
): Insight[] {
  if (!samples.length) return [];

  type FlaggedSample = { index: number; imbalance: number };
  const flagged: FlaggedSample[] = [];

  samples.forEach((s, i) => {
    const imb = computePhaseImbalancePercent(s);
    if (imb > thresholdPercent) {
      flagged.push({ index: i, imbalance: imb });
    }
  });

  if (!flagged.length) return [];

  const segments: { startIdx: number; endIdx: number; maxImb: number }[] = [];
  let currentStart = 0;
  let maxImb = flagged[0].imbalance;

  for (let i = 1; i < flagged.length; i++) {
    const prev = flagged[i - 1];
    const curr = flagged[i];
    if (curr.index === prev.index + 1) {
      if (curr.imbalance > maxImb) maxImb = curr.imbalance;
    } else {
      segments.push({
        startIdx: flagged[currentStart].index,
        endIdx: prev.index,
        maxImb
      });
      currentStart = i;
      maxImb = curr.imbalance;
    }
  }
  segments.push({
    startIdx: flagged[currentStart].index,
    endIdx: flagged[flagged.length - 1].index,
    maxImb
  });

  const thresholdMs = minMinutes * 60_000;
  const insights: Insight[] = [];

  segments.forEach((seg, i) => {
    const start = samples[seg.startIdx];
    const end = samples[seg.endIdx];
    const durationMs =
      new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime();
    if (durationMs >= thresholdMs) {
      insights.push({
        id: `phase-imb-${i}`,
        title: 'Phase imbalance window',
        description: `Phase current imbalance > ${thresholdPercent}% from ${start.timestamp} to ${end.timestamp} (${(
          durationMs / 60000
        ).toFixed(1)} min), peak ${seg.maxImb.toFixed(1)}%.`,
        severity: 'warning',
        startTime: start.timestamp,
        endTime: end.timestamp
      });
    }
  });

  return insights;
}