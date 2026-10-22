import type { PoolClient } from 'pg';
import { db } from '../config/db.js';
import type { QrTokenPayload } from '../domain/qr-token.js';
import { ApiError } from '../http/api-error.js';
import { isQrPayloadExpired, verifyQrToken } from './qr-token.service.js';

export type AttendanceScanAction =
  | 'ENTRY_REGISTERED'
  | 'EXIT_REQUIRES_ACTIVITIES';

export type AttendanceExitAction = 'EXIT_REGISTERED';

export interface AttendanceScanResult {
  action: AttendanceScanAction;
  attendanceSessionId: string;
  entryAt: string | null;
  message: string;
}

export interface AttendanceExitResult {
  action: AttendanceExitAction;
  attendanceSessionId: string;
  entryAt: string;
  exitAt: string;
  durationMinutes: number;
  activities: string[];
  message: string;
}

interface StudentRow {
  id: string;
  active: boolean;
  email: string;
}

interface AcademicPeriodRow {
  id: string;
  name: string;
}

interface AssignmentRow {
  teacher_id: string;
}

interface KioskRow {
  id: string;
  active: boolean;
}

interface KioskSessionRow {
  id: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  kiosk_id: string;
}

interface OpenAttendanceRow {
  id: string;
  entry_at: Date;
}

interface CompletedAttendanceRow {
  id: string;
  entry_at: Date;
  exit_at: Date;
  duration_minutes: number;
}

async function insertQrTokenUsage(
  client: PoolClient,
  params: {
    tokenJti: string;
    kioskId: string;
    kioskSessionId: string;
    studentId: string;
    actionResult: string;
    requestId: string;
  },
): Promise<void> {
  await client.query(
    `
      insert into qr_token_usages (
        token_jti,
        kiosk_id,
        kiosk_session_id,
        student_id,
        used_at,
        action_result,
        request_id
      )
      values ($1, $2, $3, $4, now(), $5, $6)
      on conflict (token_jti, student_id, action_result)
      do nothing;
    `,
    [
      params.tokenJti,
      params.kioskId,
      params.kioskSessionId,
      params.studentId,
      params.actionResult,
      params.requestId,
    ],
  );
}

async function insertAuditLog(
  client: PoolClient,
  params: {
    actorUserProfileId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: unknown;
    newData: unknown;
    requestId: string;
  },
): Promise<void> {
  await client.query(
    `
      insert into audit_logs (
        actor_user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        source,
        request_id
      )
      values ($1, 'STUDENT', $2, $3, $4, $5::jsonb, $6::jsonb, 'STUDENT_QR', $7);
    `,
    [
      params.actorUserProfileId,
      params.action,
      params.entityType,
      params.entityId,
      params.oldData ? JSON.stringify(params.oldData) : null,
      JSON.stringify(params.newData),
      params.requestId,
    ],
  );
}

async function loadQrContext(
  client: PoolClient,
  qrPayload: QrTokenPayload,
): Promise<{
  kiosk: KioskRow;
  kioskSession: KioskSessionRow;
}> {
  const kioskResult = await client.query<KioskRow>(
    `
      select id, active
      from kiosks
      where code = $1
      for update;
    `,
    [qrPayload.kioskId],
  );

  const kiosk = kioskResult.rows[0];

  if (!kiosk || !kiosk.active) {
    throw new ApiError(400, 'QR_KIOSK_INACTIVE', 'El QR pertenece a un kiosko inexistente o inactivo.');
  }

  const kioskSessionResult = await client.query<KioskSessionRow>(
    `
      select id, status, kiosk_id
      from kiosk_sessions
      where id = $1
        and kiosk_id = $2
      for update;
    `,
    [qrPayload.kioskSessionId, kiosk.id],
  );

  const kioskSession = kioskSessionResult.rows[0];

  if (!kioskSession || kioskSession.status !== 'ACTIVE') {
    throw new ApiError(400, 'QR_SESSION_INACTIVE', 'La sesión de kiosko no está activa.');
  }

  return {
    kiosk,
    kioskSession,
  };
}

async function loadStudent(
  client: PoolClient,
  studentUserProfileId: string,
): Promise<StudentRow> {
  const studentResult = await client.query<StudentRow>(
    `
      select id, active, email::text as email
      from students
      where user_profile_id = $1
      for update;
    `,
    [studentUserProfileId],
  );

  const student = studentResult.rows[0];

  if (!student || !student.active) {
    throw new ApiError(403, 'STUDENT_INACTIVE', 'El estudiante no existe o está inactivo.');
  }

  return student;
}

