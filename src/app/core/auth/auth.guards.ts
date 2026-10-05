import { inject } from '@angular/core';
import { Router, type CanActivateFn, type CanMatchFn, type Route } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NotificationService } from '../ui/notification.service';
import { AuthStore } from './auth.store';
import { HOME_ROUTE, LOGIN_ROUTE } from './session.service';

export const authGuard: CanMatchFn = (_route, segments) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated() && store.platformStaff()) return true;
  const redirect = '/' + segments.map((s) => s.path).join('/');
  return router.createUrlTree([LOGIN_ROUTE], { queryParams: { redirect } });
};

export const guestGuard: CanMatchFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.isAuthenticated() && store.platformStaff()
    ? router.createUrlTree([HOME_ROUTE])
    : true;
};

export const platformPermissionGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const required = (route.data?.['platform'] as string[] | undefined) ?? [];
  if (required.length === 0 || store.hasAnyPlatformPermission(required)) return true;
  inject(NotificationService).error(inject(TranslateService).instant('nav.noAccess') as string);
  return inject(Router).createUrlTree([HOME_ROUTE]);
};

export const platformMatchGuard: CanMatchFn = (route: Route) => {
  const store = inject(AuthStore);
  const required = (route.data?.['platform'] as string[] | undefined) ?? [];
  if (required.length === 0 || store.hasAnyPlatformPermission(required)) return true;
  return inject(Router).createUrlTree([HOME_ROUTE]);
};
