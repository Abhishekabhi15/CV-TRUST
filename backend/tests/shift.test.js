/**
 * Distribution shift analysis tests (pure unit — no DB required).
 */
const { analyzeShift } = require('../services/shift.service');

describe('Shift Service', () => {
  it('should return NORMAL for identical distributions', () => {
    const ref = { brightness: 120, contrast: 60, saturation: 80 };
    const result = analyzeShift(ref, { ...ref });

    expect(result.status).toBe('NORMAL');
    expect(result.shiftScore).toBe(0);
    expect(result.shiftDetected).toBe(false);
  });

  it('should return MODERATE for moderate deviation', () => {
    const ref = { brightness: 100, contrast: 50 };
    const inc = { brightness: 120, contrast: 60 }; // 20% and 20% change
    const result = analyzeShift(ref, inc);

    expect(result.status).toBe('MODERATE');
    expect(result.shiftDetected).toBe(true);
  });

  it('should return HIGH for large deviation', () => {
    const ref = { brightness: 100 };
    const inc = { brightness: 250 }; // 150% change
    const result = analyzeShift(ref, inc);

    expect(result.status).toBe('HIGH');
    expect(result.shiftScore).toBeGreaterThanOrEqual(0.3);
  });

  it('should only compare requested metrics when provided', () => {
    const ref = { brightness: 100, contrast: 200 };
    const inc = { brightness: 200, contrast: 200 }; // only brightness changed
    const result = analyzeShift(ref, inc, ['contrast']); // only compare contrast

    expect(result.status).toBe('NORMAL'); // contrast unchanged
    expect(result.details.keysCompared).toBe(1);
  });

  it('should handle no shared numeric keys gracefully', () => {
    const result = analyzeShift({ a: 'text' }, { b: 'other' });
    expect(result.shiftScore).toBe(0);
    expect(result.status).toBe('NORMAL');
  });
});
