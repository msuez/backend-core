import { describe, it, expect } from '@jest/globals';
import { LockService } from '../../src/lock/LockService';

describe('LockService', () => {
  it('can be imported without errors', () => {
    expect(LockService).toBeDefined();
    expect(typeof LockService).toBe('function');
  });

  // Integration tests skipped — LockService requires a real Redis connection
  // via Redlock. Use Testcontainers for integration testing.
});
