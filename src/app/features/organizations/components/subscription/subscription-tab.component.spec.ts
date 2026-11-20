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
    vista: SubscriptionView = VISTA,
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
    http.expectOne('/platform/organizations/org-1/subscription').flush(vista);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find(
      (b) => b.textContent?.trim() === texto,
    );

  const delMenu = async (fixture: { detectChanges: () => void }, host: HTMLElement, texto: string) => {
    boton(host, 'Más acciones')!.click();
    fixture.detectChanges();
    let item: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      item = [...document.querySelectorAll<HTMLButtonElement>('.item')].find((b) => b.textContent?.trim() === texto);
      expect(item).toBeDefined();
    });
    item!.click();
  };

  it('las acciones secundarias van en el menú y Expirar queda al final, marcada', async () => {
    const { fixture, host } = await montar();
    expect(boton(host, 'Asignar plan')).toBeDefined();
    expect(boton(host, 'Expirar')).toBeUndefined();
    boton(host, 'Más acciones')!.click();
    fixture.detectChanges();
    let items: HTMLButtonElement[] = [];
    await vi.waitFor(() => {
      items = [...document.querySelectorAll<HTMLButtonElement>('.item')];
      expect(items.length).toBeGreaterThan(0);
    });
    expect(items.map((b) => b.textContent?.trim()).at(-1)).toBe('Expirar');
    expect(items.at(-1)!.classList.contains('item--danger')).toBe(true);
  });

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

  it('una fecha del legacy que no es fecha no rompe la pestaña ni el formulario de asignar', async () => {
    const { fixture, host } = await montar(undefined, {
      ...VISTA,
      history: [{ ...VISTA.history[1], periodStart: '' }],
      mirror: { ...VISTA.mirror, expiration: 'Invalid date' },
    });
    expect(host.textContent).toContain('Espejo legacy');
    expect(host.querySelector('.sub__card:last-of-type')?.textContent).toContain('—');
    boton(host, 'Asignar plan')!.click();
    fixture.detectChanges();
    const form = host.querySelector('dba-assign-plan-form');
    expect(form?.textContent).toContain('Asignar plan');
    expect(form?.textContent).toContain('Sierra Norte');
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

  it('con deuda dice cuánto debe, no ofrece transferir y el formulario recibe la deuda que pasa', async () => {
    const { fixture, host } = await montar(undefined, {
      ...VISTA,
      current: {
        ...VISTA.current!,
        counters: [{ resource: 'DOCUMENTS', limit: 200, used: 212, remaining: -12 }],
      },
      carry: { keep: -12, reset: -12 },
    });
    expect(host.querySelector('dba-quota-bar')?.textContent).toContain('212 / 200 · debe 12');
    boton(host, 'Más acciones')!.click();
    fixture.detectChanges();
    let items: string[] = [];
    await vi.waitFor(() => {
      items = [...document.querySelectorAll<HTMLButtonElement>('.item')].map(
        (b) => b.textContent?.trim() ?? '',
      );
      expect(items.length).toBeGreaterThan(0);
    });
    expect(items).not.toContain('Transferir documentos');
    boton(host, 'Más acciones')!.click();
    boton(host, 'Asignar plan')!.click();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.directive(AssignPlanFormComponent)).componentInstance.carryable(),
    ).toBe(-12);
  });

  it('sin plan vigente muestra el último con su deuda, sin acciones sobre sus contadores', async () => {
    const { fixture, host } = await montar(undefined, {
      ...VISTA,
      current: null,
      last: {
        id: 'sub-1',
        plan: { id: 'p1', code: 'PRO', name: 'Profesional', version: 1 },
        state: 'EXPIRED',
        source: 'MANUAL',
        periodStart: '2026-09-01T12:00:00.000Z',
        periodEnd: '2026-10-31T12:00:00.000Z',
        counters: [{ resource: 'DOCUMENTS', limit: 100, used: 107, remaining: -7 }],
      },
      carry: { keep: -7, reset: -7 },
    });
    const card = host.querySelector('.sub__card')!;
    expect(card.textContent).toContain('Último plan');
    expect(card.textContent).toContain('Profesional');
    expect(card.textContent).toContain('PRO · v1');
    expect(card.textContent).toContain('Expirada');
    expect(card.querySelector('dba-quota-bar')?.textContent).toContain('107 / 100 · debe 7');
    expect(card.textContent).toContain('Debe 7 documentos: pasan como usados al plan que se asigne.');
    expect(card.querySelector('.sub__link')).toBeNull();
    expect(host.textContent).not.toMatch(/\b(sub|orgd|common|tbl)\.[a-zA-Z]/);
    boton(host, 'Asignar plan')!.click();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.directive(AssignPlanFormComponent)).componentInstance.carryable(),
    ).toBe(-7);
  });

  it('asignar con deuda avisa que la deuda pasó como usada', async () => {
    const { fixture, host } = await montar();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    boton(host, 'Asignar plan')!.click();
    fixture.detectChanges();
    fixture.debugElement
      .query(By.directive(AssignPlanFormComponent))
      .componentInstance.submitted.emit({ planCode: 'CORP', carry: false, reason: 'Cambio' });
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/subscription/assign'))
      .flush({ ...VISTA, carriedOver: -12 });
    await fixture.whenStable();
    expect(avisos).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Plan asignado. Pasó una deuda de 12 documentos, que entran como usados.',
      }),
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
    const { fixture, host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Fin de contrato' });
    await delMenu(fixture, host, 'Expirar');
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
    const { fixture, host } = await montar();
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Convenio',
    });
    await delMenu(fixture, host, 'Sin vencimiento');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/subscription/period'));
    });
    expect(req.request.body).toEqual({ noExpiry: true, reason: 'Convenio' });
    req.flush(VISTA);
  });
});
