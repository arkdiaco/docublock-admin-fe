import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { configurar, tipificado } from '../pages/resellers-test-kit';
import { ResellersApi } from './resellers.api';

describe('ResellersApi', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  it('definir el modelo manda PATCH con el valor y devuelve el reseller actualizado', async () => {
    const respuesta = firstValueFrom(TestBed.inject(ResellersApi).setModel('rs2', 'PLANS'));
    const req = http.expectOne('/platform/resellers/rs2/model');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ model: 'PLANS' });
    expect(req.request.context.get(SILENT_ERRORS)).toBe(true);
    req.flush(tipificado());
    expect((await respuesta).model).toBe('PLANS');
  });
});
