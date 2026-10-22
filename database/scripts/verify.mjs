import 'dotenv/config';
import { Client } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en database/.env');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `);

  const activePeriod = await client.query(`
    select id, name, start_date, end_date, is_active
    from academic_periods
    order by created_at desc
    limit 5;
  `);

  const profiles = await client.query(`
    select firebase_uid, email, role, active, last_login_at
    from users_profiles
    order by role, email;
  `);

  const assignments = await client.query(`
    select
      teacher.institutional_email as teacher_email,
      student.email as student_email,
      period.name as academic_period,
      assignment.active
    from teacher_student_assignments assignment
    join teachers teacher on teacher.id = assignment.teacher_id
    join students student on student.id = assignment.student_id
    join academic_periods period on period.id = assignment.academic_period_id
    order by teacher.institutional_email, student.email;
  `);

  const attendance = await client.query(`
    select
      attendance.id,
      student.email as student_email,
      attendance.entry_at,
      attendance.exit_at,
      attendance.duration_minutes,
      attendance.status,
      attendance.source
    from attendance_sessions attendance
    join students student on student.id = attendance.student_id
    order by attendance.created_at desc
    limit 10;
  `);

  const activities = await client.query(`
    select
      activity.attendance_session_id,
      activity.description,
      activity.created_at
    from activities activity
    order by activity.created_at desc
    limit 10;
  `);

  const qrUsages = await client.query(`
    select
      token_jti,
      action_result,
      used_at,
      request_id
    from qr_token_usages
    order by used_at desc
    limit 10;
  `);

  const auditLogs = await client.query(`
    select
      action,
      entity_type,
      source,
      created_at,
      request_id
    from audit_logs
    order by created_at desc
    limit 20;
  `);

  console.log('\nTablas creadas:');
  console.table(tables.rows);

  console.log('\nPeriodos académicos:');
  console.table(activePeriod.rows);

  console.log('\nPerfiles:');
  console.table(profiles.rows);

  console.log('\nAsignaciones docente-estudiante:');
  console.table(assignments.rows);

  console.log('\nAsistencias recientes:');
  console.table(attendance.rows);

  console.log('\nActividades recientes:');
  console.table(activities.rows);

  console.log('\nUsos QR recientes:');
  console.table(qrUsages.rows);

  console.log('\nAuditoría reciente:');
  console.table(auditLogs.rows);
} catch (error) {
  console.error('ERROR verificando base de datos');
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
