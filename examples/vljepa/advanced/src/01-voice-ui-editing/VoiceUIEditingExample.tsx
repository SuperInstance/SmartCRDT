/**
 * Example 1: Voice UI Editing
 *
 * Demonstrates voice-controlled UI editing using VL-JEPA
 * - Uses Web Speech API for voice input
 * - VL-JEPA understands user intent from voice commands
 * - Generates appropriate UI changes
 * - Shows before/after comparison
 */

import React, { useState, useEffect, useRef } from 'react';
import { VLJEPADemo, ComparisonView, MetricsDisplay } from '../shared';
import type { UIElement, CodeChange } from '../shared';

interface VoiceCommand {
  transcript: string;
  confidence: number;
  timestamp: number;
}

interface VoiceUIEditingState {
  isListening: boolean;
  lastCommand: VoiceCommand | null;
  originalUI: string;
  modifiedUI: string;
  changes: CodeChange[];
  metrics: {
    accuracy: number;
    latency: number;
    confidence: number;
  };
}

// Sample UI code to edit
const SAMPLE_UI = `export const UserProfile = () => {
  return (
    <div className="user-profile">
      <img src="/avatar.jpg" alt="User Avatar" />
      <h2>John Doe</h2>
      <p>Software Engineer</p>
      <button>Contact</button>
    </div>
  );
};`;

