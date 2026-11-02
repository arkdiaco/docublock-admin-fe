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
import es from '../../../../../public/i18n/es.json';
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import type { PromoCode, PromoReport, Referral } from '../data/promotions.models';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

export const configurar = async (): Promise<HttpTestingController> => {
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
  return TestBed.inject(HttpTestingController);
};

export const conPermisos = (permisos: string[]): void =>
  TestBed.inject(AuthStore).setProfile({
    user: {
      id: 'u1',
      names: 'Sam',
      surNames: 'Ventas',
      email: 'sam@docublock.co',
      identification: '',
      imageProfile: null,
    },
    platformStaff: true,
    platformPermissions: permisos,
  });

export const codigo = (over: Partial<PromoCode> = {}): PromoCode => ({
  id: 'p1',
  name: 'Lanzamiento',
  code: 'LANZA20',
  discount: 20,
  quantity: 10,
  redeemed: 2,
  remaining: 8,
  available: true,
  active: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

export const referido = (over: Partial<Referral> = {}): Referral => ({
  id: 'r1',
  name: 'Ana Gómez',
  email: 'ana@aliados.co',
  phone: '3001234567',
  document: '1020304050',
  notes: 'Aliada de notarías',
  promotionalCodeId: 'p1',
  active: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  code: {
    id: 'p1',
    code: 'ANA15',
    name: 'Ana Gómez',
    discount: 15,
    quantity: 50,
    redeemed: 3,
    remaining: 47,
    active: true,
    available: true,
  },
  ...over,
});

export const reporte = (over: Partial<PromoReport> = {}): PromoReport => ({
  referrer: null,
  redemptions: { total: 4, released: 1, effective: 3 },
  totals: [
    {
      currency: 'COP',
      marketplace: { orders: 1, promoDiscount: 5000, total: 95000 },
      plans: { transactions: 2, amount: 400000, discount: 50000 },
      total: 495000,
    },
    {
      currency: 'USD',
      marketplace: { orders: 0, promoDiscount: 0, total: 0 },
      plans: { transactions: 1, amount: 49, discount: 5 },
      total: 49,
    },
  ],
  items: [
    {
      kind: 'PLAN',
      reference: 'REF-1',
      organizationId: 'o1',
      organizationName: 'Notaría 14',
      date: '2026-10-20T10:00:00.000Z',
      promoDiscount: 50000,
      paid: 400000,
      currency: 'COP',
    },
  ],
  ...over,
});
