/**
 * GoalImageUploader Component
 *
 * Uploads and displays the goal UI image.
 */

import React, { useRef } from 'react';
import type { VisualState } from '../types';

export interface GoalImageUploaderProps {
  state: VisualState | null;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDrop: (event: React.DragEvent) => Promise<void>;
  loading: boolean;
  uploaded: boolean;
}

export default function GoalImageUploader({
  state,
  onUpload,
  onDrop,
  loading,
  uploaded,
}: GoalImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="goal-image-uploader">
      <div className="preview-header">
        <h3>Goal UI</h3>
        {state && <span className="timestamp">{new Date(state.timestamp).toLocaleTimeString()}</span>}
      </div>

      <div className="preview-content">
        {!state ? (
          <div
            className={`upload-placeholder ${loading ? 'loading' : ''}`}
            onClick={!loading ? handleClick : undefined}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="placeholder-icon">🎯</div>
            <p>Upload your goal UI image</p>
            <p className="hint">Drag and drop or click to browse</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
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
              {state.title && <span className="filename">{state.title}</span>}
            </div>
          </div>
        )}
      </div>

      {uploaded && (
        <div className="preview-actions">
          <button onClick={handleClick} disabled={loading} className="btn-secondary btn-sm">
            Change Image
          </button>
        </div>
      )}
    </div>
  );
}
