import ExcelJS from 'exceljs';
import type { PoolClient } from 'pg';
import { db } from '../config/db.js';
import { ApiError } from '../http/api-error.js';
import type { AuthenticatedUser } from '../middleware/auth-middleware.js';
import {
  getAdminAttendanceList,
  type AttendanceListFilters,
} from './admin.service.js';
import { ensureAuthAccount } from './auth-accounts.service.js';

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
}

export interface CatalogTeacher {
  id: string;
  institutionalEmail: string;
  firstName: string;
  lastName: string;
  active: boolean;
}

export interface CatalogStudent {
  id: string;
  universityCode: string;
  email: string;
  firstName: string;
  lastName: string;
  careerId: string | null;
  practiceTypeId: string | null;
  active: boolean;
}

export interface CatalogPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CatalogKiosk {
  id: string;
  code: string;
  name: string;
  location: string;
  active: boolean;
  lastSeenAt: string | null;
}

export interface AdminCatalogs {
  careers: CatalogItem[];
  practiceTypes: CatalogItem[];
  teachers: CatalogTeacher[];
  students: CatalogStudent[];
  periods: CatalogPeriod[];
  kiosks: CatalogKiosk[];
}

export interface SaveStudentInput {
  id?: string;
  universityCode: string;
  email: string;
  firstName: string;
  lastName: string;
  careerId?: string | null;
  practiceTypeId?: string | null;
  teacherId?: string | null;
  active?: boolean;
}

export interface SaveTeacherInput {
  id?: string;
  institutionalEmail: string;
  firstName: string;
  lastName: string;
  active?: boolean;
}

export interface SavePeriodInput {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SaveKioskInput {
  id?: string;
  code: string;
  name: string;
  location: string;
  active?: boolean;
}

export interface ManualRecordInput {
  attendanceSessionId?: string;
  studentId: string;
  teacherId?: string | null;
  academicPeriodId?: string | null;
  kioskId?: string | null;
  entryAt: string;
  exitAt: string;
  activities: string[];
  reason: string;
}

export interface AuditLogFilters {
  actor?: string;
  action?: string;
  entityType?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

export interface AuditLogRow {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string;
  reason: string | null;
  createdAt: string;
  requestId: string | null;
}

interface TeacherIdRow { id: string; }
interface IdRow { id: string; }

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    throw new ApiError(422, 'VALIDATION_ERROR', `${field} es obligatorio.`);
  }
  return cleaned;
}

function cleanActivities(activities: string[]): string[] {
  const cleaned = activities.map((item) => item.trim()).filter(Boolean);
  if (!cleaned.length) {
    throw new ApiError(422, 'ACTIVITY_REQUIRED', 'Debe ingresar al menos una actividad.');
  }
  return cleaned;
}

function parseDateOrThrow(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, 'VALIDATION_ERROR', `${field} no tiene una fecha válida.`);
  }
  return date;
}

async function getTeacherIdForAuthUser(authUser: AuthenticatedUser): Promise<string | null> {
  if (authUser.role !== 'TEACHER') {
    return null;
  }

  const result = await db.query<TeacherIdRow>(
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
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'El docente no tiene un perfil activo asociado.');
  }

  return teacher.id;
}

async function assertTeacherCanAccessStudent(
  client: PoolClient,
  teacherId: string | null,
  studentId: string,
): Promise<void> {
  if (!teacherId) {
    return;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from teacher_student_assignments assignment
        join academic_periods period on period.id = assignment.academic_period_id
        where assignment.teacher_id = $1
          and assignment.student_id = $2
          and assignment.active = true
          and period.is_active = true
      ) as exists;
    `,
    [teacherId, studentId],
  );

  if (!result.rows[0]?.exists) {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'El docente solo puede operar sobre estudiantes asignados.');
  }
}

async function insertAudit(client: PoolClient, params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  action: string;
  entityType: string;
  entityId: string | null;
  oldData?: unknown;
  newData?: unknown;
  source: string;
  reason?: string | null;
  requestId: string;
}): Promise<void> {
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
        reason,
        request_id
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10);
    `,
    [
      params.actorUserId,
      params.actorRole,
      params.action,
      params.entityType,
      params.entityId,
      params.oldData ? JSON.stringify(params.oldData) : null,
      params.newData ? JSON.stringify(params.newData) : null,
      params.source,
      params.reason ?? null,
      params.requestId,
    ],
  );
}

