/**
 * @fileoverview CoAgents + A2UI hybrid tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StateToA2UIConverter } from "./StateToA2UIConverter.js";
import type { AgentState } from "../state/SharedStateManager.js";

describe("StateToA2UIConverter", () => {
  let converter: StateToA2UIConverter;

  beforeEach(() => {
    converter = new StateToA2UIConverter({
      defaultLayout: "vertical",
      enableStreaming: true,
      theme: "auto",
    });
  });

  describe("Conversion", () => {
    it("should convert agent state to A2UI response", () => {
      const state: AgentState = {
        query: "What is the capital of France?",
        intent: new Array(768).fill(0).map(() => Math.random()),
        route: "cloud",
        privacy: "public",
        response: "The capital of France is Paris.",
        status: "complete",
        sessionId: "test-session-123",
        complexity: 0.4,
        metadata: {
          model: "gpt-4",
          tokens: 150,
        },
      };

      const a2ui = converter.convert(state);

      expect(a2ui).toBeDefined();
      expect(a2ui.version).toBe("1.0");
      expect(a2ui.layout).toBeDefined();
      expect(a2ui.components).toBeInstanceOf(Array);
      expect(a2ui.actions).toBeInstanceOf(Array);
      expect(a2ui.metadata).toBeDefined();
    });

    it("should include session ID in metadata", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "specific-session-id",
        complexity: 0.5,
      };

      const a2ui = converter.convert(state);
      expect(a2ui.metadata.sessionId).toBe("specific-session-id");
    });

    it("should include timestamp in metadata", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const before = Date.now();
      const a2ui = converter.convert(state);
      const after = Date.now();

      expect(a2ui.metadata.timestamp).toBeGreaterThanOrEqual(before);
      expect(a2ui.metadata.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("Layout Derivation", () => {
    it("should derive modal layout for waiting_human status", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "waiting_human",
        sessionId: "test",
        complexity: 0.5,
      };

      const layout = converter.deriveLayout(state);
      expect(layout.type).toBe("modal");
    });

    it("should use custom layout from state if present", () => {
      const customLayout = {
        type: "grid" as const,
        direction: "row" as const,
        columns: 3,
      };

      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
        ui: customLayout,
      };

      const layout = converter.deriveLayout(state);
      expect(layout).toEqual(customLayout);
    });

    it("should use default layout for normal status", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const layout = converter.deriveLayout(state);
      expect(layout.type).toBe("vertical");
    });
  });

  describe("Component Extraction", () => {
    it("should extract query display component", () => {
      const state: AgentState = {
        query: "What is AI?",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const components = converter.extractComponents(state);
      const queryComponent = components.find(c => c.id === "query-display");

      expect(queryComponent).toBeDefined();
      expect(queryComponent?.type).toBe("text");
      expect(queryComponent?.props.content).toBe("What is AI?");
    });

    it("should extract response display component", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        response: "This is the response.",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const components = converter.extractComponents(state);
      const responseComponent = components.find(
        c => c.id === "response-display"
      );

      expect(responseComponent).toBeDefined();
      expect(responseComponent?.type).toBe("markdown");
    });

    it("should extract status indicator", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const components = converter.extractComponents(state);
      const statusComponent = components.find(c => c.id === "status-indicator");

      expect(statusComponent).toBeDefined();
      expect(statusComponent?.type).toBe("badge");
      expect(statusComponent?.props.color).toBeDefined();
    });

    it("should extract metadata component if metadata exists", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
        metadata: {
          model: "gpt-4",
          latency: 1500,
        },
      };

      const components = converter.extractComponents(state);
      const metadataComponent = components.find(
        c => c.id === "metadata-display"
      );

      expect(metadataComponent).toBeDefined();
      expect(metadataComponent?.type).toBe("collapsible");
    });
  });

  describe("Action Generation", () => {
    it("should generate copy action when response exists", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        response: "Copy this text",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const actions = converter.generateActions(state);
      const copyAction = actions.find(a => a.id === "copy-response");

      expect(copyAction).toBeDefined();
      expect(copyAction?.type).toBe("button");
      expect(copyAction?.handler).toBe("copy");
    });

    it("should generate regenerate action", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const actions = converter.generateActions(state);
      const regenerateAction = actions.find(a => a.id === "regenerate");

      expect(regenerateAction).toBeDefined();
      expect(regenerateAction?.handler).toBe("regenerate");
    });

    it("should generate feedback actions", () => {
      const state: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "complete",
        sessionId: "test",
        complexity: 0.5,
      };

      const actions = converter.generateActions(state);
      const positiveFeedback = actions.find(a => a.id === "feedback-positive");
      const negativeFeedback = actions.find(a => a.id === "feedback-negative");

      expect(positiveFeedback).toBeDefined();
      expect(negativeFeedback).toBeDefined();
    });
  });

  describe("Tool Call Conversion", () => {
    it("should convert tool calls to components", () => {
      const toolCalls = [
        {
          id: "tool-1",
          name: "search",
          parameters: { query: "weather in Paris" },
        },
        {
          id: "tool-2",
          name: "calculator",
          parameters: { expression: "2+2" },
        },
      ];

      const components = converter.toolCallsToComponents(toolCalls);

      expect(components.length).toBe(2);
      expect(components[0].type).toBe("search");
      expect(components[1].type).toBe("input");
    });

    it("should map tool names to component types", () => {
      const toolCalls = [
        { id: "1", name: "chart", parameters: {} },
        { id: "2", name: "table", parameters: {} },
        { id: "3", name: "image", parameters: {} },
        { id: "4", name: "code_editor", parameters: {} },
      ];

      const components = converter.toolCallsToComponents(toolCalls);

      expect(components[0].type).toBe("chart");
      expect(components[1].type).toBe("table");
      expect(components[2].type).toBe("image");
      expect(components[3].type).toBe("code");
    });

    it("should default to text component for unknown tools", () => {
      const toolCalls = [{ id: "1", name: "unknown_tool", parameters: {} }];

      const components = converter.toolCallsToComponents(toolCalls);

      expect(components[0].type).toBe("text");
    });
  });

  describe("Status Colors", () => {
    it("should return correct color for each status", () => {
      const statuses: AgentState["status"][] = [
        "idle",
        "processing",
        "waiting_human",
        "complete",
        "error",
      ];

      const expectedColors = [
        "default",
        "primary",
        "warning",
        "success",
        "error",
      ];

      statuses.forEach((status, i) => {
        const state: AgentState = {
          query: "test",
          intent: [],
          route: "local",
          privacy: "public",
          status,
          sessionId: "test",
          complexity: 0.5,
        };

        const components = converter.extractComponents(state);
        const statusComponent = components.find(
          c => c.id === "status-indicator"
        );
        expect(statusComponent?.props.color).toBe(expectedColors[i]);
      });
    });
  });
});

describe("createConverter", () => {
  it("should create converter with default config", () => {
    const converter = converter;
    expect(converter).toBeInstanceOf(StateToA2UIConverter);
  });

  it("should create converter with custom config", () => {
    const converter = new StateToA2UIConverter({
      defaultLayout: "grid",
      enableStreaming: false,
      theme: "dark",
    });

    expect(converter).toBeInstanceOf(StateToA2UIConverter);
  });
});
