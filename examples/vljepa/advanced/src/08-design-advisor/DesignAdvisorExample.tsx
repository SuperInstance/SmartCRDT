/**
 * Example 8: AI Design Advisor
 *
 * Demonstrates VL-JEPA acting as an AI design advisor
 * - User describes UI needs
 * - VL-JEPA advises on design patterns
 * - Shows multiple design options
 * - User selects, generates code
 */

import React, { useState } from 'react';
import { VLJEPADemo, CodeBlock, MetricsDisplay } from '../shared';

interface DesignOption {
  id: string;
  name: string;
  description: string;
  category: 'layout' | 'component' | 'pattern' | 'style';
  pros: string[];
  cons: string[];
  preview: string;
  code: string;
  confidence: number;
}

interface DesignAdvisorState {
  userRequest: string;
  isAnalyzing: boolean;
  options: DesignOption[];
  selectedOption: string | null;
  metrics: {
    relevanceScore: number;
    optionsCount: number;
    analysisTime: number;
  };
}

export const DesignAdvisorExample: React.FC = () => {
  const [state, setState] = useState<DesignAdvisorState>({
    userRequest: '',
    isAnalyzing: false,
    options: [],
    selectedOption: null,
    metrics: {
      relevanceScore: 0,
      optionsCount: 0,
      analysisTime: 0
    }
  });

  const analyzeRequest = async () => {
    if (!state.userRequest.trim()) return;

    setState((prev) => ({ ...prev, isAnalyzing: true, options: [] }));
    const startTime = Date.now();

    // VL-JEPA analyzes the request and generates design options
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const options: DesignOption[] = [
      {
        id: '1',
        name: 'Card-Based Grid Layout',
        description: 'A responsive grid with card components for content organization',
        category: 'layout',
        pros: ['Responsive', 'Easy to scan', 'Modular'],
        cons: ['Can feel repetitive', 'Limited content depth'],
        preview: `[Card][Card][Card]\n[Card][Card][Card]`,
        code: `export const GridLayout = () => {
  return (
    <div className="grid">
      {items.map(item => (
        <Card key={item.id}>{item.content}</Card>
      ))}
    </div>
  );
};`,
        confidence: 0.92
      },
      {
        id: '2',
        name: 'Split-Screen Layout',
        description: 'Two-column layout with navigation on left, content on right',
        category: 'layout',
        pros: ['Clear navigation', 'Good for apps', 'Desktop-friendly'],
        cons: ['Mobile challenges', 'Less flexibility'],
        preview: `Nav | Content\nNav | Content`,
        code: `export const SplitLayout = () => {
  return (
    <div className="split">
      <nav className="sidebar">...</nav>
      <main className="content">...</main>
    </div>
  );
};`,
        confidence: 0.88
      },
      {
        id: '3',
        name: 'Single Column with Tabs',
        description: 'Centered content with horizontal tabs for navigation',
        category: 'pattern',
        pros: ['Mobile-first', 'Simple', 'Focused'],
        cons: ['Limited navigation', 'Scaling issues'],
        preview: `[Tabs]\n\nContent`,
        code: `export const TabLayout = () => {
  return (
    <div className="tabs-container">
      <Tabs>...</Tabs>
      <Content>...</Content>
    </div>
  );
};`,
        confidence: 0.85
      }
    ];

    const duration = Date.now() - startTime;

    setState((prev) => ({
      ...prev,
      isAnalyzing: false,
      options,
      metrics: {
        relevanceScore: 0.9,
        optionsCount: options.length,
        analysisTime: duration
      }
    }));
  };

  const selectOption = (optionId: string) => {
    setState((prev) => ({ ...prev, selectedOption: optionId }));
  };

  const sampleRequests = [
    'I need a dashboard layout',
    'Create a mobile-first navigation',
    'Design an e-commerce product page',
    'Build a settings panel',
    'Make a landing page'
  ];

  return (
    <VLJEPADemo
      title="AI Design Advisor"
      description="Describe your UI needs and VL-JEPA advises on the best design patterns with multiple options."
      features={[
        'Natural language input',
        'Multiple design options',
        'Pros/cons analysis',
        'Code generation for selected design'
      ]}
      metrics={{
        accuracy: state.metrics.relevanceScore,
        latency: state.metrics.analysisTime,
        confidence: 0.9
      }}
    >
      <div className="design-advisor">
        <div className="input-section">
          <h3>Describe Your UI Need</h3>
          <textarea
            value={state.userRequest}
            onChange={(e) => setState((prev) => ({ ...prev, userRequest: e.target.value }))}
            placeholder="e.g., I need a responsive dashboard with navigation and content areas..."
            className="request-input"
          />
          <button
            onClick={analyzeRequest}
            disabled={!state.userRequest.trim() || state.isAnalyzing}
            className="btn-analyze"
          >
            {state.isAnalyzing ? '🤔 Analyzing...' : '💡 Get Design Advice'}
          </button>

          <div className="sample-requests">
            <span>Try: </span>
            {sampleRequests.map((request, idx) => (
              <button
                key={idx}
                onClick={() => setState((prev) => ({ ...prev, userRequest: request }))}
                className="sample-request"
              >
                {request}
              </button>
            ))}
          </div>
        </div>

        {state.options.length > 0 && (
          <div className="options-section">
            <h3>Design Options</h3>
            <div className="options-grid">
              {state.options.map((option) => (
                <div
                  key={option.id}
                  className={`option-card ${state.selectedOption === option.id ? 'selected' : ''}`}
                  onClick={() => selectOption(option.id)}
                >
                  <div className="option-header">
                    <h4>{option.name}</h4>
                    <span className="confidence-badge">
                      {(option.confidence * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="option-description">{option.description}</p>
                  <span className="option-category">{option.category}</span>

                  <div className="option-preview">
                    <pre>{option.preview}</pre>
                  </div>

                  <div className="option-analysis">
                    <div className="pros">
                      <strong>✓ Pros:</strong>
                      <ul>
                        {option.pros.map((pro, idx) => (
                          <li key={idx}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="cons">
                      <strong>✗ Cons:</strong>
                      <ul>
                        {option.cons.map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.selectedOption && (
          <div className="selected-option">
            <h3>Generated Code</h3>
            {(() => {
              const option = state.options.find((o) => o.id === state.selectedOption);
              return option ? (
                <>
                  <p className="option-desc">{option.description}</p>
                  <CodeBlock code={option.code} language="typescript" />
                </>
              ) : null;
            })()}
          </div>
        )}

        <MetricsDisplay
          title="Advisor Metrics"
          metrics={[
            { label: 'Relevance', value: state.metrics.relevanceScore, format: 'percentage', target: 0.85 },
            { label: 'Options', value: state.metrics.optionsCount, format: 'number' },
            { label: 'Analysis Time', value: state.metrics.analysisTime, format: 'ms', target: 2000 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default DesignAdvisorExample;
