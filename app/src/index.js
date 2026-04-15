/**
 * Production Node.js Application
 * 
 * This is a simple HTTP server that demonstrates:
 * - Health check endpoint (used by ALB to determine instance health)
 * - Graceful shutdown (critical for zero-downtime Blue/Green deployments)
 * - Structured JSON logging (parseable by CloudWatch Insights)
 * - Environment-aware responses (shows which deployment is active)
 */

const http = require('http');
const os   = require('os');
const fs   = require('fs');

// ── Configuration ──────────────────────────────────────────────────────────
// These values are injected by the deployment process via /app/.env
// In production, never hardcode these — read from environment or config files
const PORT        = parseInt(process.env.PORT || '3000', 10);
const VERSION     = process.env.APP_VERSION  || '0.0.0';
const ENVIRONMENT = process.env.ENVIRONMENT  || 'unknown';
const NODE_ENV    = process.env.NODE_ENV     || 'development';

// ── Structured Logging ─────────────────────────────────────────────────────
// Always log as JSON in production. CloudWatch Logs Insights can query JSON.
function log(level, message, extra = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    instanceId: os.hostname(),
    version: VERSION,
    environment: ENVIRONMENT,
    pid: process.pid,
    ...extra
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /health
 * 
 * Critical endpoint — the ALB calls this every 30 seconds.
 * Rules:
 * - MUST return HTTP 200 when the app is working correctly
 * - MUST return non-200 when the app is broken (so ALB routes away)
 * - MUST respond within 5 seconds (our ALB health check timeout)
 * - Keep it lightweight — no database calls, no external API calls
 */
function handleHealth(req, res) {
  const responseBody = JSON.stringify({
    status:      'healthy',
    version:     VERSION,
    environment: ENVIRONMENT,
    instanceId:  os.hostname(),
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
    nodeVersion: process.version
  });

  res.writeHead(200, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(responseBody),
    'Cache-Control':  'no-cache'  // Health checks must not be cached
  });
  res.end(responseBody);
}

/**
 * GET /
 * Main application endpoint
 */
function handleRoot(req, res) {
  const responseBody = JSON.stringify({
    message:     `Hello from the ${ENVIRONMENT} environment!`,
    version:     VERSION,
    instanceId:  os.hostname(),
    environment: ENVIRONMENT,
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString()
  });

  res.writeHead(200, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(responseBody)
  });
  res.end(responseBody);
}

/**
 * GET /version
 * Returns just the version — useful for deployment verification scripts
 */
function handleVersion(req, res) {
  const responseBody = JSON.stringify({ version: VERSION });
  res.writeHead(200, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(responseBody)
  });
  res.end(responseBody);
}

// Catch-all 404
function handleNotFound(req, res) {
  const responseBody = JSON.stringify({ error: 'Not Found', path: req.url });
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(responseBody);
}

// ── Router ─────────────────────────────────────────────────────────────────
const routes = {
  'GET /health':  handleHealth,
  'GET /version': handleVersion,
  'GET /':        handleRoot,
};

// ── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const key     = `${req.method} ${req.url}`;
  const handler = routes[key] || handleNotFound;

  const start = Date.now();
  res.on('finish', () => {
    log('info', 'Request handled', {
      method:       req.method,
      path:         req.url,
      status:       res.statusCode,
      durationMs:   Date.now() - start,
      userAgent:    req.headers['user-agent'] || 'unknown'
    });
  });

  try {
    handler(req, res);
  } catch (err) {
    log('error', 'Unhandled error in request handler', { error: err.message, stack: err.stack });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  log('info', 'Server started', { port: PORT, env: NODE_ENV });
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
/**
 * SIGTERM is sent by:
 * - systemd when stopping the service during deployment
 * - CodeDeploy during the BeforeInstall hook on Blue instances
 * - Kubernetes (if you ever migrate) during pod termination
 * 
 * Graceful shutdown = stop accepting NEW connections, but finish all
 * in-flight requests before exiting. This prevents 502 errors during deploys.
 */
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('info', `${signal} received — starting graceful shutdown`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      log('error', 'Error during server close', { error: err.message });
      process.exit(1);
    }
    log('info', 'All connections closed — process exiting cleanly');
    process.exit(0);
  });

  // Safety net: if we haven't cleanly shut down in 30 seconds, force exit
  setTimeout(() => {
    log('error', 'Graceful shutdown timeout — forcing exit');
    process.exit(1);
  }, 30_000).unref(); // .unref() prevents this timer from keeping the process alive
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Log unhandled errors instead of crashing silently
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});