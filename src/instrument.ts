import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV ?? 'development',
  // Capture all errors; sample 10% of transactions in prod, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Ignore 4xx — those are expected validation errors, not real failures
  ignoreErrors: [
    /Unauthorized/,
    /Forbidden/,
    /NotFound/,
    /BadRequest/,
  ],
});

if (dsn) {
  console.log(`🛰️  Sentry enabled (env=${process.env.NODE_ENV ?? 'development'})`);
} else {
  console.log('🛰️  Sentry disabled — SENTRY_DSN not set');
}