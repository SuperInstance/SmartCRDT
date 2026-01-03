/**
 * @fileoverview Checkpoint UI - React components for human-in-the-loop checkpoints
 *
 * Provides UI components for displaying checkpoints and collecting human input.
 *
 * Features:
 * - Checkpoint dialog/modal
 * - State display at checkpoint
 * - Input collection
 * - Action buttons (approve/reject/modify)
 * - Timeout countdown
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  CheckpointResult,
  HumanInput,
  AgentState,
} from "../state/index.js";

/**
 * Checkpoint UI props
 */
export interface CheckpointUIProps {
  /** Checkpoint data */
  checkpoint: CheckpointResult;
  /** Callback when approved */
  onApprove: (feedback?: string) => void | Promise<void>;
  /** Callback when rejected */
  onReject: (reason: string) => void | Promise<void>;
  /** Callback when modified */
  onModify?: (
    modifications: Partial<AgentState>,
    feedback?: string
  ) => void | Promise<void>;
  /** Auto-show on mount */
  show?: boolean;
}

/**
 * Checkpoint dialog component
 *
 * @example
 * ```tsx
 * <CheckpointUI
 *   checkpoint={checkpoint}
 *   onApprove={(feedback) => console.log('Approved:', feedback)}
 *   onReject={(reason) => console.log('Rejected:', reason)}
 *   onModify={(mods, feedback) => console.log('Modified:', mods)}
 * />
 * ```
 */
export const CheckpointUI: React.FC<CheckpointUIProps> = ({
  checkpoint,
  onApprove,
  onReject,
  onModify,
  show = true,
}) => {
  const [isOpen, setIsOpen] = useState(show);
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(
    checkpoint.timeout ? Math.floor(checkpoint.timeout / 1000) : 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || !isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isOpen]);

  // Auto-close on timeout
  useEffect(() => {
    if (timeLeft === 0 && checkpoint.required) {
      handleReject("Auto-rejected: Timeout");
    }
  }, [timeLeft, checkpoint.required]);

  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onApprove(feedback || undefined);
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [feedback, onApprove]);

  const handleReject = useCallback(
    async (reason?: string) => {
      setIsSubmitting(true);
      try {
        await onReject(reason || feedback || "Rejected by user");
        setIsOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [feedback, onReject]
  );

  const handleModify = useCallback(async () => {
    if (!onModify) return;
    setIsSubmitting(true);
    try {
      await onModify({}, feedback || undefined);
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [feedback, onModify]);

  if (!isOpen) return null;

  const canModify = checkpoint.type === "correction" && onModify;

  return (
    <div className="coagents-checkpoint-overlay">
      <div className="coagents-checkpoint-dialog">
        {/* Header */}
        <div className="coagents-checkpoint-header">
          <h2>
            {checkpoint.type === "confirmation" && "Confirmation Required"}
            {checkpoint.type === "input" && "Input Required"}
            {checkpoint.type === "approval" && "Approval Required"}
            {checkpoint.type === "correction" && "Review Required"}
          </h2>
          {timeLeft > 0 && (
            <div className="coagents-checkpoint-timer">{timeLeft}s</div>
          )}
        </div>

        {/* Message */}
        <p className="coagents-checkpoint-message">{checkpoint.message}</p>

        {/* Agent State Display */}
        <CheckpointStateDisplay state={checkpoint.state} />

        {/* Feedback Input */}
        <div className="coagents-checkpoint-feedback">
          <label htmlFor="feedback">Feedback (optional):</label>
          <textarea
            id="feedback"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Add your feedback here..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="coagents-checkpoint-actions">
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="coagents-checkpoint-approve"
          >
            {isSubmitting ? "Submitting..." : "Approve"}
          </button>

          {canModify && (
            <button
              onClick={handleModify}
              disabled={isSubmitting}
              className="coagents-checkpoint-modify"
            >
              Modify
            </button>
          )}

          {!checkpoint.required && (
            <button
              onClick={() => handleReject()}
              disabled={isSubmitting}
              className="coagents-checkpoint-reject"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      <style>{`
        .coagents-checkpoint-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .coagents-checkpoint-dialog {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 600px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .coagents-checkpoint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .coagents-checkpoint-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .coagents-checkpoint-timer {
          font-size: 14px;
          color: #666;
        }
        .coagents-checkpoint-message {
          font-size: 16px;
          margin-bottom: 16px;
        }
        .coagents-checkpoint-feedback {
          margin-bottom: 16px;
        }
        .coagents-checkpoint-feedback label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .coagents-checkpoint-feedback textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          resize: vertical;
        }
        .coagents-checkpoint-actions {
          display: flex;
          gap: 8px;
        }
        .coagents-checkpoint-actions button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }
        .coagents-checkpoint-approve {
          background: #10b981;
          color: white;
        }
        .coagents-checkpoint-modify {
          background: #f59e0b;
          color: white;
        }
        .coagents-checkpoint-reject {
          background: #ef4444;
          color: white;
        }
        .coagents-checkpoint-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

/**
 * Display agent state at checkpoint
 */
const CheckpointStateDisplay: React.FC<{ state: AgentState }> = ({ state }) => {
  return (
    <div className="coagents-checkpoint-state">
      <h3>Current Agent State</h3>
      <div className="coagents-checkpoint-state-grid">
        <StateItem label="Query" value={state.query} />
        <StateItem label="Route" value={state.route} />
        <StateItem label="Privacy" value={state.privacy} />
        <StateItem label="Complexity" value={state.complexity.toFixed(2)} />
        {state.intent.length > 0 && (
          <StateItem label="Intent" value={`[${state.intent.length} dims]`} />
        )}
        {state.response && (
          <StateItem
            label="Response"
            value={state.response.slice(0, 100) + "..."}
          />
        )}
      </div>

      <style>{`
        .coagents-checkpoint-state {
          background: #f5f5f5;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .coagents-checkpoint-state h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #333;
        }
        .coagents-checkpoint-state-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

/**
 * Individual state item display
 */
const StateItem: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  return (
    <div>
      <strong>{label}:</strong> {value}
      <style>{`
        div {
          font-size: 13px;
          color: #555;
        }
      `}</style>
    </div>
  );
};

/**
 * Checkpoint toast notification (non-modal alternative)
 */
export const CheckpointToast: React.FC<
  CheckpointUIProps & { onClose: () => void }
> = ({ checkpoint, onApprove, onReject, onClose }) => {
  return (
    <div className="coagents-checkpoint-toast">
      <div className="coagents-checkpoint-toast-content">
        <span>{checkpoint.message}</span>
        <div className="coagents-checkpoint-toast-actions">
          <button onClick={() => onApprove()}>Approve</button>
          <button onClick={() => onReject()}>Reject</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        .coagents-checkpoint-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          z-index: 999;
        }
        .coagents-checkpoint-toast-content {
          padding: 16px;
        }
        .coagents-checkpoint-toast-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .coagents-checkpoint-toast-actions button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

export default CheckpointUI;