export async function listAdminCatalogs(authUser: AuthenticatedUser): Promise<AdminCatalogs> {
  const teacherId = await getTeacherIdForAuthUser(authUser);

  const [careers, practiceTypes, periods, kiosks] = await Promise.all([
    db.query<CatalogItem>('select id, name, active from careers order by name;'),
    db.query<CatalogItem>('select id, name, active from practice_types order by name;'),
    db.query<{ id: string; name: string; start_date: Date; end_date: Date; is_active: boolean }>(
      'select id, name, start_date, end_date, is_active from academic_periods order by start_date desc;'
    ),
    db.query<{ id: string; code: string; name: string; location: string; active: boolean; last_seen_at: Date | null }>(
      'select id, code, name, location, active, last_seen_at from kiosks order by code;'
    ),
  ]);

  const teachers = await db.query<{
    id: string;
    institutional_email: string;
    first_name: string;
    last_name: string;
    active: boolean;
  }>(
    teacherId
      ? `select id, institutional_email::text, first_name, last_name, active from teachers where id = $1 order by institutional_email;`
      : `select id, institutional_email::text, first_name, last_name, active from teachers order by institutional_email;`,
    teacherId ? [teacherId] : [],
  );

  const students = await db.query<{
    id: string;
    university_code: string;
    email: string;
    first_name: string;
    last_name: string;
    career_id: string | null;
    practice_type_id: string | null;
    active: boolean;
  }>(
    teacherId
      ? `
        select distinct
          student.id,
          student.university_code,
          student.email::text as email,
          student.first_name,
          student.last_name,
          student.career_id,
          student.practice_type_id,
          student.active
        from students student
        join teacher_student_assignments assignment on assignment.student_id = student.id
        join academic_periods period on period.id = assignment.academic_period_id
        where assignment.teacher_id = $1
          and assignment.active = true
          and period.is_active = true
        order by email;
      `
      : `
        select
          id,
          university_code,
          email::text,
          first_name,
          last_name,
          career_id,
          practice_type_id,
          active
        from students
        order by email;
      `,
    teacherId ? [teacherId] : [],
  );

  return {
    careers: careers.rows,
    practiceTypes: practiceTypes.rows,
    teachers: teachers.rows.map((row) => ({
      id: row.id,
      institutionalEmail: row.institutional_email,
      firstName: row.first_name,
      lastName: row.last_name,
      active: row.active,
    })),
    students: students.rows.map((row) => ({
      id: row.id,
      universityCode: row.university_code,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      careerId: row.career_id,
      practiceTypeId: row.practice_type_id,
      active: row.active,
    })),
    periods: periods.rows.map((row) => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date.toISOString().slice(0, 10),
      endDate: row.end_date.toISOString().slice(0, 10),
      isActive: row.is_active,
    })),
    kiosks: kiosks.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      location: row.location,
      active: row.active,
      lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    })),
  };
}

export async function saveCatalogItem(params: {
  table: 'careers' | 'practice_types';
  name: string;
}): Promise<CatalogItem> {
  const result = await db.query<CatalogItem>(
    `
      insert into ${params.table} (name, active)
      values ($1, true)
      on conflict (name)
      do update set active = true, updated_at = now()
      returning id, name, active;
    `,
    [cleanText(params.name, 'Nombre')],
  );

  return result.rows[0];
}

