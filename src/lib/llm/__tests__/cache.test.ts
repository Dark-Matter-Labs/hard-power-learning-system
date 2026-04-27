import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashRequest, isExpired } from '../cache';

describe('hashRequest', () => {
  it('returns a 64-character hex string', () => {
    const key = hashRequest('extraction', 'sys prompt', 'user message');
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[a-f0-9]+$/);
  });

  it('returns the same key for the same inputs', () => {
    const a = hashRequest('extraction', 'sys', 'msg');
    const b = hashRequest('extraction', 'sys', 'msg');
    expect(a).toBe(b);
  });

  it('returns different keys for different agents', () => {
    const a = hashRequest('extraction', 'sys', 'msg');
    const b = hashRequest('review', 'sys', 'msg');
    expect(a).not.toBe(b);
  });

  it('returns different keys for different messages', () => {
    const a = hashRequest('extraction', 'sys', 'msg1');
    const b = hashRequest('extraction', 'sys', 'msg2');
    expect(a).not.toBe(b);
  });
});

describe('isExpired', () => {
  it('returns false for null expiresAt (never expires)', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('returns true for past date', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('returns false for future date', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});
