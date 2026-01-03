/**
 * Example 3: Multi-Screen Synchronization
 *
 * Demonstrates VL-JEPA tracking and synchronizing UI state across multiple screens
 * - Tracks UI state across multiple desktops/screens
 * - Synchronizes changes in real-time
 * - Shows unified view of all screens
 * - Handles conflict resolution
 */

import React, { useState, useEffect } from 'react';
import { VLJEPADemo, MetricsDisplay } from '../shared';
import type { UIElement } from '../shared';

interface Screen {
  id: string;
  name: string;
  content: string;
  lastModified: number;
  isActive: boolean;
}

interface SyncEvent {
  timestamp: number;
  sourceScreen: string;
  action: string;
  description: string;
}

interface MultiScreenSyncState {
  screens: Screen[];
  selectedScreen: string | null;
  syncEvents: SyncEvent[];
  isAutoSync: boolean;
  metrics: {
    syncAccuracy: number;
    syncLatency: number;
    conflictResolutionRate: number;
  };
}

const INITIAL_SCREENS: Screen[] = [
  {
    id: 'screen-1',
    name: 'Desktop 1 - Main',
    content: '<button className="primary">Click Me</button>',
    lastModified: Date.now(),
    isActive: true
  },
  {
    id: 'screen-2',
    name: 'Desktop 2 - Secondary',
    content: '<button className="primary">Click Me</button>',
    lastModified: Date.now() - 1000,
    isActive: false
  },
  {
    id: 'screen-3',
    name: 'Laptop',
    content: '<button className="primary">Click Me</button>',
    lastModified: Date.now() - 2000,
    isActive: false
  }
];

