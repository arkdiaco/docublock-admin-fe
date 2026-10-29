import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { StatusComponent } from './status.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const BASE = 'http://api.test/api/core';

describe('StatusComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = () => {
    const fixture = TestBed.createComponent(StatusComponent);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('comprueba el backend al entrar, sin token, y lo reporta como que responde', async () => {
    const { fixture, host } = montar();
    expect(host.querySelector('.status__check')?.textContent).toContain('Comprobando');
    const req = http.expectOne('/health');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: 'ok' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.status__check .st--active')?.textContent).toContain('Responde');
    expect(host.querySelector('.status__detail')?.textContent).toContain('ok');
    expect(host.textContent).not.toMatch(/\b(status|shell)\.[a-z]/);
  });

  it('si el backend falla lo dice con el código y permite reintentar', async () => {
    const { fixture, host } = montar();
    http.expectOne('/health').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.status__check .st--suspended')?.textContent).toContain('No responde');
    expect(host.querySelector('.status__detail')?.textContent).toContain('HTTP 503');
    host.querySelector<HTMLButtonElement>('.status__retry')!.click();
    http.expectOne('/health').flush({ status: 'ok' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.status__check .st--active')).not.toBeNull();
  });
});
