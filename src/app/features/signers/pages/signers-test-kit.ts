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
import type { PlatformSigner, PlatformSignerDetail } from '../data/signers.models';

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

export const firmante = (over: Partial<PlatformSigner> = {}): PlatformSigner => ({
  id: 's1',
  fullName: 'Ana Ruiz',
  identification: '1032456789',
  email: 'ana@correo.co',
  cellphone: '+573001112233',
  countryId: 'co',
  countryName: 'Colombia',
  identified: true,
  autoSign: false,
  oneTouch: false,
  organizationsCount: 1,
  createdAt: '2026-01-15T12:00:00.000Z',
  ...over,
});

export const ficha = (over: Partial<PlatformSignerDetail> = {}): PlatformSignerDetail => ({
  ...firmante(),
  firstName: 'Ana',
  lastName: 'Ruiz',
  kindPersonId: 'nat',
  kindPersonName: 'Natural',
  identificationTypeId: 'cc',
  identificationTypeName: 'Cédula',
  expeditionCityId: 'bog',
  expeditionCityName: 'Bogotá',
  expeditionDate: '2010-05-20T00:00:00.000Z',
  isLegalRep: false,
  identityId: 'i1',
  organizations: [{ id: 'o1', name: 'Notaría Central', tributaryNumber: '900111222' }],
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