export async function saveStudent(params: {
  authUser: AuthenticatedUser;
  input: SaveStudentInput;
  requestId: string;
}): Promise<CatalogStudent & { invitationPending: boolean }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const actorTeacherId = await getTeacherIdForAuthUser(params.authUser);
    const forcedTeacherId = actorTeacherId ?? params.input.teacherId ?? null;

    if (params.input.id) {
      await assertTeacherCanAccessStudent(client, actorTeacherId, params.input.id);
    }

    const profile = await client.query<IdRow>(
      `
        insert into users_profiles (
          firebase_uid,
          email,
          role,
          first_name,
          last_name,
          active
        )
        values (
          concat('manual-student-', gen_random_uuid()::text),
          $1,
          'STUDENT',
          $2,
          $3,
          coalesce($4, true)
        )
        on conflict (email)
        do update set
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          active = excluded.active,
          updated_at = now()
        returning id;
      `,
      [
        cleanText(params.input.email, 'Correo'),
        cleanText(params.input.firstName, 'Nombre'),
        cleanText(params.input.lastName, 'Apellido'),
        params.input.active ?? true,
      ],
    );

    const studentResult = params.input.id
      ? await client.query<{
          id: string;
          university_code: string;
          email: string;
          first_name: string;
          last_name: string;
          career_id: string | null;
          practice_type_id: string | null;
          active: boolean;
        }>(
          `
            update students
            set
              user_profile_id = $2,
              university_code = $3,
              email = $4,
              first_name = $5,
              last_name = $6,
              career_id = $7,
              practice_type_id = $8,
              active = $9,
              updated_at = now()
            where id = $1
            returning id, university_code, email::text, first_name, last_name, career_id, practice_type_id, active;
          `,
          [
            params.input.id,
            profile.rows[0].id,
            cleanText(params.input.universityCode, 'Código universitario'),
            cleanText(params.input.email, 'Correo'),
            cleanText(params.input.firstName, 'Nombre'),
            cleanText(params.input.lastName, 'Apellido'),
            params.input.careerId || null,
            params.input.practiceTypeId || null,
            params.input.active ?? true,
          ],
        )
      : await client.query<{
          id: string;
          university_code: string;
          email: string;
          first_name: string;
          last_name: string;
          career_id: string | null;
          practice_type_id: string | null;
          active: boolean;
        }>(
          `
            insert into students (
              user_profile_id,
              university_code,
              email,
              first_name,
              last_name,
              career_id,
              practice_type_id,
              active
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            on conflict (university_code)
            do update set
              user_profile_id = excluded.user_profile_id,
              email = excluded.email,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              career_id = excluded.career_id,
              practice_type_id = excluded.practice_type_id,
              active = excluded.active,
              updated_at = now()
            returning id, university_code, email::text, first_name, last_name, career_id, practice_type_id, active;
          `,
          [
            profile.rows[0].id,
            cleanText(params.input.universityCode, 'Código universitario'),
            cleanText(params.input.email, 'Correo'),
            cleanText(params.input.firstName, 'Nombre'),
            cleanText(params.input.lastName, 'Apellido'),
            params.input.careerId || null,
            params.input.practiceTypeId || null,
            params.input.active ?? true,
          ],
        );

    const student = studentResult.rows[0];

    const account = await ensureAuthAccount(client, {
      profileId: profile.rows[0].id,
      role: 'STUDENT',
      displayName: `${student.first_name} ${student.last_name}`,
    });

    if (forcedTeacherId) {
      const activePeriod = await client.query<IdRow>(
        `select id from academic_periods where is_active = true limit 1;`,
      );

      if (activePeriod.rows[0]) {
        await client.query(
          `
            insert into teacher_student_assignments (
              teacher_id,
              student_id,
              academic_period_id,
              active
            )
            values ($1, $2, $3, true)
            on conflict (teacher_id, student_id, academic_period_id)
            do update set active = true, updated_at = now();
          `,
          [forcedTeacherId, student.id, activePeriod.rows[0].id],
        );
      }
    }

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: params.input.id ? 'STUDENT_UPDATED' : 'STUDENT_CREATED',
      entityType: 'students',
      entityId: student.id,
      newData: student,
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      id: student.id,
      universityCode: student.university_code,
      email: student.email,
      firstName: student.first_name,
      lastName: student.last_name,
      careerId: student.career_id,
      practiceTypeId: student.practice_type_id,
      active: student.active,
      invitationPending: account.invitationPending,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function prepareInvitation(params: {
  authUser: AuthenticatedUser;
  table: 'students' | 'teachers';
  id: string;
  role: 'STUDENT' | 'TEACHER';
  requestId: string;
  assertAccess?: (client: PoolClient) => Promise<void>;
}): Promise<{ email: string; invitationPending: boolean }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await params.assertAccess?.(client);

    const result = await client.query<{ user_profile_id: string | null; first_name: string; last_name: string; active: boolean }>(
      `select user_profile_id, first_name, last_name, active from ${params.table} where id = $1;`,
      [params.id],
    );
    const row = result.rows[0];

    if (!row?.user_profile_id) {
      throw new ApiError(404, 'NOT_FOUND', 'Registro no encontrado.');
    }

    if (!row.active) {
      throw new ApiError(409, 'INACTIVE', 'No se puede invitar a un registro desactivado.');
    }

    const account = await ensureAuthAccount(client, {
      profileId: row.user_profile_id,
      role: params.role,
      displayName: `${row.first_name} ${row.last_name}`,
    });

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: 'INVITATION_SENT',
      entityType: params.table,
      entityId: params.id,
      newData: { email: account.email },
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return { email: account.email, invitationPending: account.invitationPending };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function prepareStudentInvitation(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<{ email: string; invitationPending: boolean }> {
  const actorTeacherId = await getTeacherIdForAuthUser(params.authUser);
  return prepareInvitation({
    ...params,
    table: 'students',
    role: 'STUDENT',
    assertAccess: (client) => assertTeacherCanAccessStudent(client, actorTeacherId, params.id),
  });
}

export async function prepareTeacherInvitation(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<{ email: string; invitationPending: boolean }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede gestionar docentes.');
  }
  return prepareInvitation({ ...params, table: 'teachers', role: 'TEACHER' });
}

