/**
 * Voice-Controlled UI Editing Example
 *
 * Demonstrates voice commands integrated with VL-JEPA for hands-free UI editing.
 * User speaks commands, VLM converts to text, VL-JEPA generates actions.
 *
 * Workflow:
 * 1. User speaks: "Make the button blue and center it"
 * 2. VLM (Speech-to-Text) converts to text
 * 3. VL-JEPA encodes intent and generates actions
 * 4. CoAgents executes actions
 */

import { useState, useRef, useCallback } from 'react';

export interface VoiceCommand {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
}

export interface VoiceUIFlowState {
  isListening: boolean;
  commands: VoiceCommand[];
  currentTranscript: string;
  processing: boolean;
  lastCommand: VoiceCommand | null;
}

export interface VoiceUIFlowActions {
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearCommands: () => void;
  executeCommand: (command: VoiceCommand) => Promise<void>;
}

/**
 * Voice UI Flow Hook
 *
 * Integrates Web Speech API with VL-JEPA for voice-controlled UI editing.
 */
export function useVoiceUIFlow() {
  const [state, setState] = useState<VoiceUIFlowState>({
    isListening: false,
    commands: [],
    currentTranscript: '',
    processing: false,
    lastCommand: null,
  });

  const recognitionRef = useRef<any>(null);

  /**
   * Start listening for voice commands
   */
  const startListening = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isListening: true }));
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      setState((prev) => ({ ...prev, currentTranscript: transcript }));

      // Check if this is a final result
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const command: VoiceCommand = {
          id: `cmd-${Date.now()}`,
          text: transcript,
          timestamp: Date.now(),
          confidence: result[0].confidence,
        };

        setState((prev) => ({
          ...prev,
          commands: [...prev.commands, command],
          lastCommand: command,
          currentTranscript: '',
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setState((prev) => ({ ...prev, isListening: false }));
    };

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  /**
   * Stop listening for voice commands
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setState((prev) => ({ ...prev, isListening: false, currentTranscript: '' }));
    }
  }, []);

  /**
   * Clear all commands
   */
  const clearCommands = useCallback(() => {
    setState({
      isListening: false,
      commands: [],
      currentTranscript: '',
      processing: false,
      lastCommand: null,
    });
  }, []);

  /**
   * Execute a voice command via VL-JEPA
   */
  const executeCommand = useCallback(async (command: VoiceCommand) => {
    setState((prev) => ({ ...prev, processing: true }));

    try {
      console.log('[Voice UI] Executing command:', command.text);

      // Step 1: Encode text as intent with VL-JEPA
      // Step 2: Capture current UI state
      // Step 3: Generate actions
      // Step 4: Execute actions

      // Mock implementation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('[Voice UI] Command executed');
    } catch (error) {
      console.error('[Voice UI] Execution error:', error);
    } finally {
      setState((prev) => ({ ...prev, processing: false }));
    }
  }, []);

  return {
    state,
    actions: {
      startListening,
      stopListening,
      clearCommands,
      executeCommand,
    },
  };
}

/**
 * Voice-to-VL-JEPA Bridge
 *
 * Converts voice commands to VL-JEPA predictions.
 */
export class VoiceToVLJEPABridge {
  /**
   * Parse voice command into structured intent
   */
  static parseCommand(command: string): {
    actions: Array<{ type: string; target: string; params: Record<string, unknown> }>;
    confidence: number;
  } {
    // Simple parsing logic (would use NLP in production)
    const actions: any[] = [];
    const lower = command.toLowerCase();

    // Color changes
    if (lower.includes('blue')) {
      actions.push({ type: 'modify', target: '*', params: { color: '#3B82F6' } });
    } else if (lower.includes('red')) {
      actions.push({ type: 'modify', target: '*', params: { color: '#EF4444' } });
    } else if (lower.includes('green')) {
      actions.push({ type: 'modify', target: '*', params: { color: '#22C55E' } });
    }

    // Position changes
    if (lower.includes('center')) {
      actions.push({ type: 'modify', target: '*', params: { display: 'flex', justifyContent: 'center' } });
    }

    return {
      actions,
      confidence: 0.85,
    };
  }

  /**
   * Convert speech recognition results to commands
   */
  static transcribeToCommands(results: SpeechRecognitionResultList): VoiceCommand[] {
    const commands: VoiceCommand[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.isFinal) {
        commands.push({
          id: `cmd-${Date.now()}-${i}`,
          text: result[0].transcript,
          timestamp: Date.now(),
          confidence: result[0].confidence,
        });
      }
    }

    return commands;
  }
}
