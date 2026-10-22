CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_kiosk_session_per_kiosk
ON kiosk_sessions(kiosk_id)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS ix_kiosk_sessions_status_opened
ON kiosk_sessions(status, opened_at DESC);

CREATE INDEX IF NOT EXISTS ix_qr_token_usages_token_jti
ON qr_token_usages(token_jti);

CREATE INDEX IF NOT EXISTS ix_qr_token_usages_kiosk_session
ON qr_token_usages(kiosk_session_id, used_at DESC);

CREATE INDEX IF NOT EXISTS ix_audit_action_created
ON audit_logs(action, created_at DESC);
