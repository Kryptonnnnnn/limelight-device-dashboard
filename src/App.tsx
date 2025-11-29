import { useState } from 'react';
import { Layout } from './components/Layout';
import { useDeviceStream } from './hooks/useDeviceStream';
import { DeviceSample } from './types/DeviceSample';
import { GapBadge } from './components/GapBadge';
import { KpiCards } from './components/KpiCards';
import { Charts } from './components/Charts';
import { InsightsPanel } from './components/InsightsPanel';
import { exportSamplesToCsv } from './utils/csv';
import './styles.css';

const WINDOW_OPTIONS = [5, 15, 30];

function App() {
  const [windowMinutes, setWindowMinutes] = useState<number>(15);

  const { samples, lastMessageTime, isLoading, error } = useDeviceStream({
    windowMinutes,
    playbackIntervalMs: 1000,
    jsonlPath: '/device.jsonl'
  });

  const hasData = samples.length > 0;

  return (
    <Layout>
      <section
        className="dashboard-top"
        aria-label="Stream status and controls"
      >
        <div className="window-selector">
          <span>Window:</span>
          {WINDOW_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setWindowMinutes(m)}
              className={m === windowMinutes ? 'active' : ''}
              aria-pressed={m === windowMinutes}
            >
              {m} min
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isLoading && <span>Loading stream…</span>}
          {error && (
            <span style={{ color: '#f97373', fontSize: '0.8rem' }}>
              {error}
            </span>
          )}
          <GapBadge lastMessageTime={lastMessageTime} />
        </div>
      </section>

      <section className="dashboard-grid">
        <Charts samples={samples} />
        <KpiCards samples={samples} />
      </section>

      <InsightsPanel samples={samples} windowMinutes={windowMinutes} />

      <div className="export-row">
        <button
          type="button"
          className="export-button"
          onClick={() => exportSamplesToCsv(samples as DeviceSample[])}
          disabled={!hasData}
        >
          Export visible window as CSV
        </button>
      </div>
    </Layout>
  );
}

export default App;