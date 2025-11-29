import { DeviceSample } from '../types/DeviceSample';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { computePhaseImbalancePercent } from '../utils/kpi';

interface ChartsProps {
  samples: DeviceSample[];
}

function formatTimeLabel(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

export function Charts({ samples }: ChartsProps) {
  const data = samples.map((s) => ({
    timestamp: s.timestamp,
    time: formatTimeLabel(s.timestamp),
    kw: s.kw,
    state: s.state,
    ir: s.ir,
    iy: s.iy,
    ib: s.ib,
    vr: s.vr,
    vy: s.vy,
    vb: s.vb,
    imbalance: computePhaseImbalancePercent(s)
  }));

  return (
    <section className="charts" aria-label="Device trend charts">
      <div className="chart-block">
        <h2>kW trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ left: 0, right: 16, top: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="kw"
              tick={{ fontSize: 11 }}
              width={60}
              label={{
                value: 'kW',
                angle: -90,
                position: 'insideLeft',
                offset: 10
              }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="kw"
              stroke="#1d4ed8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="state-band" aria-label="State band RUN/IDLE/OFF">
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip
                formatter={(value, _name, props) =>
                  [`${props.payload.state}`, 'State']
                }
              />
              <Area
                type="step"
                dataKey="state"
                stroke="none"
                fillOpacity={1}
                isAnimationActive={false}
                // Custom color mapping via function
                fill="#e5e7eb"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="state-legend" aria-hidden="true">
            <span className="legend-run">RUN</span>
            <span className="legend-idle">IDLE</span>
            <span className="legend-off">OFF</span>
          </div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-block">
          <h2>Phase currents (A)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ left: 0, right: 16, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="ir"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="iy"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ib"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-block">
          <h2>Phase voltages (V)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ left: 0, right: 16, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="vr"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="vy"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="vb"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}