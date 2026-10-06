import express from 'express';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_PORT = 5000;

let pyBackend: ChildProcess | null = null;

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function startBackendIfNeeded() {
  const inUse = await isPortInUse(BACKEND_PORT);
  if (inUse) {
    console.log(`[SERVER] Python backend already active on port ${BACKEND_PORT}. Reusing existing process.`);
    return;
  }

  console.log(`[SERVER] Spawning Python backend on port ${BACKEND_PORT}...`);
  pyBackend = spawn(
    'python3',
    ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
    {
      stdio: 'inherit',
      detached: false,
    }
  );

  pyBackend.on('error', (err) => {
    console.error('[SERVER] Failed to start Python backend:', err);
  });

  pyBackend.on('exit', (code, signal) => {
    console.log(`[SERVER] Python backend exited with code ${code}, signal ${signal}`);
    pyBackend = null;
  });
}

// Proxy API requests to FastAPI
app.use(
  '/api',
  createProxyMiddleware({
    target: `http://127.0.0.1:${BACKEND_PORT}`,
    changeOrigin: true,
  })
);

// Serve static frontend files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Clean child process exit handlers
function cleanupAndExit(signal: string) {
  console.log(`[SERVER] Received ${signal}. Shutting down cleanly...`);
  if (pyBackend && !pyBackend.killed) {
    try {
      pyBackend.kill('SIGTERM');
      setTimeout(() => {
        if (pyBackend && !pyBackend.killed) {
          pyBackend.kill('SIGKILL');
        }
        process.exit(0);
      }, 1000);
      return;
    } catch {
      // process already dead
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => cleanupAndExit('SIGINT'));
process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
process.on('exit', () => {
  if (pyBackend && !pyBackend.killed) {
    try {
      pyBackend.kill('SIGTERM');
    } catch {}
  }
});

startBackendIfNeeded().then(() => {
  app.listen(PORT, () => {
    console.log(`[SERVER] NellSpotif Music App listening on port ${PORT}`);
  });
});
