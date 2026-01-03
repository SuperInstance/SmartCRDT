/**
 * VLJEPA Demo Wrapper Component
 * Provides consistent demo experience across all examples
 */

import React, { ReactNode, useState } from 'react';

export interface VLJEPADemoProps {
  title: string;
  description: string;
  children: ReactNode;
  features?: string[];
  code?: string;
  metrics?: {
    accuracy?: number;
    latency?: number;
    confidence?: number;
  };
}

export const VLJEPADemo: React.FC<VLJEPADemoProps> = ({
  title,
  description,
  children,
  features,
  code,
  metrics
}) => {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="vljepa-demo">
      <header className="demo-header">
        <h1>{title}</h1>
        <p className="description">{description}</p>
        {features && features.length > 0 && (
          <div className="features">
            <strong>Features:</strong>
            <ul>
              {features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <main className="demo-content">
        <div className="demo-main">{children}</div>

        {metrics && (
          <aside className="demo-metrics">
            <h3>Live Metrics</h3>
            <div className="metric">
              <span className="label">Accuracy:</span>
              <span className="value">{(metrics.accuracy * 100).toFixed(1)}%</span>
            </div>
            <div className="metric">
              <span className="label">Latency:</span>
              <span className="value">{metrics.latency.toFixed(0)}ms</span>
            </div>
            <div className="metric">
              <span className="label">Confidence:</span>
              <span className="value">{(metrics.confidence * 100).toFixed(1)}%</span>
            </div>
          </aside>
        )}
      </main>

      {code && (
        <footer className="demo-footer">
          <button onClick={() => setShowCode(!showCode)} className="toggle-code">
            {showCode ? 'Hide' : 'Show'} Code
          </button>
          {showCode && (
            <pre className="code-block">
              <code>{code}</code>
            </pre>
          )}
        </footer>
      )}
    </div>
  );
};
