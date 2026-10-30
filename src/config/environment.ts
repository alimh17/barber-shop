export type AppEnvironment = Record<string, string | undefined>;

const KAVENEGAR_TEMPLATE_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateEnvironment(config: AppEnvironment): AppEnvironment {
  const nodeEnv = config.NODE_ENV?.trim() || 'development';
  const provider =
    config.SMS_PROVIDER?.trim() ||
    (nodeEnv === 'development' || nodeEnv === 'test' ? 'mock' : undefined);

  if (provider !== 'mock' && provider !== 'kavenegar') {
    throw new Error('SMS_PROVIDER must be either mock or kavenegar');
  }

  if (provider === 'mock' && nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error('SMS_PROVIDER=mock is allowed only in development or test');
  }

  if (provider === 'kavenegar') {
    const apiKey = config.KAVENEGAR_API_KEY?.trim();
    const template = config.KAVENEGAR_VERIFY_TEMPLATE?.trim();
    if (!apiKey) {
      throw new Error(
        'KAVENEGAR_API_KEY is required for SMS_PROVIDER=kavenegar',
      );
    }
    if (!template || !KAVENEGAR_TEMPLATE_PATTERN.test(template)) {
      throw new Error(
        'KAVENEGAR_VERIFY_TEMPLATE must contain only letters, numbers, underscores, or hyphens',
      );
    }
  }

  if (nodeEnv === 'production') {
    const encryptionKey = config.SMS_CREDENTIALS_ENCRYPTION_KEY?.trim();
    if (!encryptionKey || Buffer.from(encryptionKey, 'base64').length !== 32) {
      throw new Error(
        'SMS_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key in production',
      );
    }
  }

  const vapidSubject = config.VAPID_SUBJECT?.trim();
  const vapidPublicKey = config.VAPID_PUBLIC_KEY?.trim();
  const vapidPrivateKey = config.VAPID_PRIVATE_KEY?.trim();
  const vapidValues = [vapidSubject, vapidPublicKey, vapidPrivateKey];
  if (vapidValues.some(Boolean) && !vapidValues.every(Boolean)) {
    throw new Error(
      'VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must be configured together',
    );
  }
  if (
    vapidSubject &&
    !vapidSubject.startsWith('mailto:') &&
    !vapidSubject.startsWith('https://')
  ) {
    throw new Error('VAPID_SUBJECT must be a mailto: or https:// URI');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    SMS_PROVIDER: provider,
  };
}
