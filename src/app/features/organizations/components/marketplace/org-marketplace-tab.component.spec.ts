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
import type { OrgAddon, OrgProductPrice, OverrideBody } from '../../data/org-marketplace.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import {
  addonActions,
  addonFamily,
  OrgMarketplaceTabComponent,
  priceActions,
} from './org-marketplace-tab.component';
import { OverrideFormComponent } from './override-form.component';

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
const BASE = '/platform/marketplace/organizations/org-1';

const price = (over: Partial<OrgProductPrice> = {}): OrgProductPrice => ({
  productCode: 'VAL_ANI',
  kind: 'VALIDATION_PACKAGE',
  name: 'Consultas',
  currency: 'COP',
  generalUnitPrice: 1000,
  unitPrice: 1000,
  tiers: [{ minQuantity: 100, discountPct: 10 }],
  taxPct: 19,
  overridden: false,
  ...over,
});

const addon = (over: Partial<OrgAddon> = {}): OrgAddon => ({
  code: 'ADDON_PAGARES',
  addonCode: 'pagares',
  name: 'Pagarés',
  unitPrice: 50000,
  taxPct: 19,
  state: 'INACTIVE',
  onSale: true,
  ...over,
});

type Interna = Record<string, { set: (v: unknown) => void } & (() => unknown)> & {
  submit: () => void;
};

describe('Ficha › Marketplace', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgMarketplaceTabComponent],
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

  const montar = async (prices: OrgProductPrice[], addons: OrgAddon[], permisos: string[]) => {
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
    const fixture = TestBed.createComponent(OrgMarketplaceTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    http.expectOne(`${BASE}/prices`).flush(prices);
    http.expectOne(`${BASE}/addons`).flush(addons);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
    });
    return { fixture, host };
  };

  it('acciones por origen: Stripe solo se cancela al fin del periodo, convenio se apaga ya', () => {
    expect(addonActions(addon()).map((i) => i.key)).toEqual(['activate']);
    expect(addonActions(addon({ onSale: false }))).toEqual([]);
    expect(addonActions(addon({ state: 'ACTIVE', source: 'STRIPE' })).map((i) => i.key)).toEqual([
      'cancel',
    ]);
    expect(
      addonActions(addon({ state: 'ACTIVE', source: 'STRIPE', cancelAtPeriodEnd: true })),
    ).toEqual([]);
    expect(addonActions(addon({ state: 'ACTIVE', source: 'PLATFORM' })).map((i) => i.key)).toEqual([
      'deactivate',
    ]);
    expect(addonFamily(addon({ state: 'ACTIVE', cancelAtPeriodEnd: true }))).toBe('warning');
    expect(priceActions(price()).map((i) => i.key)).toEqual(['override']);
    expect(priceActions(price({ overridden: true })).map((i) => i.key)).toEqual([
      'override',
      'remove',
    ]);
  });

  it('pinta precios y add-ons sin llaves crudas; sin manage no hay acciones', async () => {
    const { host } = await montar(
      [price({ overridden: true, unitPrice: 800, note: 'Convenio 2026' })],
      [
        addon({
          state: 'ACTIVE',
          source: 'STRIPE',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: '2026-11-30T00:00:00.000Z',
        }),
        addon({
          addonCode: 'consentimiento_informado',
          name: 'Consentimiento',
          onSale: false,
          state: 'ACTIVE',
          source: 'PLATFORM',
        }),
      ],
      ['platform:commercial'],
    );
    const texto = host.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('Precio especial');
    expect(texto).toContain('Convenio 2026');
    expect(texto).toContain('10 % desde 100');
    expect(texto).toContain('Se cancela al fin del periodo');
    expect(texto).toContain('Ya no se vende');
    expect(texto).toContain('Convenio');
    expect(host.querySelector('.mt__more')).toBeNull();
    expect(texto).not.toMatch(/orgMkt\./);
  });

  it('cancelar un add-on de Stripe pide motivo y llama a cancel', async () => {
    const { fixture } = await montar(
      [price()],
      [addon({ state: 'ACTIVE', source: 'STRIPE', currentPeriodEnd: '2026-11-30T00:00:00.000Z' })],
      ['platform:commercial', 'platform:commercial:manage'],
    );
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Pidió baja',
    });
    const tab = fixture.componentInstance as unknown as {
      target: { set: (v: unknown) => void };
      pickAddon: (k: string) => Promise<void>;
    };
    tab.target.set({ kind: 'addon', addon: addon({ state: 'ACTIVE', source: 'STRIPE' }) });
    const hecho = tab.pickAddon('cancel');
    const req = await vi.waitFor(() => http.expectOne(`${BASE}/addons/pagares/cancel`));
    expect(req.request.body).toEqual({ reason: 'Pidió baja' });
    req.flush(addon({ state: 'ACTIVE', source: 'STRIPE', cancelAtPeriodEnd: true }));
    await vi.waitFor(() => http.expectOne(`${BASE}/prices`)).then((r) => r.flush([price()]));
    http.expectOne(`${BASE}/addons`).flush([]);
    await hecho;
  });

  it('quitar el precio especial manda el motivo en el cuerpo del DELETE', async () => {
    const { fixture } = await montar(
      [price({ overridden: true })],
      [],
      ['platform:commercial', 'platform:commercial:manage'],
    );
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Fin del convenio',
    });
    const tab = fixture.componentInstance as unknown as {
      target: { set: (v: unknown) => void };
      pickPrice: (k: string) => Promise<void>;
    };
    tab.target.set({ kind: 'price', price: price({ overridden: true }) });
    const hecho = tab.pickPrice('remove');
    const req = await vi.waitFor(() => http.expectOne(`${BASE}/prices/VAL_ANI`));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ reason: 'Fin del convenio' });
    req.flush({ removed: true });
    await vi.waitFor(() => http.expectOne(`${BASE}/prices`)).then((r) => r.flush([price()]));
    http.expectOne(`${BASE}/addons`).flush([]);
    await hecho;
  });

  it('formulario: tramos generales por defecto, propios solo si se encienden, nunca en un add-on', () => {
    const fixture = TestBed.createComponent(OverrideFormComponent);
    fixture.componentRef.setInput('price', price());
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Interna;
    const enviados: OverrideBody[] = [];
    fixture.componentInstance.submitted.subscribe((b) => enviados.push(b));
    form['unitPrice'].set('850');
    form.submit();
    expect(enviados).toHaveLength(0);
    form['reason'].set('Convenio');
    form.submit();
    expect(enviados[0]).toEqual({ unitPrice: 850, reason: 'Convenio' });
    form['ownTiers'].set(true);
    form['taxPct'].set('5');
    form.submit();
    expect(enviados[1]).toEqual({
      unitPrice: 850,
      tiers: [{ minQuantity: 100, discountPct: 10 }],
      taxPct: 5,
      reason: 'Convenio',
    });
    form['taxPct'].set('150');
    form.submit();
    expect(enviados).toHaveLength(2);

    const otro = TestBed.createComponent(OverrideFormComponent);
    otro.componentRef.setInput('price', price({ kind: 'ADDON', tiers: [] }));
    otro.detectChanges();
    const addonForm = otro.componentInstance as unknown as Interna;
    const deAddon: OverrideBody[] = [];
    otro.componentInstance.submitted.subscribe((b) => deAddon.push(b));
    addonForm['ownTiers'].set(true);
    addonForm['reason'].set('Convenio');
    addonForm.submit();
    expect(deAddon[0].tiers).toBeUndefined();
  });
});
