import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { AuthStore } from '../../core/auth/auth.store';
import { API_BASE_URL } from '../../core/config/api.tokens';
import { DialogService } from '../../core/ui/dialog.service';
import { LegacyLinkFormComponent } from './components/legacy-link-form.component';
import { PlanFormComponent } from './components/plan-form.component';
import { StripeLinkFormComponent } from './components/stripe-link-form.component';
import type { PlanDetail, PlanRow } from './data/plans.models';
import { PlanDetailComponent } from './pages/plan-detail.component';
import { PlansComponent } from './pages/plans.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const CO = '65a0000000000000000000c0';

const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  code: 'CORE_10',
  name: 'Core 10',
  family: 'CORE',
  kind: 'SUBSCRIPTION',
  state: 'ACTIVE',
  version: 2,
  versions: 2,
  countryId: CO,
  countryName: 'Colombia',
  currency: 'COP',
  priceMonthly: 64999,
  priceAnnual: 701999,
  priceOnce: null,
  validityMonths: null,
  negotiated: false,
  limits: { documents: 10, idBiometric: 2, idAni: 0, idIdentity: 0 },
  visible: true,
  stripeReady: true,
  subscribers: 11,
  protected: false,
  ...over,
});

const detail = (over: Partial<PlanDetail> = {}): PlanDetail => ({
  ...row(),
  features: ['documents', 'dynamic-key'],
  legacyPlan: { id: 'L1', name: 'Corporativo' },
  history: [
    {
      id: 'v2',
      version: 2,
      state: 'ACTIVE',
      name: 'Core 10',
      createdAt: '2026-10-12T12:00:00.000Z',
      currency: 'COP',
      priceMonthly: 64999,
      priceAnnual: 701999,
      priceOnce: null,
      validityMonths: null,
      negotiated: false,
      limits: { documents: 10, idBiometric: 2, idAni: 0, idIdentity: 0 },
      visible: true,
      stripe: { monthly: 'price_m', annual: 'price_a', once: null },
      stripeReady: true,
      subscribers: 7,
    },
  ],
  ...over,
});

