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
import type {
  Invoice,
  RevenueSummary,
  TransactionDetail,
  TransactionRow,
} from '../data/billing.models';

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

export const transaccion = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 'tx1',
  idTransaction: 'MANUAL-001',
  reference: 'REF-001',
  organizationId: 'o1',
  organization: { id: 'o1', name: 'Notaría 14' },
  plan: 'pro',
  planName: 'Profesional',
  planDuration: 'monthly',
  amountMajor: 250000,
  source: 'manual',
  taxes: [],
  currency: 'COP',
  status: 'PENDING',
  invoiced: false,
  webhookEventIds: [],
  requestDate: '2026-10-29T10:00:00.000Z',
  ...over,
});

export const fichaTransaccion = (over: Partial<TransactionDetail> = {}): TransactionDetail => ({
  ...transaccion(),
  invoice: null,
  ...over,
});

export const factura = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'f1',
  invoiceNumber: 'FAC-000001',
  organizationId: 'o1',
  clientName: 'Notaría 14',
  clientTaxId: '900123456',
  clientEmail: 'pagos@notaria14.co',
  currency: 'COP',
  items: [{ concept: 'Plan Profesional', quantity: 1, unitPrice: 250000, amount: 250000 }],
  subtotal: 250000,
  taxes: [{ type: 'IVA 19%', amount: 47500 }],
  total: 297500,
  status: 'draft',
  issueDate: '2026-10-29T10:00:00.000Z',
  ...over,
});

export const resumenIngresos = (over: Partial<RevenueSummary> = {}): RevenueSummary => ({
  capped: false,
  rowsRead: 3,
  totals: [{ currency: 'COP', gross: 500000, count: 2 }],
  byStatus: [
    { status: 'APPROVED', count: 2 },
    { status: 'PENDING', count: 1 },
    { status: 'DECLINED', count: 1 },
    { status: 'VOIDED', count: 1 },
  ],
  byProvider: [{ source: 'alohapay', currency: 'COP', gross: 500000, count: 2 }],
  byMonth: [{ year: 2026, month: 10, currency: 'COP', gross: 500000, count: 2 }],
  byPlan: [{ plan: 'pro', name: 'Profesional', currency: 'COP', gross: 500000, count: 2 }],
  byOrganization: [
    { organizationId: 'o1', name: 'Notaría 14', currency: 'COP', gross: 500000, count: 2 },
  ],
  ...over,
});
