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
import type { QuotaNode, QuotaTree } from '../../data/quotas.models';
import { AssignQuotaFormComponent } from './assign-quota-form.component';
import { QuotasTabComponent } from './quotas-tab.component';
import { TransferQuotaFormComponent } from './transfer-quota-form.component';

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
const R1 = '65a0000000000000000000a1';
const R2 = '65a0000000000000000000a2';
const S1 = '65a0000000000000000000b1';

const nodo = (
  id: string,
  name: string,
  categoryType: QuotaNode['categoryType'],
  over: Partial<QuotaNode> = {},
): QuotaNode => ({
  id,
  name,
  categoryType,
  quotaAssigned: 100,
  quotaConsumed: 40,
  quotaAvailable: 60,
  numberOfTransactions: 3,
  parentIds: [],
  minQuota: 70,
  maxQuota: 150,
  ...over,
});

const ARBOL: QuotaTree = {
  organization: {
    id: 'org-1',
    businessName: 'Sierra Norte',
    subscribed: true,
    totalPlanDocuments: 500,
    remainingDocuments: 320,
    totalAssignedToCategories: 160,
    unassignedPool: 220,
  },
  regions: [
    nodo(R1, 'Norte', 'region'),
    nodo(R2, 'Sur', 'region', { quotaAssigned: 60, minQuota: 60 }),
  ],
  subsidiaries: [
    nodo(S1, 'Sede Bogotá', 'subsidiary', { parentIds: [R1], quotaAssigned: 30, minQuota: 10 }),
  ],
  orgAreas: [],
  subAreas: [],
};

describe('QuotasTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotasTabComponent],
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
    http.expectOne('/platform/organizations/org-1/quotas/tree').flush(ARBOL);
    http
      .expectOne((r) => r.url === '/platform/organizations/org-1/quotas/history')
      .flush({
        total: 1,
        items: [
          {
            id: 'h1',
            action: 'transfer',
            sourceCategoryName: 'Norte',
            destCategoryName: 'Sur',
            amount: 10,
            previousValue: 110,
            newValue: 100,
            createdAt: '2026-10-28T15:00:00.000Z',
          },
        ],
      });
  };

  const montar = async (permisos: string[] = ['platform:clients', 'platform:clients:manage']) => {
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
    const fixture = TestBed.createComponent(QuotasTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    responder();
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-stat-band')).not.toBeNull();
    });
    return { fixture, host };
  };

  const filas = (host: HTMLElement) => [
    ...host.querySelectorAll('dba-data-table')[0].querySelectorAll('.dba-tr'),
  ];

  it('pinta el pool, el árbol con cada sede bajo su región y los movimientos', async () => {
    const { host } = await montar();
    expect(host.querySelector('db-stat-band')?.textContent).toContain('320');
    expect(filas(host).map((f) => f.querySelector('.qt__label')?.textContent?.trim())).toEqual([
      'Norte',
      'Sede Bogotá',
      'Sur',
    ]);
    expect(filas(host)[1].querySelector('.dba-eyebrow')?.textContent).toContain('Sede');
    expect(host.textContent).toContain('Norte → Sur · 110 → 100');
    expect(host.textContent).toContain('Plataforma o sistema');
    expect(host.textContent).not.toMatch(/\b(quota|sub|common|tbl)\.[a-zA-Z]/);
  });

  it('sin clients:manage no hay acciones; Transferir solo donde hay qué mover', async () => {
    const { host } = await montar(['platform:clients']);
    expect(host.querySelector('.qt__link')).toBeNull();
    http.verify();
  });

  it('transferir solo ofrece ramas del mismo tipo o el plan global, y manda la transferencia', async () => {
    const { fixture, host } = await montar();
    const links = (i: number) =>
      [...filas(host)[i].querySelectorAll<HTMLButtonElement>('.qt__link')].map((b) =>
        b.textContent?.trim(),
      );
    expect(links(0)).toEqual(['Asignar', 'Transferir']);
    expect(links(2)).toEqual(['Asignar']);
    filas(host)[0].querySelectorAll<HTMLButtonElement>('.qt__link')[1].click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(TransferQuotaFormComponent))
      .componentInstance as unknown as {
      options: () => { key: string }[];
      submitted: { emit: (v: unknown) => void };
    };
    expect(form.options().map((o) => o.key)).toEqual(['organization', `region:${R2}`]);
    form.submitted.emit({
      sourceCategoryType: 'region',
      sourceCategoryId: R1,
      destCategoryType: 'region',
      destCategoryId: R2,
      amount: 10,
      reason: 'Ajuste',
    });
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/quotas/transfer'));
    expect(req.request.body.amount).toBe(10);
    req.flush({});
    await vi.waitFor(() => responder());
  });

  it('asignar manda el cupo nuevo y recarga', async () => {
    const { fixture, host } = await montar();
    filas(host)[0].querySelector<HTMLButtonElement>('.qt__link')!.click();
    fixture.detectChanges();
    fixture.debugElement
      .query(By.directive(AssignQuotaFormComponent))
      .componentInstance.submitted.emit({
        categoryType: 'region',
        categoryId: R1,
        quota: 120,
        reason: 'Más cupo',
      });
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/quotas/assign'));
    expect(req.request.body).toEqual({
      categoryType: 'region',
      categoryId: R1,
      quota: 120,
      reason: 'Más cupo',
    });
    req.flush({});
    await vi.waitFor(() => responder());
  });

  it('reiniciar pide motivo y escribir el NIT', async () => {
    const { host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Nuevo periodo' });
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.includes('Reiniciar consumo'))!
      .click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].challenge?.identifier).toBe('900123456');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/quotas/reset'));
    });
    expect(req.request.body).toEqual({ reason: 'Nuevo periodo' });
    req.flush({ consumedBefore: 80 });
    await vi.waitFor(() => responder());
  });
});