describe('Comercial › Planes', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const perfil = (permisos: string[]) =>
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

  const avisos = () => vi.spyOn(TestBed.inject(MessageService), 'add');
  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) =>
      b.textContent?.trim().includes(texto),
    );

  describe('lista', () => {
    const montar = async (rows: PlanRow[]) => {
      const fixture = TestBed.createComponent(PlansComponent);
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url === '/platform/plans');
      req.flush(rows);
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement, req };
    };

    it('pinta cada plan con precio, documentos, suscriptores y avisos; sin commercial:manage no ofrece crear', async () => {
      perfil(['platform:commercial']);
      const { host, req } = await montar([
        row(),
        row({
          code: 'GOVERNANCE',
          name: 'Governance',
          family: 'GOVERNANCE',
          negotiated: true,
          priceMonthly: -1,
          priceAnnual: -1,
          limits: { documents: null, idBiometric: null, idAni: null, idIdentity: null },
          stripeReady: null,
        }),
        row({
          code: 'PAYG_5',
          name: 'Paquete 5',
          family: 'PAYG',
          kind: 'PACKAGE',
          priceMonthly: 0,
          priceAnnual: 0,
          priceOnce: 64999,
          validityMonths: 6,
          stripeReady: null,
          visible: false,
        }),
        row({ code: 'PRIME_80', name: 'Prime 80', family: 'PRIME', stripeReady: false }),
      ]);
      expect(req.request.params.get('state')).toBe('active');
      const filas = [...host.querySelectorAll('dba-data-table .dba-tr')].map((r) =>
        r.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(filas[0]).toContain('Core 10');
      expect(filas[0]).toContain('/ mes');
      expect(filas[0]).toContain('11');
      expect(filas[1]).toContain('A convenir');
      expect(filas[1]).toContain('∞');
      expect(filas[2]).toContain('6 meses');
      expect(filas[2]).toContain('Oculto del catálogo');
      expect(filas[3]).toContain('Stripe pendiente');
      expect(boton(host, 'Crear plan')).toBeUndefined();
      expect(host.textContent).not.toMatch(/plans\./);
    });

    it('crear manda el plan y abre su ficha', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar([row()]);
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      boton(host, 'Crear plan')!.click();
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([{ id: CO, name: 'Colombia' }]);
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof PlanFormComponent,
      ).componentInstance as PlanFormComponent;
      form.created.emit({
        code: 'CORE_25',
        name: 'Core 25',
        family: 'CORE',
        kind: 'SUBSCRIPTION',
        currency: 'COP',
        priceMonthly: 89999,
        priceAnnual: 971999,
        priceOnce: null,
        validityMonths: null,
        limits: { documents: 25, idBiometric: 0, idAni: 0, idIdentity: 0 },
        visible: true,
        reason: 'Nuevo escalón',
      });
      const req = http.expectOne((r) => r.method === 'POST' && r.url === '/platform/plans');
      expect(req.request.body.code).toBe('CORE_25');
      req.flush(detail({ code: 'CORE_25' }));
      await fixture.whenStable();
      expect(navegar).toHaveBeenCalledWith(['/comercial/planes', 'CORE_25']);
    });

    it('un código en uso deja el modal abierto con el aviso', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar([row()]);
      const espia = avisos();
      boton(host, 'Crear plan')!.click();
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([]);
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof PlanFormComponent,
      ).componentInstance as PlanFormComponent;
      form.created.emit({ code: 'CORE_10' } as never);
      http
        .expectOne((r) => r.method === 'POST')
        .flush(
          { code: 'PLAN_CODIGO_EN_USO', message: 'x' },
          { status: 409, statusText: 'Conflict' },
        );
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.querySelector('dba-plan-form')).not.toBeNull();
      expect(espia.mock.calls.map(([m]) => m.detail)).toEqual([
        'Ya existe un plan con ese código, aunque esté retirado.',
      ]);
    });
  });

  describe('ficha', () => {
    const montar = async (body: PlanDetail) => {
      const fixture = TestBed.createComponent(PlanDetailComponent);
      fixture.componentRef.setInput('code', body.code);
      fixture.detectChanges();
      http.expectOne(`/platform/plans/${body.code}`).flush(body);
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    };

    const menu = async (fixture: { detectChanges: () => void }, host: HTMLElement) => {
      boton(host, 'Más acciones')?.click();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
      return [...document.querySelectorAll<HTMLButtonElement>('.item')];
    };

    it('muestra condiciones con nombres públicos de los límites, nunca ANI, y el historial', async () => {
      perfil(['platform:commercial']);
      const { host } = await montar(detail());
      expect(host.textContent).toContain('Consultar Registraduría');
      expect(host.textContent).toContain('Biometría avanzada');
      expect(host.textContent).not.toContain('ANI');
      expect(host.textContent).toContain('Listo');
      expect([...host.querySelectorAll('dba-data-table .dba-tr')].length).toBe(1);
      expect(boton(host, 'Nueva versión')).toBeUndefined();
      expect(host.textContent).not.toMatch(/plans\./);
    });

    it('DEMO no ofrece retirar ni ocultar', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { host } = await montar(
        detail({ code: 'DEMO', name: 'Demo', family: 'DEMO', protected: true }),
      );
      expect(boton(host, 'Nueva versión')).toBeDefined();
      expect(boton(host, 'Más acciones')).toBeUndefined();
    });

    it('retirar pide escribir el código y motivo, y la ficha queda retirada con solo Reactivar', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar(detail());
      const abrir = vi
        .spyOn(TestBed.inject(DialogService), 'open')
        .mockResolvedValue({ answer: 'confirm', reason: 'Se reemplaza' });
      const items = await menu(fixture, host);
      expect(items.map((i) => i.textContent?.trim())).toEqual(['Ocultar del catálogo', 'Retirar']);
      items[1].click();
      await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
      expect(abrir.mock.calls[0][0].challenge?.identifier).toBe('CORE_10');
      let req!: ReturnType<HttpTestingController['expectOne']>;
      await vi.waitFor(() => {
        req = http.expectOne(
          (r) => r.method === 'POST' && r.url === '/platform/plans/CORE_10/retire',
        );
      });
      expect(req.request.body).toEqual({ reason: 'Se reemplaza' });
      req.flush(detail({ state: 'RETIRED' }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(boton(host, 'Nueva versión')).toBeUndefined();
      const otra = await menu(fixture, host);
      expect(otra.map((i) => i.textContent?.trim())).toContain('Reactivar');
    });

    it('una versión con precio nuevo avisa que Stripe queda pendiente', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar(detail());
      const espia = avisos();
      boton(host, 'Nueva versión')!.click();
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([{ id: CO, name: 'Colombia' }]);
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof PlanFormComponent,
      ).componentInstance as PlanFormComponent;
      form.versioned.emit({ priceMonthly: 69999, reason: 'Ajuste' });
      const req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/plans/CORE_10/versions',
      );
      req.flush({ ...detail({ version: 3, stripeReady: false }), stripePending: true });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.querySelector('dba-plan-form')).toBeNull();
      expect(espia.mock.calls.map(([m]) => m.detail)).toEqual([
        'Versión nueva creada.',
        'El precio cambió: enlaza los price ids nuevos en la tarjeta Stripe.',
      ]);
      expect(host.querySelector('.rec__meta')?.textContent).toContain('v3');
    });
  });

  describe('Stripe y plan legacy en la ficha', () => {
    const montar = async (body: PlanDetail) => {
      const fixture = TestBed.createComponent(PlanDetailComponent);
      fixture.componentRef.setInput('code', body.code);
      fixture.detectChanges();
      http.expectOne(`/platform/plans/${body.code}`).flush(body);
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    };
    const tarjeta = (host: HTMLElement, titulo: string) =>
      [...host.querySelectorAll<HTMLElement>('.pd__card')].find(
        (c) => c.querySelector('h2')?.textContent?.trim() === titulo,
      )!;

    it('muestra los ids vigentes y el plan legacy; un paquete dice que no aplica y no ofrece enlazar', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { host } = await montar(detail());
      expect(tarjeta(host, 'Stripe').textContent).toContain('price_m');
      expect(tarjeta(host, 'Plan legacy').textContent).toContain('Corporativo');
      expect(boton(host, 'Enlazar precios')).toBeDefined();

      const paquete = await montar(
        detail({
          code: 'PAYG_5',
          kind: 'PACKAGE',
          family: 'PAYG',
          stripeReady: null,
          legacyPlan: null,
        }),
      );
      expect(tarjeta(paquete.host, 'Stripe').textContent).toContain('No aplica');
      expect(boton(paquete.host, 'Enlazar precios')).toBeUndefined();
      expect(tarjeta(paquete.host, 'Plan legacy').textContent).toContain('Sin vínculo');
    });

    it('un monto distinto en Stripe deja el modal abierto con «el plan dice → Stripe cobra»', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar(detail());
      const espia = avisos();
      boton(host, 'Enlazar precios')!.click();
      fixture.detectChanges();
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof StripeLinkFormComponent,
      ).componentInstance as StripeLinkFormComponent;
      form.submitted.emit({ monthly: 'price_viejo', annual: 'price_a2', reason: 'Enlace' });
      const req = http.expectOne(
        (r) => r.method === 'PUT' && r.url === '/platform/plans/CORE_10/stripe',
      );
      expect(req.request.body).toEqual({
        monthly: 'price_viejo',
        annual: 'price_a2',
        reason: 'Enlace',
      });
      req.flush(
        {
          code: 'STRIPE_MONTO_DISTINTO',
          slot: 'monthly',
          expected: 64999,
          actual: 59999,
          message: 'x',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.querySelector('dba-stripe-link-form')).not.toBeNull();
      const [mensaje] = espia.mock.calls.map(([m]) => m.detail as string);
      expect(mensaje).toMatch(
        /^El precio mensual no coincide: el plan dice .*64[.,]999.* y Stripe cobra .*59[.,]999/,
      );
    });

    it('el modal de Stripe exige el par completo y con formato price_', () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const fixture = TestBed.createComponent(StripeLinkFormComponent);
      fixture.componentRef.setInput('plan', detail());
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const inputs = [...host.querySelectorAll<HTMLInputElement>('.field__input')];
      const escribir = (i: number, v: string) => {
        inputs[i].value = v;
        inputs[i].dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };
      const go = host.querySelector<HTMLButtonElement>('.foot__go')!;
      expect(inputs[0].value).toBe('price_m');
      escribir(2, 'Cambio');
      escribir(0, 'precio_malo');
      expect(host.textContent).toContain('Un price id empieza por price_.');
      expect(go.disabled).toBe(true);
      escribir(0, '');
      expect(host.textContent).toContain('El mensual y el anual van juntos.');
      escribir(1, '');
      expect(go.disabled).toBe(false);
    });

    it('cambiar el plan legacy lista las opciones y avisa cuántas organizaciones lo tomarán después', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar(detail());
      boton(host, 'Cambiar')!.click();
      fixture.detectChanges();
      http.expectOne('/platform/plans/legacy').flush([
        {
          id: 'L1',
          name: 'Corporativo',
          costMonthly: null,
          documentsMonthly: null,
          plansLinked: ['CORE_10'],
        },
        {
          id: 'L2',
          name: 'Prepago',
          costMonthly: null,
          documentsMonthly: null,
          plansLinked: ['CORE_17'],
        },
      ]);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.querySelector('dba-legacy-link-form')?.textContent).toContain(
        '11 organizaciones',
      );
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof LegacyLinkFormComponent,
      ).componentInstance as LegacyLinkFormComponent;
      form.submitted.emit({ legacyPlanId: 'L2', reason: 'Alinear' });
      const req = http.expectOne(
        (r) => r.method === 'PUT' && r.url === '/platform/plans/CORE_10/legacy',
      );
      expect(req.request.body).toEqual({ legacyPlanId: 'L2', reason: 'Alinear' });
      req.flush(detail({ legacyPlan: { id: 'L2', name: 'Prepago' } }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.querySelector('dba-legacy-link-form')).toBeNull();
      expect(tarjeta(host, 'Plan legacy').textContent).toContain('Prepago');
    });
  });

  describe('formulario', () => {
    const montar = (plan: PlanDetail | null) => {
      const fixture = TestBed.createComponent(PlanFormComponent);
      fixture.componentRef.setInput('plan', plan);
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([{ id: CO, name: 'Colombia' }]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const campo = (label: string) =>
        [...host.querySelectorAll<HTMLElement>('dba-field')]
          .find((f) => f.querySelector('.field__label')?.textContent?.trim() === label)!
          .querySelector<HTMLInputElement>('.field__input')!;
      const escribir = (label: string, valor: string) => {
        const input = campo(label);
        input.value = valor;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };
      return { fixture, host, campo, escribir, form: fixture.componentInstance };
    };

    it('al crear sugiere el código por familia y documentos y no deja pasar sin motivo', () => {
      const { escribir, campo, host, form } = montar(null);
      escribir('Nombre', 'Core 25');
      escribir('Precio mensual', '89999');
      escribir('Precio anual', '971999');
      escribir('Documentos', '25');
      expect(campo('Código').value).toBe('CORE_25');
      const go = host.querySelector<HTMLButtonElement>('.foot__go')!;
      expect(go.disabled).toBe(true);
      escribir('Motivo', 'Nuevo escalón');
      expect(go.disabled).toBe(false);
      const emitido = vi.fn();
      form.created.subscribe(emitido);
      go.click();
      expect(emitido).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CORE_25',
          kind: 'SUBSCRIPTION',
          priceMonthly: 89999,
          priceOnce: null,
          limits: { documents: 25, idBiometric: 0, idAni: 0, idIdentity: 0 },
        }),
      );
    });

    it('en una versión manda solo lo que cambió; vacío en un límite es ilimitado', () => {
      const { escribir, host, form } = montar(detail());
      const go = host.querySelector<HTMLButtonElement>('.foot__go')!;
      escribir('Motivo', 'Ajuste');
      expect(go.disabled).toBe(true);
      escribir('Biometría avanzada', '');
      expect(host.querySelector('.form__summary')?.textContent).toContain(
        'Biometría avanzada: 2 → ∞',
      );
      expect(host.textContent).not.toContain('Stripe');
      const emitido = vi.fn();
      form.versioned.subscribe(emitido);
      go.click();
      expect(emitido).toHaveBeenCalledWith({ reason: 'Ajuste', limits: { idBiometric: null } });
    });

    it('si cambia el precio de un plan con Stripe, avisa que el checkout se cierra', () => {
      const { escribir, host } = montar(detail());
      escribir('Precio mensual', '69999');
      expect(host.textContent).toContain('queda sin price ids de Stripe');
    });
  });
});
