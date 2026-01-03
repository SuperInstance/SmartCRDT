/**
 * Example 6: A/B Testing Dashboard
 *
 * Demonstrates VL-JEPA analyzing A/B test variants and predicting winners
 * - Uploads and compares A/B variants
 * - Analyzes differences using computer vision
 * - Predicts winner based on UX principles
 * - Shows dashboard with metrics
 */

import React, { useState } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { ABTestVariant, UIElement } from '../shared';

interface ABTestState {
  variants: ABTestVariant[];
  selectedVariant: string | null;
  prediction: {
    winner: string | null;
    confidence: number;
    reasoning: string[];
  };
  isAnalyzing: boolean;
  metrics: {
    analysisAccuracy: number;
    predictionConfidence: number;
    analysisDuration: number;
  };
}

const VARIANT_A: ABTestVariant = {
  id: 'A',
  name: 'Variant A - Original',
  description: 'Current signup form with single column',
  ui: {
    id: 'variant-a',
    type: 'form',
    props: { layout: 'single-column', ctaColor: 'blue', ctaText: 'Sign Up' },
    children: []
  },
  metrics: {
    conversionRate: 0.12,
    engagement: 0.45,
    satisfaction: 3.8
  }
};

const VARIANT_B: ABTestVariant = {
  id: 'B',
  name: 'Variant B - Two Column',
  description: 'Split layout with social proof on right',
  ui: {
    id: 'variant-b',
    type: 'form',
    props: { layout: 'two-column', ctaColor: 'green', ctaText: 'Get Started' },
    children: []
  },
  metrics: {
    conversionRate: 0.15,
    engagement: 0.52,
    satisfaction: 4.1
  }
};

const VARIANT_C: ABTestVariant = {
  id: 'C',
  name: 'Variant C - Minimal',
  description: 'Minimal design with progress indicator',
  ui: {
    id: 'variant-c',
    type: 'form',
    props: { layout: 'minimal', ctaColor: 'purple', ctaText: 'Continue' },
    children: []
  },
  metrics: {
    conversionRate: 0.18,
    engagement: 0.48,
    satisfaction: 4.3
  }
};

