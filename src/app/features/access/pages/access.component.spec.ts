import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { AccessComponent } from './access.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('AccessComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = () => {
    const fixture = TestBed.createComponent(AccessComponent);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  const escribir = (host: HTMLElement, sel: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(sel)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('arranca en el correo, con el panel firmado, y el botón se habilita con un correo válido', () => {
    const { fixture, host } = montar();
    expect(host.querySelector('.dba-eyebrow')?.textContent).toContain('Paso 1 de 2');
    expect(host.querySelector('.ac__claim')?.textContent).toContain('firmada');
    const cta = host.querySelector<HTMLButtonElement>('.ac__cta')!;
    expect(cta.disabled).toBe(true);
    escribir(host, '#ac-email', 'ada@docublock.co');
    fixture.detectChanges();
    expect(cta.disabled).toBe(false);
    expect(host.textContent).not.toMatch(/\b(access|shell|env)\.[a-zA-Z]/);
  });

  it('enviar el código pasa al paso 2 y muestra a dónde fue', async () => {
    const { fixture, host } = montar();
    escribir(host, '#ac-email', 'ada@docublock.co');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/request-otp').flush({
      sent: true,
      channel: 'ad*@docublock.co',
      resendAfterSeconds: 45,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.dba-eyebrow')?.textContent).toContain('Paso 2 de 2');
    expect(host.querySelector('.ac__sent')?.textContent).toContain('ad*@docublock.co');
    expect(host.querySelector('#ac-code')).not.toBeNull();
  });

  it('un correo que no es de plataforma muestra el error en la misma pantalla y no avanza', async () => {
    const { fixture, host } = montar();
    escribir(host, '#ac-email', 'ajeno@fuera.com');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/request-otp').flush(
      { message: 'no', code: 'CUENTA_NO_EXISTE' },
      { status: 404, statusText: 'Not Found' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.ac__error')?.textContent).toContain('No encontramos personal');
    expect(host.querySelector('.dba-eyebrow')?.textContent).toContain('Paso 1 de 2');
  });

  it('con el código correcto entra y navega al destino pedido', async () => {
    const ir = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    window.history.replaceState({}, '', '/acceso?redirect=%2Forganizaciones');
    const { fixture, host } = montar();
    escribir(host, '#ac-email', 'ada@docublock.co');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/request-otp').flush({ sent: true, channel: 'c', resendAfterSeconds: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    escribir(host, '#ac-code', '123456');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/login').flush({ accessToken: 'a', refreshToken: 'r', sid: 's', expiresIn: 900 });
    await Promise.resolve();
    http.expectOne('/platform/auth/me').flush({
      user: { id: 'a1', names: 'Ada', surNames: 'Lovelace', email: 'ada@docublock.co', identification: '' },
      permissions: [],
      memberships: [],
      platformStaff: true,
      platformPermissions: ['platform:platform'],
    });
    await fixture.whenStable();
    expect(ir).toHaveBeenCalledWith('/organizaciones');
    window.history.replaceState({}, '', '/');
  });

  it('un código equivocado deja el error y no navega', async () => {
    const ir = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, host } = montar();
    escribir(host, '#ac-email', 'ada@docublock.co');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/request-otp').flush({ sent: true, channel: 'c', resendAfterSeconds: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    escribir(host, '#ac-code', '000000');
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ac__cta')!.click();
    http.expectOne('/platform/auth/login').flush(
      { message: 'no', code: 'OTP_INVALIDO' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.ac__error')?.textContent).toContain('no es válido');
    expect(ir).not.toHaveBeenCalled();
  });
});