export async function deactivateStudent(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<{ id: string; active: boolean }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const actorTeacherId = await getTeacherIdForAuthUser(params.authUser);
    await assertTeacherCanAccessStudent(client, actorTeacherId, params.id);

    const result = await client.query<{ id: string; active: boolean }>(
      `update students set active = false where id = $1 returning id, active;`,
      [params.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'El estudiante no existe.');
    }

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: 'STUDENT_DEACTIVATED',
      entityType: 'students',
      entityId: row.id,
      newData: row,
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveTeacher(params: {
  authUser: AuthenticatedUser;
  input: SaveTeacherInput;
  requestId: string;
}): Promise<CatalogTeacher & { invitationPending: boolean }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede gestionar docentes.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const email = cleanText(params.input.institutionalEmail, 'Correo institucional');
    const firstName = cleanText(params.input.firstName, 'Nombre');
    const lastName = cleanText(params.input.lastName, 'Apellido');

    const profile = await client.query<IdRow>(
      `
        insert into users_profiles (
          firebase_uid,
          email,
          role,
          first_name,
          last_name,
          active
        )
        values (concat('manual-teacher-', gen_random_uuid()::text), $1, 'TEACHER', $2, $3, $4)
        on conflict (email)
        do update set
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          active = excluded.active,
          updated_at = now()
        returning id;
      `,
      [email, firstName, lastName, params.input.active ?? true],
    );

    const result = params.input.id
      ? await client.query<{
          id: string;
          institutional_email: string;
          first_name: string;
          last_name: string;
          active: boolean;
        }>(
          `
            update teachers
            set
              user_profile_id = $2,
              institutional_email = $3,
              first_name = $4,
              last_name = $5,
              active = $6,
              updated_at = now()
            where id = $1
            returning id, institutional_email::text, first_name, last_name, active;
          `,
          [params.input.id, profile.rows[0].id, email, firstName, lastName, params.input.active ?? true],
        )
      : await client.query<{
          id: string;
          institutional_email: string;
          first_name: string;
          last_name: string;
          active: boolean;
        }>(
          `
            insert into teachers (
              user_profile_id,
              institutional_email,
              first_name,
              last_name,
              active
            )
            values ($1, $2, $3, $4, $5)
            on conflict (institutional_email)
            do update set
              user_profile_id = excluded.user_profile_id,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              active = excluded.active,
              updated_at = now()
            returning id, institutional_email::text, first_name, last_name, active;
          `,
          [profile.rows[0].id, email, firstName, lastName, params.input.active ?? true],
        );

    const teacher = result.rows[0];

    const account = await ensureAuthAccount(client, {
      profileId: profile.rows[0].id,
      role: 'TEACHER',
      displayName: `${firstName} ${lastName}`,
    });

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: params.input.id ? 'TEACHER_UPDATED' : 'TEACHER_CREATED',
      entityType: 'teachers',
      entityId: teacher.id,
      newData: teacher,
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      id: teacher.id,
      institutionalEmail: teacher.institutional_email,
      firstName: teacher.first_name,
      lastName: teacher.last_name,
      active: teacher.active,
      invitationPending: account.invitationPending,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deactivateTeacher(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<{ id: string; active: boolean }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede desactivar docentes.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string; active: boolean }>(
      `update teachers set active = false where id = $1 returning id, active;`,
      [params.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(404, 'TEACHER_NOT_FOUND', 'El docente no existe.');
    }

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: 'TEACHER_DEACTIVATED',
      entityType: 'teachers',
      entityId: row.id,
      newData: row,
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function savePeriod(params: {
  authUser: AuthenticatedUser;
  input: SavePeriodInput;
  requestId: string;
}): Promise<CatalogPeriod> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede gestionar periodos.');
  }

  const result = params.input.id
    ? await db.query<{ id: string; name: string; start_date: Date; end_date: Date; is_active: boolean }>(
        `
          update academic_periods
          set name = $2, start_date = $3::date, end_date = $4::date, updated_at = now()
          where id = $1
          returning id, name, start_date, end_date, is_active;
        `,
        [params.input.id, cleanText(params.input.name, 'Nombre'), params.input.startDate, params.input.endDate],
      )
    : await db.query<{ id: string; name: string; start_date: Date; end_date: Date; is_active: boolean }>(
        `
          insert into academic_periods (name, start_date, end_date, is_active, created_by_user_id)
          values ($1, $2::date, $3::date, false, $4)
          returning id, name, start_date, end_date, is_active;
        `,
        [cleanText(params.input.name, 'Nombre'), params.input.startDate, params.input.endDate, params.authUser.profile.id],
      );

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date.toISOString().slice(0, 10),
    endDate: row.end_date.toISOString().slice(0, 10),
    isActive: row.is_active,
  };
}

