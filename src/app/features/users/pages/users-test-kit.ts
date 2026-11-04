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
import type { PlatformUser, PlatformUserDetail } from '../data/users.models';

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

export const usuario = (over: Partial<PlatformUser> = {}): PlatformUser => ({
  id: 'u1',
  names: 'Ana',
  surNames: 'Pérez Gómez',
  email: 'ana@correo.co',
  phone: '3001112233',
  identification: '1032456789',
  active: true,
  countryId: 'co',
  countryName: 'Colombia',
  organizationsCount: 2,
  createdAt: '2026-01-15T12:00:00.000Z',
  ...over,
});

export const ficha = (over: Partial<PlatformUserDetail> = {}): PlatformUserDetail => ({
  ...usuario(),
  identificationType: 'Cédula de ciudadanía',
  cityId: 'c1',
  cityName: 'Bogotá',
  expeditionCityName: 'Medellín',
  expeditionDate: '2010-05-20',
  termsAccepted: true,
  updatedAt: '2026-02-20T12:00:00.000Z',
  memberships: [
    {
      membershipId: 'm1',
      duplicate: false,
      organizationId: 'o1',
      organizationName: 'Notaría Central',
      tributaryNumber: '900111222',
      personal: false,
      roleId: 'r1',
      roleCode: 1,
      roleName: 'Administrador',
      active: true,
      email: 'ana@notaria.co',
      phone: '6011234567',
      branchType: 'region',
    },
    {
      membershipId: 'm2',
      duplicate: false,
      organizationId: 'o2',
      personal: true,
      roleId: 'r2',
      active: false,
      email: 'ana@correo.co',
      phone: '3001112233',
    },
  ],
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
