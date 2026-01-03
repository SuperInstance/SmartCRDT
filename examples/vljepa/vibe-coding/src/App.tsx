/**
 * Vibe Coding Demo - Main App Component
 *
 * Top-level application component that renders the VibeCodingCanvas
 * and provides global context for VL-JEPA + CoAgents + A2UI integration.
 */

import React, { Suspense } from 'react';
import VibeCodingCanvas from './components/VibeCodingCanvas';

function App() {
  return (
    <div className="vibe-coding-app">
      <Suspense fallback={<div className="loading">Loading VL-JEPA...</div>}>
        <VibeCodingCanvas />
      </Suspense>
    </div>
  );
}

export default App;
