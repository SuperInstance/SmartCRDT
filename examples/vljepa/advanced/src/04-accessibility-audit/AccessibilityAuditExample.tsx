/**
 * Example 4: Accessibility Auditing
 *
 * Demonstrates VL-JEPA analyzing UI for accessibility violations
 * - Scans UI for WCAG violations
 * - Categorizes issues by severity
 * - Suggests fixes with code examples
 * - Shows audit report with metrics
 */

import React, { useState, useEffect } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { AccessibilityIssue } from '../shared';

interface AuditState {
  uiCode: string;
  issues: AccessibilityIssue[];
  isScanning: boolean;
  selectedIssue: string | null;
  metrics: {
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    scanDuration: number;
  };
}

const SAMPLE_UI = `export const Form = () => {
  return (
    <form>
      <input type="text" placeholder="Name" />
      <input type="email" placeholder="Email" />
      <button>Submit</button>
    </form>
  );
};`;

export const AccessibilityAuditExample: React.FC = () => {
  const [state, setState] = useState<AuditState>({
    uiCode: SAMPLE_UI,
    issues: [],
    isScanning: false,
    selectedIssue: null,
    metrics: {
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      scanDuration: 0
    }
  });

  const runAccessibilityAudit = async () => {
    setState((prev) => ({ ...prev, isScanning: true }));
    const startTime = Date.now();

    // Simulate VL-JEPA analyzing for accessibility issues
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const issues: AccessibilityIssue[] = [];

    // Check for form labels
    if (state.uiCode.includes('<input') && !state.uiCode.includes('label')) {
      issues.push({
        id: '1',
        severity: 'critical',
        category: 'Forms',
        description: 'Form inputs lack associated labels',
        wcagLevel: 'A',
        element: '<input>',
        suggestion: 'Add <label> elements with htmlFor attribute matching input id'
      });
    }

    // Check for button content
    if (state.uiCode.includes('<button>') && state.uiCode.includes('</button>')) {
      const buttonMatch = state.uiCode.match(/<button>(.*?)<\/button>/);
      if (buttonMatch && buttonMatch[1].trim() === 'Submit') {
        issues.push({
          id: '2',
          severity: 'moderate',
          category: 'Buttons',
          description: 'Button text could be more descriptive',
          wcagLevel: 'AA',
          element: '<button>',
          suggestion: 'Use more descriptive text like "Submit Registration Form"'
        });
      }
    }

    // Check for alt text
    if (state.uiCode.includes('<img') && !state.uiCode.includes('alt=')) {
      issues.push({
        id: '3',
        severity: 'critical',
        category: 'Images',
        description: 'Image missing alt attribute',
        wcagLevel: 'A',
        element: '<img>',
        suggestion: 'Add descriptive alt text for screen readers'
      });
    }

    // Check for headings structure
    if (!state.uiCode.includes('<h')) {
      issues.push({
        id: '4',
        severity: 'serious',
        category: 'Structure',
        description: 'No heading elements found',
        wcagLevel: 'A',
        element: 'form',
        suggestion: 'Add proper heading hierarchy starting with h1'
      });
    }

    // Check for ARIA attributes
    if (!state.uiCode.includes('aria-')) {
      issues.push({
        id: '5',
        severity: 'minor',
        category: 'ARIA',
        description: 'Consider adding ARIA attributes for better accessibility',
        wcagLevel: 'AA',
        element: 'form',
        suggestion: 'Add role="form" and aria-label="Registration form"'
      });
    }

    const scanDuration = Date.now() - startTime;

    setState((prev) => ({
      ...prev,
      issues,
      isScanning: false,
      metrics: {
        criticalCount: issues.filter((i) => i.severity === 'critical').length,
        seriousCount: issues.filter((i) => i.severity === 'serious').length,
        moderateCount: issues.filter((i) => i.severity === 'moderate').length,
        minorCount: issues.filter((i) => i.severity === 'minor').length,
        scanDuration
      }
    }));
  };

  const handleUIChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((prev) => ({ ...prev, uiCode: e.target.value }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'serious': return '#f57c00';
      case 'moderate': return '#fbc02d';
      case 'minor': return '#1976d2';
      default: return '#757575';
    }
  };

  const getWCAGColor = (level: string) => {
    switch (level) {
      case 'A': return '#4caf50';
      case 'AA': return '#2196f3';
      case 'AAA': return '#9c27b0';
      default: return '#757575';
    }
  };

  const selectedIssueData = state.issues.find((i) => i.id === state.selectedIssue);

  return (
    <VLJEPADemo
      title="Accessibility Auditing"
      description="VL-JEPA scans your UI for accessibility violations and provides actionable fixes."
      features={[
        'WCAG 2.1 compliance checking',
        'Severity-based prioritization',
        'Code-level fix suggestions',
        'Comprehensive audit reports'
      ]}
      metrics={{
        accuracy: 0.94,
        latency: state.metrics.scanDuration,
        confidence: 0.91
      }}
    >
      <div className="accessibility-audit">
        <div className="control-bar">
          <button onClick={runAccessibilityAudit} disabled={state.isScanning} className="btn-scan">
            {state.isScanning ? '🔍 Scanning...' : '🔍 Run Audit'}
          </button>
          <span className="issues-count">
            {state.issues.length} issues found
          </span>
        </div>

        <div className="main-content">
          <div className="editor-panel">
            <h3>Your UI Code</h3>
            <textarea
              value={state.uiCode}
              onChange={handleUIChange}
              className="code-editor"
              spellCheck={false}
            />
          </div>

          <div className="issues-panel">
            <h3>Accessibility Issues</h3>
            {state.issues.length === 0 && !state.isScanning ? (
              <div className="no-issues">
                <p>Run an audit to find accessibility issues</p>
              </div>
            ) : state.issues.length === 0 && state.isScanning ? (
              <div className="scanning">
                <p>🔍 Analyzing your code...</p>
              </div>
            ) : (
              <div className="issues-list">
                {state.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`issue-card severity-${issue.severity} ${state.selectedIssue === issue.id ? 'selected' : ''}`}
                    onClick={() => setState((prev) => ({ ...prev, selectedIssue: issue.id }))}
                  >
                    <div className="issue-header">
                      <span
                        className="severity-badge"
                        style={{ backgroundColor: getSeverityColor(issue.severity) }}
                      >
                        {issue.severity.toUpperCase()}
                      </span>
                      <span
                        className="wcag-badge"
                        style={{ backgroundColor: getWCAGColor(issue.wcagLevel) }}
                      >
                        WCAG {issue.wcagLevel}
                      </span>
                      <span className="issue-category">{issue.category}</span>
                    </div>

                    <h4 className="issue-title">{issue.description}</h4>
                    <p className="issue-element">Element: {issue.element}</p>
                    <p className="issue-suggestion">{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedIssueData && (
            <div className="issue-details-panel">
              <h3>Issue Details</h3>
              <div className="detail-row">
                <span className="detail-label">Severity:</span>
                <span className="detail-value" style={{ color: getSeverityColor(selectedIssueData.severity) }}>
                  {selectedIssueData.severity.toUpperCase()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">WCAG Level:</span>
                <span className="detail-value" style={{ color: getWCAGColor(selectedIssueData.wcagLevel) }}>
                  {selectedIssueData.wcagLevel}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{selectedIssueData.category}</span>
              </div>
              <div className="detail-description">
                <strong>Description:</strong>
                <p>{selectedIssueData.description}</p>
              </div>
              <div className="detail-suggestion">
                <strong>Suggested Fix:</strong>
                <pre>{selectedIssueData.suggestion}</pre>
              </div>
            </div>
          )}
        </div>

        <MetricsDisplay
          title="Audit Summary"
          metrics={[
            { label: 'Critical', value: state.metrics.criticalCount, format: 'number', status: 'error' },
            { label: 'Serious', value: state.metrics.seriousCount, format: 'number', status: 'warning' },
            { label: 'Moderate', value: state.metrics.moderateCount, format: 'number', status: 'warning' },
            { label: 'Minor', value: state.metrics.minorCount, format: 'number', status: 'success' }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default AccessibilityAuditExample;
