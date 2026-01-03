/**
 * Example 9: UI Refactoring Assistant
 *
 * Demonstrates VL-JEPA suggesting UI refactoring
 * - Uploads legacy UI code
 * - Analyzes for improvement opportunities
 * - Creates step-by-step refactoring plan
 * - Applies refactors safely
 */

import React, { useState } from 'react';
import { VLJEPADemo, ComparisonView, MetricsDisplay } from '../shared';
import type { CodeChange } from '../shared';

interface RefactoringStep {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'accessibility' | 'maintainability' | 'modernization';
  priority: 'high' | 'medium' | 'low';
  effort: 'quick' | 'moderate' | 'significant';
  status: 'pending' | 'in-progress' | 'completed';
  codeBefore: string;
  codeAfter: string;
}

interface RefactoringState {
  originalCode: string;
  refactoredCode: string;
  steps: RefactoringStep[];
  currentStep: number;
  metrics: {
    improvements: number;
    complexityReduction: number;
    performanceGain: number;
  };
}

const LEGACY_CODE = `// Legacy UI Code
function UserProfile(props) {
  var name = props.user.name;
  var email = props.user.email;
  var avatar = props.user.avatar;

  return React.createElement('div', {className: 'profile'},
    React.createElement('img', {src: avatar}),
    React.createElement('h2', null, name),
    React.createElement('p', null, email),
    React.createElement('button', {onClick: props.onContact}, 'Contact')
  );
}`;

