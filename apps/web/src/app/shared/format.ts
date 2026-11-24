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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString('es-EC', { maximumFractionDigits: 1 }) : '—';
  },

  status(value: string): { label: string; kind: BadgeKind } {
    return STATUS[value] ?? { label: value, kind: 'neutral' };
  },

  source(value: string): string {
    return SOURCE[value] ?? value;
  },

  role(value: string | null | undefined): string {
    return value ? (ROLE[value] ?? value) : '';
  },
};

export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, { label }]) => ({ value, label }));
export const SOURCE_OPTIONS = Object.entries(SOURCE).map(([value, label]) => ({ value, label }));
