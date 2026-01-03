/**
 * Connection Pooling - Database and HTTP connection management
 *
 * Features:
 * - Database connection pooling
 * - HTTP connection pooling
 * - Automatic connection management
 * - Pool size optimization
 * - Connection health monitoring
 */

import { performance } from 'perf_hooks';

/**
 * Connection state
 */
export type ConnectionState = 'idle' | 'active' | 'closing' | 'closed';

/**
 * Pool statistics
 */
export interface PoolStatistics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  closedConnections: number;
  totalRequests: number;
  totalAcquisitionTime: number;
  averageAcquisitionTime: number;
  failedAcquisitions: number;
  waitForConnectionCount: number;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  minConnections?: number;
  maxConnections?: number;
  acquisitionTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  validationInterval?: number;
}

/**
 * Pool connection
 */
export interface PooledConnection<T> {
  connection: T;
  state: ConnectionState;
  acquiredAt: number;
  lastUsedAt: number;
  createdAt: number;
  validate?: () => Promise<boolean>;
}

/**
 * Generic connection pool
 */
export class ConnectionPool<T> {
  private config: Required<ConnectionPoolConfig>;
  private connections: PooledConnection<T>[] = [];
  private acquiring = 0;
  private stats: PoolStatistics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    closedConnections: 0,
    totalRequests: 0,
    totalAcquisitionTime: 0,
    averageAcquisitionTime: 0,
    failedAcquisitions: 0,
    waitForConnectionCount: 0,
  };
  private waitQueue: Array<(connection: PooledConnection<T>) => void> = [];
  private validationTimer?: NodeJS.Timeout;

  constructor(
    private connectionFactory: () => Promise<T>,
    private destroyFactory: (connection: T) => Promise<void>,
    config: ConnectionPoolConfig = {}
  ) {
    this.config = {
      minConnections: config.minConnections ?? 1,
      maxConnections: config.maxConnections ?? 10,
      acquisitionTimeout: config.acquisitionTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 60000,
      maxLifetime: config.maxLifetime ?? 1800000,
      validationInterval: config.validationInterval ?? 60000,
    };

    this.initializePool();
    this.startValidationTimer();
  }

  /**
   * Initialize pool with minimum connections
   */
  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection<T>> {
    const connection = await this.connectionFactory();
    const pooledConn: PooledConnection<T> = {
      connection,
      state: 'idle',
      acquiredAt: 0,
      lastUsedAt: Date.now(),
      createdAt: Date.now(),
    };

    this.connections.push(pooledConn);
    this.stats.totalConnections++;
    this.stats.idleConnections++;

    return pooledConn;
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(validate?: (conn: T) => Promise<boolean>): Promise<T> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    // Find idle connection
    let pooledConn = this.connections.find((c) => c.state === 'idle');

    if (!pooledConn) {
      // Check if we can create a new connection
      if (this.connections.length < this.config.maxConnections) {
        pooledConn = await this.createConnection();
      } else {
        // Wait for a connection to become available
        this.stats.waitForConnectionCount++;
        pooledConn = await this.waitForConnection();
      }
    }

    // Validate connection if needed
    if (validate && pooledConn.validate !== undefined) {
      const isValid = await pooledConn.validate();
      if (!isValid) {
        await this.removeConnection(pooledConn);
        return this.acquire(validate);
      }
    }

    // Check connection lifetime
    const age = Date.now() - pooledConn.createdAt;
    if (age > this.config.maxLifetime) {
      await this.removeConnection(pooledConn);
      return this.acquire(validate);
    }

    // Mark as active
    pooledConn.state = 'active';
    pooledConn.acquiredAt = Date.now();
    this.stats.activeConnections++;
    this.stats.idleConnections--;

    const acquisitionTime = performance.now() - startTime;
    this.stats.totalAcquisitionTime += acquisitionTime;
    this.stats.averageAcquisitionTime =
      this.stats.totalAcquisitionTime / this.stats.totalRequests;

    return pooledConn.connection;
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(): Promise<PooledConnection<T>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(handler);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        this.stats.failedAcquisitions++;
        reject(new Error('Connection acquisition timeout'));
      }, this.config.acquisitionTimeout);

      const handler = (connection: PooledConnection<T>) => {
        clearTimeout(timeout);
        resolve(connection);
      };

      this.waitQueue.push(handler);
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: T): Promise<void> {
    const pooledConn = this.connections.find((c) => c.connection === connection);
    if (!pooledConn || pooledConn.state !== 'active') {
      return;
    }

    pooledConn.state = 'idle';
    pooledConn.lastUsedAt = Date.now();
    this.stats.activeConnections--;
    this.stats.idleConnections++;

    // Notify waiting handlers
    if (this.waitQueue.length > 0) {
      const handler = this.waitQueue.shift();
      if (handler) {
        pooledConn.state = 'active';
        this.stats.idleConnections--;
        this.stats.activeConnections++;
        handler(pooledConn);
      }
    }
  }

  /**
   * Remove a connection from the pool
   */
  private async removeConnection(pooledConn: PooledConnection<T>): Promise<void> {
    const index = this.connections.indexOf(pooledConn);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    pooledConn.state = 'closing';
    await this.destroyFactory(pooledConn.connection);
    pooledConn.state = 'closed';

    this.stats.totalConnections--;
    this.stats.closedConnections++;

    if (pooledConn.state === 'idle') {
      this.stats.idleConnections--;
    } else if (pooledConn.state === 'active') {
      this.stats.activeConnections--;
    }
  }

  /**
   * Start validation timer
   */
  private startValidationTimer(): void {
    this.validationTimer = setInterval(async () => {
      await this.validateAndCleanup();
    }, this.config.validationInterval);

    this.validationTimer.unref();
  }

  /**
   * Validate and cleanup idle connections
   */
  private async validateAndCleanup(): Promise<void> {
    const now = Date.now();

    for (const pooledConn of this.connections) {
      // Remove idle connections past timeout
      if (
        pooledConn.state === 'idle' &&
        now - pooledConn.lastUsedAt > this.config.idleTimeout
      ) {
        await this.removeConnection(pooledConn);
        continue;
      }

      // Validate connection if validator exists
      if (pooledConn.validate && pooledConn.state === 'idle') {
        try {
          const isValid = await pooledConn.validate();
          if (!isValid) {
            await this.removeConnection(pooledConn);
          }
        } catch (error) {
          await this.removeConnection(pooledConn);
        }
      }
    }

    // Ensure minimum connections
    while (this.connections.length < this.config.minConnections) {
      try {
        await this.createConnection();
      } catch (error) {
        break;
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    return { ...this.stats };
  }

  /**
   * Get current pool size
   */
  size(): number {
    return this.connections.length;
  }

  /**
   * Get active connection count
   */
  activeCount(): number {
    return this.connections.filter((c) => c.state === 'active').length;
  }

  /**
   * Get idle connection count
   */
  idleCount(): number {
    return this.connections.filter((c) => c.state === 'idle').length;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    const closePromises = this.connections.map((conn) => this.removeConnection(conn));
    await Promise.all(closePromises);

    // Reject all waiting handlers
    for (const handler of this.waitQueue) {
      const error = new Error('Pool is closing');
      handler(error as any);
    }
    this.waitQueue = [];
  }
}

/**
 * HTTP connection pool
 */
export class HTTPConnectionPool extends ConnectionPool<Request> {
  constructor(config: ConnectionPoolConfig = {}) {
    super(
      async () => {
        return new Request('https://example.com');
      },
      async () => {
        // HTTP connections are managed by the runtime
      },
      {
        minConnections: config.minConnections ?? 5,
        maxConnections: config.maxConnections ?? 100,
        ...config,
      }
    );
  }
}

/**
 * Database connection pool (abstract base)
 */
export abstract class DatabaseConnectionPool<T> extends ConnectionPool<T> {
  constructor(
    connectionFactory: () => Promise<T>,
    destroyFactory: (connection: T) => Promise<void>,
    config: ConnectionPoolConfig = {}
  ) {
    super(connectionFactory, destroyFactory, {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 20,
      ...config,
    });
  }

  /**
   * Execute query with auto-acquire and release
   */
  async execute<R>(
    queryFn: (connection: T) => Promise<R>,
    validate?: (conn: T) => Promise<boolean>
  ): Promise<R> {
    const connection = await this.acquire(validate);

    try {
      return await queryFn(connection);
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Execute transaction
   */
  async transaction<R>(
    transactionFn: (connection: T) => Promise<R>,
    validate?: (conn: T) => Promise<boolean>
  ): Promise<R> {
    const connection = await this.acquire(validate);

    try {
      const result = await transactionFn(connection);
      return result;
    } catch (error) {
      throw error;
    } finally {
      await this.release(connection);
    }
  }
}

/**
 * Connection pooling pass
 */
export class ConnectionPoolingPass {
  private static pools: Map<string, ConnectionPool<any>> = new Map();

  /**
   * Create or get a connection pool
   */
  static getPool<T>(
    name: string,
    connectionFactory: () => Promise<T>,
    destroyFactory: (connection: T) => Promise<void>,
    config?: ConnectionPoolConfig
  ): ConnectionPool<T> {
    if (!this.pools.has(name)) {
      const pool = new ConnectionPool<T>(connectionFactory, destroyFactory, config);
      this.pools.set(name, pool);
    }
    return this.pools.get(name) as ConnectionPool<T>;
  }

  /**
   * Get all pool statistics
   */
  static getAllStatistics(): Map<string, PoolStatistics> {
    const stats = new Map<string, PoolStatistics>();
    for (const [name, pool] of this.pools.entries()) {
      stats.set(name, pool.getStatistics());
    }
    return stats;
  }

  /**
   * Generate pooling report
   */
  static generatePoolingReport(): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('CONNECTION POOLING REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    let totalConnections = 0;
    let totalActive = 0;
    let totalIdle = 0;
    let totalRequests = 0;
    let totalFailed = 0;

    for (const [name, pool] of this.pools.entries()) {
      const stats = pool.getStatistics();
      totalConnections += stats.totalConnections;
      totalActive += stats.activeConnections;
      totalIdle += stats.idleConnections;
      totalRequests += stats.totalRequests;
      totalFailed += stats.failedAcquisitions;

      lines.push(`Pool: ${name}`);
      lines.push(`  Total Connections: ${pool.size()}`);
      lines.push(`  Active: ${pool.activeCount()}`);
      lines.push(`  Idle: ${pool.idleCount()}`);
      lines.push(`  Total Requests: ${stats.totalRequests}`);
      lines.push(`  Average Acquisition Time: ${stats.averageAcquisitionTime.toFixed(2)}ms`);
      lines.push(`  Failed Acquisitions: ${stats.failedAcquisitions}`);
      lines.push(`  Waiting for Connection: ${stats.waitForConnectionCount}`);
      lines.push('');
    }

    lines.push('-'.repeat(80));
    lines.push('TOTALS:');
    lines.push(`  Total Connections: ${totalConnections}`);
    lines.push(`  Active: ${totalActive}`);
    lines.push(`  Idle: ${totalIdle}`);
    lines.push(`  Total Requests: ${totalRequests}`);
    lines.push(`  Failed Acquisitions: ${totalFailed}`);
    lines.push('');

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Close all pools
   */
  static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map((pool) => pool.close());
    await Promise.all(closePromises);
    this.pools.clear();
  }
}
