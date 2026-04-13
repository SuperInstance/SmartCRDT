/**
 * @file api.ts - HTTP API server for agent interaction with the CRDT store
 * @module @lsi/fleet-collab/api
 *
 * Provides a simple HTTP server (Node.js native http module) that agents
 * can use to interact with the FleetCollabStore.
 *
 * Endpoints:
 *   POST /task/create       - Create a task
 *   POST /task/claim        - Claim a task
 *   POST /task/complete     - Complete a task
 *   GET  /task/:id          - Get a task
 *   GET  /tasks             - List all tasks
 *   POST /knowledge/contribute - Add knowledge
 *   GET  /knowledge/:id     - Get a knowledge entry
 *   GET  /knowledge         - List/search knowledge
 *   POST /heartbeat         - Agent heartbeat
 *   GET  /fleet             - Fleet state
 *   GET  /fleet/summary     - Fleet summary
 *   POST /metrics/increment - Report metric
 *   GET  /metrics           - Get all metrics
 *   POST /config/set        - Set config value
 *   GET  /config/:key       - Get config value
 *   GET  /config            - Get all config
 *   POST /membership/join   - Join fleet
 *   POST /membership/leave  - Leave fleet
 *   GET  /membership        - List members
 *   POST /merge             - Merge state from another replica
 *   GET  /export            - Export full state
 *   POST /import            - Import full state
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { FleetCollabStore } from './crdt-store.js';
import {
  type CreateTaskRequest,
  type ClaimTaskRequest,
  type CompleteTaskRequest,
  type ContributeKnowledgeRequest,
  type ReportMetricRequest,
  type HeartbeatRequest,
  type UpdateConfigRequest,
  type MergeRequest,
  type ApiResponse,
  TaskPriority,
  AgentStatus,
} from './types.js';

export interface HttpApiOptions {
  port?: number;
  hostname?: string;
  store: FleetCollabStore;
}

function jsonResponse(res: ServerResponse, statusCode: number, data: ApiResponse): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function matchPath(method: string, path: string, pattern: string): boolean {
  return path === pattern || path.startsWith(pattern.replace(/:([^/]+)/g, ''));
}

function extractPathParam(path: string, prefix: string): string | null {
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length) || null;
  }
  return null;
}

export class FleetHttpApi {
  private server: Server | null = null;
  private store: FleetCollabStore;
  private port: number;
  private hostname: string;

  constructor(opts: HttpApiOptions) {
    this.store = opts.store;
    this.port = opts.port || 3456;
    this.hostname = opts.hostname || '0.0.0.0';
  }

  /** Start the HTTP server */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (error: any) {
          jsonResponse(res, 500, {
            success: false,
            error: error.message || 'Internal server error',
            timestamp: Date.now(),
          });
        }
      });

      this.server.listen(this.port, this.hostname, () => {
        resolve();
      });
    });
  }

  /** Stop the HTTP server */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }

  /** Get the port the server is listening on */
  getPort(): number {
    return this.port;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method?.toUpperCase() || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // ---- TASKS ----
    if (method === 'POST' && path === '/task/create') {
      const body = JSON.parse(await parseBody(req)) as CreateTaskRequest;
      const task = this.store.taskBoard.createTask(
        body.title, body.description, body.priority,
        { tags: body.tags, dependencies: body.dependencies }
      );
      jsonResponse(res, 201, { success: true, data: task, timestamp: Date.now() });
      return;
    }

    if (method === 'POST' && path === '/task/claim') {
      const body = JSON.parse(await parseBody(req)) as ClaimTaskRequest;
      const task = this.store.taskBoard.claimTask(body.taskId, body.agentId);
      if (!task) {
        jsonResponse(res, 409, { success: false, error: 'Task not available for claiming', timestamp: Date.now() });
        return;
      }
      jsonResponse(res, 200, { success: true, data: task, timestamp: Date.now() });
      return;
    }

    if (method === 'POST' && path === '/task/complete') {
      const body = JSON.parse(await parseBody(req)) as CompleteTaskRequest;
      const task = this.store.taskBoard.completeTask(body.taskId, body.agentId, body.result);
      if (!task) {
        jsonResponse(res, 409, { success: false, error: 'Cannot complete task', timestamp: Date.now() });
        return;
      }
      jsonResponse(res, 200, { success: true, data: task, timestamp: Date.now() });
      return;
    }

    const taskId = extractPathParam(path, '/task/');
    if (method === 'GET' && taskId && !path.includes('/tasks')) {
      const task = this.store.taskBoard.getTask(taskId);
      if (!task) {
        jsonResponse(res, 404, { success: false, error: 'Task not found', timestamp: Date.now() });
        return;
      }
      jsonResponse(res, 200, { success: true, data: task, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/tasks') {
      const tasks = this.store.taskBoard.getAllTasks();
      jsonResponse(res, 200, { success: true, data: tasks, timestamp: Date.now() });
      return;
    }

    // ---- KNOWLEDGE ----
    if (method === 'POST' && path === '/knowledge/contribute') {
      const body = JSON.parse(await parseBody(req)) as ContributeKnowledgeRequest;
      const entry = this.store.knowledgeBase.contribute({
        title: body.title,
        content: body.content,
        category: body.category,
        createdBy: body.agentId,
        tags: body.tags || [],
        confidence: body.confidence || 0.5,
        source: body.source,
        metadata: {},
      });
      jsonResponse(res, 201, { success: true, data: entry, timestamp: Date.now() });
      return;
    }

    const kbId = extractPathParam(path, '/knowledge/');
    if (method === 'GET' && kbId && path !== '/knowledge' && !url.searchParams.has('q')) {
      const entry = this.store.knowledgeBase.getEntry(kbId);
      if (!entry) {
        jsonResponse(res, 404, { success: false, error: 'Knowledge entry not found', timestamp: Date.now() });
        return;
      }
      jsonResponse(res, 200, { success: true, data: entry, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/knowledge') {
      const q = url.searchParams.get('q');
      const entries = q ? this.store.knowledgeBase.search(q) : this.store.knowledgeBase.getAllEntries();
      jsonResponse(res, 200, { success: true, data: entries, timestamp: Date.now() });
      return;
    }

    // ---- HEARTBEAT / FLEET ----
    if (method === 'POST' && path === '/heartbeat') {
      const body = JSON.parse(await parseBody(req)) as HeartbeatRequest;
      const member = this.store.fleetState.updateAgent(body.agentId, {
        agentName: body.agentName,
        status: body.status,
        capabilities: body.capabilities,
        currentTask: body.currentTask,
      });
      jsonResponse(res, 200, { success: true, data: member, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/fleet') {
      const members = this.store.fleetState.getMembers();
      jsonResponse(res, 200, { success: true, data: members, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/fleet/summary') {
      const summary = this.store.getSnapshot();
      jsonResponse(res, 200, { success: true, data: summary, timestamp: Date.now() });
      return;
    }

    // ---- METRICS ----
    if (method === 'POST' && path === '/metrics/increment') {
      const body = JSON.parse(await parseBody(req)) as ReportMetricRequest;
      this.store.metrics.increment(body.name, body.value);
      jsonResponse(res, 200, { success: true, data: { name: body.name, value: body.value }, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/metrics') {
      const snapshots = this.store.metrics.getAllSnapshots();
      jsonResponse(res, 200, { success: true, data: snapshots, timestamp: Date.now() });
      return;
    }

    // ---- CONFIG ----
    if (method === 'POST' && path === '/config/set') {
      const body = JSON.parse(await parseBody(req)) as UpdateConfigRequest;
      this.store.config.set(body.key, body.value);
      jsonResponse(res, 200, { success: true, data: { key: body.key, value: body.value }, timestamp: Date.now() });
      return;
    }

    const configKey = extractPathParam(path, '/config/');
    if (method === 'GET' && configKey && path !== '/config') {
      const value = this.store.config.get(configKey);
      if (value === undefined) {
        jsonResponse(res, 404, { success: false, error: 'Config key not found', timestamp: Date.now() });
        return;
      }
      jsonResponse(res, 200, { success: true, data: { key: configKey, value }, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/config') {
      const all = this.store.config.toObject();
      jsonResponse(res, 200, { success: true, data: all, timestamp: Date.now() });
      return;
    }

    // ---- MEMBERSHIP ----
    if (method === 'POST' && path === '/membership/join') {
      const body = JSON.parse(await parseBody(req));
      const info = this.store.membership.join(body.agentId, {
        displayName: body.displayName,
        roles: body.roles,
        metadata: body.metadata,
      });
      jsonResponse(res, 201, { success: true, data: info, timestamp: Date.now() });
      return;
    }

    if (method === 'POST' && path === '/membership/leave') {
      const body = JSON.parse(await parseBody(req));
      this.store.membership.leave(body.agentId);
      jsonResponse(res, 200, { success: true, data: { agentId: body.agentId }, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/membership') {
      const members = this.store.membership.getAllMemberInfo();
      jsonResponse(res, 200, { success: true, data: members, timestamp: Date.now() });
      return;
    }

    // ---- MERGE / IMPORT/EXPORT ----
    if (method === 'POST' && path === '/merge') {
      const body = JSON.parse(await parseBody(req)) as MergeRequest;
      const tmpStore = new FleetCollabStore(body.fromReplica);
      tmpStore.importAll(body.state as any);
      const result = this.store.merge(tmpStore);
      jsonResponse(res, 200, { success: true, data: result, timestamp: Date.now() });
      return;
    }

    if (method === 'GET' && path === '/export') {
      const exported = this.store.exportAll();
      jsonResponse(res, 200, { success: true, data: exported, timestamp: Date.now() });
      return;
    }

    if (method === 'POST' && path === '/import') {
      const body = JSON.parse(await parseBody(req));
      this.store.importAll(body);
      jsonResponse(res, 200, { success: true, data: { imported: true }, timestamp: Date.now() });
      return;
    }

    // ---- FALLBACK ----
    jsonResponse(res, 404, { success: false, error: 'Not found', timestamp: Date.now() });
  }
}
