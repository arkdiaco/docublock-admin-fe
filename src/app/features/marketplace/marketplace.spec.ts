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
import { ProductFormComponent } from './components/product-form.component';
import type {
  CreateProductBody,
  ProductDetail,
  ProductRow,
  VersionProductBody,
} from './data/marketplace.models';
import { bulletsOf, kindLabel, priceText, tiersText } from './data/product-format';
import { MarketplaceComponent } from './pages/marketplace.component';
import { ProductDetailComponent } from './pages/product-detail.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  code: 'VAL_ANI',
  kind: 'VALIDATION_PACKAGE',
  creditType: 'ani',
  level: 1,
  name: 'Consultas en registraduría',
  currency: 'COP',
  state: 'ACTIVE',
  version: 2,
  versions: 2,
  unitPrice: 1000,
  fromPrice: 900,
  taxPct: 19,
  visible: true,
  activeAddons: 0,
  overrides: 1,
  paidOrders30d: 4,
  ...over,
});

const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({
  ...row(),
  summary: 'Resumen',
  bullets: ['Uno'],
  limitations: '',
  tiers: [{ minQuantity: 100, discountPct: 10 }],
  minQuantity: 1,
  history: [
    {
      id: 'v2',
      version: 2,
      state: 'ACTIVE',
      unitPrice: 1000,
      tiers: [],
      minQuantity: 1,
      taxPct: 19,
    },
    {
      id: 'v1',
      version: 1,
      state: 'RETIRED',
      unitPrice: 800,
      tiers: [],
      minQuantity: 1,
      taxPct: 19,
    },
  ],
  ...over,
});

type Interna = Record<string, { set: (v: unknown) => void } & (() => unknown)> & {
  submit: () => void;
};

