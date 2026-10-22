DELETE FROM qr_token_usages
WHERE student_id IN (
  SELECT id
  FROM students
  WHERE email = 'estudiante@xrlab.test'
);

DELETE FROM activities
WHERE attendance_session_id IN (
  SELECT attendance.id
  FROM attendance_sessions attendance
  JOIN students student ON student.id = attendance.student_id
  WHERE student.email = 'estudiante@xrlab.test'
);

DELETE FROM attendance_sessions
WHERE student_id IN (
  SELECT id
  FROM students
  WHERE email = 'estudiante@xrlab.test'
);

UPDATE kiosk_sessions
SET
  status = 'CLOSED',
  closed_at = COALESCE(closed_at, now()),
  updated_at = now()
WHERE status = 'ACTIVE'
  AND kiosk_id IN (
    SELECT id
    FROM kiosks
    WHERE code = 'XR-KIOSK-01'
  );
