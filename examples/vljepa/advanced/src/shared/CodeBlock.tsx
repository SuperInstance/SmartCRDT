/**
 * CodeBlock Component
 * Displays formatted code with syntax highlighting
 */

import React, { useState } from 'react';

export interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  lineNumbers?: boolean;
  copyable?: boolean;
  onChange?: (code: string) => void;
  editable?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  title,
  lineNumbers = true,
  copyable = true,
  onChange,
  editable = false
}) => {
  const [copied, setCopied] = useState(false);
  const [localCode, setLocalCode] = useState(code);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (value: string) => {
    setLocalCode(value);
    if (onChange) {
      onChange(value);
    }
  };

  const lines = localCode.split('\n');

  return (
    <div className="code-block-container">
      {(title || copyable) && (
        <div className="code-block-header">
          {title && <span className="code-title">{title}</span>}
          {copyable && (
            <button
              onClick={handleCopy}
              className={`copy-button ${copied ? 'copied' : ''}`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <div className="code-block-content">
        {lineNumbers && (
          <div className="line-numbers">
            {lines.map((_, idx) => (
              <span key={idx} className="line-number">
                {idx + 1}
              </span>
            ))}
          </div>
        )}
        <pre className={`language-${language}`}>
          {editable ? (
            <textarea
              value={localCode}
              onChange={(e) => handleChange(e.target.value)}
              className="code-editor"
              spellCheck={false}
            />
          ) : (
            <code>{localCode}</code>
          )}
        </pre>
      </div>
    </div>
  );
};
