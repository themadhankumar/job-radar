-- Fixed-window rate limiting for auth endpoints (serverless-safe: state in pg).
CREATE TABLE IF NOT EXISTS auth_attempts (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
