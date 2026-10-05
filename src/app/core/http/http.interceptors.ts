import {
  HttpClient,
  HttpContextToken,
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  shareReplay,
  switchMap,
  tap,
  throwError,
  type Observable,
} from 'rxjs';
import type { SessionResponse } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../config/api.tokens';
import { NotificationService } from '../ui/notification.service';

const isAbsolute = (url: string): boolean => /^https?:\/\//i.test(url);

const LOCAL_PREFIXES = ['/i18n/', '/assets/', 'i18n/', 'assets/'];
const isLocalAsset = (url: string): boolean => LOCAL_PREFIXES.some((p) => url.startsWith(p));

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAbsolute(req.url) || isLocalAsset(req.url)) return next(req);
  const base = inject(API_BASE_URL).replace(/\/+$/, '');
  const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return next(req.clone({ url: `${base}${path}` }));
};

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) return next(req);
  const token = inject(AuthStore).accessToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

let refreshInFlight: Observable<SessionResponse> | null = null;

const extractMessage = (error: HttpErrorResponse): string | null => {
  const body = error.error as { message?: string | string[] } | undefined;
  if (!body?.message) return null;
  return Array.isArray(body.message) ? body.message.join(' · ') : body.message;
};

const NO_REFRESH = ['/auth/refresh', '/auth/logout'];
const LOGIN_ROUTE = '/acceso';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const notify = inject(NotificationService);
  const http = inject(HttpClient);

  const toLogin = (): void => {
    store.clear();
    void router.navigate([LOGIN_ROUTE]);
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        !req.context.get(SKIP_AUTH) &&
        store.isAuthenticated() &&
        !NO_REFRESH.some((path) => req.url.includes(path))
      ) {
        const refreshToken = store.refreshTokenValue();
        if (!refreshToken) {
          toLogin();
          return throwError(() => error);
        }
        refreshInFlight ??= http.post<SessionResponse>('/auth/refresh', { refreshToken }).pipe(
          tap((session) =>
            store.setTokens({
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
            }),
          ),
          finalize(() => {
            refreshInFlight = null;
          }),
          shareReplay(1),
        );
        return refreshInFlight.pipe(
          switchMap((session) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } })),
          ),
          catchError((refreshError: unknown) => {
            if (refreshError instanceof HttpErrorResponse && refreshError.status === 401) {
              notify.info('Tu sesión expiró. Inicia sesión de nuevo.');
              toLogin();
            }
            return throwError(() => error);
          }),
        );
      }
      const silent = req.context.get(SILENT_ERRORS);
      if (error.status === 401 && !req.context.get(SKIP_AUTH) && store.isAuthenticated()) {
        toLogin();
      } else if (silent) {
        return throwError(() => error);
      } else if (error.status === 0) {
        notify.error('No se pudo conectar con el servidor');
      } else if (error.status >= 500) {
        notify.error('Ocurrió un error en el servidor. Inténtalo de nuevo.');
      } else if (error.status === 403) {
        notify.error(extractMessage(error) ?? 'No tienes permiso para esta acción');
      } else if (error.status !== 401) {
        const message = extractMessage(error);
        if (message) notify.error(message);
      }
      return throwError(() => error);
    }),
  );
};