async function loadActivePeriod(client: PoolClient): Promise<AcademicPeriodRow> {
  const periodResult = await client.query<AcademicPeriodRow>(
    `
      select id, name
      from academic_periods
      where is_active = true
      limit 1;
    `,
  );

  const activePeriod = periodResult.rows[0];

  if (!activePeriod) {
    throw new ApiError(400, 'ACTIVE_PERIOD_REQUIRED', 'No existe un periodo académico activo.');
  }

  return activePeriod;
}

async function loadAssignment(
  client: PoolClient,
  params: {
    studentId: string;
    academicPeriodId: string;
  },
): Promise<AssignmentRow> {
  const assignmentResult = await client.query<AssignmentRow>(
    `
      select teacher_id
      from teacher_student_assignments
      where student_id = $1
        and academic_period_id = $2
        and active = true
      order by created_at desc
      limit 1;
    `,
    [params.studentId, params.academicPeriodId],
  );

  const assignment = assignmentResult.rows[0];

  if (!assignment) {
    throw new ApiError(
      403,
      'STUDENT_NOT_ASSIGNED',
      'El estudiante no tiene una asignación docente activa para el periodo actual.',
    );
  }

  return assignment;
}

async function assertExpiredQrHasRecentExitIntent(
  client: PoolClient,
  params: {
    qrPayload: QrTokenPayload;
    kioskId: string;
    kioskSessionId: string;
    studentId: string;
  },
): Promise<void> {
  if (!isQrPayloadExpired(params.qrPayload)) {
    return;
  }

  const result = await client.query(
    `
      select 1
      from qr_token_usages
      where token_jti = $1
        and kiosk_id = $2
        and kiosk_session_id = $3
        and student_id = $4
        and action_result = 'EXIT_REQUIRES_ACTIVITIES'
        and used_at >= now() - interval '10 minutes'
      limit 1;
    `,
    [
      params.qrPayload.jti,
      params.kioskId,
      params.kioskSessionId,
      params.studentId,
    ],
  );

  if (result.rowCount === 0) {
    throw new ApiError(
      400,
      'QR_EXPIRED',
      'El QR expiró. Escanee nuevamente el QR vigente del kiosko.',
    );
  }
}

