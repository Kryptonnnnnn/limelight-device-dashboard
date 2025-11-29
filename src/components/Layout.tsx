import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-root">
      <header className="app-header" aria-label="Dashboard header">
        <h1>LimelightIT Device Stream Dashboard</h1>
        <p className="subtitle">
          Live-ish monitoring of a synthetic device stream with KPIs &amp; insights
        </p>
      </header>
      <main className="app-main" aria-label="Main dashboard content">
        {children}
      </main>
      <footer className="app-footer">
        <small>
          Built for LimelightIT Device Stream Challenge – focus on power, uptime,
          and actionable insights.
        </small>
      </footer>
    </div>
  );
}