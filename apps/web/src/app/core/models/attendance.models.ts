export type AttendanceScanAction =
  | 'ENTRY_REGISTERED'
  | 'EXIT_REQUIRES_ACTIVITIES';

export type AttendanceExitAction = 'EXIT_REGISTERED';

export interface AttendanceScanResponse {
  action: AttendanceScanAction;
  attendanceSessionId: string;
  entryAt: string | null;
  message: string;
}

export interface AttendanceExitResponse {
  action: AttendanceExitAction;
  attendanceSessionId: string;
  entryAt: string;
  exitAt: string;
  durationMinutes: number;
  activities: string[];
  message: string;
}
