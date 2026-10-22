import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

function loadEnvFile(path) {
  return readFile(path, 'utf8')
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2];
        }
      }
    })
    .catch(() => undefined);
}

await loadEnvFile(new URL('../.env.local', import.meta.url));
await loadEnvFile(new URL('../../database/.env', import.meta.url));

const firebaserc = JSON.parse(await readFile(new URL('../../.firebaserc', import.meta.url), 'utf8'));
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? firebaserc.projects?.default;
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const apiBaseUrl = process.env.XRLAB_API_BASE_URL ?? `http://127.0.0.1:5001/${projectId}/us-central1/xrlabApi/api`;
const password = 'Xrlab.Dev.2026!';
const results = [];
let failures = 0;

function record(name, passed, details = '') {
  results.push({ prueba: name, estado: passed ? 'OK' : 'FAIL', detalle: details });
  if (!passed) failures += 1;
}

async function signIn(email) {
  const response = await fetch(`http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok || !body.idToken) throw new Error(`No se pudo iniciar sesión ${email}: ${JSON.stringify(body)}`);
  return body.idToken;
}

async function api(method, path, token, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { status: response.status, body: await response.arrayBuffer(), headers: response.headers };
}

console.log('Verificando PC4 con emuladores locales');
console.log(`API: ${apiBaseUrl}`);

const adminToken = await signIn('admin@xrlab.test');
const teacherToken = await signIn('docente@xrlab.test');

const catalogs = await api('GET', '/admin/catalogs', adminToken);
record('admin consulta catálogos', catalogs.status === 200, `status=${catalogs.status}`);
const student = catalogs.body?.data?.students?.find((item) => item.email === 'estudiante@xrlab.test') ?? catalogs.body?.data?.students?.[0];
const teacher = catalogs.body?.data?.teachers?.find((item) => item.institutionalEmail === 'docente@xrlab.test') ?? catalogs.body?.data?.teachers?.[0];
record('catálogos incluyen estudiante', !!student?.id, student?.email ?? 'sin estudiante');
record('catálogos incluyen docente', !!teacher?.id, teacher?.institutionalEmail ?? 'sin docente');

const teacherForbidden = await api('POST', '/admin/teachers', teacherToken, {
  institutionalEmail: 'pc4.forbidden@xrlab.test', firstName: 'No', lastName: 'Permitido', active: true,
});
record('docente no gestiona docentes', teacherForbidden.status === 403, `status=${teacherForbidden.status}`);

const career = await api('POST', '/admin/careers', adminToken, { name: 'PC4 QA Carrera' });
record('admin crea carrera', career.status === 200, `status=${career.status}`);

const manual = await api('POST', '/admin/manual-records', adminToken, {
  studentId: student.id,
  teacherId: teacher.id,
  entryAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  exitAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  activities: ['PC4 verificación registro manual'],
  reason: 'PC4 verificación automática con motivo obligatorio',
});
record('admin crea registro manual', manual.status === 200, `status=${manual.status}`);
record('manual source correcto', ['ADMIN_MANUAL', 'TEACHER_MANUAL'].includes(manual.body?.data?.source), manual.body?.data?.source);

const audit = await api('GET', '/admin/audit-logs?action=ATTENDANCE_MANUAL', adminToken);
record('auditoría consultable', audit.status === 200, `status=${audit.status}`);
record('auditoría trae eventos', (audit.body?.data?.total ?? 0) > 0, `total=${audit.body?.data?.total}`);

const exportResult = await api('GET', '/admin/attendance/export?limit=100', adminToken);
record('exportación Excel responde 200', exportResult.status === 200, `status=${exportResult.status}`);
record('exportación genera bytes', exportResult.body.byteLength > 1000, `bytes=${exportResult.body.byteLength}`);

if (process.env.DATABASE_URL) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const context = await client.query(`
      select
        student.id as student_id,
        period.id as period_id,
        assignment.teacher_id,
        kiosk.id as kiosk_id
      from students student
      join academic_periods period on period.is_active = true
      left join teacher_student_assignments assignment on assignment.student_id = student.id and assignment.academic_period_id = period.id and assignment.active = true
      left join kiosks kiosk on kiosk.code = 'XR-KIOSK-01'
      where student.email = 'estudiante@xrlab.test'
      limit 1;
    `);

    if (context.rows[0]) {
      await client.query(
        `
          insert into attendance_sessions (student_id, academic_period_id, teacher_id, kiosk_id, entry_at, status, source)
          values ($1, $2, $3, $4, now() - interval '1 day', 'OPEN', 'STUDENT_QR');
        `,
        [context.rows[0].student_id, context.rows[0].period_id, context.rows[0].teacher_id, context.rows[0].kiosk_id],
      );
    }
  } finally {
    await client.end();
  }
}

const job = await api('POST', '/admin/jobs/void-incomplete-sessions', adminToken, {});
record('job sesiones incompletas responde 200', job.status === 200, `status=${job.status}`);
record('job anuló al menos una sesión', (job.body?.data?.voided ?? 0) >= 1, `voided=${job.body?.data?.voided}`);

console.table(results);
if (failures > 0) {
  console.error(`PC4 tiene ${failures} prueba(s) fallida(s).`);
  process.exit(1);
}
console.log('OK: PC4 verificado correctamente.');
