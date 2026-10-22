INSERT INTO users_profiles (
  firebase_uid,
  email,
  role,
  first_name,
  last_name,
  active
)
VALUES
  ('dev-admin-001', 'admin@xrlab.test', 'ADMIN', 'Admin', 'XRLAB', TRUE),
  ('dev-teacher-001', 'docente@xrlab.test', 'TEACHER', 'Docente', 'XRLAB', TRUE),
  ('dev-student-001', 'estudiante@xrlab.test', 'STUDENT', 'Estudiante', 'XRLAB', TRUE)
ON CONFLICT (firebase_uid)
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO teachers (
  user_profile_id,
  institutional_email,
  first_name,
  last_name,
  active
)
SELECT
  id,
  email,
  first_name,
  last_name,
  TRUE
FROM users_profiles
WHERE firebase_uid = 'dev-teacher-001'
ON CONFLICT (institutional_email)
DO UPDATE SET
  user_profile_id = EXCLUDED.user_profile_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO students (
  user_profile_id,
  university_code,
  email,
  first_name,
  last_name,
  career_id,
  practice_type_id,
  active
)
SELECT
  profile.id,
  'EST-0001',
  profile.email,
  profile.first_name,
  profile.last_name,
  career.id,
  practice_type.id,
  TRUE
FROM users_profiles profile
CROSS JOIN LATERAL (
  SELECT id
  FROM careers
  WHERE name = 'Computación'
  LIMIT 1
) career
CROSS JOIN LATERAL (
  SELECT id
  FROM practice_types
  WHERE name = 'Práctica de laboratorio'
  LIMIT 1
) practice_type
WHERE profile.firebase_uid = 'dev-student-001'
ON CONFLICT (university_code)
DO UPDATE SET
  user_profile_id = EXCLUDED.user_profile_id,
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  career_id = EXCLUDED.career_id,
  practice_type_id = EXCLUDED.practice_type_id,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO teacher_student_assignments (
  teacher_id,
  student_id,
  academic_period_id,
  active
)
SELECT
  teacher.id,
  student.id,
  period.id,
  TRUE
FROM teachers teacher
JOIN students student
  ON student.university_code = 'EST-0001'
JOIN academic_periods period
  ON period.is_active = TRUE
WHERE teacher.institutional_email = 'docente@xrlab.test'
ON CONFLICT (teacher_id, student_id, academic_period_id)
DO UPDATE SET
  active = TRUE,
  updated_at = now();
