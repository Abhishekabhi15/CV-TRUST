const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const { hashFile } = require('../utils/hash');

let mongoServer;
let tempDir;

function writeBmp(file, width, height, rgb) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const buffer = Buffer.alloc(size);
  buffer.write('BM', 0);
  buffer.writeUInt32LE(size, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = 54 + y * rowSize + x * 3;
      buffer[offset] = rgb[2];
      buffer[offset + 1] = rgb[1];
      buffer[offset + 2] = rgb[0];
    }
  }

  fs.writeFileSync(file, buffer);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvtrust-flow-'));
  await mongoose.connection.db.dropDatabase();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('CV-TRUST DB-backed prototype flow', () => {
  it('persists real dataset findings, model findings, reports, and audit logs', async () => {
    const datasetPath = path.join(tempDir, 'dataset');
    fs.mkdirSync(datasetPath);
    writeBmp(path.join(datasetPath, 'a.bmp'), 4, 4, [120, 120, 120]);
    fs.copyFileSync(path.join(datasetPath, 'a.bmp'), path.join(datasetPath, 'duplicate.bmp'));
    writeBmp(path.join(datasetPath, 'outlier.bmp'), 40, 40, [255, 255, 255]);

    const datasetResponse = await request(app)
      .post('/api/datasets/analyze')
      .send({ datasetPath });

    expect(datasetResponse.statusCode).toBe(200);
    expect(datasetResponse.body.data.datasetId).toBeTruthy();
    expect(datasetResponse.body.data.duplicateCount).toBe(1);
    expect(datasetResponse.body.data.suspiciousCount).toBe(1);

    const modelPath = path.join(tempDir, 'model.bin');
    fs.writeFileSync(modelPath, 'trusted model bytes');
    const currentHash = await hashFile(modelPath);
    const wrongHash = '0'.repeat(64);

    const modelResponse = await request(app)
      .post('/api/models/verify')
      .send({ modelPath, trustedHash: wrongHash, framework: 'YOLO' });

    expect(modelResponse.statusCode).toBe(200);
    expect(modelResponse.body.data.currentModelHash).toBe(currentHash);
    expect(modelResponse.body.data.status).toBe('SUSPICIOUS');

    const findingsResponse = await request(app).get('/api/findings');
    expect(findingsResponse.statusCode).toBe(200);
    expect(findingsResponse.body.data.length).toBeGreaterThanOrEqual(3);

    const reportResponse = await request(app).get('/api/reports/latest');
    expect(reportResponse.statusCode).toBe(200);
    expect(['REVIEW', 'QUARANTINE']).toContain(reportResponse.body.data.recommendation);
    expect(reportResponse.body.data.findings.length).toBeGreaterThanOrEqual(3);

    const auditResponse = await request(app).get('/api/audit-logs');
    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.body.data.length).toBeGreaterThanOrEqual(3);
    expect(auditResponse.body.data[0].eventHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
