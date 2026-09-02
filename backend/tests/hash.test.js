/**
 * Hash utility tests (pure unit — no I/O except temp file for hashFile).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashFile, hashObject, hashString } = require('../utils/hash');

describe('Hash Utilities', () => {
  describe('hashString', () => {
    it('should return a 64-char lowercase hex string', () => {
      const h = hashString('hello world');
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      expect(hashString('abc')).toBe(hashString('abc'));
    });

    it('should produce different hashes for different inputs', () => {
      expect(hashString('abc')).not.toBe(hashString('xyz'));
    });
  });

  describe('hashObject', () => {
    it('should return a 64-char lowercase hex string', () => {
      const h = hashObject({ a: 1, b: 2 });
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be order-independent for top-level keys', () => {
      const h1 = hashObject({ a: 1, b: 2 });
      const h2 = hashObject({ b: 2, a: 1 });
      expect(h1).toBe(h2);
    });

    it('should detect value changes', () => {
      const h1 = hashObject({ label: 'car', confidence: 0.9 });
      const h2 = hashObject({ label: 'car', confidence: 0.99 });
      expect(h1).not.toBe(h2);
    });
  });

  describe('hashFile', () => {
    it('should hash a file and return 64-char hex', async () => {
      const tmpFile = path.join(os.tmpdir(), 'test-hash.txt');
      fs.writeFileSync(tmpFile, 'cv-trust test content');
      const h = await hashFile(tmpFile);
      expect(h).toMatch(/^[a-f0-9]{64}$/);
      fs.unlinkSync(tmpFile);
    });

    it('should produce same hash for same content', async () => {
      const tmpFile = path.join(os.tmpdir(), 'test-hash2.txt');
      fs.writeFileSync(tmpFile, 'deterministic content');
      const h1 = await hashFile(tmpFile);
      const h2 = await hashFile(tmpFile);
      expect(h1).toBe(h2);
      fs.unlinkSync(tmpFile);
    });

    it('should reject with error for missing file', async () => {
      await expect(hashFile('/nonexistent/path/file.bin')).rejects.toThrow();
    });
  });
});