export async function activatePeriod(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<CatalogPeriod> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede activar periodos.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query(`update academic_periods set is_active = false where is_active = true;`);
    const result = await client.query<{ id: string; name: string; start_date: Date; end_date: Date; is_active: boolean }>(
      `
        update academic_periods
        set is_active = true, updated_at = now()
        where id = $1
        returning id, name, start_date, end_date, is_active;
      `,
      [params.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(404, 'PERIOD_NOT_FOUND', 'El periodo no existe.');
    }

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: 'ACADEMIC_PERIOD_ACTIVATED',
      entityType: 'academic_periods',
      entityId: row.id,
      newData: row,
      source: 'API',
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      id: row.id,
      name: row.name,
      startDate: row.start_date.toISOString().slice(0, 10),
      endDate: row.end_date.toISOString().slice(0, 10),
      isActive: row.is_active,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closePeriod(params: {
  authUser: AuthenticatedUser;
  id: string;
  requestId: string;
}): Promise<{ id: string; isActive: boolean }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede cerrar periodos.');
  }

  const result = await db.query<{ id: string; is_active: boolean }>(
    `update academic_periods set is_active = false where id = $1 returning id, is_active;`,
    [params.id],
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, 'PERIOD_NOT_FOUND', 'El periodo no existe.');
  }

  return { id: row.id, isActive: row.is_active };
}

export async function saveKiosk(params: {
  authUser: AuthenticatedUser;
  input: SaveKioskInput;
  requestId: string;
}): Promise<CatalogKiosk> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede gestionar kioskos.');
  }

  const result = params.input.id
    ? await db.query<{ id: string; code: string; name: string; location: string; active: boolean; last_seen_at: Date | null }>(
        `
          update kiosks
          set code = $2, name = $3, location = $4, active = $5, updated_at = now()
          where id = $1
          returning id, code, name, location, active, last_seen_at;
        `,
        [
          params.input.id,
          cleanText(params.input.code, 'Código'),
          cleanText(params.input.name, 'Nombre'),
          cleanText(params.input.location, 'Ubicación'),
          params.input.active ?? true,
        ],
      )
    : await db.query<{ id: string; code: string; name: string; location: string; active: boolean; last_seen_at: Date | null }>(
        `
          insert into kiosks (code, name, location, active)
          values ($1, $2, $3, $4)
          on conflict (code)
          do update set name = excluded.name, location = excluded.location, active = excluded.active, updated_at = now()
          returning id, code, name, location, active, last_seen_at;
        `,
        [
          cleanText(params.input.code, 'Código'),
          cleanText(params.input.name, 'Nombre'),
          cleanText(params.input.location, 'Ubicación'),
          params.input.active ?? true,
        ],
      );

  const row = result.rows[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    active: row.active,
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
  };
}

