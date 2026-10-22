CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE kiosk_session_status AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'OPEN',
    'COMPLETED',
    'INCOMPLETE_AUTO_VOIDED',
    'MANUAL_CREATED',
    'MANUAL_CORRECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE attendance_source AS ENUM (
    'STUDENT_QR',
    'TEACHER_MANUAL',
    'ADMIN_MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL UNIQUE,
  email CITEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID UNIQUE REFERENCES users_profiles(id),
  institutional_email CITEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID UNIQUE REFERENCES users_profiles(id),
  university_code TEXT NOT NULL UNIQUE,
  email CITEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  career_id UUID REFERENCES careers(id),
  practice_type_id UUID REFERENCES practice_types(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID REFERENCES users_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_academic_period_dates CHECK (end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_academic_period
ON academic_periods (is_active)
WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS teacher_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  student_id UUID NOT NULL REFERENCES students(id),
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, academic_period_id)
);

CREATE TABLE IF NOT EXISTS kiosks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosks(id),
  opened_by_user_id UUID NOT NULL REFERENCES users_profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status kiosk_session_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_kiosk_session_closed_after_opened CHECK (
    closed_at IS NULL OR closed_at >= opened_at
  )
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id),
  teacher_id UUID REFERENCES teachers(id),
  kiosk_id UUID REFERENCES kiosks(id),
  entry_at TIMESTAMPTZ NOT NULL,
  exit_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status attendance_status NOT NULL DEFAULT 'OPEN',
  source attendance_source NOT NULL DEFAULT 'STUDENT_QR',
  manual_reason TEXT,
  created_by_user_id UUID REFERENCES users_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_attendance_exit_after_entry CHECK (
    exit_at IS NULL OR exit_at >= entry_at
  ),
  CONSTRAINT ck_attendance_duration_non_negative CHECK (
    duration_minutes IS NULL OR duration_minutes >= 0
  ),
  CONSTRAINT ck_manual_reason_required CHECK (
    source = 'STUDENT_QR'
    OR manual_reason IS NOT NULL AND length(trim(manual_reason)) > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_open_session_per_student
ON attendance_sessions(student_id)
WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS ix_attendance_period_date
ON attendance_sessions(academic_period_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS ix_attendance_teacher_date
ON attendance_sessions(teacher_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS ix_attendance_student_status
ON attendance_sessions(student_id, status);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_activity_description_not_empty CHECK (length(trim(description)) > 0)
);

CREATE TABLE IF NOT EXISTS qr_token_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_jti TEXT NOT NULL,
  kiosk_id UUID NOT NULL REFERENCES kiosks(id),
  kiosk_session_id UUID NOT NULL REFERENCES kiosk_sessions(id),
  student_id UUID REFERENCES students(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action_result TEXT NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_jti, student_id, action_result)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users_profiles(id),
  actor_role user_role,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  source TEXT NOT NULL,
  reason TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_created_actor
ON audit_logs(created_at DESC, actor_user_id);

CREATE INDEX IF NOT EXISTS ix_audit_entity
ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_profiles_updated_at ON users_profiles;
CREATE TRIGGER trg_users_profiles_updated_at
BEFORE UPDATE ON users_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_careers_updated_at ON careers;
CREATE TRIGGER trg_careers_updated_at
BEFORE UPDATE ON careers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_practice_types_updated_at ON practice_types;
CREATE TRIGGER trg_practice_types_updated_at
BEFORE UPDATE ON practice_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_teachers_updated_at ON teachers;
CREATE TRIGGER trg_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_academic_periods_updated_at ON academic_periods;
CREATE TRIGGER trg_academic_periods_updated_at
BEFORE UPDATE ON academic_periods
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_student_assignments_updated_at ON teacher_student_assignments;
CREATE TRIGGER trg_teacher_student_assignments_updated_at
BEFORE UPDATE ON teacher_student_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kiosks_updated_at ON kiosks;
CREATE TRIGGER trg_kiosks_updated_at
BEFORE UPDATE ON kiosks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kiosk_sessions_updated_at ON kiosk_sessions;
CREATE TRIGGER trg_kiosk_sessions_updated_at
BEFORE UPDATE ON kiosk_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_sessions_updated_at ON attendance_sessions;
CREATE TRIGGER trg_attendance_sessions_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
