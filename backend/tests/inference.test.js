/**
 * Inference integrity tests — uses mongodb-memory-server.
 * Tests create → verify (VERIFIED) → tamper → verify (TAMPERING_DETECTED)
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const inferenceService = require('../services/inference.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.collection('inferences').deleteMany({});
});

describe('Inference Integrity', () => {
  const samplePayload = {
    modelId: 'yolov8n-v1',
    inputData: { imagePath: '/test/img.jpg', width: 640, height: 640 },
    outputData: { objects: [{ label: 'car', confidence: 0.95 }] },
    config: { threshold: 0.25 },
  };

  it('should create an inference record and return an integrityHash', async () => {
    const result = await inferenceService.createInference(samplePayload);

    expect(result.inferenceId).toBeDefined();
    expect(result.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should verify an unmodified record as VERIFIED', async () => {
    const created = await inferenceService.createInference(samplePayload);
    const verified = await inferenceService.verifyInference(String(created.inferenceId));

    expect(verified.status).toBe('VERIFIED');
    expect(verified.verified).toBe(true);
    expect(verified.storedHash).toBe(verified.currentHash);
    expect(verified.componentChecks.input.match).toBe(true);
    expect(verified.componentChecks.output.match).toBe(true);
  });

  it('should detect TAMPERING when outputData is modified in the database', async () => {
    const created = await inferenceService.createInference(samplePayload);
    const Inference = require('../models/Inference');

    // Simulate tampering — directly update outputData in the database using $set
    await Inference.collection.updateOne(
      { _id: created.inferenceId },
      { $set: { outputData: { objects: [{ label: 'truck', confidence: 0.99 }] } } }
    );

    const verified = await inferenceService.verifyInference(String(created.inferenceId));

    expect(verified.status).toBe('TAMPERING_DETECTED');
    expect(verified.verified).toBe(false);
    expect(verified.storedHash).not.toBe(verified.currentHash);
    expect(verified.componentChecks.output.match).toBe(false);
  });

  it('should throw 404 for a non-existent inference ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await expect(inferenceService.verifyInference(String(fakeId))).rejects.toMatchObject({
      statusCode: 404,
      code: 'INFERENCE_NOT_FOUND',
    });
  });
});
