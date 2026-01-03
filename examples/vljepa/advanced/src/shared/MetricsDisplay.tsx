/**
 * MetricsDisplay Component
 * Shows metrics with visual indicators
 */

import React from 'react';

export interface Metric {
  label: string;
  value: number;
  unit?: string;
  format?: 'percentage' | 'ms' | 'bytes' | 'number';
  target?: number;
  status?: 'success' | 'warning' | 'error';
}

export interface MetricsDisplayProps {
  metrics: Metric[];
  title?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
  showSparkline?: boolean;
  history?: number[][];
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  metrics,
  title,
  layout = 'horizontal',
  showSparkline = false,
  history
}) => {
  const formatValue = (metric: Metric): string => {
    const { value, format, unit } = metric;

    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'ms':
        return `${value.toFixed(0)}ms`;
      case 'bytes':
        if (value < 1024) return `${value.toFixed(0)}B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
        return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      case 'number':
      default:
        return unit ? `${value.toFixed(1)}${unit}` : `${value.toFixed(1)}`;
    }
  };

  const getStatus = (metric: Metric): 'success' | 'warning' | 'error' => {
    if (metric.status) return metric.status;

    if (metric.target) {
      const ratio = metric.value / metric.target;
      if (ratio >= 0.9) return 'success';
      if (ratio >= 0.7) return 'warning';
      return 'error';
    }

    return 'success';
  };

  const renderSparkline = (metricIndex: number) => {
    if (!showSparkline || !history) return null;

    const data = history.map((h) => h[metricIndex]);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg className="sparkline" viewBox="0 0 100 50" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className={`metrics-display metrics-${layout}`}>
      {title && <h3 className="metrics-title">{title}</h3>}

      <div className="metrics-container">
        {metrics.map((metric, idx) => {
          const status = getStatus(metric);
          const formattedValue = formatValue(metric);

          return (
            <div key={idx} className={`metric-card metric-${status}`}>
              <div className="metric-header">
                <span className="metric-label">{metric.label}</span>
                {metric.target && (
                  <span className="metric-target">Target: {formatValue({ ...metric, value: metric.target })}</span>
                )}
              </div>

              <div className="metric-value-row">
                <span className="metric-value">{formattedValue}</span>
                <div className="metric-status-indicator" />
              </div>

              {metric.target && (
                <div className="metric-progress">
                  <div
                    className="metric-progress-bar"
                    style={{
                      width: `${Math.min(100, (metric.value / metric.target) * 100)}%`
                    }}
                  />
                </div>
              )}

              {renderSparkline(idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
