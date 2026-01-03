/**
 * Sample JavaScript file for import parsing tests
 * Demonstrates CommonJS and ES module patterns
 */

const express = require('express');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const readFile = promisify(fs.readFile);

// ES module imports
import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';

// Named exports
export const API_VERSION = '1.0.0';
export const DEFAULT_PORT = 3000;

// Class with various imports
class APIServer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      port: config.port || DEFAULT_PORT,
      host: config.host || '0.0.0.0',
      env: config.env || process.env.NODE_ENV || 'development'
    };

    this.app = express();
    this.middleware = [];
    this.routes = [];
  }

  // Dynamic require
  loadPlugin(pluginName) {
    try {
      const plugin = require(pluginName);
      this.emit('plugin-loaded', pluginName);
      return plugin;
    } catch (error) {
      this.emit('plugin-error', { pluginName, error });
      throw new Error(`Failed to load plugin: ${pluginName}`);
    }
  }

  // Async/await with imports
  async loadConfig(configPath) {
    try {
      const absolutePath = path.resolve(process.cwd(), configPath);
      const content = await readFile(absolutePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.emit('config-error', error);
      throw error;
    }
  }

  // Route handler
  addRoute(method, path, handler) {
    this.routes.push({ method, path, handler });
    this.emit('route-added', { method, path });
  }

  // Start server
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Setup middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Setup routes
        this.routes.forEach(({ method, path, handler }) => {
          this.app[method.toLowerCase()](path, handler);
        });

        // Start listening
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.emit('server-started', {
            host: this.config.host,
            port: this.config.port
          });
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop server
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.emit('server-stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Static method
  static create(config) {
    return new APIServer(config);
  }
}

// Export default
export default APIServer;

// Worker thread setup
if (!isMainThread && parentPort) {
  const server = new APIServer();

  parentPort.on('message', async (message) => {
    try {
      switch (message.type) {
        case 'start':
          await server.start();
          parentPort.postMessage({ type: 'started' });
          break;
        case 'stop':
          await server.stop();
          parentPort.postMessage({ type: 'stopped' });
          break;
        default:
          parentPort.postMessage({ type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      parentPort.postMessage({ type: 'error', error: error.message });
    }
  });
}

// Export utility functions
export function createServer(config) {
  return APIServer.create(config);
}

export function getServerInfo(server) {
  return {
    host: server.config.host,
    port: server.config.port,
    env: server.config.env
  };
}