export async function scanAttendanceQr(params: {
  qrToken: string;
  studentUserProfileId: string;
  requestId: string;
  clientInfo?: unknown;
}): Promise<AttendanceScanResult> {
  const qrPayload = verifyQrToken(params.qrToken);

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const { kiosk, kioskSession } = await loadQrContext(client, qrPayload);
    const student = await loadStudent(client, params.studentUserProfileId);
    const activePeriod = await loadActivePeriod(client);
    const assignment = await loadAssignment(client, {
      studentId: student.id,
      academicPeriodId: activePeriod.id,
    });

    const openAttendanceResult = await client.query<OpenAttendanceRow>(
      `
        select id, entry_at
        from attendance_sessions
        where student_id = $1
          and status = 'OPEN'
        for update;
      `,
      [student.id],
    );

    const openAttendance = openAttendanceResult.rows[0];

    if (openAttendance) {
      await insertQrTokenUsage(client, {
        tokenJti: qrPayload.jti,
        kioskId: kiosk.id,
        kioskSessionId: kioskSession.id,
        studentId: student.id,
        actionResult: 'EXIT_REQUIRES_ACTIVITIES',
        requestId: params.requestId,
      });

      await insertAuditLog(client, {
        actorUserProfileId: params.studentUserProfileId,
        action: 'ATTENDANCE_EXIT_REQUIRES_ACTIVITIES',
        entityType: 'attendance_sessions',
        entityId: openAttendance.id,
        newData: {
          attendanceSessionId: openAttendance.id,
          qr: qrPayload,
          clientInfo: params.clientInfo ?? null,
        },
        requestId: params.requestId,
      });

      await client.query('COMMIT');

      return {
        action: 'EXIT_REQUIRES_ACTIVITIES',
        attendanceSessionId: openAttendance.id,
        entryAt: openAttendance.entry_at.toISOString(),
        message: 'Tiene una entrada abierta. Registre las actividades para confirmar la salida.',
      };
    }

    const insertedAttendance = await client.query<OpenAttendanceRow>(
      `
        insert into attendance_sessions (
          student_id,
          academic_period_id,
          teacher_id,
          kiosk_id,
          entry_at,
          status,
          source,
          created_by_user_id
        )
        values ($1, $2, $3, $4, now(), 'OPEN', 'STUDENT_QR', $5)
        returning id, entry_at;
      `,
      [
        student.id,
        activePeriod.id,
        assignment.teacher_id,
        kiosk.id,
        params.studentUserProfileId,
      ],
    );

    const attendance = insertedAttendance.rows[0];

    await insertQrTokenUsage(client, {
      tokenJti: qrPayload.jti,
      kioskId: kiosk.id,
      kioskSessionId: kioskSession.id,
      studentId: student.id,
      actionResult: 'ENTRY_REGISTERED',
      requestId: params.requestId,
    });

    await insertAuditLog(client, {
      actorUserProfileId: params.studentUserProfileId,
      action: 'ATTENDANCE_ENTRY_REGISTERED',
      entityType: 'attendance_sessions',
      entityId: attendance.id,
      newData: {
        attendanceSessionId: attendance.id,
        entryAt: attendance.entry_at.toISOString(),
        qr: qrPayload,
        clientInfo: params.clientInfo ?? null,
      },
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      action: 'ENTRY_REGISTERED',
      attendanceSessionId: attendance.id,
      entryAt: attendance.entry_at.toISOString(),
      message: 'Entrada registrada correctamente.',
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ApiError(
        409,
        'ATTENDANCE_ALREADY_OPEN',
        'Ya existe una sesión abierta para este estudiante.',
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function completeAttendanceExit(params: {
  qrToken: string;
  attendanceSessionId: string;
  activities: string[];
  studentUserProfileId: string;
  requestId: string;
  clientInfo?: unknown;
}): Promise<AttendanceExitResult> {
  const cleanedActivities = params.activities
    .map((activity) => activity.trim())
    .filter((activity) => activity.length > 0);

  if (cleanedActivities.length === 0) {
    throw new ApiError(
      422,
      'ACTIVITY_REQUIRED',
      'Debe registrar al menos una actividad para confirmar la salida.',
    );
  }

  const qrPayload = verifyQrToken(params.qrToken, {
    allowExpired: true,
  });

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const { kiosk, kioskSession } = await loadQrContext(client, qrPayload);
    const student = await loadStudent(client, params.studentUserProfileId);
    const activePeriod = await loadActivePeriod(client);

    await loadAssignment(client, {
      studentId: student.id,
      academicPeriodId: activePeriod.id,
    });

    await assertExpiredQrHasRecentExitIntent(client, {
      qrPayload,
      kioskId: kiosk.id,
      kioskSessionId: kioskSession.id,
      studentId: student.id,
    });

    const openAttendanceResult = await client.query<OpenAttendanceRow>(
      `
        select id, entry_at
        from attendance_sessions
        where id = $1
          and student_id = $2
          and status = 'OPEN'
        for update;
      `,
      [params.attendanceSessionId, student.id],
    );

    const openAttendance = openAttendanceResult.rows[0];

    if (!openAttendance) {
      throw new ApiError(
        409,
        'NO_OPEN_SESSION',
        'No existe una entrada abierta para confirmar la salida.',
      );
    }

    const completedResult = await client.query<CompletedAttendanceRow>(
      `
        update attendance_sessions
        set
          exit_at = now(),
          duration_minutes = greatest(
            0,
            floor(extract(epoch from (now() - entry_at)) / 60)::integer
          ),
          status = 'COMPLETED',
          updated_at = now()
        where id = $1
          and student_id = $2
          and status = 'OPEN'
        returning id, entry_at, exit_at, duration_minutes;
      `,
      [params.attendanceSessionId, student.id],
    );

    const completed = completedResult.rows[0];

    if (!completed) {
      throw new ApiError(
        409,
        'DB_CONFLICT_RETRY',
        'Hubo un conflicto al registrar la salida. Intente nuevamente.',
      );
    }

    for (const activity of cleanedActivities) {
      await client.query(
        `
          insert into activities (
            attendance_session_id,
            description,
            created_at
          )
          values ($1, $2, now());
        `,
        [completed.id, activity],
      );
    }

    await insertQrTokenUsage(client, {
      tokenJti: qrPayload.jti,
      kioskId: kiosk.id,
      kioskSessionId: kioskSession.id,
      studentId: student.id,
      actionResult: 'EXIT_REGISTERED',
      requestId: params.requestId,
    });

    await insertAuditLog(client, {
      actorUserProfileId: params.studentUserProfileId,
      action: 'ATTENDANCE_EXIT_REGISTERED',
      entityType: 'attendance_sessions',
      entityId: completed.id,
      oldData: {
        attendanceSessionId: openAttendance.id,
        entryAt: openAttendance.entry_at.toISOString(),
        status: 'OPEN',
      },
      newData: {
        attendanceSessionId: completed.id,
        entryAt: completed.entry_at.toISOString(),
        exitAt: completed.exit_at.toISOString(),
        durationMinutes: completed.duration_minutes,
        activities: cleanedActivities,
        qr: qrPayload,
        clientInfo: params.clientInfo ?? null,
      },
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      action: 'EXIT_REGISTERED',
      attendanceSessionId: completed.id,
      entryAt: completed.entry_at.toISOString(),
      exitAt: completed.exit_at.toISOString(),
      durationMinutes: completed.duration_minutes,
      activities: cleanedActivities,
      message: 'Salida registrada correctamente.',
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
