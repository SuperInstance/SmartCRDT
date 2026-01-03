/**
 * ActionPlanViewer Component
 *
 * Displays the generated action plan with approval controls.
 */

import React, { useState } from 'react';
import type { ActionSequence, PlannedAction } from '../types';

export interface ActionPlanViewerProps {
  plan: ActionSequence;
  onApprove: () => void;
  onModify: (modifications: { id: string; changes: Partial<PlannedAction> }[]) => void;
  onReject: () => void;
  canModify: boolean;
  executing: boolean;
}

export default function ActionPlanViewer({
  plan,
  onApprove,
  onModify,
  onReject,
  canModify,
  executing,
}: ActionPlanViewerProps) {
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [modifications, setModifications] = useState<Record<string, Partial<PlannedAction>>>({});

  const toggleAction = (id: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedActions.size === plan.actions.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(plan.actions.map((a) => a.id)));
    }
  };

  const handleApprove = () => {
    // Apply modifications if any
    const mods = Object.entries(modifications).map(([id, changes]) => ({ id, changes }));
    if (mods.length > 0) {
      onModify(mods);
    }
    onApprove();
  };

  const getActionStatusIcon = (action: PlannedAction) => {
    if (action.status === 'completed') return '✓';
    if (action.status === 'failed') return '✗';
    if (action.status === 'running') return '⟳';
    if (action.approved) return '○';
    return '○';
  };

  const getActionStatusClass = (action: PlannedAction) => {
    if (action.status === 'completed') return 'status-completed';
    if (action.status === 'failed') return 'status-failed';
    if (action.status === 'running') return 'status-running';
    return '';
  };

  return (
    <div className="action-plan-viewer">
      <div className="plan-header">
        <div>
          <h3>Generated Action Plan</h3>
          <p className="plan-meta">
            {plan.actions.length} actions · Confidence: {(plan.confidence * 100).toFixed(0)}%
            · Est. time: {(plan.estimatedTime / 1000).toFixed(1)}s
          </p>
        </div>
        <div className="plan-stats">
          <div className="stat">
            <span className="stat-label">Semantic Distance</span>
            <span className="stat-value">{plan.semanticDistance.toFixed(3)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Actions</span>
            <span className="stat-value">{plan.actions.length}</span>
          </div>
        </div>
      </div>

      <div className="actions-list">
        <div className="actions-header">
          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={selectedActions.size === plan.actions.length}
              onChange={toggleAll}
              disabled={!canModify || executing}
            />
            <span>Select All</span>
          </label>
          <span className="count">{selectedActions.size} selected</span>
        </div>

        {plan.actions.map((action, index) => (
          <div
            key={action.id}
            className={`action-item ${selectedActions.has(action.id) ? 'selected' : ''} ${getActionStatusClass(action)}`}
          >
            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={selectedActions.has(action.id)}
                onChange={() => toggleAction(action.id)}
                disabled={!canModify || executing}
              />
              <span className="action-number">{index + 1}</span>
            </label>

            <div className="action-content">
              <div className="action-header-row">
                <span className="action-icon">{getActionStatusIcon(action)}</span>
                <h4 className="action-description">{action.description}</h4>
                <span className="action-confidence">
                  {(action.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="action-details">
                <span className="action-target">Target: {action.target}</span>
                <span className="action-type">Type: {action.type}</span>
                {action.expectedOutcome && (
                  <span className="action-outcome">{action.expectedOutcome}</span>
                )}
              </div>

              {action.params && Object.keys(action.params).length > 0 && (
                <div className="action-params">
                  {Object.entries(action.params).map(([key, value]) => (
                    <span key={key} className="param">
                      {key}: {JSON.stringify(value)}
                    </span>
                  ))}
                </div>
              )}

              {action.error && (
                <div className="action-error">{action.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canModify && !executing && (
        <div className="plan-actions">
          <button onClick={onReject} className="btn-danger">
            Reject Plan
          </button>
          <div className="spacer"></div>
          <button onClick={handleApprove} className="btn-primary btn-large">
            Approve & Execute ({selectedActions.size || plan.actions.length} actions)
          </button>
        </div>
      )}
    </div>
  );
}