export async function deactivateKiosk(params: {
  authUser: AuthenticatedUser;
  id: string;
}): Promise<{ id: string; active: boolean }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede desactivar kioskos.');
  }

  const result = await db.query<{ id: string; active: boolean }>(
    `update kiosks set active = false where id = $1 returning id, active;`,
    [params.id],
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, 'KIOSK_NOT_FOUND', 'El kiosko no existe.');
  }

  return row;
}

async function resolveManualContext(client: PoolClient, params: {
  authUser: AuthenticatedUser;
  input: ManualRecordInput;
}): Promise<{
  studentId: string;
  teacherId: string | null;
  periodId: string;
  kioskId: string | null;
}> {
  const actorTeacherId = await getTeacherIdForAuthUser(params.authUser);
  await assertTeacherCanAccessStudent(client, actorTeacherId, params.input.studentId);

  const studentExists = await client.query<{ id: string }>(
    `select id from students where id = $1 and active = true limit 1;`,
    [params.input.studentId],
  );

  if (!studentExists.rows[0]) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'El estudiante no existe o está inactivo.');
  }

  const period = params.input.academicPeriodId
    ? await client.query<IdRow>(`select id from academic_periods where id = $1 limit 1;`, [params.input.academicPeriodId])
    : await client.query<IdRow>(`select id from academic_periods where is_active = true limit 1;`);

  if (!period.rows[0]) {
    throw new ApiError(400, 'ACTIVE_PERIOD_REQUIRED', 'No existe un periodo académico válido.');
  }

  let teacherId = actorTeacherId ?? params.input.teacherId ?? null;

  if (!teacherId) {
    const assignment = await client.query<TeacherIdRow>(
      `
        select teacher_id as id
        from teacher_student_assignments
        where student_id = $1
          and academic_period_id = $2
          and active = true
        order by created_at desc
        limit 1;
      `,
      [params.input.studentId, period.rows[0].id],
    );
    teacherId = assignment.rows[0]?.id ?? null;
  }

  return {
    studentId: params.input.studentId,
    teacherId,
    periodId: period.rows[0].id,
    kioskId: params.input.kioskId ?? null,
  };
}

