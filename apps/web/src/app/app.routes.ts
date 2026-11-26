import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Iniciar sesión',
    loadComponent: () => import('./core/pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'student',
    title: 'Registrar asistencia',
    canActivate: [roleGuard(['STUDENT'])],
    loadComponent: () => import('./student/pages/student-home/student-home').then((m) => m.StudentHome),
  },
  {
    path: 'kiosk',
    title: 'Kiosko',
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
        title: 'Resumen operativo',
        loadComponent: () => import('./admin/pages/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'attendance',
        title: 'Registros de asistencia',
        loadComponent: () => import('./admin/pages/admin-attendance/admin-attendance').then((m) => m.AdminAttendance),
      },
      {
        path: 'students',
        title: 'Estudiantes',
        loadComponent: () => import('./admin/pages/admin-students/admin-students').then((m) => m.AdminStudents),
      },
      {
        path: 'manual-records',
        title: 'Registro manual',
        loadComponent: () => import('./admin/pages/admin-manual-records/admin-manual-records').then((m) => m.AdminManualRecords),
      },
      {
        path: 'audit',
        title: 'Bitácora de acciones',
        loadComponent: () => import('./admin/pages/admin-audit/admin-audit').then((m) => m.AdminAudit),
      },
      {
        path: 'teachers',
        title: 'Docentes',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-teachers/admin-teachers').then((m) => m.AdminTeachers),
      },
      {
        path: 'periods',
        title: 'Periodos académicos',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-periods/admin-periods').then((m) => m.AdminPeriods),
      },
      {
        path: 'kiosks',
        title: 'Kioskos autorizados',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () => import('./admin/pages/admin-kiosks/admin-kiosks').then((m) => m.AdminKiosks),
      },
    ],
  },
  ...(isDevMode()
    ? [
        {
          path: 'ui-kit',
          loadComponent: () => import('./shared/pages/ui-kit/ui-kit').then((m) => m.UiKit),
        },
      ]
    : []),
  {
    path: 'error',
    title: 'Página no disponible',
    loadComponent: () => import('./shared/pages/error-page/error-page').then((m) => m.ErrorPage),
  },
  { path: '**', redirectTo: 'error' },
];
