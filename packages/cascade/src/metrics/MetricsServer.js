/**
 * MetricsServer - HTTP and WebSocket server for metrics
 *
 * Provides:
 * - REST API for metrics queries
 * - WebSocket for real-time streaming
 * - Web dashboard hosting
 * - Prometheus export endpoint
 *
 * Example:
 * ```ts
 * const server = new MetricsServer(collector, { port: 3000 });
 * await server.start();
 * // Access dashboard at http://localhost:3000/metrics
 * ```
 */
import { createServer } from "http";
import { URL } from "url";
/**
 * MetricsServer - HTTP/WebSocket server
 */
export class MetricsServer {
    collector;
    config;
    server = null;
    wsClients = new Set();
    broadcastInterval = null;
    constructor(collector, config = {}) {
        this.collector = collector;
        this.config = {
            ...collector.getSnapshot(), // Get existing config
            server: config.server || { enabled: true, port: 3000, host: "0.0.0.0" },
            dashboard: config.dashboard || {
                enabled: true,
                path: "/metrics",
                updateInterval: 1000,
            },
        };
    }
    /**
     * Start the server
     */
    async start() {
        if (this.server) {
            throw new Error("Server already running");
        }
        const { port, host } = this.config.server;
        this.server = createServer((req, res) => this.handleRequest(req, res));
        // Handle WebSocket upgrade
        this.server.on("upgrade", (req, socket, head) => {
            this.handleWebSocketUpgrade(req, socket, head);
        });
        await new Promise((resolve, reject) => {
            this.server.listen(port, host, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        // Start broadcasting metrics
        const updateInterval = this.config.dashboard?.updateInterval || 1000;
        this.broadcastInterval = setInterval(() => {
            this.broadcastMetrics();
        }, updateInterval);
        console.log(`Metrics server listening on http://${host}:${port}`);
        console.log(`Dashboard available at http://${host}:${port}${this.config.dashboard?.path || "/metrics"}`);
    }
    /**
     * Stop the server
     */
    async stop() {
        if (!this.server)
            return;
        // Stop broadcasting
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        // Close all WebSocket connections
        for (const client of this.wsClients) {
            try {
                client.socket.end();
            }
            catch {
                // Ignore errors during shutdown
            }
        }
        this.wsClients.clear();
        // Close server
        await new Promise(resolve => {
            this.server.close(() => resolve());
        });
        this.server = null;
        console.log("Metrics server stopped");
    }
    /**
     * Handle HTTP request
     */
    async handleRequest(req, res) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const pathname = url.pathname;
        // CORS headers
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };
        if (req.method === "OPTIONS") {
            res.writeHead(200, headers);
            res.end();
            return;
        }
        try {
            // Route handlers
            if (pathname === "/metrics" || pathname === "/metrics/") {
                await this.serveDashboard(req, res);
            }
            else if (pathname === "/api/metrics") {
                await this.serveMetrics(req, res);
            }
            else if (pathname === "/api/metrics/requests") {
                await this.serveRequestMetrics(req, res);
            }
            else if (pathname === "/api/metrics/latency") {
                await this.serveLatencyMetrics(req, res);
            }
            else if (pathname === "/api/metrics/cache") {
                await this.serveCacheMetrics(req, res);
            }
            else if (pathname === "/api/metrics/cost") {
                await this.serveCostMetrics(req, res);
            }
            else if (pathname === "/api/metrics/health") {
                await this.serveHealthMetrics(req, res);
            }
            else if (pathname === "/api/logs") {
                await this.serveLogs(req, res);
            }
            else if (pathname === "/api/errors") {
                await this.serveErrors(req, res);
            }
            else if (pathname === "/api/query") {
                await this.serveQuery(req, res);
            }
            else if (pathname === "/api/prometheus") {
                await this.servePrometheus(req, res);
            }
            else if (pathname === "/api/export") {
                await this.serveExport(req, res);
            }
            else if (pathname === "/health") {
                res.writeHead(200, { ...headers, "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
            }
            else {
                res.writeHead(404, { ...headers, "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Not found" }));
            }
        }
        catch (error) {
            res.writeHead(500, { ...headers, "Content-Type": "application/json" });
            res.end(JSON.stringify({
                error: "Internal server error",
                message: String(error),
            }));
        }
    }
    /**
     * Serve dashboard HTML
     */
    async serveDashboard(req, res) {
        const html = this.getDashboardHTML();
        res.writeHead(200, {
            "Content-Type": "text/html",
            "Cache-Control": "no-cache",
        });
        res.end(html);
    }
    /**
     * Serve all metrics
     */
    async serveMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "max-age=1",
        });
        res.end(JSON.stringify(snapshot, null, 2));
    }
    /**
     * Serve request metrics
     */
    async serveRequestMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot.requests, null, 2));
    }
    /**
     * Serve latency metrics
     */
    async serveLatencyMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot.latency, null, 2));
    }
    /**
     * Serve cache metrics
     */
    async serveCacheMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot.cache, null, 2));
    }
    /**
     * Serve cost metrics
     */
    async serveCostMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot.cost, null, 2));
    }
    /**
     * Serve health metrics
     */
    async serveHealthMetrics(req, res) {
        const snapshot = this.collector.getSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot.health, null, 2));
    }
    /**
     * Serve request logs
     */
    async serveLogs(req, res) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const limit = parseInt(url.searchParams.get("limit") || "100", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const logs = this.collector.getRequestLog({ limit, offset });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(logs, null, 2));
    }
    /**
     * Serve error logs
     */
    async serveErrors(req, res) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const limit = parseInt(url.searchParams.get("limit") || "100", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const errorType = url.searchParams.get("errorType") || undefined;
        const errors = this.collector.getErrorLog({ limit, offset, errorType });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errors, null, 2));
    }
    /**
     * Serve custom query
     */
    async serveQuery(req, res) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const start = parseInt(url.searchParams.get("start") || "0", 10);
        const end = parseInt(url.searchParams.get("end") || Date.now().toString(), 10);
        const window = url.searchParams.get("window");
        const aggregation = url.searchParams.get("aggregation");
        const metricName = url.searchParams.get("metric");
        if (!metricName) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing metric parameter" }));
            return;
        }
        // Parse labels
        const labels = {};
        for (const [key, value] of url.searchParams) {
            if (key.startsWith("label[")) {
                const labelKey = key.slice(6, -1);
                labels[labelKey] = value;
            }
        }
        // Query time series
        const timeSeries = this.collector.getTimeSeries(metricName, end - start);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(timeSeries, null, 2));
    }
    /**
     * Serve Prometheus export
     */
    async servePrometheus(req, res) {
        const prometheus = this.collector.exportPrometheus();
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(prometheus);
    }
    /**
     * Serve data export
     */
    async serveExport(req, res) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const format = url.searchParams.get("format") || "json";
        if (format === "prometheus") {
            const prometheus = this.collector.exportPrometheus();
            res.writeHead(200, {
                "Content-Type": "text/plain",
                "Content-Disposition": 'attachment; filename="metrics.txt"',
            });
            res.end(prometheus);
        }
        else if (format === "csv") {
            const snapshot = this.collector.getSnapshot();
            const csv = this.jsonToCsv(snapshot);
            res.writeHead(200, {
                "Content-Type": "text/csv",
                "Content-Disposition": 'attachment; filename="metrics.csv"',
            });
            res.end(csv);
        }
        else {
            const json = this.collector.exportJSON();
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Content-Disposition": 'attachment; filename="metrics.json"',
            });
            res.end(json);
        }
    }
    /**
     * Handle WebSocket upgrade
     */
    handleWebSocketUpgrade(req, socket, head) {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        if (url.pathname !== "/api/stream") {
            socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
            return;
        }
        // Simple WebSocket handshake (no frame parsing for simplicity)
        const key = req.headers["sec-websocket-key"];
        if (!key) {
            socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            return;
        }
        const acceptKey = this.generateWebSocketAccept(key);
        socket.write("HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);
        const connection = {
            socket,
            lastPing: Date.now(),
        };
        this.wsClients.add(connection);
        socket.on("close", () => {
            this.wsClients.delete(connection);
        });
        socket.on("error", () => {
            this.wsClients.delete(connection);
        });
        // Send initial snapshot
        this.sendToClient(connection, {
            type: "snapshot",
            data: this.collector.getSnapshot(),
        });
    }
    /**
     * Broadcast metrics to all WebSocket clients
     */
    broadcastMetrics() {
        const snapshot = this.collector.getSnapshot();
        const message = {
            type: "update",
            data: snapshot,
            timestamp: Date.now(),
        };
        for (const client of this.wsClients) {
            try {
                this.sendToClient(client, message);
            }
            catch {
                this.wsClients.delete(client);
            }
        }
    }
    /**
     * Send message to a WebSocket client
     */
    sendToClient(client, message) {
        const data = JSON.stringify(message);
        const frame = this.createWebSocketFrame(data);
        client.socket.write(frame);
    }
    /**
     * Create WebSocket frame (simplified)
     */
    createWebSocketFrame(data) {
        const payload = Buffer.from(data);
        const frame = Buffer.allocUnsafe(2 + payload.length);
        frame[0] = 0x81; // FIN + text frame
        frame[1] = payload.length;
        payload.copy(frame, 2);
        return frame;
    }
    /**
     * Generate WebSocket accept key
     */
    generateWebSocketAccept(key) {
        const crypto = require("crypto");
        const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        const hash = crypto
            .createHash("sha1")
            .update(key + GUID)
            .digest("base64");
        return hash;
    }
    /**
     * Convert JSON to CSV
     */
    jsonToCsv(obj) {
        const lines = [];
        const flatten = (obj, prefix = "") => {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value)) {
                    Object.assign(result, flatten(value, newKey));
                }
                else {
                    result[newKey] = value;
                }
            }
            return result;
        };
        const flat = flatten(obj);
        lines.push(Object.keys(flat).join(","));
        lines.push(Object.values(flat)
            .map(v => `"${v}"`)
            .join(","));
        return lines.join("\n");
    }
    /**
     * Get dashboard HTML
     */
    getDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aequor Metrics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #94a3b8;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
      padding: 2rem;
    }
    .metric-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1.5rem;
      transition: all 0.2s;
    }
    .card:hover {
      border-color: #60a5fa;
      transform: translateY(-2px);
    }
    .card-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .card-value {
      font-size: 2rem;
      font-weight: 700;
      color: #f1f5f9;
    }
    .card-unit {
      font-size: 1rem;
      color: #94a3b8;
      font-weight: 400;
    }
    .card-delta {
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .card-delta.positive {
      color: #22c55e;
    }
    .card-delta.negative {
      color: #ef4444;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .chart-container {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .chart-title {
      font-size: 1rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 1rem;
    }
    .chart-wrapper {
      position: relative;
      height: 300px;
    }
    .logs-section {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 1rem;
    }
    .log-table {
      width: 100%;
      border-collapse: collapse;
    }
    .log-table th,
    .log-table td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #334155;
    }
    .log-table th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
    }
    .log-table td {
      font-size: 0.875rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-success {
      background: #166534;
      color: #86efac;
    }
    .badge-error {
      background: #991b1b;
      color: #fca5a5;
    }
    .badge-local {
      background: #1e3a5f;
      color: #93c5fd;
    }
    .badge-cloud {
      background: #581c87;
      color: #d8b4fe;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Aequor Metrics Dashboard</h1>
    <div class="status">
      <div class="status-dot"></div>
      <span>Live</span>
    </div>
  </div>

  <div class="container">
    <div class="metric-cards">
      <div class="card">
        <div class="card-label">Total Requests</div>
        <div class="card-value" id="total-requests">0</div>
        <div class="card-delta">
          <span id="rpm">0</span> requests/min
        </div>
      </div>
      <div class="card">
        <div class="card-label">Error Rate</div>
        <div class="card-value" id="error-rate">0<span class="card-unit">%</span></div>
        <div class="card-delta" id="error-count">0 errors</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Latency</div>
        <div class="card-value" id="avg-latency">0<span class="card-unit">ms</span></div>
        <div class="card-delta">
          P95: <span id="p95-latency">0</span>ms
        </div>
      </div>
      <div class="card">
        <div class="card-label">Cache Hit Rate</div>
        <div class="card-value" id="hit-rate">0<span class="card-unit">%</span></div>
        <div class="card-delta">
          <span id="cache-size">0</span> entries
        </div>
      </div>
      <div class="card">
        <div class="card-label">Total Cost</div>
        <div class="card-value" id="total-cost">$0.00</div>
        <div class="card-delta">
          Est. monthly: $<span id="monthly-cost">0</span>
        </div>
      </div>
    </div>

    <div class="charts">
      <div class="chart-container">
        <div class="chart-title">Latency Over Time</div>
        <div class="chart-wrapper">
          <canvas id="latencyChart"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Request Rate</div>
        <div class="chart-wrapper">
          <canvas id="requestChart"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Backend Distribution</div>
        <div class="chart-wrapper">
          <canvas id="backendChart"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Cost by Backend</div>
        <div class="chart-wrapper">
          <canvas id="costChart"></canvas>
        </div>
      </div>
    </div>

    <div class="logs-section">
      <div class="section-title">Recent Requests</div>
      <table class="log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Backend</th>
            <th>Model</th>
            <th>Latency</th>
            <th>Cost</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="request-log">
        </tbody>
      </table>
    </div>
  </div>

  <script>
    // Chart.js default styles
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    // Charts
    let latencyChart, requestChart, backendChart, costChart;
    let latencyData = [];
    let requestData = [];
    const maxDataPoints = 60;

    function initCharts() {
      // Latency chart
      latencyChart = new Chart(document.getElementById('latencyChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { label: 'P50', data: [], borderColor: '#60a5fa', tension: 0.4 },
            { label: 'P95', data: [], borderColor: '#a78bfa', tension: 0.4 },
            { label: 'P99', data: [], borderColor: '#f472b6', tension: 0.4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // Request rate chart
      requestChart = new Chart(document.getElementById('requestChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Requests/min',
            data: [],
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // Backend distribution chart
      backendChart = new Chart(document.getElementById('backendChart'), {
        type: 'doughnut',
        data: {
          labels: ['Local', 'Cloud', 'Hybrid'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['#3b82f6', '#a855f7', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });

      // Cost chart
      costChart = new Chart(document.getElementById('costChart'), {
        type: 'doughnut',
        data: {
          labels: ['Local', 'Cloud', 'Hybrid'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['#3b82f6', '#a855f7', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    function updateDashboard(data) {
      // Update metric cards
      document.getElementById('total-requests').textContent = data.requests.total.toLocaleString();
      document.getElementById('error-rate').innerHTML = (data.requests.errorRate * 100).toFixed(1) + '<span class="card-unit">%</span>';
      document.getElementById('error-count').textContent = data.requests.errors.toLocaleString() + ' errors';
      document.getElementById('avg-latency').innerHTML = data.latency.avg.toFixed(0) + '<span class="card-unit">ms</span>';
      document.getElementById('p95-latency').textContent = data.latency.p95.toFixed(0);
      document.getElementById('hit-rate').innerHTML = (data.cache.hitRate * 100).toFixed(0) + '<span class="card-unit">%</span>';
      document.getElementById('cache-size').textContent = data.cache.size.toLocaleString() + ' entries';
      document.getElementById('total-cost').innerHTML = '$' + data.cost.total.toFixed(2);
      document.getElementById('monthly-cost').textContent = data.cost.estimatedMonthly.toFixed(2);
      document.getElementById('rpm').textContent = data.requests.rpm.toFixed(0);

      // Update charts
      const now = new Date().toLocaleTimeString();
      updateChartData(latencyChart, now, [data.latency.p50, data.latency.p95, data.latency.p99]);
      updateChartData(requestChart, now, [data.requests.rpm]);

      backendChart.data.datasets[0].data = [
        data.requests.byBackend.local,
        data.requests.byBackend.cloud,
        data.requests.byBackend.hybrid
      ];
      backendChart.update();

      costChart.data.datasets[0].data = [
        data.cost.byBackend.local,
        data.cost.byBackend.cloud,
        data.cost.byBackend.hybrid
      ];
      costChart.update();
    }

    function updateChartData(chart, label, data) {
      chart.data.labels.push(label);
      for (let i = 0; i < data.length; i++) {
        chart.data.datasets[i].data.push(data[i]);
      }
      if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift();
        for (let dataset of chart.data.datasets) {
          dataset.data.shift();
        }
      }
      chart.update('none');
    }

    function connectWebSocket() {
      const ws = new WebSocket('ws://' + location.host + '/api/stream');
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update' || msg.type === 'snapshot') {
          updateDashboard(msg.data);
        }
      };
      ws.onclose = () => {
        setTimeout(connectWebSocket, 5000);
      };
      ws.onerror = () => {
        setTimeout(connectWebSocket, 5000);
      };
    }

    // Initialize
    initCharts();
    connectWebSocket();
  </script>
</body>
</html>`;
    }
}
//# sourceMappingURL=MetricsServer.js.map