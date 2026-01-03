/**
 * Development Server for Offline-Capable App
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve service worker
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// All routes return index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nOffline-Capable App running at http://localhost:${PORT}`);
  console.log('\nTo test offline mode:');
  console.log('1. Open DevTools (F12)');
  console.log('2. Go to Network tab');
  console.log('3. Check "Offline" throttling');
  console.log('4. Refresh the page - app still works!\n');
});