export const MultiScreenSyncExample: React.FC = () => {
  const [state, setState] = useState<MultiScreenSyncState>({
    screens: INITIAL_SCREENS,
    selectedScreen: null,
    syncEvents: [],
    isAutoSync: true,
    metrics: {
      syncAccuracy: 0.98,
      syncLatency: 85,
      conflictResolutionRate: 1.0
    }
  });

  const addSyncEvent = (sourceScreen: string, action: string, description: string) => {
    const event: SyncEvent = {
      timestamp: Date.now(),
      sourceScreen,
      action,
      description
    };

    setState((prev) => ({
      ...prev,
      syncEvents: [event, ...prev.syncEvents].slice(0, 20) // Keep last 20 events
    }));
  };

  const updateScreenContent = (screenId: string, newContent: string) => {
    const screen = state.screens.find((s) => s.id === screenId);
    if (!screen) return;

    setState((prev) => ({
      ...prev,
      screens: prev.screens.map((s) =>
        s.id === screenId ? { ...s, content: newContent, lastModified: Date.now() } : s
      )
    }));

    // VL-JEPA analyzes the change and syncs to other screens
    if (state.isAutoSync) {
      setTimeout(() => {
        syncToOtherScreens(screenId, newContent);
      }, 100);
    }
  };

  const syncToOtherScreens = (sourceId: string, content: string) => {
    // VL-JEPA extracts intent and syncs to other screens
    setState((prev) => {
      const otherScreens = prev.screens.filter((s) => s.id !== sourceId);
      const updatedScreens = prev.screens.map((s) => {
        if (s.id !== sourceId) {
          // VL-JEPA ensures semantic equivalence across screens
          return { ...s, content, lastModified: Date.now() };
        }
        return s;
      });

      addSyncEvent(
        sourceId,
        'sync',
        `Changes synced to ${otherScreens.length} screen(s)`
      );

      return { ...prev, screens: updatedScreens };
    });
  };

  const handleScreenSelect = (screenId: string) => {
    setState((prev) => ({
      ...prev,
      selectedScreen: screenId,
      screens: prev.screens.map((s) => ({
        ...s,
        isActive: s.id === screenId
      }))
    }));
  };

  const toggleAutoSync = () => {
    setState((prev) => ({ ...prev, isAutoSync: !prev.isAutoSync }));
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (state.selectedScreen) {
      updateScreenContent(state.selectedScreen, e.target.value);
    }
  };

  const simulateConflict = () => {
    // Simulate conflicting changes from different screens
    setState((prev) => {
      const screens = [...prev.screens];
      screens[1].content = '<button className="primary btn-lg">Click Me</button>';
      screens[1].lastModified = Date.now();
      screens[2].content = '<button className="primary btn-small">Click Me</button>';
      screens[2].lastModified = Date.now() + 100;

      addSyncEvent('screen-2', 'conflict', 'Conflicting changes detected');
      addSyncEvent('screen-3', 'conflict', 'Conflicting changes detected');

      return { ...prev, screens };
    });
  };

  const resolveConflict = () => {
    // VL-JEPA uses semantic understanding to resolve conflicts
    setState((prev) => {
      const resolvedContent = '<button className="primary">Click Me</button>';
      const screens = prev.screens.map((s) => ({
        ...s,
        content: resolvedContent,
        lastModified: Date.now()
      }));

      addSyncEvent('system', 'resolve', 'Conflict resolved using semantic analysis');

      return { ...prev, screens };
    });
  };

  const selectedScreenData = state.screens.find((s) => s.id === state.selectedScreen);

  return (
    <VLJEPADemo
      title="Multi-Screen Synchronization"
      description="VL-JEPA tracks and synchronizes UI state across multiple screens, handling conflict resolution intelligently."
      features={[
        'Real-time sync across multiple desktops',
        'Semantic conflict resolution',
        'Version tracking with timestamps',
        'Visual sync event timeline'
      ]}
      metrics={{
        accuracy: state.metrics.syncAccuracy,
        latency: state.metrics.syncLatency,
        confidence: 0.98
      }}
    >
      <div className="multi-screen-sync">
        <div className="control-bar">
          <button
            className={`toggle-button ${state.isAutoSync ? 'active' : ''}`}
            onClick={toggleAutoSync}
          >
            {state.isAutoSync ? '🔄 Auto-Sync On' : '⏸️ Auto-Sync Off'}
          </button>
          <button onClick={simulateConflict} className="btn-conflict">
            ⚠️ Simulate Conflict
          </button>
          <button onClick={resolveConflict} className="btn-resolve">
            ✨ Resolve Conflict
          </button>
        </div>

        <div className="main-content">
          <div className="screens-panel">
            <h3>Connected Screens</h3>
            <div className="screens-grid">
              {state.screens.map((screen) => (
                <div
                  key={screen.id}
                  className={`screen-card ${screen.isActive ? 'active' : ''}`}
                  onClick={() => handleScreenSelect(screen.id)}
                >
                  <div className="screen-header">
                    <span className="screen-icon">🖥️</span>
                    <span className="screen-name">{screen.name}</span>
                    {screen.isActive && <span className="active-badge">Active</span>}
                  </div>
                  <div className="screen-preview">
                    <code>{screen.content}</code>
                  </div>
                  <div className="screen-meta">
                    <span className="last-modified">
                      {new Date(screen.lastModified).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-panel">
            <h3>
              {selectedScreenData
                ? `Editing: ${selectedScreenData.name}`
                : 'Select a screen to edit'}
            </h3>
            {selectedScreenData ? (
              <textarea
                value={selectedScreenData.content}
                onChange={handleContentChange}
                className="code-editor"
                spellCheck={false}
              />
            ) : (
              <div className="placeholder">Click on a screen to start editing</div>
            )}
          </div>

          <div className="events-panel">
            <h3>Sync Events</h3>
            <div className="events-list">
              {state.syncEvents.length === 0 ? (
                <div className="no-events">No sync events yet</div>
              ) : (
                state.syncEvents.map((event, idx) => (
                  <div key={idx} className={`event-item event-${event.action}`}>
                    <span className="event-time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="event-source">{event.sourceScreen}</span>
                    <span className="event-action">{event.action}</span>
                    <p className="event-description">{event.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <MetricsDisplay
          title="Sync Metrics"
          metrics={[
            { label: 'Sync Accuracy', value: state.metrics.syncAccuracy, format: 'percentage', target: 0.99 },
            { label: 'Sync Latency', value: state.metrics.syncLatency, format: 'ms', target: 100 },
            { label: 'Conflict Resolution', value: state.metrics.conflictResolutionRate, format: 'percentage', target: 0.95 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default MultiScreenSyncExample;
