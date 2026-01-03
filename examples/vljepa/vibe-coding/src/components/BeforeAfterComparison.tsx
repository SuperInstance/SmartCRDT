/**
 * BeforeAfterComparison Component
 *
 * Shows side-by-side comparison of before and after states.
 */

import React, { useState } from 'react';
import type { VisualState, PlannedAction } from '../types';

export interface BeforeAfterComparisonProps {
  before: VisualState;
  after: VisualState;
  actions: PlannedAction[];
}

export default function BeforeAfterComparison({
  before,
  after,
  actions,
}: BeforeAfterComparisonProps) {
  const [showDiff, setShowDiff] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);

  const successfulActions = actions.filter((a) => a.status === 'completed');
  const failedActions = actions.filter((a) => a.status === 'failed');

  return (
    <div className="before-after-comparison">
      <div className="comparison-header">
        <h3>Before & After Comparison</h3>
        <div className="comparison-actions">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`btn-toggle ${showDiff ? 'active' : ''}`}
          >
            {showDiff ? 'Hide Differences' : 'Show Differences'}
          </button>
        </div>
      </div>

      <div className="comparison-container">
        <div className="comparison-side before">
          <div className="side-header">Before</div>
          <canvas
            ref={(canvas) => {
              if (canvas && before.imageData) {
                canvas.width = before.imageData.width;
                canvas.height = before.imageData.height;
                const ctx = canvas.getContext('2d');
                ctx?.putImageData(before.imageData, 0, 0);
              }
            }}
            className="comparison-canvas"
          />
          <div className="side-meta">
            <span>{new Date(before.timestamp).toLocaleTimeString()}</span>
            {before.url && <span className="url">{before.url}</span>}
          </div>
        </div>

        <div className="comparison-divider">
          <div className="arrow">→</div>
        </div>

        <div className="comparison-side after">
          <div className="side-header">After</div>
          <canvas
            ref={(canvas) => {
              if (canvas && after.imageData) {
                canvas.width = after.imageData.width;
                canvas.height = after.imageData.height;
                const ctx = canvas.getContext('2d');
                ctx?.putImageData(after.imageData, 0, 0);
              }
            }}
            className="comparison-canvas"
          />
          <div className="side-meta">
            <span>{new Date(after.timestamp).toLocaleTimeString()}</span>
            {after.url && <span className="url">{after.url}</span>}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="comparison-summary">
        <div className="summary-stat success">
          <span className="stat-value">{successfulActions.length}</span>
          <span className="stat-label">Successful</span>
        </div>
        {failedActions.length > 0 && (
          <div className="summary-stat error">
            <span className="stat-value">{failedActions.length}</span>
            <span className="stat-label">Failed</span>
          </div>
        )}
        <div className="summary-stat">
          <span className="stat-value">{actions.length}</span>
          <span className="stat-label">Total Actions</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {actions.reduce((sum, a) => sum + (a.executionTime || 0), 0)}
          </span>
          <span className="stat-label">Total Time (ms)</span>
        </div>
      </div>

      {/* Action list summary */}
      <div className="actions-summary">
        <h4>Actions Summary</h4>
        <div className="summary-list">
          {actions.map((action, index) => (
            <div
              key={action.id}
              className={`summary-item ${action.status === 'completed' ? 'success' : action.status === 'failed' ? 'error' : ''}`}
            >
              <span className="item-number">{index + 1}</span>
              <span className="item-description">{action.description}</span>
              <span className="item-status">
                {action.status === 'completed' && '✓'}
                {action.status === 'failed' && '✗'}
                {action.executionTime && ` (${action.executionTime.toFixed(0)}ms)`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
