/**
 * Tests for HTTP API
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FleetHttpApi } from '../api.js';
import { FleetCollabStore } from '../crdt-store.js';
import { TaskPriority, AgentStatus } from '../types.js';
import { AgentId } from '../types.js';

function httpGet(url: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request }) => {
      request(url, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
        res.on('error', reject);
      }).on('error', reject).end();
    });
  });
}

function httpPost(url: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request }) => {
      const payload = JSON.stringify(body);
      const opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const req = request(url, opts, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  });
}

describe('FleetHttpApi', () => {
  let store: FleetCollabStore;
  let api: FleetHttpApi;
  const baseUrl = 'http://127.0.0.1:3457';

  beforeAll(async () => {
    store = new FleetCollabStore('agent-1');
    api = new FleetHttpApi({ store, port: 3457, hostname: '127.0.0.1' });
    await api.start();
  });

  afterAll(async () => {
    await api.stop();
  });

  it('should create a task via API', async () => {
    const res = await httpPost(`${baseUrl}/task/create`, {
      agentId: 'agent-1',
      timestamp: Date.now(),
      title: 'API Task',
      description: 'Created via API',
      priority: 'high',
      tags: ['api'],
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('API Task');
  });

  it('should get all tasks', async () => {
    const res = await httpGet(`${baseUrl}/tasks`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should claim a task via API', async () => {
    const tasks = store.taskBoard.getAllTasks();
    const taskId = tasks[0].id;
    const res = await httpPost(`${baseUrl}/task/claim`, {
      agentId: 'agent-2',
      timestamp: Date.now(),
      taskId,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.claimedBy).toBe('agent-2');
  });

  it('should complete a task via API', async () => {
    const tasks = store.taskBoard.getTasksByAgent('agent-2');
    const taskId = tasks[0].id;
    const res = await httpPost(`${baseUrl}/task/complete`, {
      agentId: 'agent-2',
      timestamp: Date.now(),
      taskId,
      result: 'Done via API',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('should contribute knowledge via API', async () => {
    const res = await httpPost(`${baseUrl}/knowledge/contribute`, {
      agentId: 'agent-1',
      timestamp: Date.now(),
      title: 'API Knowledge',
      content: 'Learned via the API',
      category: 'api-testing',
      tags: ['api', 'test'],
      confidence: 0.9,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should list knowledge entries', async () => {
    const res = await httpGet(`${baseUrl}/knowledge`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should record heartbeat via API', async () => {
    const res = await httpPost(`${baseUrl}/heartbeat`, {
      agentId: 'agent-1',
      agentName: 'API Agent',
      status: 'online',
      capabilities: ['testing', 'api'],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agentName).toBe('API Agent');
  });

  it('should get fleet members', async () => {
    const res = await httpGet(`${baseUrl}/fleet`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get fleet summary', async () => {
    const res = await httpGet(`${baseUrl}/fleet/summary`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAgents).toBeGreaterThanOrEqual(1);
  });

  it('should increment a metric via API', async () => {
    const res = await httpPost(`${baseUrl}/metrics/increment`, {
      agentId: 'agent-1',
      timestamp: Date.now(),
      name: 'api_requests',
      value: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get all metrics via API', async () => {
    const res = await httpGet(`${baseUrl}/metrics`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data['g:api_requests']).toBeDefined();
  });

  it('should set config via API', async () => {
    const res = await httpPost(`${baseUrl}/config/set`, {
      agentId: 'agent-1',
      timestamp: Date.now(),
      key: 'apiTestKey',
      value: 'apiTestValue',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get config value via API', async () => {
    const res = await httpGet(`${baseUrl}/config/apiTestKey`);
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe('apiTestValue');
  });

  it('should get all config via API', async () => {
    const res = await httpGet(`${baseUrl}/config`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should join membership via API', async () => {
    const res = await httpPost(`${baseUrl}/membership/join`, {
      agentId: 'agent-1',
      displayName: 'API Member',
      roles: ['tester'],
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should list membership via API', async () => {
    const res = await httpGet(`${baseUrl}/membership`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should export full state via API', async () => {
    const res = await httpGet(`${baseUrl}/export`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replicaId).toBe('agent-1');
    expect(res.body.data.exportedAt).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const res = await httpGet(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
  });
});
