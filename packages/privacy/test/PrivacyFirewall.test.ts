/**
 * PrivacyFirewall Tests
 *
 * Tests for privacy firewall rule evaluation, actions, and enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PrivacyFirewall,
  type FirewallRule,
  type FirewallCondition,
  type FirewallAction,
  type FirewallDecision,
  type FirewallContext,
} from '../src/firewall/PrivacyFirewall.js';
import { PrivacyLevel, PIIType, type PrivacyClassification } from '@lsi/protocol';
import { RedactionStrategy } from '../src/redaction/SemanticPIIRedactor.js';

describe('PrivacyFirewall - Rule Evaluation', () => {
  let firewall: PrivacyFirewall;

  beforeEach(() => {
    firewall = new PrivacyFirewall({
      enableDefaultRules: true,
    });
  });

  it('should block SOVEREIGN from cloud', async () => {
    const context: FirewallContext = {
      query: 'My SSN is 123-45-6789',
      classification: {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN],
        reason: 'SSN detected',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('deny');
    expect(decision.finalDestination).toBe('local');
  });

  it('should allow SOVEREIGN locally', async () => {
    const context: FirewallContext = {
      query: 'My SSN is 123-45-6789',
      classification: {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN],
        reason: 'SSN detected',
      },
      destination: 'local',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('allow');
  });

  it('should redact SENSITIVE for cloud', async () => {
    const context: FirewallContext = {
      query: 'Email me at user@example.com',
      classification: {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [PIIType.EMAIL],
        reason: 'Email detected',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('redact');
    expect(decision.redactionStrategy).toBeDefined();
  });

  it('should allow PUBLIC everywhere', async () => {
    const cloudContext: FirewallContext = {
      query: 'What is the capital of France?',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.95,
        piiTypes: [],
        reason: 'No PII',
      },
      destination: 'cloud',
    };

    const localContext: FirewallContext = {
      ...cloudContext,
      destination: 'local',
    };

    const cloudDecision = await firewall.evaluate(cloudContext);
    const localDecision = await firewall.evaluate(localContext);

    expect(cloudDecision.action).toBe('allow');
    expect(localDecision.action).toBe('allow');
  });

  it('should evaluate rules in priority order', async () => {
    const customRules: FirewallRule[] = [
      {
        id: 'high-priority',
        name: 'High Priority Rule',
        description: 'Should be evaluated first',
        condition: { type: 'destination', value: 'cloud' },
        action: { type: 'deny', reason: 'High priority deny' },
        priority: 200,
        enabled: true,
      },
      {
        id: 'low-priority',
        name: 'Low Priority Rule',
        description: 'Should be evaluated after',
        condition: { type: 'destination', value: 'cloud' },
        action: { type: 'allow' },
        priority: 50,
        enabled: true,
      },
    ];

    const customFirewall = new PrivacyFirewall({
      customRules,
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test query',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await customFirewall.evaluate(context);

    // High priority rule should match
    expect(decision.matchedRules).toContain('high-priority');
  });

  it('should skip disabled rules', async () => {
    const customRules: FirewallRule[] = [
      {
        id: 'disabled-rule',
        name: 'Disabled Rule',
        description: 'Should not match',
        condition: { type: 'destination', value: 'cloud' },
        action: { type: 'deny', reason: 'Should not apply' },
        priority: 100,
        enabled: false,
      },
    ];

    const customFirewall = new PrivacyFirewall({
      customRules,
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test query',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await customFirewall.evaluate(context);

    expect(decision.action).not.toBe('deny');
    expect(decision.matchedRules).not.toContain('disabled-rule');
  });

  it('should handle no matching rules', async () => {
    const customFirewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test query',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await customFirewall.evaluate(context);

    // Default action when no rules match should be allow
    expect(decision.action).toBe('allow');
    expect(decision.matchedRules).toEqual([]);
  });
});

describe('PrivacyFirewall - Custom Rules', () => {
  it('should add custom rule', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const customRule: FirewallRule = {
      id: 'custom-1',
      name: 'Custom Rule',
      description: 'Test rule',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(customRule);

    const context: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'local',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.matchedRules).toContain('custom-1');
  });

  it('should remove rule', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const rule: FirewallRule = {
      id: 'removable',
      name: 'Removable Rule',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(rule);
    firewall.removeRule('removable');

    const context: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'local',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.matchedRules).not.toContain('removable');
  });

  it('should enable rule', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const rule: FirewallRule = {
      id: 'toggleable',
      name: 'Toggleable Rule',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: false,
    };

    firewall.addRule(rule);
    firewall.enableRule('toggleable');

    expect(firewall.getRule('toggleable')?.enabled).toBe(true);
  });

  it('should disable rule', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const rule: FirewallRule = {
      id: 'toggleable',
      name: 'Toggleable Rule',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(rule);
    firewall.disableRule('toggleable');

    expect(firewall.getRule('toggleable')?.enabled).toBe(false);
  });

  it('should update rule priority', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const rule: FirewallRule = {
      id: 'priority-test',
      name: 'Priority Test',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(rule);
    firewall.updateRulePriority('priority-test', 200);

    expect(firewall.getRule('priority-test')?.priority).toBe(200);
  });
});

describe('PrivacyFirewall - Context Evaluation', () => {
  let firewall: PrivacyFirewall;

  beforeEach(() => {
    firewall = new PrivacyFirewall({
      enableDefaultRules: true,
    });
  });

  it('should evaluate with query context', async () => {
    const context: FirewallContext = {
      query: 'My email is user@example.com',
      classification: {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [PIIType.EMAIL],
        reason: 'Email detected',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('redact');
  });

  it('should evaluate with classification confidence', async () => {
    const context: FirewallContext = {
      query: 'Test query',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.5,
        piiTypes: [],
        reason: 'Low confidence',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    // Should still work with low confidence
    expect(decision.action).toBeDefined();
  });

  it('should evaluate with destination', async () => {
    const cloudContext: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.9,
        piiTypes: [PIIType.EMAIL],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const localContext: FirewallContext = {
      ...cloudContext,
      destination: 'local',
    };

    const cloudDecision = await firewall.evaluate(cloudContext);
    const localDecision = await firewall.evaluate(localContext);

    expect(cloudDecision.action).not.toBe(localDecision.action);
  });

  it('should evaluate with constraints', async () => {
    const context: FirewallContext = {
      query: 'Test query',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
      constraints: {
        maxCost: 0.01,
        requireLocal: false,
      },
    };

    const decision = await firewall.evaluate(context);

    expect(decision).toBeDefined();
  });
});

describe('PrivacyFirewall - Edge Cases', () => {
  it('should handle no rules', async () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    // Default to allow when no rules
    expect(decision.action).toBe('allow');
  });

  it('should handle conflicting rules', async () => {
    const firewall = new PrivacyFirewall({
      customRules: [
        {
          id: 'allow-rule',
          name: 'Allow Rule',
          description: 'Allow',
          condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
          action: { type: 'allow' },
          priority: 50,
          enabled: true,
        },
        {
          id: 'deny-rule',
          name: 'Deny Rule',
          description: 'Deny',
          condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
          action: { type: 'deny', reason: 'Conflict test' },
          priority: 100,
          enabled: true,
        },
      ],
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    // Higher priority (deny) should win
    expect(decision.action).toBe('deny');
  });

  it('should handle multiple matching rules', async () => {
    const firewall = new PrivacyFirewall({
      customRules: [
        {
          id: 'rule-1',
          name: 'Rule 1',
          description: 'First',
          condition: { type: 'destination', value: 'cloud' },
          action: { type: 'redact', strategy: RedactionStrategy.FULL },
          priority: 100,
          enabled: true,
        },
        {
          id: 'rule-2',
          name: 'Rule 2',
          description: 'Second',
          condition: { type: 'classification', value: PrivacyLevel.SENSITIVE },
          action: { type: 'deny', reason: 'Sensitive data' },
          priority: 90,
          enabled: true,
        },
      ],
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Sensitive query',
      classification: {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.9,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    // Both rules could match, but first matching wins
    expect(decision.matchedRules.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle redirect action', async () => {
    const firewall = new PrivacyFirewall({
      customRules: [
        {
          id: 'redirect-rule',
          name: 'Redirect Rule',
          description: 'Redirect to local',
          condition: { type: 'classification', value: PrivacyLevel.SOVEREIGN },
          action: { type: 'redirect', destination: 'local' },
          priority: 100,
          enabled: true,
        },
      ],
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'SSN: 123-45-6789',
      classification: {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN],
        reason: 'SSN',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('redirect');
    expect(decision.finalDestination).toBe('local');
  });

  it('should handle hasPII condition', async () => {
    const firewall = new PrivacyFirewall({
      customRules: [
        {
          id: 'pii-rule',
          name: 'PII Rule',
          description: 'Has PII',
          condition: { type: 'hasPII', piiTypes: [PIIType.EMAIL] },
          action: { type: 'redact', strategy: RedactionStrategy.FULL },
          priority: 100,
          enabled: true,
        },
      ],
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Email: user@example.com',
      classification: {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.9,
        piiTypes: [PIIType.EMAIL],
        reason: 'Email',
      },
      destination: 'cloud',
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('redact');
  });

  it('should handle constraint condition', async () => {
    const firewall = new PrivacyFirewall({
      customRules: [
        {
          id: 'constraint-rule',
          name: 'Constraint Rule',
          description: 'Check constraint',
          condition: { type: 'constraint', key: 'requireLocal', value: true },
          action: { type: 'redirect', destination: 'local' },
          priority: 100,
          enabled: true,
        },
      ],
      enableDefaultRules: false,
    });

    const context: FirewallContext = {
      query: 'Test',
      classification: {
        level: PrivacyLevel.PUBLIC,
        confidence: 1.0,
        piiTypes: [],
        reason: 'Test',
      },
      destination: 'cloud',
      constraints: { requireLocal: true },
    };

    const decision = await firewall.evaluate(context);

    expect(decision.action).toBe('redirect');
  });
});

describe('PrivacyFirewall - Rule Management', () => {
  let firewall: PrivacyFirewall;

  beforeEach(() => {
    firewall = new PrivacyFirewall({
      enableDefaultRules: false,
    });
  });

  it('should list all rules', () => {
    const rule: FirewallRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(rule);

    const rules = firewall.listRules();

    expect(rules).toContainEqual(rule);
  });

  it('should get specific rule', () => {
    const rule: FirewallRule = {
      id: 'get-test',
      name: 'Get Test',
      description: 'Test',
      condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
      action: { type: 'allow' },
      priority: 50,
      enabled: true,
    };

    firewall.addRule(rule);

    const retrieved = firewall.getRule('get-test');

    expect(retrieved).toEqual(rule);
  });

  it('should return undefined for non-existent rule', () => {
    const retrieved = firewall.getRule('non-existent');

    expect(retrieved).toBeUndefined();
  });

  it('should handle max rules limit', () => {
    const firewall = new PrivacyFirewall({
      enableDefaultRules: false,
      maxRules: 3,
    });

    // Add up to limit
    for (let i = 0; i < 3; i++) {
      firewall.addRule({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        description: 'Test',
        condition: { type: 'classification', value: PrivacyLevel.PUBLIC },
        action: { type: 'allow' },
        priority: 50,
        enabled: true,
      });
    }

    // Should have 3 rules
    expect(firewall.listRules().length).toBe(3);
  });
});
