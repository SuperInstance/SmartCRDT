/**
 * Example 12: Predictive UI
 *
 * Demonstrates VL-JEPA predicting user intent and pre-loading suggestions
 * - VL-JEPA analyzes user behavior patterns
 * - Predicts next user action
 * - Pre-loads likely suggestions
 * - Measures prediction accuracy
 */

import React, { useState, useEffect } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { PredictiveAction } from '../shared';

interface UserAction {
  timestamp: number;
  type: string;
  element: string;
  value?: any;
}

interface PredictionResult {
  action: string;
  probability: number;
  actualAction?: string;
  correct: boolean;
}

interface PredictiveUIState {
  userActions: UserAction[];
  predictions: PredictiveAction[];
  predictionHistory: PredictionResult[];
  isModelTraining: boolean;
  metrics: {
    accuracy: number;
    totalPredictions: number;
    correctPredictions: number;
    avgConfidence: number;
  };
}

// Simulated user action patterns
const ACTION_PATTERNS = [
  { sequence: ['click-home', 'click-products', 'click-category'], next: 'click-filter', probability: 0.85 },
  { sequence: ['click-cart', 'view-checkout'], next: 'click-checkout', probability: 0.92 },
  { sequence: ['click-login', 'input-email'], next: 'input-password', probability: 0.95 },
  { sequence: ['click-search', 'input-query'], next: 'click-search-button', probability: 0.88 },
  { sequence: ['view-product', 'click-add-cart'], next: 'click-cart', probability: 0.78 }
];

