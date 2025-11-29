import { DeviceSample } from '../types/DeviceSample';

export interface StateDurations {
  runMs: number;
  idleMs: number;
  offMs: number;
  totalMs: number;
}

export function computeStateDurations(samples: DeviceSample[]): StateDurations {
  if (samples.length < 2) {
    return { runMs: 0, idleMs: 0, offMs: 0, totalMs: 0 };
  }

  let runMs = 0;
  let idleMs = 0;
  let offMs = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const cur = samples[i];
    const next = samples[i + 1];
    const dt =
      new Date(next.timestamp).getTime() - new Date(cur.timestamp).getTime();
    if (cur.state === 'RUN') runMs += dt;
    else if (cur.state === 'IDLE') idleMs += dt;
    else if (cur.state === 'OFF') offMs += dt;
  }

  const totalMs = runMs + idleMs + offMs;
  return { runMs, idleMs, offMs, totalMs };
}

export function computeAverageKw(samples: DeviceSample[]): number {
  if (!samples.length) return 0;
  const sum = samples.reduce((acc, s) => acc + s.kw, 0);
  return sum / samples.length;
}

export function computeEnergyKwh(samples: DeviceSample[]): number {
  if (!samples.length) return 0;
  const values = samples.map((s) => s.kwh_total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}

export function computePfAverage(samples: DeviceSample[]): number {
  const filtered = samples.filter(
    (s) => (s.state === 'RUN' || s.state === 'IDLE') && s.pf !== null
  );
  if (!filtered.length) return 0;
  const sum = filtered.reduce((acc, s) => acc + (s.pf ?? 0), 0);
  return sum / filtered.length;
}

export interface ThroughputResult {
  unitsPerMin: number;
  rolling60sUnitsPerMin: number;
}

export function computeThroughput(
  samples: DeviceSample[]
): ThroughputResult {
  if (samples.length < 2) {
    return { unitsPerMin: 0, rolling60sUnitsPerMin: 0 };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];

  const dtMs =
    new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
  const dtMin = dtMs / 60000;
  const deltaCount = last.count_total - first.count_total;
  const unitsPerMin = dtMin > 0 ? deltaCount / dtMin : 0;

  const cutoff60 = new Date(last.timestamp).getTime() - 60_000;
  const last60 = samples.filter(
    (s) => new Date(s.timestamp).getTime() >= cutoff60
  );
  let rolling = 0;
  if (last60.length > 1) {
    const first60 = last60[0];
    const delta60 = last.count_total - first60.count_total;
    // counts in last 60 s -> units / min = delta60 / 1 min = delta60
    rolling = delta60;
  }

  return { unitsPerMin, rolling60sUnitsPerMin: rolling };
}

export function computePhaseImbalancePercent(sample: DeviceSample): number {
  const currents = [sample.ir, sample.iy, sample.ib];
  const maxI = Math.max(...currents);
  const minI = Math.min(...currents);
  const avgI = currents.reduce((a, b) => a + b, 0) / currents.length;
  if (!avgI) return 0;
  return ((maxI - minI) / avgI) * 100;
}

export function round(num: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}