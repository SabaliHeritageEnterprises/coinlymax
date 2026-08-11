/**
 * Lightweight, dependency-free env validation run at boot.
 * Fails fast with a clear message if a required secret is missing in production.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';
  const required = ['DATABASE_URL'];
  const prodRequired = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

  const missing = [
    ...required,
    ...(isProd ? prodRequired : []),
  ].filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill them in.`,
    );
  }

  if (isProd) {
    for (const key of prodRequired) {
      const value = String(config[key] ?? '');
      if (value.length < 24) {
        throw new Error(`${key} is too short for production (min 24 chars). Generate with: openssl rand -base64 48`);
      }
    }
  }

  return config;
}