export async function createOrCorrectManualRecord(params: {
  authUser: AuthenticatedUser;
  input: ManualRecordInput;
  requestId: string;
}): Promise<{ id: string; status: string; source: string; durationMinutes: number }> {
  const reason = cleanText(params.input.reason, 'Motivo');
  const activities = cleanActivities(params.input.activities);
  const entryAt = parseDateOrThrow(params.input.entryAt, 'Entrada');
  const exitAt = parseDateOrThrow(params.input.exitAt, 'Salida');

  if (exitAt.getTime() < entryAt.getTime()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'La salida no puede ser anterior a la entrada.');
  }

  const source = params.authUser.role === 'ADMIN' ? 'ADMIN_MANUAL' : 'TEACHER_MANUAL';
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const context = await resolveManualContext(client, {
      authUser: params.authUser,
      input: params.input,
    });

    let oldData: unknown = null;
    let attendanceId = params.input.attendanceSessionId ?? null;
    let status = 'MANUAL_CREATED';

    if (attendanceId) {
      const old = await client.query(
        `select * from attendance_sessions where id = $1 for update;`,
        [attendanceId],
      );

      if (!old.rows[0]) {
        throw new ApiError(404, 'ATTENDANCE_NOT_FOUND', 'El registro a corregir no existe.');
      }

      oldData = old.rows[0];
      status = 'MANUAL_CORRECTED';

      await client.query(
        `
          update attendance_sessions
          set
            student_id = $2,
            academic_period_id = $3,
            teacher_id = $4,
            kiosk_id = $5,
            entry_at = $6,
            exit_at = $7,
            duration_minutes = greatest(floor(extract(epoch from ($7::timestamptz - $6::timestamptz)) / 60)::int, 0),
            status = 'MANUAL_CORRECTED',
            source = $8,
            manual_reason = $9,
            created_by_user_id = $10,
            updated_at = now()
          where id = $1;
        `,
        [
          attendanceId,
          context.studentId,
          context.periodId,
          context.teacherId,
          context.kioskId,
          entryAt.toISOString(),
          exitAt.toISOString(),
          source,
          reason,
          params.authUser.profile.id,
        ],
      );

      await client.query(`delete from activities where attendance_session_id = $1;`, [attendanceId]);
    } else {
      const inserted = await client.query<{ id: string }>(
        `
          insert into attendance_sessions (
            student_id,
            academic_period_id,
            teacher_id,
            kiosk_id,
            entry_at,
            exit_at,
            duration_minutes,
            status,
            source,
            manual_reason,
            created_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            greatest(floor(extract(epoch from ($6::timestamptz - $5::timestamptz)) / 60)::int, 0),
            'MANUAL_CREATED',
            $7,
            $8,
            $9
          )
          returning id;
        `,
        [
          context.studentId,
          context.periodId,
          context.teacherId,
          context.kioskId,
          entryAt.toISOString(),
          exitAt.toISOString(),
          source,
          reason,
          params.authUser.profile.id,
        ],
      );
      attendanceId = inserted.rows[0].id;
    }

    for (const activity of activities) {
      await client.query(
        `insert into activities (attendance_session_id, description, created_at) values ($1, $2, now());`,
        [attendanceId, activity],
      );
    }

    const finalRow = await client.query<{ id: string; status: string; source: string; duration_minutes: number }>(
      `select id, status::text, source::text, duration_minutes from attendance_sessions where id = $1;`,
      [attendanceId],
    );

    const row = finalRow.rows[0];

    await insertAudit(client, {
      actorUserId: params.authUser.profile.id,
      actorRole: params.authUser.role,
      action: params.input.attendanceSessionId ? 'ATTENDANCE_MANUAL_CORRECTED' : 'ATTENDANCE_MANUAL_CREATED',
      entityType: 'attendance_sessions',
      entityId: row.id,
      oldData: oldData ?? undefined,
      newData: { ...row, activities },
      source,
      reason,
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      id: row.id,
      status: row.status,
      source: row.source,
      durationMinutes: row.duration_minutes,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listAuditLogs(params: {
  authUser: AuthenticatedUser;
  filters: AuditLogFilters;
}): Promise<{ rows: AuditLogRow[]; total: number; limit: number; offset: number }> {
  const teacherId = await getTeacherIdForAuthUser(params.authUser);
  const values: unknown[] = [];
  const where: string[] = [];

  if (teacherId) {
    values.push(teacherId, params.authUser.profile.id);
    where.push(`(
      audit.actor_user_id = $2
      or exists (
        select 1
        from attendance_sessions attendance
        where audit.entity_type = 'attendance_sessions'
          and audit.entity_id = attendance.id
          and attendance.teacher_id = $1
      )
    )`);
  }

  if (params.filters.actor) {
    values.push(`%${params.filters.actor}%`);
    where.push(`coalesce(actor.email::text, '') ilike $${values.length}`);
  }

  if (params.filters.action) {
    values.push(`%${params.filters.action}%`);
    where.push(`audit.action ilike $${values.length}`);
  }

  if (params.filters.entityType) {
    values.push(`%${params.filters.entityType}%`);
    where.push(`audit.entity_type ilike $${values.length}`);
  }

  if (params.filters.source) {
    values.push(`%${params.filters.source}%`);
    where.push(`audit.source ilike $${values.length}`);
  }

  if (params.filters.dateFrom) {
    values.push(params.filters.dateFrom);
    where.push(`(audit.created_at at time zone 'America/Guayaquil')::date >= $${values.length}::date`);
  }

  if (params.filters.dateTo) {
    values.push(params.filters.dateTo);
    where.push(`(audit.created_at at time zone 'America/Guayaquil')::date <= $${values.length}::date`);
  }

  const limit = Math.min(Math.max(params.filters.limit, 1), 100);
  const offset = Math.max(params.filters.offset, 0);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';

  const count = await db.query<{ total: string }>(
    `
      select count(*)::text as total
      from audit_logs audit
      left join users_profiles actor on actor.id = audit.actor_user_id
      ${whereSql};
    `,
    values,
  );

  const pagedValues = [...values, limit, offset];
  const rows = await db.query<{
    id: string;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    source: string;
    reason: string | null;
    created_at: Date;
    request_id: string | null;
  }>(
    `
      select
        audit.id,
        actor.email::text as actor_email,
        audit.actor_role::text as actor_role,
        audit.action,
        audit.entity_type,
        audit.entity_id,
        audit.source,
        audit.reason,
        audit.created_at,
        audit.request_id
      from audit_logs audit
      left join users_profiles actor on actor.id = audit.actor_user_id
      ${whereSql}
      order by audit.created_at desc
      limit $${pagedValues.length - 1}
      offset $${pagedValues.length};
    `,
    pagedValues,
  );

  return {
    rows: rows.rows.map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
      requestId: row.request_id,
    })),
    total: Number(count.rows[0]?.total ?? 0),
    limit,
    offset,
  };
}

