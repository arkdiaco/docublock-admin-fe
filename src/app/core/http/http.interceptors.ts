import {
  HttpClient,
  HttpContextToken,
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
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

const LOGOUT_PATH = '/platform/auth/logout';
const NO_REFRESH = ['/platform/auth/refresh', LOGOUT_PATH];
const LOGIN_ROUTE = '/acceso';

const SESSION_GONE = new Set([400, 401, 403]);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const injector = inject(Injector);
  const notify = (): NotificationService => injector.get(NotificationService);
  const http = inject(HttpClient);
  const t = (key: string): string => injector.get(TranslateService).instant(key) as string;

  const toLogin = (): void => {
    store.clear();
    void router.navigate([LOGIN_ROUTE]);
  };

  const report = (error: HttpErrorResponse): Observable<never> => {
    if (error.status === 401 && !req.context.get(SKIP_AUTH) && store.isAuthenticated() && !req.url.includes(LOGOUT_PATH)) {
      notify().info(t('http.sessionExpired'));
      toLogin();
    } else if (req.context.get(SILENT_ERRORS)) {
      return throwError(() => error);
    } else if (error.status === 0) {
      notify().error(t('http.offline'));
    } else if (error.status >= 500) {
      notify().error(t('http.server'));
    } else if (error.status === 403) {
      notify().error(extractMessage(error) ?? t('http.forbidden'));
    } else if (error.status !== 401) {
      const message = extractMessage(error);
      if (message) notify().error(message);
    }
    return throwError(() => error);
  };

  const refreshed = (refreshToken: string): Observable<SessionResponse> =>
    (refreshInFlight ??= http.post<SessionResponse>('/platform/auth/refresh', { refreshToken }).pipe(
      tap((session) => store.setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken })),
      finalize(() => {
        refreshInFlight = null;
      }),
      shareReplay(1),
    ));

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const canRefresh =
        error.status === 401 &&
        !req.context.get(SKIP_AUTH) &&
        store.isAuthenticated() &&
        !NO_REFRESH.some((path) => req.url.includes(path));
      if (!canRefresh) return report(error);
      const refreshToken = store.refreshTokenValue();
      if (!refreshToken) return report(error);
      return refreshed(refreshToken).pipe(
        catchError((refreshError: unknown) => {
          const status = refreshError instanceof HttpErrorResponse ? refreshError.status : 0;
          if (SESSION_GONE.has(status)) {
            if (store.isAuthenticated()) {
              notify().info(t('http.sessionExpired'));
              toLogin();
            }
          } else {
            notify().error(t('http.refreshUnavailable'));
          }
          return throwError(() => error);
        }),
        switchMap((session) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } })).pipe(
            catchError((retryError: HttpErrorResponse) => report(retryError)),
          ),
        ),
      );
    }),
  );
};
