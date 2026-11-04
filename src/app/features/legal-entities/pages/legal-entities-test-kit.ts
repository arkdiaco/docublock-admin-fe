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
  LegalEntityDetail,
  LegalEntityRow,
  PendingLegalEntity,
} from '../data/legal-entities.models';

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

export const entidad = (over: Partial<LegalEntityRow> = {}): LegalEntityRow => ({
  id: 'e1',
  businessName: 'Acme SAS',
  identification: '900111222',
  countryId: 'co',
  countryName: 'Colombia',
  active: true,
  representativesCount: 1,
  legalRepName: 'Ana Ruiz',
  createdAt: '2026-01-15T12:00:00.000Z',
  ...over,
});

export const ficha = (over: Partial<LegalEntityDetail> = {}): LegalEntityDetail => ({
  ...entidad(),
  kindPersonId: 'jur',
  kindPersonName: 'Persona Juridica',
  companySignerId: 'c1',
  representatives: [
    {
      signerId: 's1',
      fullName: 'Ana Ruiz',
      identification: '1032456789',
      email: 'ana@correo.co',
      isLegalRep: true,
      signerIsLegalRep: false,
      since: '2026-01-15T12:00:00.000Z',
    },
  ],
  ...over,
});

export const porRegistrar = (over: Partial<PendingLegalEntity> = {}): PendingLegalEntity => ({
  signerId: 'c1',
  businessName: 'Gravitar SAS',
  identification: '900370406',
  countryId: 'co',
  countryName: 'Colombia',
  kindPersonId: 'jur',
  representativeIdentification: '1032409749',
  representative: { signerId: 'p1', fullName: 'Ana Ruiz' },
  ...over,
});

export const conPermisos = (permisos: string[]): void => {
  TestBed.inject(AuthStore).setProfile({
    user: {
      id: 'a1',
      names: 'Sam',
      surNames: 'Ventas',
      email: 'sam@docublock.co',
      identification: '',
      imageProfile: null,
    },
    platformStaff: true,
    platformPermissions: permisos,
  });
};
