import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Start Python FastAPI backend if not running
console.log('[SERVER] Starting Python backend on port 5000...');
const pyBackend = spawn('python3', ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '5000'], {
  stdio: 'inherit',
});

pyBackend.on('error', (err) => {
  console.error('[SERVER] Failed to start Python backend:', err);
});

// Proxy API requests to FastAPI
app.use(
  '/api',
  createProxyMiddleware({
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  })
);

// Serve static frontend files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[SERVER] NellSpotif Music App listening on port ${PORT}`);
});

process.on('SIGINT', () => {
  pyBackend.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  pyBackend.kill('SIGTERM');
  process.exit();
});
