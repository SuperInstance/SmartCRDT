/**
 * CurrentUIPreview Component
 *
 * Shows the current UI state with capture button.
 */

import React from 'react';
import type { VisualState } from '../types';

export interface CurrentUIPreviewProps {
  state: VisualState | null;
  onCapture: () => void;
  loading: boolean;
  captured: boolean;
}

export default function CurrentUIPreview({
  state,
  onCapture,
  loading,
  captured,
}: CurrentUIPreviewProps) {
  return (
    <div className="current-ui-preview">
      <div className="preview-header">
        <h3>Current UI</h3>
        {state && <span className="timestamp">{new Date(state.timestamp).toLocaleTimeString()}</span>}
      </div>

      <div className="preview-content">
        {!state ? (
          <div className="preview-placeholder">
            <div className="placeholder-icon">📷</div>
            <p>Capture your current UI to begin</p>
            <button
              onClick={onCapture}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Capturing...' : 'Capture Current UI'}
            </button>
          </div>
        ) : (
          <div className="preview-captured">
            <canvas
              ref={(canvas) => {
                if (canvas && state.imageData) {
                  canvas.width = state.imageData.width;
                  canvas.height = state.imageData.height;
                  const ctx = canvas.getContext('2d');
                  ctx?.putImageData(state.imageData, 0, 0);
                }
              }}
              className="preview-canvas"
            />
            <div className="preview-info">
              <span>Embedding: {state.embedding?.length || 0}-dim</span>
              {state.url && <span className="url">{state.url}</span>}
            </div>
          </div>
        )}
      </div>

      {captured && (
        <div className="preview-actions">
          <button onClick={onCapture} disabled={loading} className="btn-secondary btn-sm">
            Recapture
          </button>
        </div>
      )}
    </div>
  );
}
