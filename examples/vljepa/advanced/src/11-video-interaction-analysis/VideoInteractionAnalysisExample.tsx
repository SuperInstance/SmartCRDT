/**
 * Example 11: Video Interaction Analysis
 *
 * Demonstrates VL-JEPA analyzing user interactions from screen recordings
 * - Uploads screen recording video
 * - VL-JEPA tracks and analyzes interactions
 * - Detects patterns and anomalies
 * - Shows insights and recommendations
 */

import React, { useState } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { VideoInteraction } from '../shared';

interface InteractionPattern {
  name: string;
  description: string;
  frequency: number;
  significance: 'high' | 'medium' | 'low';
  example?: VideoInteraction;
}

interface AnalysisInsight {
  type: 'issue' | 'opportunity' | 'pattern';
  title: string;
  description: string;
  recommendation: string;
}

interface VideoAnalysisState {
  isAnalyzing: boolean;
  progress: number;
  interactions: VideoInteraction[];
  patterns: InteractionPattern[];
  insights: AnalysisInsight[];
  metrics: {
    interactionsDetected: number;
    patternsFound: number;
    analysisDuration: number;
    accuracy: number;
  };
}

export const VideoInteractionAnalysisExample: React.FC = () => {
  const [state, setState] = useState<VideoAnalysisState>({
    isAnalyzing: false,
    progress: 0,
    interactions: [],
    patterns: [],
    insights: [],
    metrics: {
      interactionsDetected: 0,
      patternsFound: 0,
      analysisDuration: 0,
      accuracy: 0.94
    }
  });

  const simulateVideoUpload = async () => {
    setState((prev) => ({ ...prev, isAnalyzing: true, progress: 0 }));

    // Simulate video analysis progress
    const progressSteps = [10, 25, 40, 60, 80, 100];
    for (const step of progressSteps) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setState((prev) => ({ ...prev, progress: step }));
    }

    // Generate simulated interactions
    const interactions: VideoInteraction[] = [
      { timestamp: 0.5, type: 'click', element: 'button-primary', position: { x: 150, y: 300 }, duration: 200 },
      { timestamp: 1.2, type: 'input', element: 'input-email', position: { x: 200, y: 250 }, value: 'user@email.com' },
      { timestamp: 3.5, type: 'scroll', element: 'div-container', position: { x: 0, y: 400 }, duration: 1500 },
      { timestamp: 5.0, type: 'hover', element: 'card-product', position: { x: 300, y: 200 }, duration: 800 },
      { timestamp: 7.2, type: 'click', element: 'button-add-cart', position: { x: 450, y: 500 }, duration: 180 },
      { timestamp: 8.5, type: 'drag', element: 'slider-price', position: { x: 300, y: 350 }, duration: 1200, value: 75 }
    ];

    // Generate patterns
    const patterns: InteractionPattern[] = [
      {
        name: 'Rage Clicking',
        description: 'User clicked same element multiple times rapidly',
        frequency: 3,
        significance: 'high',
        example: { timestamp: 12.0, type: 'click', element: 'button-submit', position: { x: 150, y: 300 } }
      },
      {
        name: 'Hesitation',
        description: 'User hovered over button before clicking',
        frequency: 5,
        significance: 'medium'
      },
      {
        name: 'Fast Scrolling',
        description: 'User scrolled through content quickly',
        frequency: 2,
        significance: 'low'
      },
      {
        name: 'Input Correction',
        description: 'User backspaced and retyped in form fields',
        frequency: 4,
        significance: 'medium'
      }
    ];

    // Generate insights
    const insights: AnalysisInsight[] = [
      {
        type: 'issue',
        title: 'Button Unresponsiveness',
        description: 'Users clicked the submit button an average of 3 times, suggesting perceived lag',
        recommendation: 'Add loading state or skeleton UI to provide immediate feedback'
      },
      {
        type: 'opportunity',
        title: 'High Engagement on Product Cards',
        description: 'Users spent an average of 2.5 seconds hovering over product cards',
        recommendation: 'Consider adding quick-view functionality or rich tooltips'
      },
      {
        type: 'pattern',
        title: 'Form Field Confusion',
        description: 'Users frequently corrected input in email field',
        recommendation: 'Add real-time validation and format hints'
      }
    ];

    setState((prev) => ({
      ...prev,
      isAnalyzing: false,
      interactions,
      patterns,
      insights,
      metrics: {
        interactionsDetected: interactions.length,
        patternsFound: patterns.length,
        analysisDuration: 3000,
        accuracy: 0.94
      }
    }));
  };

  return (
    <VLJEPADemo
      title="Video Interaction Analysis"
      description="Upload a screen recording and VL-JEPA analyzes user interactions to find patterns and issues."
      features={[
        'Computer vision-based interaction tracking',
        'Pattern recognition (rage clicking, hesitation, etc.)',
        'Actionable insights and recommendations',
        'Timeline visualization'
      ]}
      metrics={{
        accuracy: state.metrics.accuracy,
        latency: state.metrics.analysisDuration,
        confidence: 0.92
      }}
    >
      <div className="video-interaction-analysis">
        <div className="upload-section">
          <div className="upload-area">
            <div className="upload-icon">📹</div>
            <h3>Upload Screen Recording</h3>
            <p>Drag and drop a video file or click to browse</p>
            <button onClick={simulateVideoUpload} disabled={state.isAnalyzing} className="btn-upload">
              {state.isAnalyzing ? 'Analyzing...' : 'Analyze Demo Video'}
            </button>
          </div>

          {state.isAnalyzing && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${state.progress}%` }} />
              <span className="progress-text">{state.progress}%</span>
            </div>
          )}
        </div>

        {state.interactions.length > 0 && (
          <div className="analysis-results">
            <div className="interactions-panel">
              <h3>Detected Interactions</h3>
              <div className="interactions-timeline">
                {state.interactions.map((interaction, idx) => (
                  <div key={idx} className={`interaction-item interaction-${interaction.type}`}>
                    <span className="interaction-time">{interaction.timestamp.toFixed(1)}s</span>
                    <span className="interaction-type">{interaction.type}</span>
                    <span className="interaction-element">{interaction.element}</span>
                    {interaction.duration && (
                      <span className="interaction-duration">{interaction.duration}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="patterns-panel">
              <h3>Detected Patterns</h3>
              <div className="patterns-list">
                {state.patterns.map((pattern, idx) => (
                  <div key={idx} className={`pattern-card significance-${pattern.significance}`}>
                    <div className="pattern-header">
                      <h4>{pattern.name}</h4>
                      <span className="frequency-badge">{pattern.frequency} occurrences</span>
                    </div>
                    <p className="pattern-description">{pattern.description}</p>
                    <span className={`significance-badge ${pattern.significance}`}>
                      {pattern.significance} significance
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="insights-panel">
              <h3>Insights & Recommendations</h3>
              <div className="insights-list">
                {state.insights.map((insight, idx) => (
                  <div key={idx} className={`insight-card insight-${insight.type}`}>
                    <div className="insight-header">
                      <span className={`insight-type ${insight.type}`}>
                        {insight.type.toUpperCase()}
                      </span>
                      <h4>{insight.title}</h4>
                    </div>
                    <p className="insight-description">{insight.description}</p>
                    <div className="insight-recommendation">
                      <strong>Recommendation:</strong>
                      <p>{insight.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <MetricsDisplay
          title="Analysis Metrics"
          metrics={[
            { label: 'Interactions', value: state.metrics.interactionsDetected, format: 'number' },
            { label: 'Patterns', value: state.metrics.patternsFound, format: 'number' },
            { label: 'Accuracy', value: state.metrics.accuracy, format: 'percentage', target: 0.9 },
            { label: 'Duration', value: state.metrics.analysisDuration, format: 'ms', target: 5000 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default VideoInteractionAnalysisExample;
