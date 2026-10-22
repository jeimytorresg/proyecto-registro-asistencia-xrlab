import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./core/pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'student',
    canActivate: [roleGuard(['STUDENT'])],
    loadComponent: () => import('./student/pages/student-home/student-home').then((m) => m.StudentHome),
  },
  {
    path: 'kiosk',
    canActivate: [roleGuard(['ADMIN', 'TEACHER'])],
    loadComponent: () => import('./kiosk/pages/kiosk-home/kiosk-home').then((m) => m.KioskHome),
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['ADMIN', 'TEACHER'])],
    loadComponent: () => import('./admin/layouts/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./admin/pages/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./admin/pages/admin-attendance/admin-attendance').then((m) => m.AdminAttendance),
      },
      {
        path: 'students',
        loadComponent: () => import('./admin/pages/admin-students/admin-students').then((m) => m.AdminStudents),
      },
      {
        path: 'manual-records',
        loadComponent: () => import('./admin/pages/admin-manual-records/admin-manual-records').then((m) => m.AdminManualRecords),
      },
      {
        path: 'audit',
        loadComponent: () => import('./admin/pages/admin-audit/admin-audit').then((m) => m.AdminAudit),
      },
      {
        path: 'teachers',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-teachers/admin-teachers').then((m) => m.AdminTeachers),
      },
      {
        path: 'periods',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-periods/admin-periods').then((m) => m.AdminPeriods),
      },
      {
        path: 'kiosks',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-kiosks/admin-kiosks').then((m) => m.AdminKiosks),
      },
    ],
  },
  {
    path: 'error',
    loadComponent: () => import('./shared/pages/error-page/error-page').then((m) => m.ErrorPage),
  },
  { path: '**', redirectTo: 'error' },
];
