import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import type { OrgCredits, OrgSettings, ValidationPricing } from '../../data/validations.models';
import { CreditFormComponent } from './credit-form.component';
import { ValidationsTabComponent } from './validations-tab.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const ORG = {
  id: 'org-1',
  businessName: 'Sierra Norte',
  tributaryNumber: '900123456',
} as PlatformOrgDetail;

const SETTINGS: OrgSettings = {
  validations: { identityValid: true, biometricValid: false, ani: true, liveness: false },
  selfService: { blockComments: false, documentPhotos: true },
};

const CREDITS: OrgCredits = {
  identity: { unlimited: false, remaining: 40 },
  biometric: { unlimited: true, remaining: 0 },
  ani: { unlimited: false, remaining: 0 },
};

const PRICING: ValidationPricing = {
  mode: 'package',
  currency: 'COP',
  packagePrice: 3500,
  packageIncludes: ['ani', 'macherFacial'],
  unitPrices: { ani: 1200, liveness: 800, macherFacial: 2000 },
  configured: true,
};

describe('ValidationsTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidationsTabComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const responder = () => {
    http.expectOne('/platform/organizations/org-1/settings').flush(SETTINGS);
    http.expectOne('/platform/validation-credits/org-1').flush(CREDITS);
    http.expectOne('/platform/validation-credits/org-1/pricing').flush(PRICING);
    http
      .expectOne((r) => r.url === '/platform/validation-credits/org-1/log')
      .flush({
        total: 1,
        items: [
          {
            id: 'l1',
            creditType: 'identity',
            action: 'recharge',
            amount: 40,
            previousRemaining: 0,
            newRemaining: 40,
            createdAt: '2026-10-20T15:00:00.000Z',
          },
        ],
      });
  };

  const montar = async (permisos: string[] = ['platform:clients', 'platform:clients:manage']) => {
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'x',
        names: 'Marta',
        surNames: 'Vidal',
        email: 'm@d.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });
    const fixture = TestBed.createComponent(ValidationsTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    responder();
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-module-toggle')).not.toBeNull();
    });
    return { fixture, host };
  };

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) =>
      b.textContent?.includes(texto),
    );

  it('pinta validaciones con nombres públicos, saldos, precio y movimientos', async () => {
    const { host } = await montar();
    const texto = host.textContent ?? '';
    expect(texto).toContain('Validación contra documento');
    expect(texto).toContain('Biometría avanzada');
    expect(texto).toContain('Consultar Registraduría');
    expect(texto).toContain('Liveness');
    expect(texto).not.toContain('ANI');
    expect(texto).toContain('Ilimitado');
    expect(texto).toContain('Paquete');
    expect(texto).toContain('Recarga');
    expect(host.querySelectorAll('[role="switch"][aria-checked="true"]').length).toBe(2);
    expect(texto).not.toMatch(/\b(val|common|sub|tbl)\.[a-zA-Z]/);
  });

  it('sin clients:manage los interruptores quedan bloqueados y no hay ajustes', async () => {
    const { host } = await montar(['platform:clients']);
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')].every((b) => b.disabled),
    ).toBe(true);
    expect(boton(host, 'Ajustar')).toBeUndefined();
    expect(boton(host, 'Editar precio')).toBeUndefined();
    expect(boton(host, 'Cuenta de cobro')).toBeDefined();
  });

  it('habilitar una validación pide motivo y manda solo esa llave', async () => {
    const { host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Lo contrató' });
    host.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1].click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].reason?.required).toBe(true);
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'PATCH' && r.url === '/platform/organizations/org-1/settings',
      );
    });
    expect(req.request.body).toEqual({ biometricValid: true, reason: 'Lo contrató' });
    req.flush({ ...SETTINGS, validations: { ...SETTINGS.validations, biometricValid: true } });
  });

  it('recargar créditos manda la recarga con motivo y refresca los movimientos', async () => {
    const { fixture } = await montar();
    (fixture.componentInstance as unknown as { pickCredit: (k: string) => void }).pickCredit(
      'identity',
    );
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(CreditFormComponent))
      .componentInstance as unknown as {
      submitted: { emit: (v: unknown) => void };
    };
    form.submitted.emit({ change: { recharge: 10 }, reason: 'Compra' });
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === '/platform/validation-credits/org-1',
    );
    expect(req.request.body).toEqual({ identity: { recharge: 10 }, reason: 'Compra' });
    req.flush({ ...CREDITS, identity: { unlimited: false, remaining: 50 } });
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.url === '/platform/validation-credits/org-1/log')
        .flush({ total: 0, items: [] }),
    );
  });
});
