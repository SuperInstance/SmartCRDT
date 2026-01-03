/**
 * @file serve.ts - Simple HTTP server for serving the demo HTML
 * @description Development server for testing the collaborative editor
 * @module collaboration/serve
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const HTML_FILE = path.join(__dirname, 'index.html');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Default to index.html
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = HTML_FILE;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found - serve index.html
        fs.readFile(HTML_FILE, (err, content) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     Collaboration Demo Server                              ║
╠════════════════════════════════════════════════════════════╣
║     HTTP: http://localhost:${PORT}                             ║
║     File: index.html                                         ║
║                                                              ║
║     Open multiple browser windows to:                        ║
║     http://localhost:${PORT}                                   ║
║                                                              ║
║     Make sure WebSocket server is running on port 8080       ║
║     Press Ctrl+C to stop                                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});
