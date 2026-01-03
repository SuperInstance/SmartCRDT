/**
 * ComparisonView Component
 * Shows before/after comparison with diff highlighting
 */

import React from 'react';

export interface ComparisonViewProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  diff?: boolean;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
  diff = true
}) => {
  const computeDiff = (oldText: string, newText: string) => {
    // Simple word-level diff
    const oldWords = oldText.split(/\s+/);
    const newWords = newText.split(/\s+/);

    const changes: Array<{ type: 'same' | 'add' | 'remove'; text: string }> = [];

    let i = 0,
      j = 0;
    while (i < oldWords.length || j < newWords.length) {
      if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
        changes.push({ type: 'same', text: oldWords[i] });
        i++;
        j++;
      } else {
        if (i < oldWords.length) {
          changes.push({ type: 'remove', text: oldWords[i] });
          i++;
        }
        if (j < newWords.length) {
          changes.push({ type: 'add', text: newWords[j] });
          j++;
        }
      }
    }

    return changes;
  };

  const changes = diff ? computeDiff(before, after) : null;

  return (
    <div className="comparison-view">
      <div className="comparison-panel before">
        <h4>{beforeLabel}</h4>
        <pre className="comparison-content">{before}</pre>
      </div>

      <div className="comparison-divider">→</div>

      <div className="comparison-panel after">
        <h4>{afterLabel}</h4>
        {diff && changes ? (
          <div className="diff-content">
            {changes.map((change, idx) => (
              <span key={idx} className={`diff-${change.type}`}>
                {change.text}{' '}
              </span>
            ))}
          </div>
        ) : (
          <pre className="comparison-content">{after}</pre>
        )}
      </div>
    </div>
  );
};
