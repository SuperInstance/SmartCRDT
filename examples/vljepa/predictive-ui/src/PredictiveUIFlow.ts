/**
 * Real-Time UI Suggestions Example
 *
 * Demonstrates predictive UI suggestions using VL-JEPA.
 * As user edits, VL-JEPA suggests next likely changes.
 *
 * Features:
 * - Real-time suggestion generation
 * - Confidence-based filtering
 * - One-click application
 * - Learning from user patterns
 */

import { useState, useEffect, useCallback } from 'react';

export interface UISuggestion {
  id: string;
  type: 'modify' | 'create' | 'delete' | 'restyle';
  target: string;
  params: Record<string, unknown>;
  confidence: number;
  description: string;
  reasoning: string;
  preview?: string;
  quickApply: string;
}

export interface PredictiveUIState {
  suggestions: UISuggestion[];
  active: boolean;
  learning: boolean;
  userPatterns: Map<string, number>;
}

/**
 * Predictive UI Flow Hook
 *
 * Generates real-time UI suggestions based on user behavior.
 */
export function usePredictiveUIFlow() {
  const [state, setState] = useState<PredictiveUIState>({
    suggestions: [],
    active: true,
    learning: true,
    userPatterns: new Map(),
  });

  /**
   * Generate suggestions based on current context
   */
  const generateSuggestions = useCallback(async (context: {
    currentElement?: string;
    recentChanges: Array<{ target: string; change: string }>;
    userIntent?: string;
  }) => {
    if (!state.active) return [];

    const suggestions: UISuggestion[] = [];

    // Analyze recent patterns
    const patterns = Array.from(state.userPatterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Generate suggestions based on patterns
    for (const [pattern, frequency] of patterns) {
      const confidence = Math.min(0.95, 0.6 + frequency * 0.05);

      if (confidence > 0.7) {
        suggestions.push({
          id: `suggestion-${Date.now()}-${suggestions.length}`,
          type: 'modify',
          target: context.currentElement || '*',
          params: {},
          confidence,
          description: `Apply ${pattern} based on your workflow`,
          reasoning: `You've done this ${frequency} times before`,
          quickApply: pattern,
        });
      }
    }

    // Context-aware suggestions
    if (context.currentElement?.includes('button')) {
      suggestions.push({
        id: 'sugg-button-padding',
        type: 'modify',
        target: context.currentElement,
        params: { padding: '16px' },
        confidence: 0.85,
        description: 'Increase button padding',
        reasoning: 'Buttons typically need more padding for better touch targets',
        quickApply: 'padding: 16px',
      });

      suggestions.push({
        id: 'sugg-button-hover',
        type: 'modify',
        target: context.currentElement,
        params: { transition: 'all 0.2s ease' },
        confidence: 0.78,
        description: 'Add smooth hover transition',
        reasoning: 'Improves user feedback',
        quickApply: 'transition: all 0.2s ease',
      });
    }

    setState((prev) => ({ ...prev, suggestions }));
    return suggestions;
  }, [state.active, state.userPatterns]);

  /**
   * Apply suggestion
   */
  const applySuggestion = useCallback(async (suggestion: UISuggestion) => {
    console.log('[Predictive UI] Applying suggestion:', suggestion.description);

    // Apply the change
    // Learn from user acceptance
    if (state.learning) {
      const pattern = suggestion.quickApply;
      const current = state.userPatterns.get(pattern) || 0;
      state.userPatterns.set(pattern, current + 1);

      // Persist patterns
      localStorage.setItem(
        'predictive-ui-patterns',
        JSON.stringify(Array.from(state.userPatterns.entries()))
      );
    }
  }, [state.learning, state.userPatterns]);

  /**
   * Record user action for learning
   */
  const recordAction = useCallback((action: {
    target: string;
    change: string;
    type: string;
  }) => {
    if (!state.learning) return;

    const pattern = `${action.type}:${action.change}`;
    const current = state.userPatterns.get(pattern) || 0;
    state.userPatterns.set(pattern, current + 1);

    setState((prev) => ({ ...prev }));
  }, [state.learning, state.userPatterns]);

  /**
   * Dismiss suggestion (negative feedback)
   */
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.filter((s) => s.id !== suggestionId),
    }));
  }, []);

  /**
   * Toggle predictive mode
   */
  const toggleActive = useCallback(() => {
    setState((prev) => ({ ...prev, active: !prev.active }));
  }, []);

  /**
   * Clear learned patterns
   */
  const clearPatterns = useCallback(() => {
    state.userPatterns.clear();
    localStorage.removeItem('predictive-ui-patterns');
    setState((prev) => ({ ...prev }));
  }, [state.userPatterns]);

  // Load saved patterns on mount
  useEffect(() => {
    const saved = localStorage.getItem('predictive-ui-patterns');
    if (saved) {
      try {
        const patterns = new Map(JSON.parse(saved));
        setState((prev) => ({ ...prev, userPatterns: patterns }));
      } catch (e) {
        console.error('Failed to load patterns:', e);
      }
    }
  }, []);

  return {
    state,
    generateSuggestions,
    applySuggestion,
    recordAction,
    dismissSuggestion,
    toggleActive,
    clearPatterns,
  };
}

