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
import type { SubscriptionView } from '../../data/subscription.models';
import { AssignPlanFormComponent } from './assign-plan-form.component';
import { CounterFormComponent } from './counter-form.component';
import { SubscriptionTabComponent } from './subscription-tab.component';

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

const VISTA: SubscriptionView = {
  current: {
    id: 'sub-1',
    plan: { id: 'p1', code: 'CORP', name: 'Corporativo', version: 2 },
    source: 'MANUAL',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2027-01-01T00:00:00.000Z',
    lapsed: false,
    counters: [
      { resource: 'DOCUMENTS', limit: 200, used: 150, remaining: 50 },
      { resource: 'ID_ANI', limit: null, used: 3, remaining: null },
    ],
  },
  history: [
    {
      id: 'sub-1',
      plan: { id: 'p1', code: 'CORP', name: 'Corporativo' },
      state: 'ACTIVE',
      source: 'MANUAL',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2027-01-01T00:00:00.000Z',
    },
    {
      id: 'sub-0',
      plan: { id: 'p0', code: 'DEMO', name: 'Demo' },
      state: 'EXPIRED',
      source: 'LEGACY',
      periodStart: '2025-01-01T00:00:00.000Z',
      periodEnd: null,
    },
  ],
  mirror: { documents: 200, remainingDocuments: 50, expiration: '2027-01-01T00:00:00.000Z' },
  plans: [
    {
      code: 'CORP',
      name: 'Corporativo',
      family: 'corp',
      kind: 'SUBSCRIPTION',
      validityMonths: 12,
      limits: { documents: 200, idBiometric: null, idAni: null, idIdentity: null },
    },
  ],
};

describe('SubscriptionTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionTabComponent],
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
    permisos: string[] = ['platform:clients', 'platform:commercial', 'platform:commercial:manage'],
  ) => {
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'u1',
        names: 'Marta',
        surNames: 'Vidal',
        email: 'm@d.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });
    const fixture = TestBed.createComponent(SubscriptionTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1/subscription').flush(VISTA);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find(
      (b) => b.textContent?.trim() === texto,
    );

  it('pinta el plan vigente, los contadores con nombres públicos, el historial y el espejo legacy', async () => {
    const { host } = await montar();
    expect(host.textContent).toContain('Corporativo');
    expect(host.textContent).toContain('CORP · v2');
    expect(host.querySelectorAll('dba-quota-bar').length).toBe(2);
    expect(host.textContent).toContain('Consultar Registraduría');
    expect(host.textContent).not.toContain('ANI');
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(2);
    expect(host.textContent).toContain('Espejo legacy');
    expect(host.textContent).not.toMatch(/\b(sub|orgd|common|tbl)\.[a-zA-Z]/);
  });

  it('sin commercial:manage no hay acciones', async () => {
    const { host } = await montar(['platform:clients']);
    expect(boton(host, 'Asignar plan')).toBeUndefined();
    expect(host.querySelector('.sub__link')).toBeNull();
  });

  it('asignar manda el plan con el arrastre y muestra cuánto se arrastró', async () => {
    const { fixture, host } = await montar();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    boton(host, 'Asignar plan')!.click();
    fixture.detectChanges();
    fixture.debugElement
      .query(By.directive(AssignPlanFormComponent))
      .componentInstance.submitted.emit({
        planCode: 'CORP',
        carry: true,
        reason: 'Renovación anual',
      });
    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/subscription/assign'),
    );
    expect(req.request.body).toEqual({ planCode: 'CORP', carry: true, reason: 'Renovación anual' });
    req.flush({ ...VISTA, carriedOver: 50 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('dba-assign-plan-form')).toBeNull();
    expect(avisos).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Plan asignado con 50 documentos arrastrados' }),
    );
  });

  it('fijar un contador manda solo lo que cambió', async () => {
    const { fixture, host } = await montar();
    host.querySelector<HTMLButtonElement>('.sub__link')!.click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(CounterFormComponent));
    expect(form).not.toBeNull();
    form.componentInstance.submitted.emit({ used: 20, reason: 'Corrección' });
    const req = http.expectOne(
      (r) => r.method === 'PATCH' && r.url.endsWith('/subscription/counters/DOCUMENTS'),
    );
    expect(req.request.body).toEqual({ used: 20, reason: 'Corrección' });
    req.flush(VISTA);
  });

  it('expirar exige motivo y escribir el NIT', async () => {
    const { host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Fin de contrato' });
    boton(host, 'Expirar')!.click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].challenge?.identifier).toBe('900123456');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/subscription/expire'));
    });
    expect(req.request.body).toEqual({ reason: 'Fin de contrato' });
    req.flush({ ...VISTA, current: null });
  });

  it('sin vencimiento pide motivo y manda noExpiry', async () => {
    const { host } = await montar();
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Convenio',
    });
    boton(host, 'Sin vencimiento')!.click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/subscription/period'));
    });
    expect(req.request.body).toEqual({ noExpiry: true, reason: 'Convenio' });
    req.flush(VISTA);
  });
});
