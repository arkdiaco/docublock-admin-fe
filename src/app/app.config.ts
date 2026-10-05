import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  type ApplicationConfig,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { AppUpdate } from './core/app-update/app-update.service';
import { SessionService } from './core/auth/session.service';
import {
  authInterceptor,
  baseUrlInterceptor,
  errorInterceptor,
} from './core/http/http.interceptors';
import { provideI18n } from './core/i18n/i18n.providers';
import { ConsoleTitleStrategy } from './core/layout/console-title.strategy';
import { DocublockPreset } from './core/theme/docublock-preset';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(SessionService).restore()),
    provideAppInitializer(() => inject(AppUpdate).start()),
    { provide: LOCALE_ID, useValue: 'es' },
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withNavigationErrorHandler((error) => void inject(AppUpdate).recover(error.error, error.url)),
    ),
    { provide: TitleStrategy, useClass: ConsoleTitleStrategy },
    provideHttpClient(withInterceptors([baseUrlInterceptor, authInterceptor, errorInterceptor])),
    providePrimeNG({
      theme: {
        preset: DocublockPreset,
        options: { darkModeSelector: false, cssLayer: false },
      },
      ripple: true,
    }),
    MessageService,
    ...provideI18n(),
  ],
};