/**
 * UI Change Predictor
 *
 * Predicts next UI changes based on:
 * - Current element being edited
 * - Recent changes in session
 * - Learned user patterns
 * - Design system context
 */
export class UIChangePredictor {
  /**
   * Predict next changes from context
   */
  static predict(context: {
    currentElement?: string;
    recentChanges: Array<{ target: string; change: string; timestamp: number }>;
    userPatterns: Map<string, number>;
  }): UISuggestion[] {
    const suggestions: UISuggestion[] = [];

    // Time-based patterns (morning vs evening usage)
    const hour = new Date().getHours();
    const isMorning = hour >= 6 && hour < 12;

    // Element-specific predictions
    if (context.currentElement?.includes('button')) {
      suggestions.push({
        id: 'pred-button-hover',
        type: 'modify',
        target: context.currentElement,
        params: { ':hover': { transform: 'scale(1.05)' } },
        confidence: 0.82,
        description: 'Add hover scale effect',
        reasoning: 'Buttons commonly benefit from hover feedback',
        quickApply: 'transform: scale(1.05) on hover',
      });
    }

    // Sequence-based predictions
    const lastChanges = context.recentChanges.slice(-3);
    if (lastChanges.length >= 2) {
      const lastTargets = new Set(lastChanges.map((c) => c.target));
      if (lastTargets.size === 1) {
        // User focused on one element, suggest related changes
        const target = lastChanges[0].target;
        suggestions.push({
          id: 'pred-related',
          type: 'modify',
          target,
          params: {},
          confidence: 0.75,
          description: `Continue styling ${target}`,
          reasoning: 'You\'ve been focusing on this element',
          quickApply: 'Continue',
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract patterns from action history
   */
  static extractPatterns(history: Array<{
    action: string;
    target: string;
    timestamp: number;
  }>): Map<string, number> {
    const patterns = new Map<string, number>();

    // Group by action type
    const actionGroups = new Map<string, number[]>();
    for (const item of history) {
      const key = `${item.action}:${item.target}`;
      if (!actionGroups.has(key)) {
        actionGroups.set(key, []);
      }
      actionGroups.get(key)!.push(item.timestamp);
    }

    // Calculate frequency and recency
    for (const [key, timestamps] of actionGroups) {
      const frequency = timestamps.length;
      const lastUsed = Math.max(...timestamps);
      const recency = Date.now() - lastUsed;

      // Score combines frequency and recency
      const score = frequency * Math.exp(-recency / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days
      patterns.set(key, score);
    }

    return patterns;
  }
}

/**
 * Suggestion Engine
 *
 * Core engine for generating UI suggestions.
 */
export class SuggestionEngine {
  private vljepa: any;
  private coagents: any;

  constructor(vljepa: any, coagents: any) {
    this.vljepa = vljepa;
    this.coagents = coagents;
  }

  /**
   * Generate suggestions using VL-JEPA
   */
  async generateWithVLJEPA(context: {
    currentEmbedding: Float32Array;
    userIntent: string;
  }): Promise<UISuggestion[]> {
    // Encode user intent
    const intentEmbedding = await this.vljepa.encodeLanguage(userIntent);

    // Predict next states
    const prediction = await this.vljepa.predict(context.currentEmbedding, intentEmbedding);

    // Convert actions to suggestions
    return prediction.actions.map((action: any, index: number) => ({
      id: `vljepa-suggestion-${index}`,
      type: action.type,
      target: action.target,
      params: action.params,
      confidence: action.confidence,
      description: action.reasoning || `Suggested ${action.type}`,
      reasoning: action.reasoning || 'Based on VL-JEPA prediction',
      quickApply: JSON.stringify(action.params),
    }));
  }

  /**
   * Rank suggestions by multiple factors
   */
  rankSuggestions(suggestions: UISuggestion[], context: {
    userPreferences?: string[];
    designSystem?: any;
  }): UISuggestion[] {
    return suggestions
      .map((s) => {
        let score = s.confidence;

        // Boost based on user preferences
        if (context.userPreferences?.includes(s.type)) {
          score *= 1.2;
        }

        // Boost based on design system alignment
        if (context.designSystem?.matches(s.params)) {
          score *= 1.1;
        }

        return { ...s, confidence: Math.min(score, 1) };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }
}
