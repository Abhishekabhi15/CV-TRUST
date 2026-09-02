/**
 * Health endpoint tests.
 * Uses supertest against the Express app (no MongoDB needed for basic health).
 */
const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('should return 200 with success flag and data object', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('CV-TRUST backend is running');
    expect(['OK', 'PARTIAL', 'DEGRADED']).toContain(res.body.status);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.data.version).toBe('0.1.0');
    expect(res.body.data.services).toBeDefined();
    expect(res.body.data.services).toHaveProperty('mongodb');
    expect(res.body.data.services).toHaveProperty('pythonService');
  });

  it('should include a status field (ok | partial | degraded)', async () => {
    const res = await request(app).get('/api/health');
    expect(['OK', 'PARTIAL', 'DEGRADED']).toContain(res.body.data.status);
  });

  it('should include a timestamp in meta', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.timestamp).toBeDefined();
    expect(new Date(res.body.meta.timestamp).toISOString()).toBe(res.body.meta.timestamp);
  });
});

describe('404 — unknown routes', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
