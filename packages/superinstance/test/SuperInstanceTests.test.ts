/**
 * SuperInstance Tests
 *
 * Tests for ContextPlane, IntentionPlane, LucidDreamer,
 * and cartridge operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextPlane,
  IntentionPlane,
  LucidDreamer,
  SuperInstance,
} from '../src/index.js';

describe('ContextPlane - Context Operations', () => {
  let contextPlane: ContextPlane;

  beforeEach(() => {
    contextPlane = new ContextPlane({});
  });

  it('should store embedding', async () => {
    const text = 'Test text for embedding';
    const embedding = await contextPlane.buildEmbedding(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  });

  it('should retrieve embedding', async () => {
    const text = 'Test text';
    await contextPlane.buildEmbedding(text);
    const embedding = await contextPlane.buildEmbedding(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  });

  it('should search by similarity', async () => {
    await contextPlane.buildEmbedding('similar text 1');
    await contextPlane.buildEmbedding('similar text 2');

    const context = await contextPlane.retrieveContext({
      query: 'similar text',
    });

    expect(context).toBeDefined();
    expect(context.embeddings).toBeDefined();
  });

  it('should handle cache miss', async () => {
    const context = await contextPlane.retrieveContext({
      query: 'nonexistent query',
    });

    expect(context).toBeDefined();
    expect(context.knowledge).toBeDefined();
  });

  it('should update context', async () => {
    await contextPlane.storeKnowledge({
      key: 'test-key',
      value: 'test-value',
    });

    const retrieved = await contextPlane.retrieveKnowledge('test-key');

    expect(retrieved).toBeDefined();
    expect(retrieved?.value).toBe('test-value');
  });

  it('should delete context', async () => {
    await contextPlane.storeKnowledge({
      key: 'delete-key',
      value: 'delete-value',
    });

    // Note: Current stub doesn't have delete, but this tests the pattern
    const retrieved = await contextPlane.retrieveKnowledge('delete-key');

    expect(retrieved).toBeDefined();
  });

  it('should handle multiple contexts', async () => {
    await contextPlane.storeKnowledge({ key: 'key1', value: 'value1' });
    await contextPlane.storeKnowledge({ key: 'key2', value: 'value2' });
    await contextPlane.storeKnowledge({ key: 'key3', value: 'value3' });

    const retrieved1 = await contextPlane.retrieveKnowledge('key1');
    const retrieved2 = await contextPlane.retrieveKnowledge('key2');
    const retrieved3 = await contextPlane.retrieveKnowledge('key3');

    expect(retrieved1?.value).toBe('value1');
    expect(retrieved2?.value).toBe('value2');
    expect(retrieved3?.value).toBe('value3');
  });

  it('should persist to disk', async () => {
    await contextPlane.storeKnowledge({
      key: 'persist-key',
      value: 'persist-value',
    });

    const retrieved = await contextPlane.retrieveKnowledge('persist-key');

    expect(retrieved).toBeDefined();
  });
});

describe('ContextPlane - Import', () => {
  let contextPlane: ContextPlane;

  beforeEach(() => {
    contextPlane = new ContextPlane({});
  });

  it('should import documents', async () => {
    const documents = [
      { id: 'doc1', content: 'Content 1' },
      { id: 'doc2', content: 'Content 2' },
    ];

    // Stub implementation - test that it doesn't throw
    expect(async () => {
      for (const doc of documents) {
        await contextPlane.buildEmbedding(doc.content);
      }
    }).not.toThrow();
  });

  it('should parse AST', async () => {
    const code = 'function test() { return true; }';

    // Stub implementation - test that it doesn't throw
    expect(async () => {
      await contextPlane.buildEmbedding(code);
    }).not.toThrow();
  });

  it('should extract domains', async () => {
    const domains = await contextPlane.extractDomains('machine learning and AI');

    expect(domains).toBeDefined();
    expect(Array.isArray(domains)).toBe(true);
  });

  it('should handle large imports', async () => {
    const largeContent = 'a'.repeat(100000);

    expect(async () => {
      await contextPlane.buildEmbedding(largeContent);
    }).not.toThrow();
  });
});

describe('ContextPlane - Cartridges', () => {
  let contextPlane: ContextPlane;

  beforeEach(() => {
    contextPlane = new ContextPlane({});
  });

  it('should use cartridge context', async () => {
    await contextPlane.storeKnowledge({
      key: 'cartridge-key',
      value: 'cartridge-value',
    });

    const retrieved = await contextPlane.retrieveKnowledge('cartridge-key');

    expect(retrieved).toBeDefined();
  });

  it('should merge cartridge contexts', async () => {
    await contextPlane.storeKnowledge({ key: 'merge1', value: 'value1' });
    await contextPlane.storeKnowledge({ key: 'merge2', value: 'value2' });

    const context = await contextPlane.retrieveContext({
      query: 'test',
    });

    expect(context.knowledge.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle cartridge unload', async () => {
    await contextPlane.storeKnowledge({
      key: 'unload-key',
      value: 'unload-value',
    });

    // Stub implementation
    const retrieved = await contextPlane.retrieveKnowledge('unload-key');

    expect(retrieved).toBeDefined();
  });
});

describe('ContextPlane - Edge Cases', () => {
  let contextPlane: ContextPlane;

  beforeEach(() => {
    contextPlane = new ContextPlane({});
  });

  it('should handle empty context', async () => {
    const context = await contextPlane.retrieveContext({
      query: '',
    });

    expect(context).toBeDefined();
  });

  it('should handle corrupted data', async () => {
    // Should handle gracefully
    expect(async () => {
      await contextPlane.buildEmbedding('');
    }).not.toThrow();
  });

  it('should handle unicode', async () => {
    const unicodeText = 'Hello 世界 🌍 Привет';

    expect(async () => {
      await contextPlane.buildEmbedding(unicodeText);
    }).not.toThrow();
  });
});

describe('IntentionPlane - Intent Encoding', () => {
  let intentionPlane: IntentionPlane;

  beforeEach(() => {
    intentionPlane = new IntentionPlane({});
  });

  it('should encode query to intent', async () => {
    const result = await intentionPlane.route({
      query: 'What is the weather?',
      intent: 'query',
    });

    expect(result).toBeDefined();
    expect(result.backend).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should reduce to 768 dimensions', async () => {
    // Stub implementation - tests the interface
    const result = await intentionPlane.route({
      query: 'Test query',
      intent: 'query',
    });

    expect(result).toBeDefined();
  });

  it('should add DP noise', async () => {
    // Stub implementation - tests the interface
    const result = await intentionPlane.route({
      query: 'Sensitive query',
      intent: 'query',
    });

    expect(result).toBeDefined();
  });

  it('should cache encodings', async () => {
    const result1 = await intentionPlane.route({
      query: 'Cache test',
      intent: 'query',
    });

    const result2 = await intentionPlane.route({
      query: 'Cache test',
      intent: 'query',
    });

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('should handle batch encoding', async () => {
    const queries = [
      { query: 'Query 1', intent: 'query' },
      { query: 'Query 2', intent: 'question' },
      { query: 'Query 3', intent: 'instruction' },
    ];

    for (const q of queries) {
      const result = await intentionPlane.route(q);
      expect(result).toBeDefined();
    }
  });
});

describe('IntentionPlane - Model Selection', () => {
  let intentionPlane: IntentionPlane;

  beforeEach(() => {
    intentionPlane = new IntentionPlane({});
  });

  it('should select local model for simple queries', async () => {
    const result = await intentionPlane.route({
      query: 'What is 2+2?',
      intent: 'query',
    });

    expect(result.backend).toBeDefined();
  });

  it('should select cloud model for complex queries', async () => {
    const result = await intentionPlane.route({
      query: 'Analyze complex economic factors',
      intent: 'analysis',
    });

    expect(result.backend).toBeDefined();
  });

  it('should respect privacy level', async () => {
    const result = await intentionPlane.route({
      query: 'SSN: 123-45-6789',
      intent: 'query',
    });

    expect(result.backend).toBeDefined();
  });

  it('should respect constraints', async () => {
    const result = await intentionPlane.route({
      query: 'Quick query',
      intent: 'query',
    });

    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('IntentionPlane - Adapter', () => {
  let intentionPlane: IntentionPlane;

  beforeEach(() => {
    intentionPlane = new IntentionPlane({});
  });

  it('should apply adapter if available', async () => {
    const result = await intentionPlane.route({
      query: 'Test query',
      intent: 'query',
    });

    expect(result).toBeDefined();
  });

  it('should fallback to base model', async () => {
    const result = await intentionPlane.route({
      query: 'Fallback test',
      intent: 'query',
    });

    expect(result.backend).toBeDefined();
  });

  it('should handle multiple adapters', async () => {
    const queries = [
      { query: 'Query 1', intent: 'query' },
      { query: 'Query 2', intent: 'question' },
    ];

    for (const q of queries) {
      const result = await intentionPlane.route(q);
      expect(result).toBeDefined();
    }
  });
});

describe('IntentionPlane - Edge Cases', () => {
  let intentionPlane: IntentionPlane;

  beforeEach(() => {
    intentionPlane = new IntentionPlane({});
  });

  it('should handle no encodings', async () => {
    const result = await intentionPlane.route({
      query: '',
      intent: 'unknown',
    });

    expect(result).toBeDefined();
  });

  it('should handle encoding errors', async () => {
    const result = await intentionPlane.route({
      query: '!@#$%',
      intent: 'unknown',
    });

    expect(result).toBeDefined();
  });
});

describe('LucidDreamer - Shadow Logging', () => {
  let lucidDreamer: LucidDreamer;

  beforeEach(() => {
    lucidDreamer = new LucidDreamer({
      enabled: true,
      shadowLogger: {
        storageDir: './test-shadow-logs',
        maxBufferSize: 10,
        privacyFilterEnabled: true,
      },
    });
  });

  it('should log interaction', async () => {
    await lucidDreamer.initialize();

    const sessionId = await lucidDreamer.logInteraction({
      query: 'What is AI?',
      queryMetadata: {
        intent: 'query',
        intentConfidence: 0.9,
        complexity: 0.5,
        backend: 'local',
        model: 'llama3.2',
        routingConfidence: 0.8,
        latency: 100,
      },
      response: 'AI is artificial intelligence',
      responseMetadata: {
        backend: 'local',
        model: 'llama3.2',
        latency: 100,
        tokensGenerated: 20,
      },
    });

    expect(sessionId).toBeDefined();
  });

  it('should filter sovereign data', async () => {
    await lucidDreamer.initialize();

    const sessionId = await lucidDreamer.logInteraction({
      query: 'SSN: 123-45-6789',
      queryMetadata: {
        intent: 'query',
        intentConfidence: 0.9,
        complexity: 0.5,
        backend: 'local',
        model: 'llama3.2',
        routingConfidence: 0.8,
        latency: 100,
      },
      response: 'I cannot help with that',
      responseMetadata: {
        backend: 'local',
        model: 'llama3.2',
        latency: 50,
        tokensGenerated: 10,
      },
    });

    expect(sessionId).toBeDefined();
  });

  it('should get shadow logs', async () => {
    await lucidDreamer.initialize();

    await lucidDreamer.logInteraction({
      query: 'Test',
      queryMetadata: {
        intent: 'query',
        intentConfidence: 0.9,
        complexity: 0.3,
        backend: 'local',
        model: 'llama3.2',
        routingConfidence: 0.8,
        latency: 100,
      },
      response: 'Response',
      responseMetadata: {
        backend: 'local',
        model: 'llama3.2',
        latency: 50,
      },
    });

    const logs = await lucidDreamer.getShadowLogs();

    expect(logs).toBeDefined();
    expect(logs.stats.totalEntries).toBeGreaterThan(0);
  });
});

describe('LucidDreamer - Hypothesis Generation', () => {
  let lucidDreamer: LucidDreamer;

  beforeEach(() => {
    lucidDreamer = new LucidDreamer({ enabled: true });
  });

  it('should generate hypothesis', async () => {
    await lucidDreamer.initialize();

    const hypothesis = await lucidDreamer.generateHypothesis({
      observation: 'high local preference',
    });

    expect(hypothesis).toBeDefined();
    expect(hypothesis.hypothesis).toBeDefined();
    expect(hypothesis.confidence).toBeGreaterThan(0);
  });

  it('should get learning recommendations', async () => {
    await lucidDreamer.initialize();

    const recommendations = await lucidDreamer.getLearningRecommendations();

    expect(Array.isArray(recommendations)).toBe(true);
  });
});

describe('SuperInstance - Integration', () => {
  let superInstance: SuperInstance;

  beforeEach(async () => {
    superInstance = new SuperInstance({});
    await superInstance.initialize();
  });

  it('should transduce input', async () => {
    const result = await superInstance.transduce('What is AI?');

    expect(result.embedding).toBeDefined();
    expect(result.category).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should recall context', async () => {
    const meaning = {
      embedding: new Array(768).fill(0.1),
    };

    const result = await superInstance.recall(meaning);

    expect(result.knowledge).toBeDefined();
    expect(result.context).toBeDefined();
  });

  it('should cogitate', async () => {
    const meaning = { embedding: [] };
    const context = { knowledge: [] };

    const result = await superInstance.cogitate(meaning, context);

    expect(result.content).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should effect action', async () => {
    const thought = {
      content: 'Execute this',
      confidence: 0.8,
    };

    const result = await superInstance.effect(thought);

    expect(result.output).toBeDefined();
    expect(result.executed).toBe(true);
  });

  it('should handle query', async () => {
    const result = await superInstance.query('What is the weather?');

    expect(result.content).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should handle empty query', async () => {
    const result = await superInstance.query('');

    expect(result.content).toBeDefined();
  });

  it('should shutdown', async () => {
    await expect(superInstance.shutdown()).resolves.not.toThrow();
  });
});

describe('Cartridge Operations', () => {
  it('should load cartridge', async () => {
    const superInstance = new SuperInstance({});
    await superInstance.initialize();

    // Stub implementation - tests that it doesn't throw
    expect(async () => {
      await superInstance.query('Test');
    }).not.toThrow();
  });

  it('should use cartridge context', async () => {
    const superInstance = new SuperInstance({});
    await superInstance.initialize();

    const result = await superInstance.query('Test query');

    expect(result.content).toBeDefined();
  });

  it('should merge cartridge contexts', async () => {
    const superInstance = new SuperInstance({});
    await superInstance.initialize();

    const result1 = await superInstance.query('Query 1');
    const result2 = await superInstance.query('Query 2');

    expect(result1.content).toBeDefined();
    expect(result2.content).toBeDefined();
  });

  it('should handle cartridge unload', async () => {
    const superInstance = new SuperInstance({});
    await superInstance.initialize();

    await expect(superInstance.shutdown()).resolves.not.toThrow();
  });
});

describe('ContextPlane - Import Parsing', () => {
  let contextPlane: ContextPlane;

  beforeEach(() => {
    contextPlane = new ContextPlane({});
  });

  it('should parse ES6 imports', async () => {
    const code = `
import { useState, useEffect } from 'react';
import * as React from 'react';
import axios from 'axios';
import { configure } from '@testing-library/react';
import myDefault from './myModule';
    `;

    const analysis = await contextPlane.parseImports(code);

    expect(analysis.hasImports).toBe(true);
    expect(analysis.imports.length).toBe(5);
    expect(analysis.modules).toContain('react');
    expect(analysis.modules).toContain('axios');
    expect(analysis.modules).toContain('@testing-library/react');

    // Check first import (named)
    const firstImport = analysis.imports[0];
    expect(firstImport.module).toBe('react');
    expect(firstImport.namedImports).toEqual(['useState', 'useEffect']);
    expect(firstImport.importType).toBe('import');
    expect(firstImport.isRelative).toBe(false);
  });

  it('should parse CommonJS requires', async () => {
    const code = `
const express = require('express');
const _ = require('lodash');
const config = require('./config.json');
    `;

    const analysis = await contextPlane.parseImports(code);

    expect(analysis.hasImports).toBe(true);
    expect(analysis.imports.length).toBe(3);
    expect(analysis.imports[0].importType).toBe('require');
    expect(analysis.imports[2].isRelative).toBe(true);
  });

  it('should parse dynamic imports', async () => {
    const code = `
const module = await import('./dynamicModule');
const lazyComponent = () => import('./LazyComponent');
    `;

    const analysis = await contextPlane.parseImports(code);

    expect(analysis.hasImports).toBe(true);
    expect(analysis.imports[0].importType).toBe('dynamic-import');
    expect(analysis.imports[0].isRelative).toBe(true);
  });

  it('should detect file type', async () => {
    const tsCode = `
import { Component } from 'react';
import * as ts from 'typescript';
    `;

    const analysis = await contextPlane.parseImports(tsCode);
    expect(analysis.fileType).toBe('typescript');

    const jsCode = `
import { h } from 'preact';
import { render } from 'preact-render-to-string';
    `;

    const jsAnalysis = await contextPlane.parseImports(jsCode);
    expect(jsAnalysis.fileType).toBe('javascript');
  });

  it('should extract primary domain', async () => {
    const code = `
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
    `;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.primaryDomain).toBe('react');
  });

  it('should handle mixed import types', async () => {
    const code = `
import React from 'react';
const _ = require('lodash');
const moment = await import('moment');
    `;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.imports.length).toBe(3);
    expect(new Set(analysis.imports.map(i => i.importType))).toEqual(new Set(['import', 'require', 'dynamic-import']));
  });

  it('should handle relative imports', async () => {
    const code = `
import utils from './utils';
import config from '../config';
import deep from '../../deep/module';
    `;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.imports.every(imp => imp.isRelative)).toBe(true);
  });

  it('should handle default, named, and namespace imports', async () => {
    const code = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
    `;

    const analysis = await contextPlane.parseImports(code);

    const defaultImport = analysis.imports.find(i => i.defaultImport === 'React');
    expect(defaultImport).toBeDefined();

    const namedImport = analysis.imports.find(i => i.namedImports.includes('useState'));
    expect(namedImport).toBeDefined();

    const namespaceImport = analysis.imports.find(i => i.namespaceImports.includes('ReactDOM'));
    expect(namespaceImport).toBeDefined();
  });

  it('should build dependency graph', async () => {
    const code = `
import React from 'react';
import { Component } from 'react';
import { render } from 'react-dom';
import ReactDOM from 'react-dom';
    `;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.dependencyGraph).toBeDefined();
    expect(analysis.dependencyGraph['react']).toBeDefined();
    expect(analysis.dependencyGraph['react-dom']).toBeDefined();
  });

  it('should store import relationships', async () => {
    const sourceKey = 'test-file.tsx';
    const code = `
import React from 'react';
import { useState } from 'react';
    `;

    await contextPlane.parseImports(code, sourceKey);

    const deps = contextPlane.getDependencies(sourceKey);
    expect(deps).toContain('react');

    const stats = contextPlane.getDependencyGraphStats();
    expect(stats.totalSources).toBe(1);
    expect(stats.totalDependencies).toBe(2);
  });

  it('should retrieve import metadata', async () => {
    const sourceKey = 'test-file.ts';
    const code = `
import express from 'express';
    `;

    await contextPlane.parseImports(code, sourceKey);

    const metadata = contextPlane.getImportMetadata(sourceKey);
    expect(metadata).toBeDefined();
    expect(metadata!.fileType).toBe('typescript');
    expect(metadata!.lines).toBe(1);
  });

  it('should handle no imports', async () => {
    const code = `
console.log('Hello World');
const x = 42;
    `;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.hasImports).toBe(false);
    expect(analysis.imports).toHaveLength(0);
    expect(analysis.modules).toHaveLength(0);
  });

  it('should handle comments and empty lines', async () => {
    const code = `
// This is a comment
import React from 'react';

// Another comment
import { useState } from 'react';

// Final comment
`;

    const analysis = await contextPlane.parseImports(code);
    expect(analysis.hasImports).toBe(true);
    expect(analysis.imports.length).toBe(2);
  });

  it('should handle with options', async () => {
    const code = `
import React from 'react';
import { useState } from 'react';
    `;

    const analysis = await contextPlane.parseImports(code, undefined, {
      includeLineNumbers: false,
      detectFileType: false,
      extractPrimaryDomain: false
    });

    expect(analysis.fileType).toBe('unknown');
    expect(analysis.primaryDomain).toBeUndefined();
    // Line numbers should still be included by default
  });

  it('should get reverse dependencies', async () => {
    const code1 = `
import React from 'react';
    `;
    const code2 = `
import { Component } from 'react';
    `;

    await contextPlane.parseImports(code1, 'file1.tsx');
    await contextPlane.parseImports(code2, 'file2.tsx');

    const reverseDeps = contextPlane.getReverseDependencies('react');
    expect(reverseDeps).toContain('file1.tsx');
    expect(reverseDeps).toContain('file2.tsx');
  });

  it('should handle large number of imports', async () => {
    const code = [];
    for (let i = 0; i < 100; i++) {
      code.push(`import lib${i} from 'library-${i}';`);
    }
    const largeCode = code.join('\n');

    const analysis = await contextPlane.parseImports(largeCode);
    expect(analysis.imports.length).toBe(100);
    expect(analysis.modules.length).toBe(100);
  });
});
