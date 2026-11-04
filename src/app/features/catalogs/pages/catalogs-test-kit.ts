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
import type { CountryDetail, FieldRules, SignerPolicy } from '../data/catalogs.models';

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

export const pais = (over: Partial<CountryDetail> = {}): CountryDetail => ({
  id: 'co',
  name: 'Colombia',
  abbreviation: 'CO',
  flag: '🇨🇴',
  callingCode: '+57',
  currency: 'COP',
  locale: 'es-CO',
  timezone: 'America/Bogota',
  citiesCount: 1123,
  kindPersonsCount: 2,
  identificationTypesCount: 7,
  resolution: '',
  taxId: { label: 'NIT', pattern: '^[0-9]+$', normalize: 'strip-dv' },
  capabilities: {
    companyRegistry: { provider: 'x' },
    identityRegistry: { docTypes: ['CC'] },
    registryFaceMatch: null,
    idCardReader: null,
    sms: true,
    addons: ['pagares'],
  },
  ...over,
});

const reglas = (over: Partial<FieldRules> = {}): FieldRules => ({
  businessName: 'hidden',
  identificationTypeRepLegalId: 'hidden',
  identificationRepLegal: 'hidden',
  expeditionDate: 'optional',
  birthDate: 'optional',
  expeditionCityId: 'optional',
  personalMail: 'optional',
  ...over,
});

export const politica = (over: Partial<SignerPolicy> = {}): SignerPolicy => ({
  countryId: 'co',
  directory: 'ORG_ONLY',
  fields: {
    natural: { fields: reglas() },
    legal: { fields: reglas({ businessName: 'required' }) },
  },
  customFields: false,
  customDirectory: false,
  ...over,
});
