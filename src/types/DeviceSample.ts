export type DeviceState = 'RUN' | 'IDLE' | 'OFF';

export interface DeviceSample {
  timestamp: string; // ISO string
  state: DeviceState;
  kw: number;
  kwh_total: number;
  pf: number | null;
  count_total: number;
  ir: number;
  iy: number;
  ib: number;
  vr: number;
  vy: number;
  vb: number;
  alarm_code: string | null;
}