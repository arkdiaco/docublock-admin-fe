import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
import type { OrgSettings } from '../../data/validations.models';
import { OrgSettingsTabComponent } from './org-settings-tab.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const ORG = { id: 'org-1', businessName: 'Sierra Norte' } as PlatformOrgDetail;

const SETTINGS: OrgSettings = {
  validations: { identityValid: true, biometricValid: false, ani: true, liveness: false },
  selfService: { whatsapp: true, skipVisualSign: false, blockComments: false, documentPhotos: true },
};

describe('OrgSettingsTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgSettingsTabComponent],
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
    const fixture = TestBed.createComponent(OrgSettingsTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1/settings').flush(SETTINGS);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-module-toggle')).not.toBeNull();
    });
    return { fixture, host };
  };

  const interruptores = (host: HTMLElement) => [
    ...host.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
  ];

  it('muestra los cuatro ajustes en Avisos y Firma con su estado, sin llaves crudas', async () => {
    const { host } = await montar();
    expect([...host.querySelectorAll('h2')].map((h) => h.textContent?.trim())).toEqual([
      'Avisos',
      'Firma',
    ]);
    expect(interruptores(host).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Avisos por WhatsApp',
      'Saltar la firma visual',
      'Rechazar sin escribir motivo',
      'Fotos del documento',
    ]);
    expect(interruptores(host).map((b) => b.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'true',
    ]);
    expect(host.textContent).not.toMatch(/\b(ost|common|sub)\.[a-zA-Z]/);
  });

  it('sin clients:manage los interruptores quedan bloqueados', async () => {
    const { host } = await montar(['platform:clients']);
    expect(interruptores(host).every((b) => b.disabled)).toBe(true);
  });

  it('saltar la firma visual pide motivo, manda solo esa llave y pinta el nuevo estado', async () => {
    const { fixture, host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Lo pidió el cliente' });
    interruptores(host)[1].click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0]).toMatchObject({
      title: 'ost.onTitle',
      params: { name: 'Saltar la firma visual', org: 'Sierra Norte' },
      reason: { required: true },
    });
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'PATCH' && r.url === '/platform/organizations/org-1/settings',
      );
    });
    expect(req.request.body).toEqual({ skipVisualSign: true, reason: 'Lo pidió el cliente' });
    req.flush({ ...SETTINGS, selfService: { ...SETTINGS.selfService, skipVisualSign: true } });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(interruptores(host)[1].getAttribute('aria-checked')).toBe('true');
    });
  });

  it('si se cancela el diálogo no se manda nada', async () => {
    const { host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    interruptores(host)[0].click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    http.expectNone((r) => r.method === 'PATCH');
  });
});