export const UIRefactoringExample: React.FC = () => {
  const [state, setState] = useState<RefactoringState>({
    originalCode: LEGACY_CODE,
    refactoredCode: LEGACY_CODE,
    steps: [],
    currentStep: 0,
    metrics: {
      improvements: 0,
      complexityReduction: 0,
      performanceGain: 0
    }
  });

  const analyzeCode = async () => {
    // VL-JEPA analyzes legacy code for refactoring opportunities
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const steps: RefactoringStep[] = [
      {
        id: '1',
        name: 'Convert to TypeScript',
        description: 'Add type safety by converting to TypeScript with proper interfaces',
        category: 'modernization',
        priority: 'high',
        effort: 'moderate',
        status: 'pending',
        codeBefore: 'function UserProfile(props) {',
        codeAfter: 'interface UserProfileProps {\n  user: User;\n  onContact: () => void;\n}\n\nfunction UserProfile({ user, onContact }: UserProfileProps) {'
      },
      {
        id: '2',
        name: 'Use JSX instead of createElement',
        description: 'Modernize by using JSX syntax for better readability',
        category: 'maintainability',
        priority: 'high',
        effort: 'quick',
        status: 'pending',
        codeBefore: "React.createElement('div', {className: 'profile'}, ...)",
        codeAfter: '<div className="profile">...</div>'
      },
      {
        id: '3',
        name: 'Add semantic HTML',
        description: 'Use semantic elements for better accessibility',
        category: 'accessibility',
        priority: 'medium',
        effort: 'quick',
        status: 'pending',
        codeBefore: '<img src={avatar} />',
        codeAfter: '<img src={avatar} alt={\`Avatar of \${name}\`} />'
      },
      {
        id: '4',
        name: 'Extract Avatar Component',
        description: 'Extract avatar into reusable component',
        category: 'maintainability',
        priority: 'medium',
        effort: 'moderate',
        status: 'pending',
        codeBefore: '<img src={avatar} ... />',
        codeAfter: '<Avatar src={avatar} name={name} />'
      },
      {
        id: '5',
        name: 'Optimize re-renders',
        description: 'Memoize component to prevent unnecessary re-renders',
        category: 'performance',
        priority: 'low',
        effort: 'quick',
        status: 'pending',
        codeBefore: 'function UserProfile({ user, onContact }) {',
        codeAfter: 'const UserProfile = React.memo(function UserProfile({ user, onContact }) {'
      }
    ];

    setState((prev) => ({ ...prev, steps }));
  };

  const applyStep = async (stepId: string) => {
    const step = state.steps.find((s) => s.id === stepId);
    if (!step) return;

    setState((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, status: 'in-progress' as const } : s
      )
    }));

    // Simulate applying the refactor
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let updatedCode = state.refactoredCode;

    if (step.id === '2') {
      updatedCode = updatedCode
        .replace(/React\.createElement\('div', \{className: 'profile'\}/g, '<div className="profile"')
        .replace(/React\.createElement\('img', \{src: avatar\}/g, '<img src={avatar}')
        .replace(/React\.createElement\('h2', null, name\)/g, '<h2>{name}</h2>')
        .replace(/React\.createElement\('p', null, email\)/g, '<p>{email}</p>')
        .replace(/React\.createElement\('button', \{onClick: props\.onContact\}, 'Contact'\)/g, '<button onClick={onContact}>Contact</button>');
    }

    setState((prev) => {
      const newSteps = prev.steps.map((s) =>
        s.id === stepId ? { ...s, status: 'completed' as const } : s
      );
      const completedCount = newSteps.filter((s) => s.status === 'completed').length;

      return {
        ...prev,
        steps: newSteps,
        refactoredCode: updatedCode,
        currentStep: completedCount,
        metrics: {
          improvements: completedCount,
          complexityReduction: completedCount * 15,
          performanceGain: completedCount * 8
        }
      };
    });
  };

  const applyAllSteps = async () => {
    for (const step of state.steps) {
      if (step.status !== 'completed') {
        await applyStep(step.id);
      }
    }
  };

  return (
    <VLJEPADemo
      title="UI Refactoring Assistant"
      description="VL-JEPA analyzes your legacy UI code and creates a step-by-step refactoring plan."
      features={[
        'Legacy code analysis',
        'Prioritized refactoring steps',
        'Safe, incremental changes',
        'Before/after comparison'
      ]}
      metrics={{
        accuracy: 0.91,
        latency: 1500,
        confidence: 0.88
      }}
    >
      <div className="ui-refactoring">
        <div className="control-bar">
          <button onClick={analyzeCode} disabled={state.steps.length > 0} className="btn-analyze">
            🔍 Analyze Code
          </button>
          <button
            onClick={applyAllSteps}
            disabled={state.steps.length === 0}
            className="btn-apply-all"
          >
            ✨ Apply All Steps
          </button>
          <span className="progress-indicator">
            {state.currentStep}/{state.steps.length} steps completed
          </span>
        </div>

        <div className="main-content">
          <div className="steps-panel">
            <h3>Refactoring Steps</h3>
            {state.steps.length === 0 ? (
              <div className="placeholder">Click "Analyze Code" to find refactoring opportunities</div>
            ) : (
              <div className="steps-list">
                {state.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`step-card priority-${step.priority} status-${step.status}`}
                  >
                    <div className="step-header">
                      <span className="step-number">{idx + 1}</span>
                      <h4>{step.name}</h4>
                      <span className={`priority-badge ${step.priority}`}>{step.priority}</span>
                    </div>

                    <p className="step-description">{step.description}</p>

                    <div className="step-meta">
                      <span className={`category-badge ${step.category}`}>{step.category}</span>
                      <span className={`effort-badge ${step.effort}`}>{step.effort} effort</span>
                    </div>

                    {step.status === 'pending' && (
                      <button onClick={() => applyStep(step.id)} className="btn-apply-step">
                        Apply Step
                      </button>
                    )}
                    {step.status === 'in-progress' && (
                      <span className="status-in-progress">⏳ Applying...</span>
                    )}
                    {step.status === 'completed' && (
                      <span className="status-completed">✓ Completed</span>
                    )}

                    <div className="step-comparison">
                      <pre className="code-before">{step.codeBefore}</pre>
                      <span className="arrow">→</span>
                      <pre className="code-after">{step.codeAfter}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="comparison-panel">
            <h3>Code Comparison</h3>
            <ComparisonView
              before={state.originalCode}
              after={state.refactoredCode}
              beforeLabel="Original Code"
              afterLabel="Refactored Code"
            />
          </div>
        </div>

        <MetricsDisplay
          title="Refactoring Metrics"
          metrics={[
            { label: 'Improvements', value: state.metrics.improvements, format: 'number' },
            { label: 'Complexity Reduction', value: state.metrics.complexityReduction, format: 'percentage' },
            { label: 'Performance Gain', value: state.metrics.performanceGain, format: 'percentage' }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default UIRefactoringExample;