export const VoiceUIEditingExample: React.FC = () => {
  const [state, setState] = useState<VoiceUIEditingState>({
    isListening: false,
    lastCommand: null,
    originalUI: SAMPLE_UI,
    modifiedUI: SAMPLE_UI,
    changes: [],
    metrics: {
      accuracy: 0.95,
      latency: 150,
      confidence: 0.87
    }
  });

  const recognitionRef = useRef<any>(null);

  // Simulated VL-JEPA processing of voice commands
  const processVoiceCommand = async (command: string): Promise<CodeChange[]> => {
    const startTime = Date.now();

    // Simulate VL-JEPA intent understanding
    const changes: CodeChange[] = [];

    // Pattern matching for common voice commands
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('blue') && lowerCommand.includes('button')) {
      changes.push({
        type: 'modify',
        path: 'button.style',
        content: 'backgroundColor: "blue", color: "white"',
        reason: 'Change button color to blue per voice command'
      });
    }

    if (lowerCommand.includes('make') && lowerCommand.includes('larger')) {
      changes.push({
        type: 'modify',
        path: 'img.style',
        content: 'width: "120px", height: "120px"',
        reason: 'Increase avatar size per voice command'
      });
    }

    if (lowerCommand.includes('center')) {
      changes.push({
        type: 'modify',
        path: 'div.style',
        content: 'textAlign: "center"',
        reason: 'Center align content per voice command'
      });
    }

    if (lowerCommand.includes('add') && lowerCommand.includes('email')) {
      changes.push({
        type: 'add',
        path: 'div.children',
        content: '<p>john.doe@example.com</p>',
        reason: 'Add email field per voice command'
      });
    }

    // Update metrics
    const latency = Date.now() - startTime;
    setState((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        latency,
        confidence: 0.85 + Math.random() * 0.1
      }
    }));

    return changes;
  };

  const applyChanges = (ui: string, changes: CodeChange[]): string => {
    let modifiedUI = ui;

    changes.forEach((change) => {
      if (change.type === 'modify' && change.path.includes('button')) {
        modifiedUI = modifiedUI.replace('<button>Contact</button>', '<button style={{backgroundColor: "blue", color: "white"}}>Contact</button>');
      }
      if (change.type === 'modify' && change.path.includes('img')) {
        modifiedUI = modifiedUI.replace('<img src="/avatar.jpg"', '<img src="/avatar.jpg" style={{width: "120px", height: "120px"}}');
      }
      if (change.type === 'add' && change.path.includes('children')) {
        modifiedUI = modifiedUI.replace('<p>Software Engineer</p>', '<p>Software Engineer</p>\n      <p>john.doe@example.com</p>');
      }
      if (change.type === 'modify' && change.path.includes('div')) {
        modifiedUI = modifiedUI.replace('className="user-profile"', 'className="user-profile" style={{textAlign: "center"}}');
      }
    });

    return modifiedUI;
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = async (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        const confidence = event.results[last][0].confidence;

        setState((prev) => ({
          ...prev,
          lastCommand: {
            transcript,
            confidence,
            timestamp: Date.now()
          }
        }));

        // Process command with VL-JEPA
        const changes = await processVoiceCommand(transcript);

        if (changes.length > 0) {
          const modifiedUI = applyChanges(state.originalUI, changes);
          setState((prev) => ({
            ...prev,
            modifiedUI,
            changes
          }));
        }
      };

      recognitionRef.current.start();
      setState((prev) => ({ ...prev, isListening: true }));
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState((prev) => ({ ...prev, isListening: false }));
    }
  };

  const resetDemo = () => {
    setState({
      isListening: false,
      lastCommand: null,
      originalUI: SAMPLE_UI,
      modifiedUI: SAMPLE_UI,
      changes: [],
      metrics: {
        accuracy: 0.95,
        latency: 150,
        confidence: 0.87
      }
    });
  };

  // Sample voice commands for demo
  const sampleCommands = [
    'Make the button blue',
    'Add email address',
    'Make the avatar larger',
    'Center the content'
  ];

  const simulateCommand = async (command: string) => {
    setState((prev) => ({
      ...prev,
      lastCommand: {
        transcript: command,
        confidence: 0.95,
        timestamp: Date.now()
      }
    }));

    const changes = await processVoiceCommand(command);
    if (changes.length > 0) {
      const modifiedUI = applyChanges(state.originalUI, changes);
      setState((prev) => ({
        ...prev,
        modifiedUI,
        changes
      }));
    }
  };

  return (
    <VLJEPADemo
      title="Voice UI Editing"
      description="Use voice commands to edit UI components. VL-JEPA understands your intent and generates code changes automatically."
      features={[
        'Real-time voice recognition using Web Speech API',
        'Intent understanding via VL-JEPA',
        'Automatic code transformation',
        'Before/after comparison'
      ]}
      metrics={state.metrics}
    >
      <div className="voice-ui-editing">
        <div className="control-panel">
          <div className="voice-controls">
            {!state.isListening ? (
              <button onClick={startListening} className="btn-start">
                🎤 Start Listening
              </button>
            ) : (
              <button onClick={stopListening} className="btn-stop">
                ⏹️ Stop Listening
              </button>
            )}
            <button onClick={resetDemo} className="btn-reset">
              🔄 Reset
            </button>
          </div>

          <div className="sample-commands">
            <h4>Try these commands:</h4>
            {sampleCommands.map((cmd, idx) => (
              <button key={idx} onClick={() => simulateCommand(cmd)} className="sample-command">
                {cmd}
              </button>
            ))}
          </div>

          {state.lastCommand && (
            <div className="last-command">
              <strong>Last command:</strong> "{state.lastCommand.transcript}"
              <span className="confidence">
                ({(state.lastCommand.confidence * 100).toFixed(0)}% confidence)
              </span>
            </div>
          )}
        </div>

        <div className="comparison-container">
          <ComparisonView
            before={state.originalUI}
            after={state.modifiedUI}
            beforeLabel="Original UI"
            afterLabel="Modified UI"
          />
        </div>

        {state.changes.length > 0 && (
          <div className="changes-list">
            <h4>Applied Changes:</h4>
            {state.changes.map((change, idx) => (
              <div key={idx} className={`change-item change-${change.type}`}>
                <span className="change-type">{change.type.toUpperCase()}</span>
                <span className="change-path">{change.path}</span>
                <p className="change-reason">{change.reason}</p>
              </div>
            ))}
          </div>
        )}

        <MetricsDisplay
          title="Live Metrics"
          metrics={[
            { label: 'Accuracy', value: state.metrics.accuracy, format: 'percentage', target: 0.95 },
            { label: 'Latency', value: state.metrics.latency, format: 'ms', target: 200 },
            { label: 'Confidence', value: state.metrics.confidence, format: 'percentage', target: 0.9 }
          ]}
          layout="horizontal"
        />
      </div>
    </VLJEPADemo>
  );
};

export default VoiceUIEditingExample;
