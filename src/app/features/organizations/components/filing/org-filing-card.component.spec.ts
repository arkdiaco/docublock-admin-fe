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
import { NotificationService } from '../../../../core/ui/notification.service';
import type { OrgProductPrice } from '../../data/org-marketplace.models';
import {
  filingExample,
  hasFiling,
  isFilingPrefix,
  normalizeFilingPrefix,
} from '../../data/org-filing';
import type { FilingPrefixBody, PlatformFilingView } from '../../data/org-filing.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { OverrideFormComponent } from '../marketplace/override-form.component';
import { FilingPrefixFormComponent } from './filing-prefix-form.component';
import { OrgFilingCardComponent } from './org-filing-card.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const URL = '/platform/organizations/org-1/filing';

const org = (modules: string[] = ['radicacion']): PlatformOrgDetail =>
  ({ id: 'org-1', businessName: 'Constructora Andina', modules }) as PlatformOrgDetail;

const vista = (over: Partial<PlatformFilingView> = {}): PlatformFilingView => ({
  balance: { unlimited: false, remaining: 12 },
  prefix: 'CAND',
  example: 'CAND-2026-E-000001',
  ...over,
});

type Interna = Record<string, { set: (v: unknown) => void } & (() => unknown)> & {
  submit: () => void;
};

const texto = (host: HTMLElement): string => host.textContent?.replace(/\s+/g, ' ') ?? '';

