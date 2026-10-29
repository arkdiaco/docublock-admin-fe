import { inject } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, platformMatchGuard } from './core/auth/auth.guards';
import { AuthStore } from './core/auth/auth.store';
import { HOME_ROUTE } from './core/auth/session.service';
import { ConsoleShellComponent } from './core/layout/console-shell.component';
import {
  CONSOLE_GROUPS,
  LEGACY_REDIRECTS,
  MY_ACCESS_PATH,
  OVERVIEW_PATH,
  canSeeItem,
  groupAccess,
  itemAccess,
  type ConsoleGroup,
  type ConsoleItem,
  type ConsoleSection,
} from './core/layout/console-nav';

const placeholder = () => import('./features/placeholder/pages/placeholder.component').then((m) => m.PlaceholderComponent);

const SECTION_PAGES: Partial<Record<ConsoleSection, Routes>> = {
  organizations: [
    {
      path: '',
      loadComponent: () => import('./features/organizations/pages/organizations.component').then((m) => m.OrganizationsComponent),
    },
    {
      path: ':id',
      loadComponent: () => import('./features/organizations/pages/organization-detail.component').then((m) => m.OrganizationDetailComponent),
    },
  ],
  staff: [{ path: '', loadComponent: () => import('./features/staff/pages/staff.component').then((m) => m.StaffComponent) }],
  health: [{ path: '', loadComponent: () => import('./features/status/pages/status.component').then((m) => m.StatusComponent) }],
};

const sectionRoute = (group: ConsoleGroup, item: ConsoleItem): Route => ({
  path: item.path,
  canMatch: [platformMatchGuard],
  data: { titleKey: item.labelKey, platform: itemAccess(group, item) },
  children: SECTION_PAGES[item.key] ?? [{ path: '', loadComponent: placeholder, data: { titleKey: item.labelKey } }],
});

const firstVisible = (group: ConsoleGroup) => () => {
  const owned = inject(AuthStore).platformPermissions();
  const item = group.items.find((candidate) => canSeeItem(owned, group, candidate));
  return item ? `/${group.path}/${item.path}` : HOME_ROUTE;
};

const groupRoute = (group: ConsoleGroup): Route => ({
  path: group.path,
  canMatch: [authGuard, platformMatchGuard],
  data: { titleKey: group.labelKey, platform: groupAccess(group.key) },
  children: [{ path: '', pathMatch: 'full', redirectTo: firstVisible(group) }, ...group.items.map((item) => sectionRoute(group, item))],
});

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
        path: OVERVIEW_PATH,
        canMatch: [authGuard],
        loadComponent: () => import('./features/overview/pages/overview.component').then((m) => m.OverviewComponent),
        data: { titleKey: 'nav.overview' },
      },
      ...CONSOLE_GROUPS.map(groupRoute),
      {
        path: MY_ACCESS_PATH,
        canMatch: [authGuard],
        loadComponent: () => import('./features/my-access/pages/my-access.component').then((m) => m.MyAccessComponent),
        data: { titleKey: 'mine.title' },
      },
      {
        path: 'sistema/diseno',
        canMatch: [authGuard],
        loadComponent: () => import('./features/design-system/pages/design-system.component').then((m) => m.DesignSystemComponent),
        data: { titleKey: 'sys.title' },
      },
      ...LEGACY_REDIRECTS.map(([path, redirectTo]): Route => ({ path, pathMatch: 'full', redirectTo })),
      { path: '', pathMatch: 'full', redirectTo: OVERVIEW_PATH },
    ],
  },
  { path: '**', redirectTo: OVERVIEW_PATH },
];