export const PredictiveUIExample: React.FC = () => {
  const [state, setState] = useState<PredictiveUIState>({
    userActions: [],
    predictions: [],
    predictionHistory: [],
    isModelTraining: false,
    metrics: {
      accuracy: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      avgConfidence: 0
    }
  });

  useEffect(() => {
    // Make predictions as user actions accumulate
    if (state.userActions.length >= 2) {
      makePrediction();
    }
  }, [state.userActions]);

  const makePrediction = () => {
    const recentActions = state.userActions.slice(-3).map((a) => a.type);

    // Find matching pattern
    const match = ACTION_PATTERNS.find((pattern) =>
      pattern.sequence.every((action, idx) => recentActions[idx] === action)
    );

    if (match) {
      const prediction: PredictiveAction = {
        action: match.next,
        probability: match.probability,
        timestamp: Date.now(),
        executed: false
      };

      setState((prev) => ({
        ...prev,
        predictions: [prediction]
      }));
    }
  };

  const simulateUserAction = (actionType: string, element: string, value?: any) => {
    const action: UserAction = {
      timestamp: Date.now(),
      type: actionType,
      element,
      value
    };

    // Check if prediction was correct
    let predictionCorrect = false;
    let actualAction = '';

    if (state.predictions.length > 0) {
      const latestPrediction = state.predictions[0];
      predictionCorrect = latestPrediction.action === actionType;
      actualAction = actionType;

      const result: PredictionResult = {
        action: latestPrediction.action,
        probability: latestPrediction.probability,
        actualAction,
        correct: predictionCorrect
      };

      setState((prev) => {
        const newHistory = [...prev.predictionHistory, result];
        const correctCount = newHistory.filter((h) => h.correct).length;

        return {
          ...prev,
          predictionHistory: newHistory,
          predictions: [],
          metrics: {
            accuracy: correctCount / newHistory.length,
            totalPredictions: newHistory.length,
            correctPredictions: correctCount,
            avgConfidence: newHistory.reduce((sum, h) => sum + h.probability, 0) / newHistory.length
          }
        };
      });
    }

    setState((prev) => ({
      ...prev,
      userActions: [...prev.userActions, action]
    }));
  };

  const trainModel = async () => {
    setState((prev) => ({ ...prev, isModelTraining: true }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setState((prev) => ({ ...prev, isModelTraining: false }));
  };

  const resetSimulation = () => {
    setState({
      userActions: [],
      predictions: [],
      predictionHistory: [],
      isModelTraining: false,
      metrics: {
        accuracy: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        avgConfidence: 0
      }
    });
  };

  // Demo scenario buttons
  const scenarios = [
    { name: 'Shopping Flow', actions: [
      () => simulateUserAction('click-home', 'nav-home'),
      () => simulateUserAction('click-products', 'nav-products'),
      () => simulateUserAction('click-category', 'category-electronics'),
      () => simulateUserAction('click-filter', 'filter-price'),
    ]},
    { name: 'Checkout Flow', actions: [
      () => simulateUserAction('click-cart', 'nav-cart'),
      () => simulateUserAction('view-checkout', 'checkout-page'),
      () => simulateUserAction('click-checkout', 'btn-checkout'),
    ]},
    { name: 'Login Flow', actions: [
      () => simulateUserAction('click-login', 'nav-login'),
      () => simulateUserAction('input-email', 'input-email', 'user@example.com'),
      () => simulateUserAction('input-password', 'input-password', '********'),
    ]}
  ];

  const runScenario = async (scenario: typeof scenarios[0]) => {
    resetSimulation();
    for (const action of scenario.actions) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      action();
    }
  };

  return (
    <VLJEPADemo
      title="Predictive UI"
      description="VL-JEPA learns user behavior patterns and predicts next actions to pre-load suggestions."
      features={[
        'Behavior pattern learning',
        'Real-time prediction',
        'Confidence-based pre-loading',
        'Accuracy measurement'
      ]}
      metrics={{
        accuracy: state.metrics.accuracy,
        latency: 50,
        confidence: state.metrics.avgConfidence
      }}
    >
      <div className="predictive-ui">
        <div className="control-bar">
          <button onClick={trainModel} disabled={state.isModelTraining} className="btn-train">
            {state.isModelTraining ? '🔄 Training...' : '🧠 Train Model'}
          </button>
          <button onClick={resetSimulation} className="btn-reset">
            🔄 Reset
          </button>
          <span className="prediction-count">
            {state.metrics.totalPredictions} predictions made
          </span>
        </div>

        <div className="scenarios-section">
          <h3>Test Scenarios</h3>
          <div className="scenarios-grid">
            {scenarios.map((scenario, idx) => (
              <button
                key={idx}
                onClick={() => runScenario(scenario)}
                className="scenario-btn"
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        <div className="main-content">
          <div className="actions-panel">
            <h3>User Actions</h3>
            <div className="actions-timeline">
              {state.userActions.length === 0 ? (
                <div className="placeholder">Run a scenario to see user actions</div>
              ) : (
                state.userActions.map((action, idx) => (
                  <div key={idx} className="action-item">
                    <span className="action-number">#{idx + 1}</span>
                    <span className="action-type">{action.type}</span>
                    <span className="action-element">{action.element}</span>
                    <span className="action-time">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="predictions-panel">
            <h3>Current Predictions</h3>
            {state.predictions.length === 0 ? (
              <div className="placeholder">No active predictions</div>
            ) : (
              state.predictions.map((prediction, idx) => (
                <div key={idx} className="prediction-card">
                  <div className="prediction-header">
                    <span className="prediction-icon">🔮</span>
                    <h4>Predicted Action</h4>
                  </div>
                  <div className="prediction-action">{prediction.action}</div>
                  <div className="prediction-confidence">
                    <span>Confidence: </span>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{ width: `${(prediction.probability * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span>{(prediction.probability * 100).toFixed(0)}%</span>
                  </div>
                  <p className="prediction-note">
                    Suggestions are pre-loaded for faster response
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="history-panel">
            <h3>Prediction History</h3>
            <div className="history-list">
              {state.predictionHistory.length === 0 ? (
                <div className="placeholder">No predictions yet</div>
              ) : (
                state.predictionHistory.map((result, idx) => (
                  <div
                    key={idx}
                    className={`history-item ${result.correct ? 'correct' : 'incorrect'}`}
                  >
                    <span className={`status-indicator ${result.correct ? 'correct' : 'incorrect'}`}>
                      {result.correct ? '✓' : '✗'}
                    </span>
                    <span className="predicted">Predicted: {result.action}</span>
                    {result.actualAction && (
                      <span className="actual">Actual: {result.actualAction}</span>
                    )}
                    <span className="probability">
                      {(result.probability * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <MetricsDisplay
          title="Prediction Metrics"
          metrics={[
            { label: 'Accuracy', value: state.metrics.accuracy, format: 'percentage', target: 0.85 },
            { label: 'Predictions', value: state.metrics.totalPredictions, format: 'number' },
            { label: 'Avg Confidence', value: state.metrics.avgConfidence, format: 'percentage', target: 0.8 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default PredictiveUIExample;