describe('Ficha › Radicación de documentos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgFilingCardComponent],
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
    respuesta: PlatformFilingView | 'falla',
    permisos: string[] = ['platform:clients'],
    detalle: PlatformOrgDetail = org(),
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
    const fixture = TestBed.createComponent(OrgFilingCardComponent);
    fixture.componentRef.setInput('org', detalle);
    fixture.detectChanges();
    const req = http.expectOne(URL);
    if (respuesta === 'falla') req.flush({}, { status: 500, statusText: 'x' });
    else req.flush(respuesta);
    const host = fixture.nativeElement as HTMLElement;
    const card = fixture.componentInstance as unknown as { loading: () => boolean };
    await vi.waitFor(() => expect(card.loading()).toBe(false));
    fixture.detectChanges();
    return { fixture, host };
  };

  it('el prefijo se normaliza como en el core y el ejemplo sigue su formato', () => {
    expect(normalizeFilingPrefix(' ándina-2 ')).toBe('ANDINA2');
    expect(isFilingPrefix('AB')).toBe(true);
    expect(isFilingPrefix('A')).toBe(false);
    expect(isFilingPrefix('ABCDEFGHI')).toBe(false);
    expect(filingExample('JURI', 2026)).toBe('JURI-2026-E-000001');
    expect(hasFiling(vista({ prefix: null, balance: { unlimited: false, remaining: 0 } }))).toBe(
      false,
    );
    expect(hasFiling(vista({ prefix: null, balance: { unlimited: true, remaining: 0 } }))).toBe(
      true,
    );
    expect(hasFiling(vista({ prefix: null, balance: { unlimited: false, remaining: 3 } }))).toBe(
      true,
    );
    expect(hasFiling(vista({ balance: { unlimited: false, remaining: 0 } }))).toBe(true);
  });

  it('muestra saldo, prefijo y ejemplo sin llaves crudas; sin gestionar no hay botón', async () => {
    const { host } = await montar(vista());
    const t = texto(host);
    expect(t).toContain('Radicación de documentos');
    expect(t).toContain('12 radicaciones');
    expect(t).toContain('CAND');
    expect(t).toContain('Así se ve: CAND-2026-E-000001');
    expect(host.querySelector('button')).toBeNull();
    expect(t).not.toMatch(/orgFiling\./);
  });

  it('ilimitadas, una sola y sin prefijo todavía', async () => {
    const ilimitada = await montar(vista({ balance: { unlimited: true, remaining: 0 } }));
    expect(texto(ilimitada.host)).toContain('Ilimitadas');
    const una = await montar(vista({ balance: { unlimited: false, remaining: 1 } }));
    expect(texto(una.host)).toContain('1 radicación');
    const sinPrefijo = await montar(vista({ prefix: null, example: null }));
    expect(texto(sinPrefijo.host)).toContain('Se asigna con el primer radicado');
  });

  it('con el módulo apagado solo sale si hay saldo o prefijo', async () => {
    const vacia = await montar(
      vista({ prefix: null, example: null, balance: { unlimited: false, remaining: 0 } }),
      ['platform:clients'],
      org([]),
    );
    expect(vacia.host.querySelector('section')).toBeNull();
    const conPrefijo = await montar(
      vista({ balance: { unlimited: false, remaining: 0 } }),
      ['platform:clients'],
      org([]),
    );
    expect(texto(conPrefijo.host)).toContain('CAND');
  });

  it('si la lectura falla se puede reintentar; con el módulo apagado no estorba', async () => {
    const encendido = await montar('falla');
    expect(texto(encendido.host)).toContain('No se pudo leer la radicación');
    const apagado = await montar('falla', ['platform:clients'], org([]));
    expect(apagado.host.querySelector('section')).toBeNull();
  });

  it('cambiar el prefijo manda el prefijo normalizado y el motivo, y pinta la ficha nueva', async () => {
    const { fixture, host } = await montar(vista(), [
      'platform:clients',
      'platform:clients:manage',
    ]);
    const exito = vi.spyOn(TestBed.inject(NotificationService), 'success');
    const card = fixture.componentInstance as unknown as {
      changePrefix: (body: FilingPrefixBody) => Promise<void>;
    };
    expect(texto(host)).toContain('Cambiar prefijo');
    const hecho = card.changePrefix({ prefix: 'JURI', reason: 'Lo pidió el cliente' });
    const req = http.expectOne(`${URL}/prefix`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ prefix: 'JURI', reason: 'Lo pidió el cliente' });
    req.flush(vista({ prefix: 'JURI', example: 'JURI-2026-E-000001' }));
    await hecho;
    fixture.detectChanges();
    expect(texto(host)).toContain('Así se ve: JURI-2026-E-000001');
    expect(exito).toHaveBeenCalledWith('El prefijo quedó en JURI');
  });

  it('los rechazos del core se explican: prefijo inválido o en uso', async () => {
    const { fixture } = await montar(vista(), ['platform:clients', 'platform:clients:manage']);
    const fallo = vi.spyOn(TestBed.inject(NotificationService), 'error');
    const card = fixture.componentInstance as unknown as {
      changePrefix: (body: FilingPrefixBody) => Promise<void>;
    };
    const enUso = card.changePrefix({ prefix: 'OCUP', reason: 'x' });
    http
      .expectOne(`${URL}/prefix`)
      .flush({ code: 'PREFIJO_EN_USO' }, { status: 409, statusText: 'Conflict' });
    await enUso;
    expect(fallo).toHaveBeenLastCalledWith('Ese prefijo ya lo usa otra organización.');
    const otro = card.changePrefix({ prefix: 'OCUP', reason: 'x' });
    http.expectOne(`${URL}/prefix`).flush({}, { status: 500, statusText: 'x' });
    await otro;
    expect(fallo).toHaveBeenLastCalledWith('No se pudo cambiar el prefijo. Inténtalo de nuevo.');
  });

  it('formulario: exige prefijo válido, distinto del actual y motivo; avisa que no se libera', () => {
    const fixture = TestBed.createComponent(FilingPrefixFormComponent);
    fixture.componentRef.setInput('current', 'CAND');
    fixture.detectChanges();
    const host = document.body;
    expect(texto(host)).toContain('nunca se libera');
    const form = fixture.componentInstance as unknown as Interna;
    const enviados: FilingPrefixBody[] = [];
    fixture.componentInstance.submitted.subscribe((b) => enviados.push(b));
    form['prefix'].set('cand');
    form['reason'].set('Cambio de marca');
    form.submit();
    form['prefix'].set('a');
    form.submit();
    expect(enviados).toHaveLength(0);
    form['prefix'].set(' jurí ');
    fixture.detectChanges();
    expect(texto(host)).toMatch(/Así se verá: JURI-\d{4}-E-000001/);
    form.submit();
    expect(enviados).toEqual([{ prefix: 'JURI', reason: 'Cambio de marca' }]);
    expect(texto(host)).not.toMatch(/orgFiling\./);
    fixture.destroy();
  });

  it('el precio especial de radicaciones cuenta en radicaciones', () => {
    const precio: OrgProductPrice = {
      productCode: 'VAL_RADICACION',
      kind: 'VALIDATION_PACKAGE',
      creditType: 'radicacion',
      name: 'Radicaciones',
      currency: 'COP',
      generalUnitPrice: 900,
      unitPrice: 900,
      tiers: [{ minQuantity: 100, discountPct: 10 }],
      taxPct: 19,
      overridden: false,
    };
    const fixture = TestBed.createComponent(OverrideFormComponent);
    fixture.componentRef.setInput('price', precio);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as Interna)['ownTiers'].set(true);
    fixture.detectChanges();
    expect(texto(document.body)).toContain('radicaciones');
    expect(texto(document.body)).not.toContain('consultas');
    fixture.destroy();
  });
});
