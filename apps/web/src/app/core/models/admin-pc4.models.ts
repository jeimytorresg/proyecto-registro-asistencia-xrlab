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

export interface AdminAttendanceActivity {
  id: string;
  description: string;
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
  activities: AdminAttendanceActivity[];
}

export interface AttendanceListResult {
  rows: AdminAttendanceRow[];
  total: number;
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

export interface AuditListResult {
  rows: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}
