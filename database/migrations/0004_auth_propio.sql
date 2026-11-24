-- Fase 2: autenticación propia (reemplaza a Firebase Auth).
-- firebase_uid se conserva hasta el final de la migración para poder volver atrás.

ALTER TABLE users_profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_token_purpose') THEN
    CREATE TYPE auth_token_purpose AS ENUM ('INVITE', 'RESET');
  END IF;
END $$;

-- Tokens de un solo uso para invitación y recuperación de contraseña. Solo se guarda el hash (sha256).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  purpose auth_token_purpose NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_profile_id, purpose);

-- Refresh tokens rotativos. family_id agrupa la cadena de rotaciones: si se reutiliza un token
-- ya rotado se revoca toda la familia.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_profile_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
