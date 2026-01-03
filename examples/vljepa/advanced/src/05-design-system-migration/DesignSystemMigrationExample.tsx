/**
 * Example 5: Design System Migration
 *
 * Demonstrates VL-JEPA migrating between design systems
 * - Analyzes old and new design systems
 * - Maps components between systems
 * - Generates migration plan
 * - Shows progress tracking
 */

import React, { useState } from 'react';
import { VLJEPADemo, ComparisonView, MetricsDisplay } from '../shared';
import type { DesignToken, UIElement } from '../shared';

interface ComponentMapping {
  oldComponent: string;
  newComponent: string;
  confidence: number;
  changes: string[];
  status: 'pending' | 'migrating' | 'completed';
}

interface MigrationState {
  oldDesignSystem: string;
  newDesignSystem: string;
  mappings: ComponentMapping[];
  migrationProgress: number;
  metrics: {
    componentsMapped: number;
    confidenceScore: number;
    estimatedTimeRemaining: number;
  };
}

const OLD_DS = `// Old Design System (Material UI v4)
import { Button, Card, TextField } from '@material-ui/core';

export const MyComponent = () => {
  return (
    <Card>
      <TextField label="Name" variant="outlined" />
      <Button variant="contained" color="primary">Submit</Button>
    </Card>
  );
};`;

const NEW_DS = `// New Design System (Mantine v7)
import { Button, Card, TextInput } from '@mantine/core';

export const MyComponent = () => {
  return (
    <Card>
      <TextInput label="Name" />
      <Button>Submit</Button>
    </Card>
  );
};`;

export const DesignSystemMigrationExample: React.FC = () => {
  const [state, setState] = useState<MigrationState>({
    oldDesignSystem: OLD_DS,
    newDesignSystem: NEW_DS,
    mappings: [],
    migrationProgress: 0,
    metrics: {
      componentsMapped: 0,
      confidenceScore: 0,
      estimatedTimeRemaining: 0
    }
  });

  const analyzeDesignSystems = async () => {
    // VL-JEPA analyzes both design systems and creates mappings
    const mappings: ComponentMapping[] = [
      {
        oldComponent: 'Card (Material UI)',
        newComponent: 'Card (Mantine)',
        confidence: 0.95,
        changes: [
          'Remove elevation prop',
          'Update padding styles',
          'Update shadow API'
        ],
        status: 'pending'
      },
      {
        oldComponent: 'TextField (Material UI)',
        newComponent: 'TextInput (Mantine)',
        confidence: 0.92,
        changes: [
          'Change variant="outlined" to default',
          'Update label prop structure',
          'Update error handling'
        ],
        status: 'pending'
      },
      {
        oldComponent: 'Button (Material UI)',
        newComponent: 'Button (Mantine)',
        confidence: 0.98,
        changes: [
          'Remove variant="contained"',
          'Update color prop structure',
          'Update onClick handler'
        ],
        status: 'pending'
      }
    ];

    const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;

    setState((prev) => ({
      ...prev,
      mappings,
      metrics: {
        componentsMapped: mappings.length,
        confidenceScore: avgConfidence,
        estimatedTimeRemaining: mappings.length * 15 // 15 min per component
      }
    }));
  };

  const migrateComponent = async (index: number) => {
    setState((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m, i) =>
        i === index ? { ...m, status: 'migrating' as const } : m
      )
    }));

    // Simulate migration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setState((prev) => {
      const newMappings = prev.mappings.map((m, i) =>
        i === index ? { ...m, status: 'completed' as const } : m
      );
      const completedCount = newMappings.filter((m) => m.status === 'completed').length;
      const progress = (completedCount / newMappings.length) * 100;

      return {
        ...prev,
        mappings: newMappings,
        migrationProgress: progress
      };
    });
  };

  const migrateAll = async () => {
    for (let i = 0; i < state.mappings.length; i++) {
      await migrateComponent(i);
    }
  };

  return (
    <VLJEPADemo
      title="Design System Migration"
      description="VL-JEPA intelligently maps components between design systems and generates migration plans."
      features={[
        'Automatic component mapping',
        'Confidence-based recommendations',
        'Step-by-step migration guide',
        'Progress tracking'
      ]}
      metrics={{
        accuracy: 0.93,
        latency: 800,
        confidence: state.metrics.confidenceScore
      }}
    >
      <div className="design-system-migration">
        <div className="control-bar">
          <button onClick={analyzeDesignSystems} className="btn-analyze">
            🔍 Analyze Design Systems
          </button>
          <button
            onClick={migrateAll}
            disabled={state.mappings.length === 0 || state.migrationProgress === 100}
            className="btn-migrate"
          >
            🚀 Migrate All
          </button>
          <span className="progress-indicator">
            Progress: {state.migrationProgress.toFixed(0)}%
          </span>
        </div>

        <div className="comparison-section">
          <h3>Design Systems Comparison</h3>
          <ComparisonView
            before={state.oldDesignSystem}
            after={state.newDesignSystem}
            beforeLabel="Old Design System"
            afterLabel="New Design System"
          />
        </div>

        {state.mappings.length > 0 && (
          <div className="mappings-section">
            <h3>Component Mappings</h3>
            <div className="mappings-list">
              {state.mappings.map((mapping, idx) => (
                <div
                  key={idx}
                  className={`mapping-card status-${mapping.status}`}
                >
                  <div className="mapping-header">
                    <span className="mapping-from">{mapping.oldComponent}</span>
                    <span className="mapping-arrow">→</span>
                    <span className="mapping-to">{mapping.newComponent}</span>
                    <span className={`confidence-badge ${mapping.confidence > 0.9 ? 'high' : 'medium'}`}>
                      {(mapping.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>

                  <div className="mapping-changes">
                    <strong>Changes required:</strong>
                    <ul>
                      {mapping.changes.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mapping-status">
                    {mapping.status === 'pending' && (
                      <button onClick={() => migrateComponent(idx)} className="btn-migrate-one">
                        Migrate
                      </button>
                    )}
                    {mapping.status === 'migrating' && (
                      <span className="status-migrating">⏳ Migrating...</span>
                    )}
                    {mapping.status === 'completed' && (
                      <span className="status-completed">✓ Completed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.metrics.componentsMapped > 0 && (
          <MetricsDisplay
            title="Migration Metrics"
            metrics={[
              { label: 'Components Mapped', value: state.metrics.componentsMapped, format: 'number' },
              { label: 'Confidence Score', value: state.metrics.confidenceScore, format: 'percentage', target: 0.9 },
              { label: 'Est. Time Remaining', value: state.metrics.estimatedTimeRemaining, format: 'number', unit: ' min' }
            ]}
            layout="horizontal"
          />
        )}
      </div>
    </VLJEPADemo>
  );
};

export default DesignSystemMigrationExample;