export async function voidIncompleteSessions(params: {
  authUser: AuthenticatedUser;
  requestId: string;
}): Promise<{ voided: number; ids: string[] }> {
  if (params.authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'ROLE_FORBIDDEN', 'Solo el administrador puede ejecutar el job de sesiones incompletas.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const rows = await client.query<{ id: string; student_id: string; entry_at: Date }>(
      `
        update attendance_sessions
        set
          status = 'INCOMPLETE_AUTO_VOIDED',
          duration_minutes = 0,
          updated_at = now()
        where status = 'OPEN'
          and (entry_at at time zone 'America/Guayaquil')::date <
              (now() at time zone 'America/Guayaquil')::date
        returning id, student_id, entry_at;
      `,
    );

    for (const row of rows.rows) {
      await insertAudit(client, {
        actorUserId: params.authUser.profile.id,
        actorRole: params.authUser.role,
        action: 'ATTENDANCE_INCOMPLETE_AUTO_VOIDED',
        entityType: 'attendance_sessions',
        entityId: row.id,
        newData: {
          id: row.id,
          studentId: row.student_id,
          entryAt: row.entry_at.toISOString(),
          status: 'INCOMPLETE_AUTO_VOIDED',
        },
        source: 'SYSTEM_JOB',
        requestId: params.requestId,
      });
    }

    await client.query('COMMIT');

    return {
      voided: rows.rowCount ?? 0,
      ids: rows.rows.map((row) => row.id),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function exportAttendanceExcel(params: {
  authUser: AuthenticatedUser;
  filters: AttendanceListFilters;
}): Promise<Buffer> {
  const result = await getAdminAttendanceList({
    authUser: params.authUser,
    filters: {
      ...params.filters,
      limit: Math.min(params.filters.limit ?? 1000, 5000),
      offset: Math.max(params.filters.offset ?? 0, 0),
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'XRLAB';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Asistencias');

  worksheet.columns = [
    { header: 'Estudiante', key: 'studentName', width: 28 },
    { header: 'Correo', key: 'studentEmail', width: 32 },
    { header: 'Docente', key: 'teacherEmail', width: 32 },
    { header: 'Periodo', key: 'periodName', width: 24 },
    { header: 'Kiosko', key: 'kioskCode', width: 18 },
    { header: 'Entrada', key: 'entryAt', width: 26 },
    { header: 'Salida', key: 'exitAt', width: 26 },
    { header: 'Duración minutos', key: 'durationMinutes', width: 18 },
    { header: 'Estado', key: 'status', width: 24 },
    { header: 'Origen', key: 'source', width: 20 },
    { header: 'Actividades', key: 'activities', width: 60 },
  ];

  worksheet.getRow(1).font = { bold: true };

  for (const row of result.rows) {
    worksheet.addRow({
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      teacherEmail: row.teacherEmail ?? '',
      periodName: row.periodName,
      kioskCode: row.kioskCode ?? '',
      entryAt: row.entryAt,
      exitAt: row.exitAt ?? '',
      durationMinutes: row.durationMinutes ?? '',
      status: row.status,
      source: row.source,
      activities: row.activities.map((activity) => activity.description).join('\n'),
    });
  }

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = 'A1:K1';

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
