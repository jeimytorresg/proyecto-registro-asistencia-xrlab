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

export interface AttendanceListFilters {
  status?: string;
  source?: string;
  studentEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface DashboardSummary {
  studentsInside: number;
  entriesToday: number;
  exitsToday: number;
  incompleteSessions: number;
  totalHoursCurrentPeriod: number;
  latestRows: AdminAttendanceRow[];
}
