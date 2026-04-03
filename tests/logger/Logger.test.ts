import { describe, it, expect, beforeAll } from '@jest/globals';
import { Logger } from '../../src/logger/Logger';

describe('Logger', () => {
  it('can create Logger without init (uses default)', () => {
    expect(() => new Logger('TestContext')).not.toThrow();
  });

  it('Logger.init() does not throw', () => {
    expect(() => Logger.init({ level: 'silent' })).not.toThrow();
  });

  it('Logger.init() with isDev=false does not throw', () => {
    expect(() => Logger.init({ isDev: false, level: 'silent' })).not.toThrow();
  });

  describe('logging methods', () => {
    beforeAll(() => Logger.init({ level: 'silent' }));

    it('info does not throw', () => {
      const logger = new Logger('Test');
      expect(() => logger.info('test message')).not.toThrow();
    });

    it('debug does not throw', () => {
      const logger = new Logger('Test');
      expect(() => logger.debug('test message')).not.toThrow();
    });

    it('warn does not throw', () => {
      const logger = new Logger('Test');
      expect(() => logger.warn('test message')).not.toThrow();
    });

    it('error does not throw', () => {
      const logger = new Logger('Test');
      expect(() => logger.error('test message')).not.toThrow();
    });

    it('info with data does not throw', () => {
      const logger = new Logger('Test');
      expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    });
  });
});
