import type { BadgeKind } from './ui';

const dateFormat = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateTimeFormat = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

const STATUS: Record<string, { label: string; kind: BadgeKind }> = {
  OPEN: { label: 'Dentro', kind: 'live' },
  COMPLETED: { label: 'Completa', kind: 'ok' },
  INCOMPLETE_AUTO_VOIDED: { label: 'Incompleta', kind: 'warn' },
  MANUAL_CREATED: { label: 'Manual', kind: 'neutral' },
  MANUAL_CORRECTED: { label: 'Corregida', kind: 'neutral' },
};

const SOURCE: Record<string, string> = {
  STUDENT_QR: 'QR del estudiante',
  ADMIN_MANUAL: 'Manual (administrador)',
  TEACHER_MANUAL: 'Manual (docente)',
};

const AUDIT_ACTION: Record<string, string> = {
  STUDENT_CREATED: 'Estudiante creado',
  STUDENT_UPDATED: 'Estudiante editado',
  STUDENT_DEACTIVATED: 'Estudiante desactivado',
  TEACHER_CREATED: 'Docente creado',
  TEACHER_UPDATED: 'Docente editado',
  TEACHER_DEACTIVATED: 'Docente desactivado',
  INVITATION_SENT: 'Invitación enviada',
  ACADEMIC_PERIOD_ACTIVATED: 'Periodo activado',
  ACADEMIC_PERIOD_CLOSED: 'Periodo cerrado',
  KIOSK_SESSION_OPENED: 'Sesión de kiosko abierta',
  KIOSK_SESSION_REUSED: 'Sesión de kiosko reutilizada',
  KIOSK_SESSION_CLOSED: 'Sesión de kiosko cerrada',
  ATTENDANCE_ENTRY_REGISTERED: 'Entrada registrada',
  ATTENDANCE_EXIT_REQUIRES_ACTIVITIES: 'Salida pendiente de actividades',
  ATTENDANCE_EXIT_REGISTERED: 'Salida registrada',
  ATTENDANCE_MANUAL_CREATED: 'Registro manual creado',
  ATTENDANCE_MANUAL_CORRECTED: 'Registro corregido',
  ATTENDANCE_INCOMPLETE_AUTO_VOIDED: 'Sesión incompleta cerrada',
};

const AUDIT_ENTITY: Record<string, string> = {
  attendance_sessions: 'Registro de asistencia',
  kiosk_sessions: 'Sesión de kiosko',
  kiosks: 'Kiosko',
  students: 'Estudiante',
  teachers: 'Docente',
  academic_periods: 'Periodo',
};

const AUDIT_SOURCE: Record<string, string> = {
  API: 'Aplicación',
  SYSTEM_JOB: 'Proceso automático',
};

/** Si aparece un valor nuevo del backend: "SOME_VALUE" pasa a "Some value". */
function humanize(value: string): string {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ROLE: Record<string, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

/** Formatos y etiquetas legibles para la interfaz. Los valores internos nunca se muestran tal cual. */
export const fmt = {
  /** "24 nov 2026, 8:05" */
  dateTime(value: string | null | undefined): string {
    return value ? dateTimeFormat.format(new Date(value)) : '—';
  },

  /** "24 nov 2026" (para mostrar con la hora debajo) */
  date(value: string | null | undefined): string {
    return value ? dateFormat.format(new Date(value)) : '—';
  },

  /** "08:05"; vacío si no hay valor */
  time(value: string | null | undefined): string {
    return value ? timeFormat.format(new Date(value)) : '';
  },

  /** 135 -> "2 h 15 min" */
  duration(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
      return '—';
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) {
      return `${rest} min`;
    }
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  },

  /** 12.12 -> "12,1" (separador decimal de es-EC) */
  number(value: number | string | null | undefined): string {
    const parsed = value === null || value === undefined || value === '' ? Number.NaN : Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString('es-EC', { maximumFractionDigits: 1 }) : '—';
  },

  status(value: string): { label: string; kind: BadgeKind } {
    return STATUS[value] ?? { label: humanize(value), kind: 'neutral' };
  },

  source(value: string): string {
    return SOURCE[value] ?? humanize(value);
  },

  /** "2026-09-01" pasa a "1 sep 2026" (sin desfase de zona horaria) */
  dateOnly(value: string | null | undefined): string {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? dateFormat.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : '—';
  },

  auditAction(value: string): string {
    return AUDIT_ACTION[value] ?? humanize(value);
  },

  auditEntity(value: string): string {
    return AUDIT_ENTITY[value] ?? humanize(value);
  },

  auditSource(value: string): string {
    return AUDIT_SOURCE[value] ?? humanize(value);
  },

  role(value: string | null | undefined): string {
    return value ? (ROLE[value] ?? value) : '';
  },
};

export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, { label }]) => ({ value, label }));
export const SOURCE_OPTIONS = Object.entries(SOURCE).map(([value, label]) => ({ value, label }));
export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION).map(([value, label]) => ({ value, label }));
export const AUDIT_ENTITY_OPTIONS = Object.entries(AUDIT_ENTITY).map(([value, label]) => ({ value, label }));
export const AUDIT_SOURCE_OPTIONS = Object.entries(AUDIT_SOURCE).map(([value, label]) => ({ value, label }));
