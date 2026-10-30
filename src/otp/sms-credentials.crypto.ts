import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedSecret {
  encrypted: string;
  iv: string;
  authTag: string;
}

function parseKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'SMS_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  }
  return key;
}

export function encryptSmsSecret(
  secret: string,
  keyValue: string,
): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', parseKey(keyValue), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSmsSecret(
  secret: EncryptedSecret,
  keyValue: string,
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    parseKey(keyValue),
    Buffer.from(secret.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
