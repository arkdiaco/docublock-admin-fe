import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'estado',
    loadComponent: () => import('./features/status/pages/status.component').then((m) => m.StatusComponent),
    data: { titleKey: 'status.title' },
  },
  {
    path: 'sistema',
    loadComponent: () => import('./features/design-system/pages/design-system.component').then((m) => m.DesignSystemComponent),
    data: { titleKey: 'sys.title' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'estado' },
  { path: '**', redirectTo: 'estado' },
];
