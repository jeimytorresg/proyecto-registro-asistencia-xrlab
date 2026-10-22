import { readFile } from 'node:fs/promises';

const firebaserc = JSON.parse(
  await readFile(new URL('../../.firebaserc', import.meta.url), 'utf8'),
);

const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  firebaserc.projects?.default;

if (!projectId) {
  throw new Error('No se encontró projectId en .firebaserc');
}

const authEmulatorHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const authSignInUrl =
  `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=dev`;

const apiBaseUrl =
  process.env.XRLAB_API_BASE_URL ??
  `http://127.0.0.1:5001/${projectId}/us-central1/xrlabApi/api`;

const password = 'Xrlab.Dev.2026!';

const users = [
  {
    email: 'admin@xrlab.test',
    role: 'ADMIN',
  },
  {
    email: 'docente@xrlab.test',
    role: 'TEACHER',
  },
  {
    email: 'estudiante@xrlab.test',
    role: 'STUDENT',
  },
];

const results = [];
let failures = 0;

function record(name, passed, details = '') {
  results.push({
    prueba: name,
    estado: passed ? 'OK' : 'FAIL',
    detalle: details,
  });

  if (!passed) {
    failures += 1;
  }
}

async function signIn(email) {
  const response = await fetch(authSignInUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `No se pudo iniciar sesión con ${email}: ${JSON.stringify(body)}`,
    );
  }

  if (!body.idToken) {
    throw new Error(`Firebase Auth Emulator no devolvió idToken para ${email}`);
  }

  return body.idToken;
}

async function apiGet(path, idToken = null) {
  const headers = {};

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'GET',
    headers,
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

function assertStatus(name, actual, expected) {
  record(
    name,
    actual === expected,
    `esperado=${expected}; recibido=${actual}`,
  );
}

function assertCode(name, body, expectedCode) {
  const actualCode = body?.error?.code;

  record(
    name,
    actualCode === expectedCode,
    `esperado=${expectedCode}; recibido=${actualCode}`,
  );
}

function assertRole(name, body, expectedRole) {
  const actualRole = body?.data?.role;

  record(
    name,
    actualRole === expectedRole,
    `esperado=${expectedRole}; recibido=${actualRole}`,
  );
}

console.log('Verificando PC1 con emuladores locales');
console.log(`Project ID: ${projectId}`);
console.log(`Auth Emulator: ${authEmulatorHost}`);
console.log(`API: ${apiBaseUrl}`);

const health = await apiGet('/health');
assertStatus('health público', health.status, 200);
record('health ok=true', health.body?.ok === true, JSON.stringify(health.body));

const unauthenticated = await apiGet('/auth/session-check');
assertStatus('session-check sin token', unauthenticated.status, 401);
assertCode('session-check sin token AUTH_REQUIRED', unauthenticated.body, 'AUTH_REQUIRED');

const tokens = new Map();

for (const user of users) {
  const token = await signIn(user.email);
  tokens.set(user.email, token);

  const sessionCheck = await apiGet('/auth/session-check', token);

  assertStatus(`session-check ${user.email}`, sessionCheck.status, 200);
  assertRole(`rol ${user.email}`, sessionCheck.body, user.role);
}

const adminToken = tokens.get('admin@xrlab.test');
const teacherToken = tokens.get('docente@xrlab.test');
const studentToken = tokens.get('estudiante@xrlab.test');

const adminAdminCheck = await apiGet('/auth/admin-check', adminToken);
assertStatus('ADMIN puede acceder a admin-check', adminAdminCheck.status, 200);

const teacherAdminCheck = await apiGet('/auth/admin-check', teacherToken);
assertStatus('TEACHER puede acceder a admin-check', teacherAdminCheck.status, 200);

const studentAdminCheck = await apiGet('/auth/admin-check', studentToken);
assertStatus('STUDENT no puede acceder a admin-check', studentAdminCheck.status, 403);
assertCode('STUDENT recibe ROLE_FORBIDDEN en admin-check', studentAdminCheck.body, 'ROLE_FORBIDDEN');

const studentStudentCheck = await apiGet('/auth/student-check', studentToken);
assertStatus('STUDENT puede acceder a student-check', studentStudentCheck.status, 200);

const teacherStudentCheck = await apiGet('/auth/student-check', teacherToken);
assertStatus('TEACHER no puede acceder a student-check', teacherStudentCheck.status, 403);
assertCode('TEACHER recibe ROLE_FORBIDDEN en student-check', teacherStudentCheck.body, 'ROLE_FORBIDDEN');

const adminStudentCheck = await apiGet('/auth/student-check', adminToken);
assertStatus('ADMIN no puede acceder a student-check', adminStudentCheck.status, 403);
assertCode('ADMIN recibe ROLE_FORBIDDEN en student-check', adminStudentCheck.body, 'ROLE_FORBIDDEN');

console.table(results);

if (failures > 0) {
  console.error(`PC1 tiene ${failures} prueba(s) fallida(s).`);
  process.exit(1);
}

console.log('OK: PC1 verificado correctamente.');
