DELETE FROM qr_token_usages
WHERE student_id IN (
  SELECT id FROM students WHERE email IN ('estudiante@xrlab.test', 'pc4.manual.student@xrlab.test')
);

DELETE FROM activities
WHERE attendance_session_id IN (
  SELECT attendance.id
  FROM attendance_sessions attendance
  JOIN students student ON student.id = attendance.student_id
  WHERE student.email IN ('estudiante@xrlab.test', 'pc4.manual.student@xrlab.test')
);

DELETE FROM attendance_sessions
WHERE student_id IN (
  SELECT id FROM students WHERE email IN ('estudiante@xrlab.test', 'pc4.manual.student@xrlab.test')
);

DELETE FROM audit_logs
WHERE request_id LIKE 'pc4-verify-%';

UPDATE kiosk_sessions
SET
  status = 'CLOSED',
  closed_at = COALESCE(closed_at, now()),
  updated_at = now()
WHERE status = 'ACTIVE'
  AND kiosk_id IN (SELECT id FROM kiosks WHERE code = 'XR-KIOSK-01');
