/**
 * @fileoverview CoAgents + A2UI Example Application
 *
 * Complete working example demonstrating:
 * - CoAgents integration with LangGraph
 * - Human-in-the-loop checkpoints
 * - A2UI auto-generation
 * - Shared state management
 */

import React, { useState } from 'react';
import {
  CoAgentsA2UIProvider,
  useAgentState,
  useAgentAction,
  useCheckpoint,
} from '@lsi/coagents';
import { A2UIRenderer } from '@lsi/a2ui/renderer';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'sensitive' | 'sovereign'>('public');

  return (
    <CoAgentsA2UIProvider
      config={{
        langgraphUrl: '/api/langgraph',
        autoGenerateUI: true,
        enableStreaming: true,
      }}
    >
      <div className="app">
        <header>
          <h1>Aequor CoAgents + A2UI Demo</h1>
          <p>Human-in-the-loop AI orchestration with auto-generated UI</p>
        </header>

        <main>
          <QueryInput
            query={query}
            privacy={privacy}
            onQueryChange={setQuery}
            onPrivacyChange={setPrivacy}
          />

          <AgentDisplay />

          <CheckpointModal />

          <A2UIOutput />
        </main>

        <footer>
          <p>Powered by Aequor Cognitive Orchestration Platform</p>
        </footer>
      </div>
    </CoAgentsA2UIProvider>
  );
};

/**
 * Query input component
 */
const QueryInput: React.FC<{
  query: string;
  privacy: 'public' | 'sensitive' | 'sovereign';
  onQueryChange: (q: string) => void;
  onPrivacyChange: (p: 'public' | 'sensitive' | 'sovereign') => void;
}> = ({ query, privacy, onQueryChange, onPrivacyChange }) => {
  const { processQuery, isLoading } = useAgentAction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      await processQuery(query, privacy);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="query-form">
      <div className="form-group">
        <label htmlFor="query">Query:</label>
        <textarea
          id="query"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Enter your query here..."
          rows={4}
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="privacy">Privacy Level:</label>
        <select
          id="privacy"
          value={privacy}
          onChange={(e) =>
            onPrivacyChange(e.target.value as 'public' | 'sensitive' | 'sovereign')
          }
          disabled={isLoading}
        >
          <option value="public">Public</option>
          <option value="sensitive">Sensitive</option>
          <option value="sovereign">Sovereign (local only)</option>
        </select>
      </div>

      <button type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? 'Processing...' : 'Submit'}
      </button>
    </form>
  );
};

/**
 * Agent state display
 */
const AgentDisplay: React.FC = () => {
  const state = useAgentState();

  if (state.status === 'idle') return null;

  return (
    <div className="agent-display">
      <h2>Agent State</h2>
      <div className="state-grid">
        <StateItem label="Query" value={state.query} />
        <StateItem label="Status" value={state.status} />
        <StateItem label="Route" value={state.route} />
        <StateItem label="Privacy" value={state.privacy} />
        <StateItem label="Complexity" value={state.complexity.toFixed(2)} />
        {state.intent.length > 0 && (
          <StateItem label="Intent" value={`${state.intent.length} dimensions`} />
        )}
      </div>

      {state.response && (
        <div className="response-section">
          <h3>Response</h3>
          <p>{state.response}</p>
        </div>
      )}
    </div>
  );
};

/**
 * Individual state item
 */
const StateItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="state-item">
    <strong>{label}:</strong> <span>{value}</span>
  </div>
);

/**
 * Checkpoint modal
 */
const CheckpointModal: React.FC = () => {
  const { checkpoints, approve, reject } = useCheckpoint();

  const activeCheckpoints = Array.from(checkpoints.values());

  if (activeCheckpoints.length === 0) return null;

  return (
    <div className="checkpoint-overlay">
      {activeCheckpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="checkpoint-modal">
          <h2>{checkpoint.type === 'confirmation' ? 'Confirmation Required' : 'Review Required'}</h2>
          <p>{checkpoint.message}</p>

          <div className="checkpoint-actions">
            <button onClick={() => approve(checkpoint.id, 'Approved')}>Approve</button>
            <button onClick={() => reject(checkpoint.id, 'Rejected by user')}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * A2UI output display
 */
const A2UIOutput: React.FC = () => {
  return (
    <div className="a2ui-output">
      <h2>Generated UI</h2>
      <A2UIRenderer />
    </div>
  );
};

export default App;
