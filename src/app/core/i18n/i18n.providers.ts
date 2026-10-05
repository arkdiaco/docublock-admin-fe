import { HttpClient } from '@angular/common/http';
import {
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import {
  TranslateLoader,
  TranslateService,
  provideTranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { calendarLocale } from './calendar-locale';

const LANG_KEY = 'db.lang';

class HttpTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`/i18n/${lang}.json`);
  }
}

export function provideI18n(): (Provider | EnvironmentProviders)[] {
  return [
    provideTranslateService({
      loader: { provide: TranslateLoader, useClass: HttpTranslateLoader },
      fallbackLang: 'es',
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      const primeng = inject(PrimeNG);
      const stored = localStorage.getItem(LANG_KEY) as 'es' | 'en' | null;
      translate.addLangs(['es', 'en']);
      const applyCalendar = (lang: string): void =>
        primeng.setTranslation(
          calendarLocale(lang, {
            today: translate.instant('calendar.today') as string,
            clear: translate.instant('calendar.clear') as string,
          }),
        );
      translate.onLangChange.subscribe((event) => applyCalendar(event.lang));
      return firstValueFrom(translate.use(stored ?? environment.defaultLang)).then(
        () => undefined,
        () => undefined,
      );
    }),
  ];
}

export function persistLang(lang: 'es' | 'en'): void {
  localStorage.setItem(LANG_KEY, lang);
}
