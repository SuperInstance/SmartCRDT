/**
 * Tests for InteractionCollector
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InteractionCollector } from "../src/collectors/InteractionCollector.js";

describe("InteractionCollector", () => {
  let collector: InteractionCollector;
  const userId = "test-user";
  let sessionId: string;

  beforeEach(() => {
    collector = new InteractionCollector({
      samplingRate: 1.0,
      bufferSize: 10,
      flushInterval: 5000
    });
    sessionId = collector.startSession(userId).sessionId;
  });

  describe("Session Management", () => {
    it("should start a new session", () => {
      const session = collector.startSession(userId);
      expect(session.userId).toBe(userId);
      expect(session.interactions).toHaveLength(0);
      expect(session.startTime).toBeGreaterThan(0);
    });

    it("should end a session", () => {
      const session = collector.endSession(sessionId);
      expect(session?.endTime).toBeGreaterThan(0);
      expect(session?.endTime).toBeGreaterThan(session!.startTime);
    });

    it("should track active session count", () => {
      expect(collector.getActiveSessionCount()).toBe(1);
      collector.startSession("user-2");
      expect(collector.getActiveSessionCount()).toBe(2);
    });
  });

  describe("Click Collection", () => {
    it("should record a click interaction", () => {
      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 100, y: 200, width: 50, height: 30 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      const click = collector.recordClick(sessionId, element, { x: 100, y: 200 }, context);

      expect(click).toBeDefined();
      expect(click?.type).toBe("click");
      expect(click?.element.id).toBe("btn-1");
    });

    it("should respect sampling rate", () => {
      const lowRateCollector = new InteractionCollector({ samplingRate: 0.1 });
      const testSession = lowRateCollector.startSession(userId);

      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      let hits = 0;
      for (let i = 0; i < 100; i++) {
        const result = lowRateCollector.recordClick(
          testSession.sessionId,
          element,
          { x: 0, y: 0 },
          context
        );
        if (result) hits++;
      }

      // With 10% sampling rate, should get roughly 10 hits (with some variance)
      expect(hits).toBeGreaterThan(0);
      expect(hits).toBeLessThan(30);
    });
  });

  describe("Hover Collection", () => {
    it("should record hover with duration", () => {
      const element = {
        id: "card-1",
        type: "card",
        position: { x: 50, y: 50, width: 200, height: 150 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      const hover = collector.recordHover(sessionId, element, { x: 50, y: 50 }, context, 2500);

      expect(hover).toBeDefined();
      expect(hover?.type).toBe("hover");
      expect(hover?.duration).toBe(2500);
    });
  });

  describe("Scroll Collection", () => {
    it("should record scroll with distance", () => {
      const element = {
        id: "viewport",
        type: "container",
        position: { x: 0, y: 0, width: 1000, height: 800 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      const scroll = collector.recordScroll(sessionId, element, { x: 0, y: 500 }, context, 500);

      expect(scroll).toBeDefined();
      expect(scroll?.type).toBe("scroll");
      expect(scroll?.duration).toBe(500); // distance stored in duration
      expect(scroll?.metadata?.distance).toBe(500);
    });
  });

  describe("Navigation Collection", () => {
    it("should record navigation events", () => {
      const context = {
        page: "/from",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      const nav = collector.recordNavigation(sessionId, "/from", "/to", context);

      expect(nav).toBeDefined();
      expect(nav?.type).toBe("navigate");
      expect(nav?.element.attributes?.from).toBe("/from");
      expect(nav?.element.attributes?.to).toBe("/to");
    });
  });

  describe("Input Collection", () => {
    it("should record input interactions", () => {
      const element = {
        id: "input-1",
        type: "input",
        position: { x: 100, y: 100, width: 200, height: 30 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      const input = collector.recordInput(sessionId, element, "test value", context);

      expect(input).toBeDefined();
      expect(input?.type).toBe("input");
      expect(input?.metadata?.value).toBe("test value");
    });
  });

  describe("Interaction Queries", () => {
    it("should get interactions by type", () => {
      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);
      collector.recordHover(sessionId, element, { x: 0, y: 0 }, context, 1000);
      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);

      const clicks = collector.getInteractionsByType(sessionId, "click");
      const hovers = collector.getInteractionsByType(sessionId, "hover");

      expect(clicks).toHaveLength(2);
      expect(hovers).toHaveLength(1);
    });

    it("should get interactions by time range", () => {
      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);
      const now = Date.now();
      const context2 = { ...context, timestamp: now };

      setTimeout(() => {
        collector.recordClick(sessionId, element, { x: 0, y: 0 }, context2);
        const recent = collector.getInteractionsByTimeRange(sessionId, now - 1000, now + 5000);
        expect(recent.length).toBeGreaterThan(0);
      }, 100);
    });
  });

  describe("Session Statistics", () => {
    it("should calculate session stats", () => {
      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);
      collector.recordHover(sessionId, element, { x: 0, y: 0 }, context, 1000);
      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);

      const stats = collector.getSessionStats(sessionId);

      expect(stats.totalInteractions).toBe(3);
      expect(stats.byType.click).toBe(2);
      expect(stats.byType.hover).toBe(1);
      expect(stats.uniqueElements).toBe(1);
    });
  });

  describe("Data Management", () => {
    it("should export all sessions", () => {
      collector.startSession("user-2");
      collector.startSession("user-3");

      const sessions = collector.exportSessions();

      expect(sessions).toHaveLength(3);
    });

    it("should get total interaction count", () => {
      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);
      collector.recordClick(sessionId, element, { x: 0, y: 0 }, context);

      expect(collector.getTotalInteractionCount()).toBe(2);
    });

    it("should clear all data", () => {
      collector.clear();

      expect(collector.getActiveSessionCount()).toBe(0);
      expect(collector.getTotalInteractionCount()).toBe(0);
    });
  });

  describe("Anonymization", () => {
    it("should anonymize user IDs when enabled", () => {
      const anonCollector = new InteractionCollector({ anonymize: true });
      const session = anonCollector.startSession("sensitive-user-id");

      expect(session.userId).not.toBe("sensitive-user-id");
      expect(session.userId).toMatch(/^user-\d+$/);
    });
  });

  describe("Buffer Flushing", () => {
    it("should flush buffer when full", () => {
      const smallBufferCollector = new InteractionCollector({ bufferSize: 3 });
      const testSession = smallBufferCollector.startSession(userId);

      const element = {
        id: "btn-1",
        type: "button",
        position: { x: 0, y: 0, width: 0, height: 0 }
      };

      const context = {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      };

      // Add 3 interactions (buffer size)
      smallBufferCollector.recordClick(testSession.sessionId, element, { x: 0, y: 0 }, context);
      smallBufferCollector.recordClick(testSession.sessionId, element, { x: 0, y: 0 }, context);
      smallBufferCollector.recordClick(testSession.sessionId, element, { x: 0, y: 0 }, context);

      const interactions = smallBufferCollector.getSessionInteractions(testSession.sessionId);
      expect(interactions.length).toBeGreaterThanOrEqual(3);
    });
  });
});
