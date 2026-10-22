import { db } from '../config/db.js';
import { ApiError } from '../http/api-error.js';
import type { AuthenticatedUser } from '../middleware/auth-middleware.js';

export interface AttendanceListFilters {
  periodId?: string;
  status?: string;
  source?: string;
  studentEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

export interface AdminAttendanceRow {
  id: string;
  studentEmail: string;
  studentName: string;
  teacherEmail: string | null;
  periodName: string;
  kioskCode: string | null;
  entryAt: string;
  exitAt: string | null;
  durationMinutes: number | null;
  status: string;
  source: string;
  activities: Array<{
    id: string;
    description: string;
  }>;
}

export interface AttendanceListResult {
  rows: AdminAttendanceRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardSummary {
  studentsInside: number;
  entriesToday: number;
  exitsToday: number;
  incompleteSessions: number;
  totalHoursCurrentPeriod: number;
  latestRows: AdminAttendanceRow[];
}

interface TeacherRow {
  id: string;
}

interface AttendanceQueryRow {
  id: string;
  student_email: string;
  student_name: string;
  teacher_email: string | null;
  period_name: string;
  kiosk_code: string | null;
  entry_at: Date;
  exit_at: Date | null;
  duration_minutes: number | null;
  status: string;
  source: string;
  activities: Array<{
    id: string;
    description: string;
  }>;
}

function mapAttendanceRow(row: AttendanceQueryRow): AdminAttendanceRow {
  return {
    id: row.id,
    studentEmail: row.student_email,
    studentName: row.student_name,
    teacherEmail: row.teacher_email,
    periodName: row.period_name,
    kioskCode: row.kiosk_code,
    entryAt: row.entry_at.toISOString(),
    exitAt: row.exit_at?.toISOString() ?? null,
    durationMinutes: row.duration_minutes,
    status: row.status,
    source: row.source,
    activities: Array.isArray(row.activities) ? row.activities : [],
  };
}

async function getTeacherIdForAuthUser(authUser: AuthenticatedUser): Promise<string | null> {
  if (authUser.role !== 'TEACHER') {
    return null;
  }

  const result = await db.query<TeacherRow>(
    `
      select id
      from teachers
      where user_profile_id = $1
        and active = true
      limit 1;
    `,
    [authUser.profile.id],
  );

  const teacher = result.rows[0];

  if (!teacher) {
    throw new ApiError(
      403,
      'ROLE_FORBIDDEN',
      'El docente no tiene un perfil activo asociado.',
    );
  }

  return teacher.id;
}

function buildAttendanceWhere(params: {
  filters: AttendanceListFilters;
  teacherId: string | null;
}): {
  whereSql: string;
  values: unknown[];
} {
  const values: unknown[] = [];
  const where: string[] = [];

  if (params.filters.periodId) {
    values.push(params.filters.periodId);
    where.push(`attendance.academic_period_id = $${values.length}`);
  } else {
    where.push('period.is_active = true');
  }

  if (params.teacherId) {
    values.push(params.teacherId);
    where.push(`attendance.teacher_id = $${values.length}`);
  }

  if (params.filters.status) {
    values.push(params.filters.status);
    where.push(`attendance.status = $${values.length}`);
  }

  if (params.filters.source) {
    values.push(params.filters.source);
    where.push(`attendance.source = $${values.length}`);
  }

  if (params.filters.studentEmail) {
    values.push(`%${params.filters.studentEmail}%`);
    where.push(`(
      student.email::text ilike $${values.length}
      or concat(student.first_name, ' ', student.last_name) ilike $${values.length}
      or student.university_code ilike $${values.length}
    )`);
  }

  if (params.filters.dateFrom) {
    values.push(params.filters.dateFrom);
    where.push(`(attendance.entry_at at time zone 'America/Guayaquil')::date >= $${values.length}::date`);
  }

  if (params.filters.dateTo) {
    values.push(params.filters.dateTo);
    where.push(`(attendance.entry_at at time zone 'America/Guayaquil')::date <= $${values.length}::date`);
  }

  return {
    whereSql: where.length ? `where ${where.join('\n  and ')}` : '',
    values,
  };
}

export async function getAdminAttendanceList(params: {
  authUser: AuthenticatedUser;
  filters: AttendanceListFilters;
}): Promise<AttendanceListResult> {
  const teacherId = await getTeacherIdForAuthUser(params.authUser);

  const limit = Math.min(Math.max(params.filters.limit, 1), 100);
  const offset = Math.max(params.filters.offset, 0);

  const { whereSql, values } = buildAttendanceWhere({
    filters: {
      ...params.filters,
      limit,
      offset,
    },
    teacherId,
  });

  const countResult = await db.query<{ total: string }>(
    `
      select count(*)::text as total
      from attendance_sessions attendance
      join students student on student.id = attendance.student_id
      join academic_periods period on period.id = attendance.academic_period_id
      left join teachers teacher on teacher.id = attendance.teacher_id
      left join kiosks kiosk on kiosk.id = attendance.kiosk_id
      ${whereSql};
    `,
    values,
  );

  const pagedValues = [...values, limit, offset];

  const rowsResult = await db.query<AttendanceQueryRow>(
    `
      select
        attendance.id,
        student.email::text as student_email,
        concat(student.first_name, ' ', student.last_name) as student_name,
        teacher.institutional_email::text as teacher_email,
        period.name as period_name,
        kiosk.code as kiosk_code,
        attendance.entry_at,
        attendance.exit_at,
        attendance.duration_minutes,
        attendance.status::text as status,
        attendance.source::text as source,
        coalesce(
          json_agg(
            json_build_object(
              'id', activity.id,
              'description', activity.description
            )
            order by activity.created_at
          ) filter (where activity.id is not null),
          '[]'::json
        ) as activities
      from attendance_sessions attendance
      join students student on student.id = attendance.student_id
      join academic_periods period on period.id = attendance.academic_period_id
      left join teachers teacher on teacher.id = attendance.teacher_id
      left join kiosks kiosk on kiosk.id = attendance.kiosk_id
      left join activities activity on activity.attendance_session_id = attendance.id
      ${whereSql}
      group by
        attendance.id,
        student.email,
        student.first_name,
        student.last_name,
        teacher.institutional_email,
        period.name,
        kiosk.code
      order by attendance.entry_at desc
      limit $${pagedValues.length - 1}
      offset $${pagedValues.length};
    `,
    pagedValues,
  );

  return {
    rows: rowsResult.rows.map(mapAttendanceRow),
    total: Number(countResult.rows[0]?.total ?? 0),
    limit,
    offset,
  };
}

async function countMetric(sql: string, values: unknown[]): Promise<number> {
  const result = await db.query<{ value: string }>(sql, values);
  return Number(result.rows[0]?.value ?? 0);
}

export async function getAdminDashboard(params: {
  authUser: AuthenticatedUser;
}): Promise<DashboardSummary> {
  const teacherId = await getTeacherIdForAuthUser(params.authUser);

  const accessSql = teacherId ? 'and attendance.teacher_id = $1' : '';
  const values = teacherId ? [teacherId] : [];

  const studentsInside = await countMetric(
    `
      select count(*)::text as value
      from attendance_sessions attendance
      join academic_periods period on period.id = attendance.academic_period_id
      where period.is_active = true
        and attendance.status = 'OPEN'
        ${accessSql};
    `,
    values,
  );

  const entriesToday = await countMetric(
    `
      select count(*)::text as value
      from attendance_sessions attendance
      join academic_periods period on period.id = attendance.academic_period_id
      where period.is_active = true
        and (attendance.entry_at at time zone 'America/Guayaquil')::date =
            (now() at time zone 'America/Guayaquil')::date
        ${accessSql};
    `,
    values,
  );

  const exitsToday = await countMetric(
    `
      select count(*)::text as value
      from attendance_sessions attendance
      join academic_periods period on period.id = attendance.academic_period_id
      where period.is_active = true
        and attendance.exit_at is not null
        and (attendance.exit_at at time zone 'America/Guayaquil')::date =
            (now() at time zone 'America/Guayaquil')::date
        ${accessSql};
    `,
    values,
  );

  const incompleteSessions = await countMetric(
    `
      select count(*)::text as value
      from attendance_sessions attendance
      join academic_periods period on period.id = attendance.academic_period_id
      where period.is_active = true
        and attendance.status = 'INCOMPLETE_AUTO_VOIDED'
        ${accessSql};
    `,
    values,
  );

  const totalMinutes = await countMetric(
    `
      select coalesce(sum(attendance.duration_minutes), 0)::text as value
      from attendance_sessions attendance
      join academic_periods period on period.id = attendance.academic_period_id
      where period.is_active = true
        and attendance.status = 'COMPLETED'
        ${accessSql};
    `,
    values,
  );

  const latestResult = await getAdminAttendanceList({
    authUser: params.authUser,
    filters: {
      limit: 10,
      offset: 0,
    },
  });

  return {
    studentsInside,
    entriesToday,
    exitsToday,
    incompleteSessions,
    totalHoursCurrentPeriod: Math.round((totalMinutes / 60) * 100) / 100,
    latestRows: latestResult.rows,
  };
}
