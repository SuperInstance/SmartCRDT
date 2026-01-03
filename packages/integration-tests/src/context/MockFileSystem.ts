/**
 * Mock File System Utilities for Context-Aware Query Testing
 *
 * Provides in-memory file system simulation for testing import parsing,
 * domain extraction, and file watching without touching actual disk.
 */

import * as path from 'path';

export interface MockFile {
  path: string;
  content: string;
  mtime?: Date;
}

export interface MockFileSystemOptions {
  root?: string;
  caseSensitive?: boolean;
}

/**
 * In-memory file system for testing
 */
export class MockFileSystem {
  private files: Map<string, MockFile> = new Map();
  private root: string;
  private caseSensitive: boolean;

  constructor(options: MockFileSystemOptions = {}) {
    this.root = options.root || '/mock/fs';
    this.caseSensitive = options.caseSensitive ?? true;
  }

  /**
   * Normalize a file path for the mock filesystem
   */
  private normalizePath(filePath: string): string {
    let normalized = filePath; // Use the raw path
    if (!this.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  }

  /**
   * Add a file to the mock filesystem
   */
  addFile(file: MockFile): void {
    const normalizedPath = this.normalizePath(file.path);
    this.files.set(normalizedPath, {
      ...file,
      path: normalizedPath,
      mtime: file.mtime || new Date()
    });
  }

  /**
   * Add multiple files at once
   */
  addFiles(files: MockFile[]): void {
    files.forEach(file => this.addFile(file));
  }

  /**
   * Get a file's content
   */
  async readFile(filePath: string): Promise<string> {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);

    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    return file.content;
  }

  /**
   * Check if a file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath);
  }

  /**
   * Get file stats
   */
  async stat(filePath: string): Promise<{
    isFile: () => boolean;
    isDirectory: () => boolean;
    mtime: Date;
    size: number;
  }> {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);

    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    return {
      isFile: () => true,
      isDirectory: () => false,
      mtime: file.mtime || new Date(),
      size: file.content.length
    };
  }

  /**
   * Update a file's content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    const existing = this.files.get(normalizedPath);

    this.files.set(normalizedPath, {
      path: normalizedPath,
      content,
      mtime: new Date()
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    this.files.delete(normalizedPath);
  }

  /**
   * List all files
   */
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Get file basename
   */
  basename(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * Get file count
   */
  size(): number {
    return this.files.size;
  }
}

/**
 * Create a mock filesystem with common project structure
 */
export function createMockProjectFileSystem(): MockFileSystem {
  const fs = new MockFileSystem({ root: '/mock/project' });

  // Add common configuration files
  fs.addFiles([
    {
      path: '/mock/project/package.json',
      content: JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'typescript': '^5.0.0'
        }
      }, null, 2)
    },
    {
      path: '/mock/project/tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node'
        }
      }, null, 2)
    }
  ]);

  return fs;
}

/**
 * Mock fs.promises API that uses MockFileSystem
 */
export class MockFsPromises {
  constructor(private mockFs: MockFileSystem) {}

  async readFile(filePath: string, encoding: string): Promise<string> {
    if (encoding !== 'utf-8') {
      throw new Error('Only utf-8 encoding is supported');
    }
    return this.mockFs.readFile(filePath);
  }

  async stat(filePath: string): Promise<any> {
    return this.mockFs.stat(filePath);
  }

  async access(filePath: string): Promise<void> {
    const exists = await this.mockFs.exists(filePath);
    if (!exists) {
      throw new Error(`ENOENT: ${filePath}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    return this.mockFs.writeFile(filePath, content);
  }

  async unlink(filePath: string): Promise<void> {
    return this.mockFs.deleteFile(filePath);
  }

  async readdir(dirPath: string): Promise<any[]> {
    // Simple implementation - list files in directory
    const allFiles = this.mockFs.listFiles();
    const dirFiles = allFiles.filter(f => f.startsWith(dirPath));
    return dirFiles.map(f => ({
      name: this.mockFs.basename(f),
      isDirectory: () => false,
      isFile: () => true
    }));
  }
}

/**
 * Create a mock file system with sample monorepo structure
 */
export function createMockMonorepoFileSystem(): MockFileSystem {
  const fs = new MockFileSystem({ root: '/mock/monorepo' });

  // Packages directory structure
  const packages = [
    {
      path: '/mock/monorepo/packages/core/src/index.ts',
      content: `
import { Logger } from './utils/logger';
import { Config } from './config';

export class Core {
  private logger: Logger;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
  }

  async initialize(): Promise<void> {
    this.logger.info('Core initialized');
  }

  async process(data: any): Promise<any> {
    this.logger.debug('Processing data');
    return data;
  }
}

export { Logger, Config };
`
    },
    {
      path: '/mock/monorepo/packages/core/src/utils/logger.ts',
      content: `
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string): void {
    if (this.level === LogLevel.DEBUG) {
      console.debug(\`[DEBUG] \${message}\`);
    }
  }

  info(message: string): void {
    console.info(\`[INFO] \${message}\`);
  }

  warn(message: string): void {
    console.warn(\`[WARN] \${message}\`);
  }

  error(message: string): void {
    console.error(\`[ERROR] \${message}\`);
  }
}
`
    },
    {
      path: '/mock/monorepo/packages/core/src/config.ts',
      content: `
export interface Config {
  logLevel: string;
  apiUrl: string;
  timeout: number;
}

export const defaultConfig: Config = {
  logLevel: 'info',
  apiUrl: 'https://api.example.com',
  timeout: 5000
};
`
    },
    {
      path: '/mock/monorepo/packages/api/src/index.ts',
      content: `
import express from 'express';
import { Core } from '@lsi/core';

const app = express();

const core = new Core({
  logLevel: 'debug',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  timeout: 10000
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/process', async (req, res) => {
  try {
    const result = await core.process(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
`
    },
    {
      path: '/mock/monorepo/packages/web/src/App.tsx',
      content: `
import React, { useState, useEffect } from 'react';
import { Core } from '@lsi/core';

interface AppProps {
  title: string;
}

export const App: React.FC<AppProps> = ({ title }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const core = new Core({
      logLevel: 'info',
      apiUrl: 'https://api.example.com',
      timeout: 5000
    });

    setLoading(true);
    core.initialize()
      .then(() => core.process({ query: 'test' }))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{title}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default App;
`
    }
  ];

  fs.addFiles(packages);

  return fs;
}
