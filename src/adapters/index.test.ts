import { describe, it, expect } from 'vitest';
import { isKnownAdapter } from './index.js';

describe('isKnownAdapter', () => {
  it('accepts currently-registered adapters', () => {
    for (const name of ['codex', 'codex-responses', 'gpt', 'local', 'lmstudio', 'openrouter']) {
      expect(isKnownAdapter(name)).toBe(true);
    }
  });

  it('rejects removed/unknown providers (e.g. a stale `claude` chat session)', () => {
    expect(isKnownAdapter('claude')).toBe(false);
    expect(isKnownAdapter('')).toBe(false);
    expect(isKnownAdapter('anthropic')).toBe(false);
    // must not be fooled by Object.prototype members
    expect(isKnownAdapter('toString')).toBe(false);
    expect(isKnownAdapter('constructor')).toBe(false);
  });
});
