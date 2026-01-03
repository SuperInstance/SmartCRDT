/**
 * VLJEPA Example Base Component
 * Provides common functionality for all examples
 */

import React, { ReactNode, createContext, useContext, useState, useCallback } from 'react';
import type { ExampleState, VLJEPAPrediction } from './types';

interface ExampleContextValue {
  state: ExampleState;
  updateState: (updates: Partial<ExampleState>) => void;
  addPrediction: (prediction: VLJEPAPrediction) => void;
  clearPredictions: () => void;
}

const ExampleContext = createContext<ExampleContextValue | null>(null);

export interface VLJEPAExampleProps {
  children: ReactNode;
  id: string;
  name: string;
}

export const VLJEPAExampleProvider: React.FC<VLJEPAExampleProps> = ({ children, id, name }) => {
  const [state, setState] = useState<ExampleState>({
    isLoading: false,
    predictions: [],
    metrics: {
      accuracy: 0,
      latency: 0,
      confidence: 0,
      throughput: 0,
      memoryUsage: 0
    },
    currentStep: 0,
    totalSteps: 1
  });

  const updateState = useCallback((updates: Partial<ExampleState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const addPrediction = useCallback((prediction: VLJEPAPrediction) => {
    setState((prev) => ({
      ...prev,
      predictions: [...prev.predictions, prediction],
      metrics: {
        ...prev.metrics,
        confidence:
          prev.predictions.length > 0
            ? (prev.metrics.confidence * prev.predictions.length + prediction.confidence) /
              (prev.predictions.length + 1)
            : prediction.confidence
      }
    }));
  }, []);

  const clearPredictions = useCallback(() => {
    setState((prev) => ({ ...prev, predictions: [] }));
  }, []);

  return (
    <ExampleContext.Provider value={{ state, updateState, addPrediction, clearPredictions }}>
      <div className="vljepa-example" data-example-id={id} data-example-name={name}>
        {children}
      </div>
    </ExampleContext.Provider>
  );
};

export const useExampleContext = () => {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExampleContext must be used within VLJEPAExampleProvider');
  }
  return context;
};

/**
 * Higher-order component for creating examples
 */
export const createExample = (
  id: string,
  name: string,
  renderContent: () => ReactNode
): React.FC => {
  return () => (
    <VLJEPAExampleProvider id={id} name={name}>
      {renderContent()}
    </VLJEPAExampleProvider>
  );
};
