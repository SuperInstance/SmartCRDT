/**
 * ExecutionTimeline Component
 *
 * Shows real-time execution progress of the action plan.
 */

import React from 'react';
import type { ExecutionProgress, ActionSequence } from '../types';

export interface ExecutionTimelineProps {
  progress: ExecutionProgress;
  plan: ActionSequence;
}

export default function ExecutionTimeline({ progress, plan }: ExecutionTimelineProps) {
  const getStatusColor = (index: number) => {
    if (index < progress.completed) return '#22c55e';
    if (index === progress.current) return '#3b82f6';
    if (plan.actions[index]?.status === 'failed') return '#ef4444';
    return '#374151';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="execution-timeline">
      <div className="timeline-header">
        <h3>Execution Progress</h3>
        <div className="progress-stats">
          <span className="stat">
            {progress.completed}/{progress.total} completed
          </span>
          {progress.failed > 0 && (
            <span className="stat text-danger">{progress.failed} failed</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-large">
        <div
          className="progress-fill"
          style={{ width: `${progress.percentage}%` }}
        >
          <span className="progress-text">{progress.percentage.toFixed(0)}%</span>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="timeline-visualization">
        {plan.actions.map((action, index) => (
          <div key={action.id} className="timeline-item">
            <div
              className="timeline-dot"
              style={{ backgroundColor: getStatusColor(index) }}
            ></div>
            <div
              className="timeline-line"
              style={{
                backgroundColor: index < plan.actions.length - 1 ? getStatusColor(index) : 'transparent',
              }}
            ></div>
            <div className="timeline-label">
              <span className="action-num">{index + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Current action */}
      {progress.current < plan.actions.length && (
        <div className="current-action">
          <span className="label">Currently executing:</span>
          <span className="action-desc">
            {plan.actions[progress.current]?.description || 'Unknown'}
          </span>
        </div>
      )}

      {/* Time estimates */}
      <div className="time-estimates">
        <div className="time-item">
          <span className="label">Elapsed:</span>
          <span className="value">{formatTime(progress.elapsed)}</span>
        </div>
        <div className="time-item">
          <span className="label">Remaining:</span>
          <span className="value">{formatTime(progress.remaining)}</span>
        </div>
        <div className="time-item">
          <span className="label">Total:</span>
          <span className="value">{formatTime(progress.elapsed + progress.remaining)}</span>
        </div>
      </div>
    </div>
  );
}