export const ABTestingDashboardExample: React.FC = () => {
  const [state, setState] = useState<ABTestState>({
    variants: [VARIANT_A, VARIANT_B],
    selectedVariant: null,
    prediction: {
      winner: null,
      confidence: 0,
      reasoning: []
    },
    isAnalyzing: false,
    metrics: {
      analysisAccuracy: 0.92,
      predictionConfidence: 0,
      analysisDuration: 0
    }
  });

  const addVariant = (variant: ABTestVariant) => {
    setState((prev) => ({
      ...prev,
      variants: [...prev.variants, variant]
    }));
  };

  const removeVariant = (variantId: string) => {
    setState((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== variantId)
    }));
  };

  const runAnalysis = async () => {
    setState((prev) => ({ ...prev, isAnalyzing: true }));
    const startTime = Date.now();

    // VL-JEPA analyzes variants using computer vision
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate VL-JEPA prediction
    const bestVariant = state.variants.reduce((best, current) =>
      current.metrics.conversionRate > best.metrics.conversionRate ? current : best
    );

    const reasoning = [
      `${bestVariant.name} has highest conversion rate (${(bestVariant.metrics.conversionRate * 100).toFixed(1)}%)`,
      'CTA button uses action-oriented language',
      'Layout follows F-pattern reading pattern',
      'Visual hierarchy guides user attention effectively',
      'Form fields minimize cognitive load'
    ];

    const duration = Date.now() - startTime;

    setState((prev) => ({
      ...prev,
      isAnalyzing: false,
      prediction: {
        winner: bestVariant.id,
        confidence: 0.87 + Math.random() * 0.1,
        reasoning
      },
      metrics: {
        analysisAccuracy: 0.92,
        predictionConfidence: 0.87 + Math.random() * 0.1,
        analysisDuration: duration
      }
    }));
  };

  const getVariantCard = (variant: ABTestVariant) => (
    <div
      key={variant.id}
      className={`variant-card ${state.selectedVariant === variant.id ? 'selected' : ''} ${state.prediction.winner === variant.id ? 'winner' : ''}`}
      onClick={() => setState((prev) => ({ ...prev, selectedVariant: variant.id }))}
    >
      <div className="variant-header">
        <h4>{variant.name}</h4>
        {state.prediction.winner === variant.id && (
          <span className="winner-badge">🏆 Predicted Winner</span>
        )}
      </div>
      <p className="variant-description">{variant.description}</p>

      <div className="variant-ui-preview">
        <div className="mock-form" style={{ flexDirection: variant.ui.props.layout === 'single-column' ? 'column' : 'row' }}>
          <input type="text" placeholder="Email" style={{ borderColor: variant.ui.props.ctaColor }} />
          <button style={{ backgroundColor: variant.ui.props.ctaColor }}>
            {variant.ui.props.ctaText}
          </button>
        </div>
      </div>

      <div className="variant-metrics">
        <div className="metric">
          <span className="label">Conversion:</span>
          <span className="value">{(variant.metrics.conversionRate * 100).toFixed(1)}%</span>
        </div>
        <div className="metric">
          <span className="label">Engagement:</span>
          <span className="value">{(variant.metrics.engagement * 100).toFixed(1)}%</span>
        </div>
        <div className="metric">
          <span className="label">Satisfaction:</span>
          <span className="value">{variant.metrics.satisfaction}/5</span>
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); removeVariant(variant.id); }} className="btn-remove">
        Remove
      </button>
    </div>
  );

  return (
    <VLJEPADemo
      title="A/B Testing Dashboard"
      description="VL-JEPA analyzes A/B test variants and predicts winners using computer vision and UX principles."
      features={[
        'Visual comparison of variants',
        'Computer vision analysis',
        'UX principle scoring',
        'Winner prediction with confidence'
      ]}
      metrics={{
        accuracy: state.metrics.analysisAccuracy,
        latency: state.metrics.analysisDuration,
        confidence: state.metrics.predictionConfidence
      }}
    >
      <div className="ab-testing-dashboard">
        <div className="control-bar">
          <button onClick={runAnalysis} disabled={state.isAnalyzing || state.variants.length < 2} className="btn-analyze">
            {state.isAnalyzing ? '🔍 Analyzing...' : '🔍 Run Analysis'}
          </button>
          <button onClick={() => addVariant(VARIANT_C)} disabled={state.variants.some((v) => v.id === 'C')} className="btn-add">
            ➕ Add Variant C
          </button>
          <span className="variant-count">{state.variants.length} variants</span>
        </div>

        <div className="variants-grid">
          {state.variants.map((variant) => getVariantCard(variant))}
        </div>

        {state.prediction.winner && (
          <div className="prediction-panel">
            <h3>VL-JEPA Prediction</h3>
            <div className="prediction-result">
              <div className="winner-announcement">
                <span className="emoji">🏆</span>
                <span>Winner: {state.variants.find((v) => v.id === state.prediction.winner)?.name}</span>
              </div>
              <div className="confidence-meter">
                <span>Confidence:</span>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${(state.prediction.confidence * 100).toFixed(0)}%` }}
                  />
                </div>
                <span>{(state.prediction.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="reasoning-list">
              <h4>Reasoning:</h4>
              {state.prediction.reasoning.map((reason, idx) => (
                <div key={idx} className="reasoning-item">
                  <span className="bullet">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <MetricsDisplay
          title="Analysis Metrics"
          metrics={[
            { label: 'Accuracy', value: state.metrics.analysisAccuracy, format: 'percentage', target: 0.9 },
            { label: 'Confidence', value: state.metrics.predictionConfidence, format: 'percentage', target: 0.85 },
            { label: 'Duration', value: state.metrics.analysisDuration, format: 'ms', target: 3000 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default ABTestingDashboardExample;
