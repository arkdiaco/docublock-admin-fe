import type { Routes } from '@angular/router';
import { authGuard, guestGuard, platformMatchGuard } from './core/auth/auth.guards';
import { ConsoleShellComponent } from './core/layout/console-shell.component';
import { ROUTE_ACCESS } from './core/layout/console-nav';

const placeholder = () => import('./features/placeholder/pages/placeholder.component').then((m) => m.PlaceholderComponent);

export const routes: Routes = [
  {
    path: 'acceso',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/access/pages/access.component').then((m) => m.AccessComponent),
    data: { titleKey: 'access.title' },
  },
  {
    path: '',
    component: ConsoleShellComponent,
    children: [
      {
        path: 'panel',
        canMatch: [authGuard],
        loadComponent: () => import('./features/overview/pages/overview.component').then((m) => m.OverviewComponent),
        data: { titleKey: 'nav.overview', platform: ROUTE_ACCESS.overview },
      },
      {
        path: 'organizaciones',
        canMatch: [authGuard, platformMatchGuard],
        data: { titleKey: 'nav.organizations', platform: ROUTE_ACCESS.organizations },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/organizations/pages/organizations.component').then((m) => m.OrganizationsComponent),
          },
          { path: ':id', loadComponent: placeholder, data: { titleKey: 'nav.organizations' } },
        ],
      },
      {
        path: 'usuarios',
        canMatch: [authGuard, platformMatchGuard],
        loadComponent: placeholder,
        data: { titleKey: 'nav.users', platform: ROUTE_ACCESS.users },
      },
      {
        path: 'planes',
        canMatch: [authGuard, platformMatchGuard],
        loadComponent: placeholder,
        data: { titleKey: 'nav.plans', platform: ROUTE_ACCESS.plans },
      },
      {
        path: 'facturacion',
        canMatch: [authGuard, platformMatchGuard],
        loadComponent: placeholder,
        data: { titleKey: 'nav.billing', platform: ROUTE_ACCESS.billing },
      },
      {
        path: 'seguridad',
        canMatch: [authGuard, platformMatchGuard],
        loadComponent: placeholder,
        data: { titleKey: 'nav.security', platform: ROUTE_ACCESS.security },
      },
      {
        path: 'auditoria',
        canMatch: [authGuard, platformMatchGuard],
        loadComponent: placeholder,
        data: { titleKey: 'nav.audit', platform: ROUTE_ACCESS.audit },
      },
      {
        path: 'sistema',
        data: { titleKey: 'nav.system', platform: ROUTE_ACCESS.system },
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/status/pages/status.component').then((m) => m.StatusComponent),
          },
          {
            path: 'diseno',
            loadComponent: () => import('./features/design-system/pages/design-system.component').then((m) => m.DesignSystemComponent),
            data: { titleKey: 'sys.title' },
          },
        ],
      },
      { path: 'estado', redirectTo: 'sistema' },
      { path: '', pathMatch: 'full', redirectTo: 'panel' },
    ],
  },
  { path: '**', redirectTo: 'panel' },
];