describe('Comercial › Marketplace', () => {
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

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) =>
      b.textContent?.trim().includes(texto),
    );

  describe('formato', () => {
    it('rotula, cobra y parte viñetas', () => {
      const t = TestBed.inject(TranslateService);
      expect(kindLabel(row())).toBe('mkt.credit.ani');
      expect(kindLabel(row({ kind: 'ADDON', addonCode: 'pagares' }))).toBe('mkt.addon.pagares');
      expect(priceText(row(), t, 'es-CO')).toMatch(/^Desde .*900.*1\.000/);
      expect(priceText(row({ fromPrice: 1000 }), t, 'es-CO')).toMatch(/\/ consulta$/);
      expect(priceText(row({ kind: 'ADDON' }), t, 'es-CO')).toMatch(/\/ mes$/);
      expect(tiersText([], t)).toBe('Sin descuento por volumen');
      expect(tiersText([{ minQuantity: 100, discountPct: 5 }], t)).toBe('5 % desde 100');
      expect(bulletsOf(' uno \n\n dos ')).toEqual(['uno', 'dos']);
    });
  });

  describe('lista', () => {
    it('pinta los productos a la venta y sin manage no ofrece crear', async () => {
      perfil(['platform:commercial']);
      const fixture = TestBed.createComponent(MarketplaceComponent);
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url === '/platform/marketplace/products');
      expect(req.request.params.get('state')).toBe('active');
      req.flush([
        row(),
        row({
          code: 'ADDON_PAGARES',
          kind: 'ADDON',
          addonCode: 'pagares',
          name: 'Pagarés',
          activeAddons: 3,
          visible: false,
        }),
      ]);
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const filas = [...host.querySelectorAll('dba-data-table .dba-tr')].map((r) =>
        r.textContent?.replace(/\s+/g, ' '),
      );
      expect(filas[0]).toContain('4 compras en 30 días');
      expect(filas[0]).toContain('1 precios especiales');
      expect(filas[1]).toContain('3 add-ons activos');
      expect(filas[1]).toContain('Oculto en la tienda');
      expect(boton(host, 'Nuevo producto')).toBeUndefined();
      expect(host.textContent).not.toMatch(/mkt\./);
    });

    it('crear manda el producto y abre su ficha', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const fixture = TestBed.createComponent(MarketplaceComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/platform/marketplace/products').flush([]);
      await fixture.whenStable();
      fixture.detectChanges();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      boton(fixture.nativeElement, 'Nuevo producto')!.click();
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([{ currency: 'COP' }, { currency: 'USD' }]);
      const form = fixture.debugElement.query(
        (d) => d.componentInstance instanceof ProductFormComponent,
      ).componentInstance as ProductFormComponent;
      const body = { code: 'VAL_IDENTITY', reason: 'Alta' } as CreateProductBody;
      form.created.emit(body);
      const req = http.expectOne('/platform/marketplace/products');
      expect(req.request.method).toBe('POST');
      req.flush(detail({ code: 'VAL_IDENTITY' }));
      await fixture.whenStable();
      expect(navegar).toHaveBeenCalledWith([expect.any(String), 'VAL_IDENTITY']);
    });
  });

  describe('formulario', () => {
    it('crear sugiere el código por tipo y moneda y no manda tramos en un add-on', async () => {
      const fixture = TestBed.createComponent(ProductFormComponent);
      fixture.detectChanges();
      http.expectOne('/catalogs/countries').flush([{ currency: 'COP' }, { currency: 'USD' }]);
      const form = fixture.componentInstance as unknown as Interna &
        Record<string, (v: unknown) => void>;
      expect(form['code']()).toBe('VAL_ANI');
      form['pickCurrency']('USD');
      expect(form['code']()).toBe('VAL_ANI_USD');
      form['pickKind']('ADDON');
      expect(form['code']()).toBe('ADDON_PAGARES_USD');
      const enviados: CreateProductBody[] = [];
      fixture.componentInstance.created.subscribe((b) => enviados.push(b));
      form['name'].set('Pagarés');
      form['unitPrice'].set('20');
      form.submit();
      expect(enviados).toHaveLength(0);
      form['reason'].set('Alta');
      form.submit();
      expect(enviados[0]).toMatchObject({
        code: 'ADDON_PAGARES_USD',
        kind: 'ADDON',
        addonCode: 'pagares',
        tiers: [],
        minQuantity: 1,
        currency: 'USD',
      });
      expect(enviados[0].creditType).toBeUndefined();
    });

    it('nueva versión manda solo lo que cambió y sin cambios no deja guardar', () => {
      const fixture = TestBed.createComponent(ProductFormComponent);
      fixture.componentRef.setInput('product', detail());
      fixture.detectChanges();
      const form = fixture.componentInstance as unknown as Interna;
      const enviados: VersionProductBody[] = [];
      fixture.componentInstance.versioned.subscribe((b) => enviados.push(b));
      form['reason'].set('Ajuste');
      form.submit();
      expect(enviados).toHaveLength(0);
      form['unitPrice'].set('1200');
      form.submit();
      expect(enviados[0]).toEqual({ reason: 'Ajuste', unitPrice: 1200 });
    });
  });

  describe('ficha', () => {
    const montar = async (product: ProductDetail) => {
      const fixture = TestBed.createComponent(ProductDetailComponent);
      fixture.componentRef.setInput('code', product.code);
      fixture.detectChanges();
      http.expectOne('/platform/marketplace/products/' + product.code).flush(product);
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    };

    it('muestra términos, versiones y el aviso de ficha faltante', async () => {
      perfil(['platform:commercial']);
      const { host } = await montar(detail({ code: 'VAL_ANI_USD' }));
      expect(host.textContent).toContain('Versiones (2)');
      expect(host.textContent).toContain('10 % desde 100');
      expect(host.textContent).toContain('no tiene ficha propia');
      expect(boton(host, 'Nueva versión')).toBeUndefined();
      expect(host.textContent).not.toMatch(/mkt\./);
    });

    it('retirar pide el código como desafío y llama a retire', async () => {
      perfil(['platform:commercial', 'platform:commercial:manage']);
      const { fixture } = await montar(detail());
      const abrir = vi
        .spyOn(TestBed.inject(DialogService), 'open')
        .mockResolvedValue({ answer: 'confirm', reason: 'Sin uso' });
      (fixture.componentInstance as unknown as { pick: (k: string) => void }).pick('retire');
      const req = await vi.waitFor(() =>
        http.expectOne('/platform/marketplace/products/VAL_ANI/retire'),
      );
      expect(req.request.body).toEqual({ reason: 'Sin uso' });
      req.flush(detail({ state: 'RETIRED' }));
      await fixture.whenStable();
      expect(abrir.mock.calls[0][0]).toMatchObject({ challenge: { identifier: 'VAL_ANI' } });
    });
  });
});
