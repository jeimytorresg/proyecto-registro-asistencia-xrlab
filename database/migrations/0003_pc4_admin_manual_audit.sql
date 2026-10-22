CREATE INDEX IF NOT EXISTS ix_students_active_email
ON students(active, email);

CREATE INDEX IF NOT EXISTS ix_teachers_active_email
ON teachers(active, institutional_email);

CREATE INDEX IF NOT EXISTS ix_periods_active_dates
ON academic_periods(is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS ix_attendance_status_entry
ON attendance_sessions(status, entry_at DESC);

CREATE INDEX IF NOT EXISTS ix_attendance_source_entry
ON attendance_sessions(source, entry_at DESC);

CREATE INDEX IF NOT EXISTS ix_attendance_created_by
ON attendance_sessions(created_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_activities_session_created
ON activities(attendance_session_id, created_at);

CREATE INDEX IF NOT EXISTS ix_audit_source_created
ON audit_logs(source, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_audit_action_entity_created
ON audit_logs(action, entity_type, created_at DESC);
