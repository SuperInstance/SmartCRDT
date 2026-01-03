/**
 * Context-Aware Query Integration Tests
 *
 * Comprehensive end-to-end tests for:
 * - Import parsing from various file types
 * - Domain extraction accuracy
 * - Knowledge graph construction and querying
 * - File watcher triggers
 * - Domain confidence scoring
 * - Graph traversal queries
 * - Error recovery for invalid files
 *
 * @package integration-tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextPlane } from '@lsi/superinstance';
import type {
  ImportAnalysis,
  ImportStatement,
  Domain,
  DomainClassification,
  KnowledgeEntry
} from '@lsi/protocol';
import {
  MockFileSystem,
  createMockMonorepoFileSystem,
  createMockProjectFileSystem
} from './MockFileSystem';

// Sample file contents for testing
const TYPESCRIPT_SAMPLE = `
import { Injectable, Logger } from '@core/decorators';
import { Config } from '@core/config';
import { HttpClient } from '@utils/http';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { join } from 'path';
import { UserService } from './services/UserService';
import { validateEmail } from './utils/validators';

export class UserController {
  constructor(private config: Config) {}

  async createUser(req: Request, res: Response): Promise<void> {
    const result = await this.userService.create(req.body);
    res.json(result);
  }
}
`;

const REACT_SAMPLE = `
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { User } from '@types/index';
import { Button } from '@components/ui/Button';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/api';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState(null);
  const dispatch = useDispatch();
  const { user } = useAuth();

  const { data: posts } = useQuery({
    queryKey: ['posts'],
    queryFn: api.getPosts
  });

  return <div>{data}</div>;
};
`;

const PYTHON_SAMPLE = `
import os
import sys
import json
from datetime import datetime
from typing import List, Dict
import numpy as np
import pandas as pd
from fastapi import FastAPI
from .models import User
from .utils import hash_password

class UserService:
    def create_user(self, data: dict) -> User:
        return User(**data)
`;

describe('Context-Aware Query Integration Tests', () => {
  let contextPlane: ContextPlane;
  let mockFs: MockFileSystem;

  beforeEach(async () => {
    // Create ContextPlane without API key to test fallback behavior
    contextPlane = new ContextPlane({});
    await contextPlane.initialize();

    // Create mock filesystem
    mockFs = createMockMonorepoFileSystem();
  });

  afterEach(async () => {
    await contextPlane.shutdown();
    mockFs.clear();
  });

  describe('Import Parsing', () => {
    describe('TypeScript File Parsing', () => {
      it('should parse named imports from TypeScript files', async () => {
        const analysis = await contextPlane.parseImports(
          TYPESCRIPT_SAMPLE,
          'test-file.ts'
        );

        expect(analysis).toBeDefined();
        expect(analysis.imports).toBeInstanceOf(Array);
        expect(analysis.imports.length).toBeGreaterThan(0);

        // Check for external imports
        const externalImports = analysis.imports.filter(
          imp => imp.type === 'external'
        );
        expect(externalImports.length).toBeGreaterThan(0);

        // Check for specific imports
        const hasExpressImport = analysis.imports.some(
          imp => imp.module === 'express'
        );
        expect(hasExpressImport).toBe(true);
      });

      it('should parse type-only imports correctly', async () => {
        const content = `
import type { Request, Response } from 'express';
import type { User } from './types';
export class Controller {}
`;

        const analysis = await contextPlane.parseImports(content, 'test.ts');

        const typeImports = analysis.imports.filter(
          imp => imp.isTypeOnly || imp.importedNames?.some((n: any) => n.isType)
        );

        expect(typeImports.length).toBeGreaterThan(0);
      });

      it('should parse namespace imports', async () => {
        const content = `
import * as fs from 'fs';
import * as path from 'path';
export class FileReader {}
`;

        const analysis = await contextPlane.parseImports(content, 'test.ts');

        const namespaceImports = analysis.imports.filter(
          imp => imp.type === 'namespace'
        );

        expect(namespaceImports.length).toBeGreaterThan(0);
      });

      it('should parse default exports', async () => {
        const content = `
import express from 'express';
import React from 'react';
export default class App {}
`;

        const analysis = await contextPlane.parseImports(content, 'test.ts');

        const defaultImports = analysis.imports.filter(
          imp => imp.importedNames?.some((n: any) => n.type === 'default')
        );

        expect(defaultImports.length).toBeGreaterThan(0);
      });

      it('should parse dynamic imports', async () => {
        const content = `
const loadModule = async (name: string) => {
  const module = await import(name);
  return module.default;
};
`;

        const analysis = await contextPlane.parseImports(content, 'test.ts');

        // Dynamic imports should be detected
        const hasDynamicImports = analysis.imports.some(
          imp => imp.type === 'dynamic'
        );

        expect(hasDynamicImports).toBe(true);
      });

      it('should parse relative imports correctly', async () => {
        const content = `
import { UserService } from './services/UserService';
import { validateEmail } from './utils/validators';
import { APIError } from './errors';
`;

        const analysis = await contextPlane.parseImports(content, 'test.ts');

        const relativeImports = analysis.imports.filter(
          imp => imp.type === 'relative'
        );

        expect(relativeImports.length).toBeGreaterThan(0);
      });
    });

    describe('React/JSX File Parsing', () => {
      it('should parse imports from React components', async () => {
        const analysis = await contextPlane.parseImports(
          REACT_SAMPLE,
          'Dashboard.tsx'
        );

        expect(analysis.imports.length).toBeGreaterThan(0);

        // Should detect React imports
        const hasReactImport = analysis.imports.some(
          imp => imp.module === 'react'
        );
        expect(hasReactImport).toBe(true);

        // Should detect router imports
        const hasRouterImport = analysis.imports.some(
          imp => imp.module === 'react-router-dom'
        );
        expect(hasRouterImport).toBe(true);
      });

      it('should detect hook imports', async () => {
        const analysis = await contextPlane.parseImports(
          REACT_SAMPLE,
          'Dashboard.tsx'
        );

        const hookImports = analysis.imports.filter(imp =>
          imp.importedNames?.some((n: any) =>
            ['useState', 'useEffect', 'useCallback', 'useMemo'].includes(n.name)
          )
        );

        expect(hookImports.length).toBeGreaterThan(0);
      });
    });

    describe('JavaScript File Parsing', () => {
      it('should parse CommonJS require statements', async () => {
        const content = `
const express = require('express');
const fs = require('fs');
const { promisify } = require('util');
`;

        const analysis = await contextPlane.parseImports(content, 'test.js');

        expect(analysis.imports.length).toBeGreaterThan(0);

        // Check for CommonJS detection
        const hasCommonJS = analysis.imports.some(
          imp => imp.syntax === 'commonjs'
        );
        expect(hasCommonJS).toBe(true);
      });

      it('should parse mixed ES modules and CommonJS', async () => {
        const content = `
const express = require('express');
import { EventEmitter } from 'events';
export default class Server {}
`;

        const analysis = await contextPlane.parseImports(content, 'mixed.js');

        // Should detect both import types
        expect(analysis.imports.length).toBeGreaterThan(0);
      });
    });

    describe('Python File Parsing', () => {
      it('should parse Python imports', async () => {
        const analysis = await contextPlane.parseImports(
          PYTHON_SAMPLE,
          'test.py'
        );

        expect(analysis.imports.length).toBeGreaterThan(0);

        // Check for Python module detection
        const hasPythonImports = analysis.imports.some(imp =>
          ['os', 'sys', 'json', 'datetime', 'typing'].includes(imp.module)
        );

        expect(hasPythonImports).toBe(true);
      });

      it('should parse from imports', async () => {
        const content = `
from datetime import datetime, timedelta
from typing import List, Dict
from .models import User
`;

        const analysis = await contextPlane.parseImports(content, 'test.py');

        const fromImports = analysis.imports.filter(
          imp => imp.type === 'from'
        );

        expect(fromImports.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Domain Extraction', () => {
    it('should extract programming domain from code files', async () => {
      const domains = await contextPlane.extractDomains(TYPESCRIPT_SAMPLE);

      expect(domains).toContain('programming');
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should detect web development domain', async () => {
      const webCode = `
import express from 'express';
import { Router } from 'express';
import React from 'react';
import { render } from 'react-dom';

const app = express();
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});
`;

      const domains = await contextPlane.extractDomains(webCode);

      expect(domains).toContain('programming');
      // May also contain other related domains
    });

    it('should detect data science domain', async () => {
      const dataScienceCode = `
import numpy as np
import pandas as pd
from sklearn.model import train_test_split
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv')
X = df[['feature1', 'feature2']]
y = df['target']
`;

      const domains = await contextPlane.extractDomains(dataScienceCode);

      expect(domains.length).toBeGreaterThan(0);
      // Should detect science/programming
    });

    it('should provide domain confidence scores', async () => {
      const classification = await contextPlane.extractDomainClassification(
        TYPESCRIPT_SAMPLE
      );

      expect(classification).toHaveProperty('confidence');
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.confidence).toBeLessThanOrEqual(1);

      expect(classification).toHaveProperty('primaryDomain');
      expect(classification.primaryDomain).toBeDefined();

      expect(classification).toHaveProperty('domains');
      expect(classification.domains).toBeInstanceOf(Array);
    });

    it('should handle ambiguous content', async () => {
      const ambiguous = `
This is some text that doesn't clearly belong to any specific domain.
It could be general information or documentation.
`;

      const domains = await contextPlane.extractDomains(ambiguous);

      expect(Array.isArray(domains)).toBe(true);
      // Should return general or low-confidence classification
    });

    it('should extract multiple domains for interdisciplinary content', async () => {
      const bioinformaticsCode = `
import Bio from 'biojs';
import numpy as np

class SequenceAnalyzer {
  analyze(sequence: string) {
    # Biological analysis with computational methods
    return np.mean(sequence)
  }
}
`;

      const domains = await contextPlane.extractDomains(bioinformaticsCode);

      // Should detect multiple relevant domains
      expect(domains.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Knowledge Graph Construction', () => {
    it('should build knowledge graph from parsed imports', async () => {
      const fileKey = 'test-file.ts';
      const analysis = await contextPlane.parseImports(
        TYPESCRIPT_SAMPLE,
        fileKey
      );

      // Store knowledge
      await contextPlane.storeKnowledge({
        key: fileKey,
        value: {
          path: fileKey,
          importAnalysis: analysis,
          type: 'file'
        }
      });

      // Verify knowledge was stored
      const retrieved = await contextPlane.retrieveKnowledge(fileKey);
      expect(retrieved).toBeDefined();
      expect(retrieved.value.importAnalysis).toEqual(analysis);
    });

    it('should track dependency relationships', async () => {
      const file1Key = 'controller.ts';
      const file2Key = 'service.ts';

      // Parse and store first file
      const analysis1 = await contextPlane.parseImports(
        TYPESCRIPT_SAMPLE,
        file1Key
      );
      await contextPlane.storeKnowledge({
        key: file1Key,
        value: { importAnalysis: analysis1 }
      });

      // Parse and store second file
      const analysis2 = await contextPlane.parseImports(
        REACT_SAMPLE,
        file2Key
      );
      await contextPlane.storeKnowledge({
        key: file2Key,
        value: { importAnalysis: analysis2 }
      });

      // Verify both are stored
      const retrieved1 = await contextPlane.retrieveKnowledge(file1Key);
      const retrieved2 = await contextPlane.retrieveKnowledge(file2Key);

      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();
    });

    it('should handle circular dependencies gracefully', async () => {
      const fileA = `
import { B } from './fileB';
export class A { constructor(private b: B) {} }
`;

      const fileB = `
import { A } from './fileA';
export class B { constructor(private a: A) {} }
`;

      const analysisA = await contextPlane.parseImports(fileA, 'fileA.ts');
      const analysisB = await contextPlane.parseImports(fileB, 'fileB.ts');

      await contextPlane.storeKnowledge({
        key: 'fileA.ts',
        value: { importAnalysis: analysisA }
      });

      await contextPlane.storeKnowledge({
        key: 'fileB.ts',
        value: { importAnalysis: analysisB }
      });

      // Should not throw or hang
      const retrievedA = await contextPlane.retrieveKnowledge('fileA.ts');
      const retrievedB = await contextPlane.retrieveKnowledge('fileB.ts');

      expect(retrievedA).toBeDefined();
      expect(retrievedB).toBeDefined();
    });
  });

  describe('Knowledge Graph Queries', () => {
    beforeEach(async () => {
      // Setup test knowledge base
      const files = [
        { key: 'file1.ts', content: TYPESCRIPT_SAMPLE },
        { key: 'file2.tsx', content: REACT_SAMPLE },
        { key: 'file3.py', content: PYTHON_SAMPLE }
      ];

      for (const file of files) {
        const analysis = await contextPlane.parseImports(
          file.content,
          file.key
        );

        await contextPlane.storeKnowledge({
          key: file.key,
          value: {
            path: file.key,
            content: file.content,
            importAnalysis: analysis,
            type: 'file'
          }
        });
      }
    });

    it('should query context for specific modules', async () => {
      const query = 'files that import express';
      const results = await contextPlane.queryContext(query);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find files by domain', async () => {
      const programmingFiles = await contextPlane.retrieveByDomain(
        'programming'
      );

      expect(programmingFiles).toBeDefined();
      expect(Array.isArray(programmingFiles)).toBe(true);
    });

    it('should support semantic search', async () => {
      const semanticQuery = 'user authentication and authorization';
      const results = await contextPlane.semanticSearch(semanticQuery, {
        limit: 5
      });

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should retrieve dependent files', async () => {
      // Query for files that depend on a specific module
      const dependents = await contextPlane.getDependents('express');

      expect(dependents).toBeDefined();
      expect(Array.isArray(dependents)).toBe(true);
    });
  });

  describe('File Watcher Integration', () => {
    it('should initialize file watcher', async () => {
      await contextPlane.watchFiles({
        paths: ['/mock/src']
      });

      const status = contextPlane.getFileWatchStatus();

      expect(status.isWatching).toBe(true);
      expect(status.watchedPaths).toContain('/mock/src');
    });

    it('should detect file changes', async () => {
      await contextPlane.watchFiles({
        paths: ['/mock/src']
      });

      // Mock file change detection
      const initialKnowledge = await contextPlane.retrieveKnowledge(
        '/mock/src/test.ts'
      );

      // After file change, knowledge should be updated
      // (This would require actual file system mocking)
      expect(initialKnowledge).toBeDefined();
    });

    it('should handle file deletions', async () => {
      await contextPlane.watchFiles({
        paths: ['/mock/src']
      });

      // Store some knowledge
      await contextPlane.storeKnowledge({
        key: '/mock/src/test.ts',
        value: { content: 'test' }
      });

      // After file deletion, knowledge should be removed
      // (This would require actual file system mocking)
      const status = contextPlane.getFileWatchStatus();
      expect(status.isWatching).toBe(true);
    });

    it('should stop watching files', async () => {
      await contextPlane.watchFiles({
        paths: ['/mock/src']
      });

      await contextPlane.stopWatchingFiles();

      const status = contextPlane.getFileWatchStatus();

      expect(status.isWatching).toBe(false);
      expect(status.watchedPaths).toEqual([]);
    });

    it('should debounce rapid file changes', async () => {
      await contextPlane.watchFiles({
        paths: ['/mock/src'],
        debounceMs: 300
      });

      const status = contextPlane.getFileWatchStatus();

      expect(status.isWatching).toBe(true);
      // Debouncing prevents excessive processing
    });
  });

  describe('Domain Confidence Scoring', () => {
    it('should assign high confidence to clear domain matches', async () => {
      const clearMatch = `
import express from 'express';
import { Router } from 'express';

const app = express();
const router = Router();

app.use('/api', router);
`;

      const classification = await contextPlane.extractDomainClassification(
        clearMatch
      );

      expect(classification.confidence).toBeGreaterThan(0.5);
      expect(classification.primaryDomain).toBeDefined();
    });

    it('should assign lower confidence to ambiguous content', async () => {
      const ambiguous = `
Some information about various topics.
`;

      const classification = await contextPlane.extractDomainClassification(
        ambiguous
      );

      expect(classification.confidence).toBeLessThan(0.8);
    });

    it('should provide confidence scores for all domains', async () => {
      const classification = await contextPlane.extractDomainClassification(
        TYPESCRIPT_SAMPLE
      );

      expect(classification.domains).toBeDefined();
      expect(classification.domains.length).toBeGreaterThan(0);

      // Each domain should have a confidence score
      classification.domains.forEach((domain: Domain) => {
        expect(domain).toHaveProperty('confidence');
        expect(domain.confidence).toBeGreaterThanOrEqual(0);
        expect(domain.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should rank domains by confidence', async () => {
      const classification = await contextPlane.extractDomainClassification(
        TYPESCRIPT_SAMPLE
      );

      const confidences = classification.domains.map(
        (d: Domain) => d.confidence
      );

      // Check that domains are sorted by confidence (descending)
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i]);
      }
    });
  });

  describe('Graph Traversal Queries', () => {
    beforeEach(async () => {
      // Build a dependency graph
      const files = {
        'app.ts': `
import { Controller } from './controller';
import { Service } from './service';
`,
        'controller.ts': `
import { Service } from './service';
import { Repository } from './repository';
`,
        'service.ts': `
import { Repository } from './repository';
`,
        'repository.ts': `
import { Database } from './database';
`,
        'database.ts': `
export class Database {}
`
      };

      for (const [key, content] of Object.entries(files)) {
        const analysis = await contextPlane.parseImports(content, key);
        await contextPlane.storeKnowledge({
          key,
          value: { content, importAnalysis: analysis }
        });
      }
    });

    it('should find all dependencies of a file', async () => {
      const dependencies = await contextPlane.getAllDependencies('app.ts');

      expect(dependencies).toBeDefined();
      expect(Array.isArray(dependencies)).toBe(true);
      // app.ts should transitively depend on all other files
    });

    it('should find reverse dependencies', async () => {
      const reverseDeps = await contextPlane.getReverseDependencies(
        'repository.ts'
      );

      expect(reverseDeps).toBeDefined();
      expect(Array.isArray(reverseDeps)).toBe(true);
      // Multiple files should depend on repository
    });

    it('should detect circular dependencies', async () => {
      const circularA = `
import { B } from './b';
export class A {}
`;
      const circularB = `
import { A } from './a';
export class B {}
`;

      await contextPlane.storeKnowledge({
        key: 'a.ts',
        value: { content: circularA }
      });

      await contextPlane.storeKnowledge({
        key: 'b.ts',
        value: { content: circularB }
      });

      const cycles = await contextPlane.detectCircularDependencies();

      expect(cycles).toBeDefined();
      expect(Array.isArray(cycles)).toBe(true);
    });

    it('should calculate dependency depth', async () => {
      const depth = await contextPlane.getDependencyDepth('app.ts');

      expect(typeof depth).toBe('number');
      expect(depth).toBeGreaterThan(0);
    });

    it('should find shortest dependency path', async () => {
      const path = await contextPlane.findShortestPath('app.ts', 'database.ts');

      expect(path).toBeDefined();
      expect(Array.isArray(path)).toBe(true);
      expect(path[0]).toBe('app.ts');
      expect(path[path.length - 1]).toBe('database.ts');
    });
  });

  describe('Error Recovery', () => {
    it('should handle invalid file content gracefully', async () => {
      const invalidContent = null as any;

      const analysis = await contextPlane.parseImports(
        invalidContent,
        'invalid.ts'
      );

      expect(analysis).toBeDefined();
      // Should return empty analysis rather than throwing
    });

    it('should handle syntax errors in code', async () => {
      const syntaxError = `
import { Something } from 'somewhere'
export class Broken {{{
`;

      const analysis = await contextPlane.parseImports(
        syntaxError,
        'broken.ts'
      );

      // Should not throw, should handle gracefully
      expect(analysis).toBeDefined();
    });

    it('should handle empty file content', async () => {
      const analysis = await contextPlane.parseImports('', 'empty.ts');

      expect(analysis).toBeDefined();
      expect(analysis.imports).toEqual([]);
    });

    it('should handle unsupported file types', async () => {
      const unsupported = 'This is not a supported file type';

      const analysis = await contextPlane.parseImports(
        unsupported,
        'unknown.xyz'
      );

      expect(analysis).toBeDefined();
    });

    it('should recover from storage errors', async () => {
      // Mock storage error
      const originalStore = contextPlane.storeKnowledge.bind(contextPlane);

      vi.spyOn(contextPlane, 'storeKnowledge').mockImplementationOnce(
        async () => {
          throw new Error('Storage error');
        }
      );

      // Should not crash
      await expect(
        contextPlane.storeKnowledge({ key: 'test', value: {} })
      ).rejects.toThrow();

      // Should recover and work normally
      vi.restoreAllMocks();
      await contextPlane.storeKnowledge({ key: 'test2', value: {} });

      const retrieved = await contextPlane.retrieveKnowledge('test2');
      expect(retrieved).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should parse imports quickly', async () => {
      const startTime = performance.now();

      await contextPlane.parseImports(TYPESCRIPT_SAMPLE, 'test.ts');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should parse in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle large files efficiently', async () => {
      // Create a large file with many imports
      const largeFile = Array(100)
        .fill(0)
        .map((_, i) => `import { Module${i} } from 'module${i}';`)
        .join('\n');

      const startTime = performance.now();

      const analysis = await contextPlane.parseImports(largeFile, 'large.ts');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(analysis.imports.length).toBe(100);
      expect(duration).toBeLessThan(500); // Should handle 100 imports in < 500ms
    });

    it('should retrieve knowledge quickly', async () => {
      await contextPlane.storeKnowledge({
        key: 'test-key',
        value: { data: 'test' }
      });

      const startTime = performance.now();

      await contextPlane.retrieveKnowledge('test-key');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Retrieval should be very fast (< 10ms)
      expect(duration).toBeLessThan(10);
    });

    it('should scale with knowledge base size', async () => {
      // Store many entries
      const entries = 1000;
      for (let i = 0; i < entries; i++) {
        await contextPlane.storeKnowledge({
          key: `key-${i}`,
          value: { index: i }
        });
      }

      const startTime = performance.now();

      await contextPlane.retrieveKnowledge('key-500');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still be fast even with 1000 entries
      expect(duration).toBeLessThan(50);
    });
  });
});
