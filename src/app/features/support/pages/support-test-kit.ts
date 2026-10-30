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
import type { TicketDetail, TicketSummary } from '../data/support.models';

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
      surNames: 'Soporte',
      email: 'sam@docublock.co',
      identification: '',
      imageProfile: null,
    },
    platformStaff: true,
    platformPermissions: permisos,
  });

export const resumen = (over: Partial<TicketSummary> = {}): TicketSummary => ({
  id: 't1',
  ticketNumber: 'TKT-2026-000001',
  organizationId: 'o1',
  subject: 'No llega la clave',
  description: 'El SMS no llega',
  category: 'signature',
  priority: 'high',
  status: 'open',
  sourceChannel: 'signature_flow',
  createdByType: 'signer',
  requesterName: 'Ana Rey',
  requesterEmail: 'ana@x.co',
  sla: {
    policyName: 'default',
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    firstResponseDueAt: '2099-01-01T00:00:00.000Z',
    resolutionDueAt: '2099-01-02T00:00:00.000Z',
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    firstResponseBreached: false,
    resolutionBreached: false,
  },
  tags: [],
  metadata: {},
  createdAt: '2026-10-29T10:00:00.000Z',
  organization: { id: 'o1', name: 'Notaría 14' },
  assignee: null,
  ...over,
});

export const ficha = (over: Partial<TicketDetail> = {}): TicketDetail => ({
  ...resumen(),
  messages: [
    {
      authorType: 'signer',
      authorName: 'Ana Rey',
      body: 'El SMS no llega',
      attachments: ['firma/organizations/o1/documents/x/captura.png'],
      internalNote: false,
      createdAt: '2026-10-29T10:00:00.000Z',
    },
    {
      authorType: 'agent',
      authorName: 'Lía Admin',
      body: 'Revisar operador',
      attachments: [],
      internalNote: true,
      createdAt: '2026-10-29T11:00:00.000Z',
    },
  ],
  auditLog: [
    {
      action: 'created',
      byType: 'signer',
      byName: 'Ana Rey',
      from: null,
      to: 'open',
      createdAt: '2026-10-29T10:00:00.000Z',
    },
    {
      action: 'priority_change',
      byType: 'agent',
      byName: 'Lía Admin',
      from: 'normal',
      to: 'high',
      createdAt: '2026-10-29T10:30:00.000Z',
    },
  ],
  assignmentHistory: [],
  ...over,
});
