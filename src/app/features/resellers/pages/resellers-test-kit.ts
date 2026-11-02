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
import type { HistoryEntry, PortfolioOrg, Reseller } from '../data/resellers.models';

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

export const reseller = (over: Partial<Reseller> = {}): Reseller => ({
  id: 'rs1',
  businessName: 'Aliados SAS',
  tributaryNumber: '900111222',
  email: 'hola@aliados.co',
  active: true,
  isReseller: true,
  portfolioCount: 2,
  createdAt: '2026-01-15T10:00:00.000Z',
  ...over,
});

export const cartera = (over: Partial<PortfolioOrg> = {}): PortfolioOrg => ({
  id: 'o1',
  businessName: 'Notaría 14',
  tributaryNumber: '900123456',
  active: true,
  plan: {
    code: 'pro',
    name: 'Profesional',
    periodEnd: '2026-12-31T00:00:00.000Z',
    documents: { limit: 100, used: 40, remaining: 60 },
  },
  users: { total: 5, active30d: 3 },
  ...over,
});

export const movimiento = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'h1',
  userId: 'u9',
  action: 'organization.reseller_assigned',
  organizationId: 'o1',
  resellerId: 'rs1',
  actorName: 'Sam Ventas',
  organizationName: 'Notaría 14',
  resellerName: 'Aliados SAS',
  createdAt: '2026-10-20T10:00:00.000Z',
  ...over,
});
