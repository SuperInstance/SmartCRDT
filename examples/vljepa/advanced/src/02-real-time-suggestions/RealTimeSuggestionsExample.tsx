/**
 * Example 2: Real-Time UI Suggestions
 *
 * Demonstrates VL-JEPA watching user work and providing real-time UI suggestions
 * - Analyzes user's current UI work
 * - Suggests improvements in real-time
 * - User can accept/reject suggestions
 * - Shows suggestion confidence and reasoning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { UIElement, CodeChange } from '../shared';

interface Suggestion {
  id: string;
  type: 'improvement' | 'optimization' | 'accessibility' | 'best-practice';
  title: string;
  description: string;
  code: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
}

interface RealTimeSuggestionsState {
  currentUI: string;
  suggestions: Suggestion[];
  isActive: boolean;
  metrics: {
    accuracy: number;
    latency: number;
    suggestionsCount: number;
    acceptanceRate: number;
  };
}

const SAMPLE_UI = `export const ProductCard = () => {
  return (
    <div className="card">
      <img src="/product.jpg" alt="Product" />
      <h3>Product Name</h3>
      <p>$99.99</p>
      <button>Buy Now</button>
    </div>
  );
};`;

export const RealTimeSuggestionsExample: React.FC = () => {
  const [state, setState] = useState<RealTimeSuggestionsState>({
    currentUI: SAMPLE_UI,
    suggestions: [],
    isActive: true,
    metrics: {
      accuracy: 0.92,
      latency: 200,
      suggestionsCount: 0,
      acceptanceRate: 0
    }
  });

  // Simulate VL-JEPA analyzing UI and generating suggestions
  const generateSuggestions = useCallback((ui: string): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    // Analyze common patterns and suggest improvements
    if (ui.includes('img') && !ui.includes('loading=')) {
      suggestions.push({
        id: '1',
        type: 'optimization',
        title: 'Add image loading attribute',
        description: 'Add loading="lazy" for better performance with images below the fold.',
        code: '<img src="/product.jpg" alt="Product" loading="lazy" />',
        confidence: 0.95,
        priority: 'high',
        status: 'pending'
      });
    }

    if (ui.includes('<button>') && !ui.includes('type=')) {
      suggestions.push({
        id: '2',
        type: 'best-practice',
        title: 'Add button type attribute',
        description: 'Explicitly specify type="button" to prevent form submission behavior.',
        code: '<button type="button">Buy Now</button>',
        confidence: 0.98,
        priority: 'high',
        status: 'pending'
      });
    }

    if (ui.includes('className="card"') && !ui.includes('role=')) {
      suggestions.push({
        id: '3',
        type: 'accessibility',
        title: 'Add ARIA role for better accessibility',
        description: 'Add role="article" to give the card semantic meaning to screen readers.',
        code: '<div className="card" role="article">',
        confidence: 0.89,
        priority: 'medium',
        status: 'pending'
      });
    }

    if (ui.includes('$99.99') && !ui.includes('currency formatting')) {
      suggestions.push({
        id: '4',
        type: 'improvement',
        title: 'Use price formatting utility',
        description: 'Consider using a price formatting utility for consistent currency display.',
        code: '<Price value={99.99} currency="USD" />',
        confidence: 0.82,
        priority: 'low',
        status: 'pending'
      });
    }

    return suggestions;
  }, []);

  // Simulate real-time analysis
  useEffect(() => {
    if (!state.isActive) return;

    const timer = setTimeout(() => {
      const newSuggestions = generateSuggestions(state.currentUI);
      setState((prev) => ({
        ...prev,
        suggestions: newSuggestions,
        metrics: {
          ...prev.metrics,
          suggestionsCount: newSuggestions.length,
          latency: 150 + Math.random() * 100
        }
      }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.currentUI, state.isActive, generateSuggestions]);

  const handleAcceptSuggestion = (id: string) => {
    const suggestion = state.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    // Apply the suggestion
    let updatedUI = state.currentUI;
    if (suggestion.id === '1') {
      updatedUI = updatedUI.replace('<img src="/product.jpg"', '<img src="/product.jpg" loading="lazy"');
    } else if (suggestion.id === '2') {
      updatedUI = updatedUI.replace('<button>', '<button type="button">');
    } else if (suggestion.id === '3') {
      updatedUI = updatedUI.replace('className="card"', 'className="card" role="article"');
    }

    const acceptedCount = state.suggestions.filter((s) => s.status === 'accepted').length + 1;
    const totalDecisions = state.suggestions.filter((s) => s.status !== 'pending').length + 1;

    setState((prev) => ({
      ...prev,
      currentUI: updatedUI,
      suggestions: prev.suggestions.map((s) => (s.id === id ? { ...s, status: 'accepted' as const } : s)),
      metrics: {
        ...prev.metrics,
        acceptanceRate: acceptedCount / totalDecisions
      }
    }));
  };

  const handleRejectSuggestion = (id: string) => {
    const acceptedCount = state.suggestions.filter((s) => s.status === 'accepted').length;
    const totalDecisions = state.suggestions.filter((s) => s.status !== 'pending').length + 1;

    setState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((s) => (s.id === id ? { ...s, status: 'rejected' as const } : s)),
      metrics: {
        ...prev.metrics,
        acceptanceRate: acceptedCount / totalDecisions
      }
    }));
  };

  const handleUIChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((prev) => ({ ...prev, currentUI: e.target.value }));
  };

  const toggleActive = () => {
    setState((prev) => ({ ...prev, isActive: !prev.isActive }));
  };

  return (
    <VLJEPADemo
      title="Real-Time UI Suggestions"
      description="VL-JEPA watches your work and provides intelligent suggestions for UI improvements as you code."
      features={[
        'Real-time code analysis',
        'Contextual suggestions with reasoning',
        'Accept/reject workflow',
        'Confidence-based prioritization'
      ]}
      metrics={{
        accuracy: state.metrics.accuracy,
        latency: state.metrics.latency,
        confidence: 0.9
      }}
    >
      <div className="real-time-suggestions">
        <div className="control-bar">
          <button
            className={`toggle-button ${state.isActive ? 'active' : ''}`}
            onClick={toggleActive}
          >
            {state.isActive ? '🔍 Analysis Active' : '⏸️ Analysis Paused'}
          </button>
          <span className="suggestion-count">
            {state.suggestions.length} suggestions available
          </span>
        </div>

        <div className="main-content">
          <div className="editor-panel">
            <h3>Your Code</h3>
            <textarea
              value={state.currentUI}
              onChange={handleUIChange}
              className="code-editor"
              spellCheck={false}
            />
          </div>

          <div className="suggestions-panel">
            <h3>Suggestions</h3>
            {state.suggestions.length === 0 ? (
              <div className="no-suggestions">
                {state.isActive ? '🔄 Analyzing your code...' : 'Analysis paused'}
              </div>
            ) : (
              <div className="suggestions-list">
                {state.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`suggestion-card suggestion-${suggestion.type} priority-${suggestion.priority} status-${suggestion.status}`}
                  >
                    <div className="suggestion-header">
                      <span className={`suggestion-type ${suggestion.type}`}>
                        {suggestion.type}
                      </span>
                      <span className={`priority-badge ${suggestion.priority}`}>
                        {suggestion.priority}
                      </span>
                      <span className="confidence">
                        {(suggestion.confidence * 100).toFixed(0)}% confident
                      </span>
                    </div>

                    <h4 className="suggestion-title">{suggestion.title}</h4>
                    <p className="suggestion-description">{suggestion.description}</p>

                    <pre className="suggestion-code">
                      <code>{suggestion.code}</code>
                    </pre>

                    {suggestion.status === 'pending' && (
                      <div className="suggestion-actions">
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion.id)}
                          className="btn-accept"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="btn-reject"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}

                    {suggestion.status === 'accepted' && (
                      <div className="suggestion-status accepted">✓ Applied</div>
                    )}
                    {suggestion.status === 'rejected' && (
                      <div className="suggestion-status rejected">✗ Rejected</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <MetricsDisplay
          title="Performance Metrics"
          metrics={[
            { label: 'Accuracy', value: state.metrics.accuracy, format: 'percentage', target: 0.9 },
            { label: 'Latency', value: state.metrics.latency, format: 'ms', target: 300 },
            { label: 'Suggestions', value: state.metrics.suggestionsCount, format: 'number' },
            { label: 'Accept Rate', value: state.metrics.acceptanceRate, format: 'percentage' }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default RealTimeSuggestionsExample;
