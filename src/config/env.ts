function getEnv(key: string, fallback = ''): string {
  return (import.meta.env[key] as string | undefined) ?? fallback;
}

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

export const GEMINI_PROXY_URL = getEnv('VITE_GEMINI_PROXY_URL', '/functions/v1/gemini-proxy');
export const SETU_ENV = getEnv('VITE_SETU_ENV', 'sandbox');
export const SETU_CLIENT_ID = getEnv('VITE_SETU_CLIENT_ID');
export const SETU_SECRET = getEnv('VITE_SETU_SECRET');
export const SETU_WEBHOOK_URL = getEnv('VITE_SETU_WEBHOOK_URL');
export const SENTRY_DSN = getEnv('VITE_SENTRY_DSN');
export const DEMO_MODE = getEnv('VITE_DEMO_MODE') === 'true';
export const VAPID_PUBLIC_KEY = getEnv('VITE_VAPID_PUBLIC_KEY');
export const PLAID_CLIENT_ID = getEnv('VITE_PLAID_CLIENT_ID');
export const LOG_LEVEL = getEnv('VITE_LOG_LEVEL', 'INFO');
export const APP_VERSION = getEnv('VITE_APP_VERSION', '0.0.0');
export const RAZORPAY_PROXY_URL = getEnv('VITE_RAZORPAY_PROXY_URL', '/functions/v1/razorpay-proxy');
export const RESEND_API_KEY = getEnv('RESEND_API_KEY');
// Server-only: no VITE_ prefix so it is not bundled into the client
export const EXCHANGE_RATE_API_KEY = getEnv('EXCHANGE_RATE_API_KEY');

export function validateEnv(): string[] {
  const errors: string[] = [];
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
  for (const key of required) {
    if (!import.meta.env[key]) {
      errors.push(`Missing required env: ${key}`);
    }
  }
  return errors;
}
