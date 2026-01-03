/**
 * @fileoverview CoAgents package tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SharedStateManager } from "./state/SharedStateManager.js";
import {
  CheckpointManager,
  createAequorCheckpoints,
} from "./checkpoints/CheckpointManager.js";
import { StateToA2UIConverter } from "./hybrid/StateToA2UIConverter.js";
import type { AgentState, CheckpointConfig } from "./state/index.js";

describe("SharedStateManager", () => {
  let manager: SharedStateManager;

  beforeEach(() => {
    manager = new SharedStateManager({
      langgraphUrl: "/api/langgraph",
      enableCheckpoints: true,
      syncInterval: 0,
    });
  });

  it("should create initial state", () => {
    const state = manager.getState();
    expect(state).toBeDefined();
    expect(state.status).toBe("idle");
    expect(state.sessionId).toBeDefined();
  });

  it("should update state", () => {
    manager.setState({ query: "test query" });
    const state = manager.getState();
    expect(state.query).toBe("test query");
  });

  it("should subscribe to state changes", () => {
    let receivedState: AgentState | undefined;
    const unsubscribe = manager.subscribe(state => {
      receivedState = state;
    });

    manager.setState({ query: "new query" });
    expect(receivedState?.query).toBe("new query");

    unsubscribe();
  });

  afterEach(() => {
    manager.destroy();
  });
});

describe("CheckpointManager", () => {
  let manager: CheckpointManager;
  let testCheckpoint: CheckpointConfig;

  beforeEach(() => {
    manager = new CheckpointManager();
    testCheckpoint = {
      id: "test-checkpoint",
      type: "confirmation",
      message: "Test checkpoint",
      nodeId: "test-node",
      required: true,
      timeout: 5000,
    };
    manager.registerCheckpoint(testCheckpoint);
  });

  it("should register checkpoint", () => {
    const config = manager.getCheckpointConfig("test-checkpoint");
    expect(config).toEqual(testCheckpoint);
  });

  it("should trigger checkpoint", async () => {
    const testState: AgentState = {
      query: "test",
      intent: [],
      route: "local",
      privacy: "public",
      status: "processing",
      sessionId: "test-session",
      complexity: 0.5,
    };

    // Trigger checkpoint in background
    const checkpointPromise = manager.triggerCheckpoint(
      "test-checkpoint",
      testState
    );

    // Approve immediately
    setTimeout(
      () => manager.approveCheckpoint("test-checkpoint", "Approved"),
      100
    );

    const result = await checkpointPromise;
    expect(result.id).toBe("test-checkpoint");
    expect(result.status).toBe("approved");
  });

  it("should create Aequor checkpoints", () => {
    const checkpoints = createAequorCheckpoints();
    expect(checkpoints.length).toBeGreaterThan(0);
    expect(checkpoints[0].id).toBeDefined();
  });
});

describe("StateToA2UIConverter", () => {
  let converter: StateToA2UIConverter;

  beforeEach(() => {
    converter = new StateToA2UIConverter();
  });

  it("should convert state to A2UI response", () => {
    const state: AgentState = {
      query: "What is the weather?",
      intent: new Array(768).fill(0),
      route: "local",
      privacy: "public",
      response: "The weather is sunny.",
      status: "complete",
      sessionId: "test-session",
      complexity: 0.3,
    };

    const a2ui = converter.convert(state);
    expect(a2ui).toBeDefined();
    expect(a2ui.components).toBeDefined();
    expect(a2ui.actions).toBeDefined();
    expect(a2ui.layout).toBeDefined();
  });

  it("should derive layout from state", () => {
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

  it("should extract components from state", () => {
    const state: AgentState = {
      query: "test query",
      intent: [],
      route: "local",
      privacy: "public",
      response: "test response",
      status: "complete",
      sessionId: "test",
      complexity: 0.5,
    };

    const components = converter.extractComponents(state);
    expect(components.length).toBeGreaterThan(0);
  });

  it("should map tool calls to components", () => {
    const toolCalls = [
      { id: "1", name: "search", parameters: { query: "test" } },
      { id: "2", name: "calculator", parameters: { expression: "2+2" } },
    ];

    const components = converter.toolCallsToComponents(toolCalls);
    expect(components.length).toBe(2);
    expect(components[0].type).toBe("search");
  });
});
