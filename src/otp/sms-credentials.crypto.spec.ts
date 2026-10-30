import { describe, expect, it } from 'vitest';
import {
  decryptSmsSecret,
  encryptSmsSecret,
} from './sms-credentials.crypto.js';

describe('SMS credential encryption', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('round-trips an API key without storing plaintext', () => {
    const encrypted = encryptSmsSecret('tenant-api-key', key);
    expect(encrypted.encrypted).not.toContain('tenant-api-key');
    expect(decryptSmsSecret(encrypted, key)).toBe('tenant-api-key');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSmsSecret('tenant-api-key', key);
    encrypted.encrypted = Buffer.from('tampered').toString('base64');
    expect(() => decryptSmsSecret(encrypted, key)).toThrow();
  });
});
