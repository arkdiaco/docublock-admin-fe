import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { TargetHistoryEvent } from '../../../shared/ui/target-history.component';
import type {
  CountryOption,
  IdentificationTypeOption,
  NamedOption,
  PageOf,
  PlatformSignerDetail,
  SignerChanges,
  SignerDocument,
  SignerOneTouch,
  SignersPage,
  SignerView,
} from './signers.models';

const BASE = '/platform/signers';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const SIGNER_ERRORS: readonly string[] = [
  'FIRMANTE_NO_ENCONTRADO',
  'CONTACTO_EN_USO',
  'PAIS_NO_ENCONTRADO',
  'CIUDAD_NO_ENCONTRADA',
  'FECHA_INVALIDA',
  'FECHAS_INVALIDAS',
  'TIPO_PERSONA_INVALIDO',
  'TIPO_IDENTIFICACION_INVALIDO',
  'CAMPOS_REQUERIDOS',
  'NOMBRE_REQUERIDO',
  'APELLIDO_REQUERIDO',
  'CORREO_INVALIDO',
  'CELULAR_INVALIDO',
  'ORGANIZACION_NO_ENCONTRADA',
  'FIRMANTE_YA_VINCULADO',
  'FIRMANTE_NO_VINCULADO',
  'FIRMA_AUTOMATICA_INACTIVA',
  'LLAVE_NO_ENCONTRADA',
];

@Injectable({ providedIn: 'root' })
export class SignersApi {
  private readonly http = inject(HttpClient);

  list(query: {
    search?: string;
    view?: SignerView;
    countryId?: string;
    page: number;
    limit: number;
  }): Observable<SignersPage> {
    return this.http.get<SignersPage>(BASE, { params: toParams(query) });
  }

  get(id: string): Observable<PlatformSignerDetail> {
    return this.http.get<PlatformSignerDetail>(`${BASE}/${id}`, { context: silent() });
  }

  update(id: string, changes: SignerChanges, reason: string): Observable<PlatformSignerDetail> {
    return this.http.patch<PlatformSignerDetail>(
      `${BASE}/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  addOrganization(id: string, orgId: string, reason: string): Observable<PlatformSignerDetail> {
    return this.http.post<PlatformSignerDetail>(
      `${BASE}/${id}/organizations/${orgId}`,
      { reason },
      { context: silent() },
    );
  }

  removeOrganization(id: string, orgId: string, reason: string): Observable<PlatformSignerDetail> {
    return this.http.delete<PlatformSignerDetail>(`${BASE}/${id}/organizations/${orgId}`, {
      body: { reason },
      context: silent(),
    });
  }

  disableAutoSign(id: string, reason: string): Observable<PlatformSignerDetail> {
    return this.http.post<PlatformSignerDetail>(
      `${BASE}/${id}/auto-sign/disable`,
      { reason },
      { context: silent() },
    );
  }

  oneTouch(id: string): Observable<SignerOneTouch> {
    return this.http.get<SignerOneTouch>(`${BASE}/${id}/one-touch`, { context: silent() });
  }

  revokeOneTouch(id: string, credentialId: string, reason: string): Observable<SignerOneTouch> {
    return this.http.delete<SignerOneTouch>(
      `${BASE}/${id}/one-touch/credentials/${encodeURIComponent(credentialId)}`,
      { body: { reason }, context: silent() },
    );
  }

  documents(identity: string, page: number, limit: number): Observable<PageOf<SignerDocument>> {
    return this.http.get<PageOf<SignerDocument>>('/platform/documents', {
      params: toParams({ identity, page, limit }),
      context: silent(),
    });
  }

  history(id: string, page: number, limit: number): Observable<PageOf<TargetHistoryEvent>> {
    return this.http.get<PageOf<TargetHistoryEvent>>('/platform/audit', {
      params: toParams({ targetType: 'signer', targetId: id, page, limit }),
      context: silent(),
    });
  }

  cities(countryId: string, search: string): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`/catalogs/countries/${countryId}/cities`, {
      params: toParams({ search: search || undefined, limit: 50 }),
    });
  }

  kindPersons(countryId: string): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`/catalogs/countries/${countryId}/kind-persons`);
  }

  identificationTypes(countryId: string): Observable<IdentificationTypeOption[]> {
    return this.http.get<IdentificationTypeOption[]>(
      `/catalogs/countries/${countryId}/identification-types`,
    );
  }

  countries(): Observable<CountryOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>('/catalogs/countries')
      .pipe(
        map((countries) => countries.map((country) => ({ id: country.id, label: country.name }))),
      );
  }
}
