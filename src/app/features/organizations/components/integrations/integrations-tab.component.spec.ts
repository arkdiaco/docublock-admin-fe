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
import type { OrgIntegrations } from '../../data/integrations.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { IntegrationsTabComponent } from './integrations-tab.component';

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

const VIEW: OrgIntegrations = {
  apiKey: { hasKey: true, preview: '···abc123', issuedAt: '2026-09-03T00:00:00.000Z' },
  classicWebhook: {
    url: 'https://sierra.co/hook',
    enabled: true,
    secretConfigured: true,
    secretRotatedAt: null,
    extraUrls: [],
  },
  bridge: {
    state: 'ok',
    keys: [
      {
        id: 'k1',
        name: 'ERP',
        prefix: 'dbk_live_ab',
        scopes: ['documents:write'],
        state: 'active',
        expiresAt: null,
        lastUsedAt: '2026-10-20T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    endpoints: [
      {
        id: 'w1',
        url: 'https://sierra.co/v2',
        events: ['document.signed'],
        contract: 'v2',
        enabled: false,
      },
    ],
  },
};

const URL = '/platform/organizations/org-1/integrations';

describe('IntegrationsTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntegrationsTabComponent],
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

  const montar = async (
    view: OrgIntegrations = VIEW,
    permisos: string[] = ['platform:clients', 'platform:clients:manage'],
  ) => {
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
    const fixture = TestBed.createComponent(IntegrationsTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    http.expectOne(URL).flush(view);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.it__card')).not.toBeNull();
    });
    return { fixture, host };
  };

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) =>
      b.textContent?.includes(texto),
    );

  it('muestra la apiKey solo por su final, el webhook clásico y lo del bridge', async () => {
    const { host } = await montar();
    const texto = host.textContent ?? '';
    expect(texto).toContain('···abc123');
    expect(texto).toContain('https://sierra.co/hook');
    expect(texto).toContain('ERP');
    expect(texto).toContain('dbk_live_ab');
    expect(texto).toContain('https://sierra.co/v2');
    expect(texto).toContain('Claves de integración v2 (1)');
    expect(texto).not.toMatch(/\b(integ|common|sub|tbl)\.[a-zA-Z]/);
  });

  it('sin clients:manage no se puede rotar', async () => {
    const { host } = await montar(VIEW, ['platform:clients']);
    expect(boton(host, 'Rotar')).toBeUndefined();
  });

  it('si el bridge no responde lo dice sin esconder la apiKey', async () => {
    const { host } = await montar({
      ...VIEW,
      bridge: { state: 'unavailable', keys: [], endpoints: [] },
    });
    expect(host.textContent).toContain('El servicio de integraciones no respondió');
    expect(host.textContent).toContain('···abc123');
  });

  it('rotar pide NIT y motivo, muestra la clave una sola vez y recarga', async () => {
    const { fixture, host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Clave filtrada' });
    boton(host, 'Rotar API key')!.click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].challenge?.identifier).toBe('900123456');
    expect(abrir.mock.calls[0][0].reason?.required).toBe(true);
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url.endsWith('/integrations/api-key/rotate'),
      );
    });
    expect(req.request.body).toEqual({ reason: 'Clave filtrada' });
    req.flush({ apiKey: 'eyJ.nueva.clave', issuedAt: '2026-10-29T00:00:00.000Z' });
    await vi.waitFor(() =>
      http.expectOne(URL).flush({ ...VIEW, apiKey: { hasKey: true, preview: '···clave' } }),
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.body.textContent).toContain('eyJ.nueva.clave');
    });
    const listo = [
      ...document.body.querySelectorAll<HTMLButtonElement>('db-modal-shell button'),
    ].find((b) => b.textContent?.includes('Ya la guardé'))!;
    listo.click();
    fixture.detectChanges();
    expect(document.body.textContent).not.toContain('eyJ.nueva.clave');
  });

  it('sin apiKey ofrece generarla sin pedir NIT', async () => {
    const { host } = await montar({
      ...VIEW,
      apiKey: { hasKey: false },
      bridge: { state: 'no_api_key', keys: [], endpoints: [] },
    });
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    boton(host, 'Generar API key')!.click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].challenge).toBeUndefined();
    expect(host.textContent).toContain('genera la API key primero');
  });
});
