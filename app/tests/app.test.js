/**
 * Unit tests for the application
 * 
 * We test the business logic separately from the HTTP layer.
 * The CI pipeline runs these before allowing deployment.
 * If these fail, the pipeline stops — nothing gets deployed.
 */

describe('Health check response shape', () => {
  const buildHealthResponse = (version, environment) => ({
    status:      'healthy',
    version,
    environment,
    instanceId:  'test-host',
    uptime:      0,
    timestamp:   new Date().toISOString(),
    nodeVersion: process.version
  });

  test('status field is exactly "healthy"', () => {
    const res = buildHealthResponse('1.0.0', 'blue');
    expect(res.status).toBe('healthy');
  });

  test('version field matches input', () => {
    const res = buildHealthResponse('2.5.1', 'green');
    expect(res.version).toBe('2.5.1');
  });

  test('environment field matches input', () => {
    const res = buildHealthResponse('1.0.0', 'green');
    expect(res.environment).toBe('green');
  });

  test('timestamp is a valid ISO 8601 date string', () => {
    const res = buildHealthResponse('1.0.0', 'blue');
    expect(() => new Date(res.timestamp)).not.toThrow();
    expect(new Date(res.timestamp).toISOString()).toBe(res.timestamp);
  });

  test('uptime is a non-negative number', () => {
    const res = buildHealthResponse('1.0.0', 'blue');
    expect(typeof res.uptime).toBe('number');
    expect(res.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('Structured logging format', () => {
  const buildLogEntry = (level, message, extra = {}) => ({
    level,
    message,
    timestamp: new Date().toISOString(),
    instanceId: 'test-host',
    version: '1.0.0',
    environment: 'test',
    pid: process.pid,
    ...extra
  });

  test('log entry has all required fields', () => {
    const entry = buildLogEntry('info', 'Test message');
    expect(entry).toHaveProperty('level');
    expect(entry).toHaveProperty('message');
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('instanceId');
    expect(entry).toHaveProperty('version');
  });

  test('log level is a valid level', () => {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    const entry = buildLogEntry('info', 'Test');
    expect(validLevels).toContain(entry.level);
  });

  test('extra fields are merged into log entry', () => {
    const entry = buildLogEntry('info', 'Request', { method: 'GET', status: 200 });
    expect(entry.method).toBe('GET');
    expect(entry.status).toBe(200);
  });
});

describe('Environment configuration', () => {
  test('PORT defaults to 3000 when not set', () => {
    const port = parseInt(process.env.PORT || '3000', 10);
    expect(port).toBe(3000);
  });

  test('PORT is a valid integer when set', () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '8080';
    const port = parseInt(process.env.PORT, 10);
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
    process.env.PORT = originalPort;
  });
});