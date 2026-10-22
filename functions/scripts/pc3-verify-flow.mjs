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

async function checkedFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    console.error('\nNo se pudo conectar con el emulador.');
    console.error('Verifica que esté activo con: npm run emulators');
    console.error(`URL intentada: ${url}\n`);
    throw error;
  }
}

async function signIn(email) {
  const response = await checkedFetch(authSignInUrl, {
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

  if (!response.ok || !body.idToken) {
    throw new Error(`No se pudo iniciar sesión con ${email}: ${JSON.stringify(body)}`);
  }

  return body.idToken;
}

async function apiGet(path, token) {
  const response = await checkedFetch(`${apiBaseUrl}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

async function apiPost(path, token, body) {
  const response = await checkedFetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json();

  return {
    status: response.status,
    body: responseBody,
  };
}

console.log('Verificando PC3 con emuladores locales');
console.log(`Project ID: ${projectId}`);
console.log(`Auth Emulator: ${authEmulatorHost}`);
console.log(`API: ${apiBaseUrl}`);

const health = await apiGet('/health');
record('health público 200', health.status === 200, `status=${health.status}`);
record('health ok=true', health.body?.ok === true, JSON.stringify(health.body));

const adminToken = await signIn('admin@xrlab.test');
const teacherToken = await signIn('docente@xrlab.test');
const studentToken = await signIn('estudiante@xrlab.test');

const openSession = await apiPost('/kiosk/sessions/open', teacherToken, {
  kioskCode: 'XR-KIOSK-01',
});

record('docente abre sesión kiosko', openSession.status === 200, `status=${openSession.status}`);

const kioskSessionId = openSession.body?.data?.session?.id;

record(
  'kioskSessionId recibido',
  typeof kioskSessionId === 'string' && kioskSessionId.length > 0,
  kioskSessionId,
);

const batch = await apiPost('/kiosk/qr/batch', teacherToken, {
  kioskSessionId,
  batchSeconds: 60,
});

record('docente obtiene batch QR', batch.status === 200, `status=${batch.status}`);

const tokens = batch.body?.data?.tokens ?? [];
const currentToken = tokens[0]?.token;

record(
  'batch contiene tokens',
  Array.isArray(tokens) && tokens.length > 0 && typeof currentToken === 'string',
  `tokens=${tokens.length}`,
);

const entryScan = await apiPost('/attendance/scan', studentToken, {
  qrToken: currentToken,
  clientInfo: {
    userAgent: 'pc3-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('estudiante registra entrada', entryScan.status === 200, `status=${entryScan.status}`);
record(
  'acción ENTRY_REGISTERED',
  entryScan.body?.data?.action === 'ENTRY_REGISTERED',
  entryScan.body?.data?.action,
);

const exitIntentScan = await apiPost('/attendance/scan', studentToken, {
  qrToken: currentToken,
  clientInfo: {
    userAgent: 'pc3-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('estudiante inicia salida', exitIntentScan.status === 200, `status=${exitIntentScan.status}`);
record(
  'acción EXIT_REQUIRES_ACTIVITIES',
  exitIntentScan.body?.data?.action === 'EXIT_REQUIRES_ACTIVITIES',
  exitIntentScan.body?.data?.action,
);

const attendanceSessionId = exitIntentScan.body?.data?.attendanceSessionId;

const emptyExit = await apiPost('/attendance/exit', studentToken, {
  qrToken: currentToken,
  attendanceSessionId,
  activities: [],
  clientInfo: {
    userAgent: 'pc3-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record(
  'salida sin actividades bloqueada',
  emptyExit.status === 400 || emptyExit.status === 422,
  `status=${emptyExit.status}; code=${emptyExit.body?.error?.code}`,
);

const exitResponse = await apiPost('/attendance/exit', studentToken, {
  qrToken: currentToken,
  attendanceSessionId,
  activities: [
    'Prueba PC3: configuración de visor XR',
    'Prueba PC3: documentación de evidencia de laboratorio',
  ],
  clientInfo: {
    userAgent: 'pc3-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('estudiante registra salida', exitResponse.status === 200, `status=${exitResponse.status}`);
record(
  'acción EXIT_REGISTERED',
  exitResponse.body?.data?.action === 'EXIT_REGISTERED',
  exitResponse.body?.data?.action,
);
record(
  'duración calculada',
  typeof exitResponse.body?.data?.durationMinutes === 'number',
  String(exitResponse.body?.data?.durationMinutes),
);

const adminAttendance = await apiGet('/admin/attendance?status=COMPLETED&studentEmail=estudiante', adminToken);

record('admin consulta registros', adminAttendance.status === 200, `status=${adminAttendance.status}`);
record(
  'admin ve registro completado',
  (adminAttendance.body?.data?.rows ?? []).some((row) => row.status === 'COMPLETED'),
  `rows=${adminAttendance.body?.data?.rows?.length ?? 0}`,
);

const teacherAttendance = await apiGet('/admin/attendance?status=COMPLETED&studentEmail=estudiante', teacherToken);

record('docente consulta registros', teacherAttendance.status === 200, `status=${teacherAttendance.status}`);
record(
  'docente ve estudiante asignado',
  (teacherAttendance.body?.data?.rows ?? []).some((row) => row.studentEmail === 'estudiante@xrlab.test'),
  `rows=${teacherAttendance.body?.data?.rows?.length ?? 0}`,
);

const studentAdminAttempt = await apiGet('/admin/attendance', studentToken);

record(
  'estudiante no consulta panel admin',
  studentAdminAttempt.status === 403,
  `status=${studentAdminAttempt.status}`,
);

const dashboard = await apiGet('/admin/dashboard', teacherToken);

record('dashboard docente responde', dashboard.status === 200, `status=${dashboard.status}`);
record(
  'dashboard tiene métricas',
  typeof dashboard.body?.data?.entriesToday === 'number' &&
    typeof dashboard.body?.data?.exitsToday === 'number',
  JSON.stringify(dashboard.body?.data),
);

const closeSession = await apiPost('/kiosk/sessions/close', teacherToken, {
  kioskSessionId,
});

record('docente cierra sesión kiosko', closeSession.status === 200, `status=${closeSession.status}`);

console.table(results);

if (failures > 0) {
  console.error(`PC3 tiene ${failures} prueba(s) fallida(s).`);
  process.exit(1);
}

console.log('OK: PC3 verificado correctamente.');
