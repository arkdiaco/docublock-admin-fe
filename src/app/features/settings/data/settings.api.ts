import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type {
  CredentialGroup,
  SettingAction,
  SettingItem,
  SettingValue,
  SettingsHistoryPage,
  SettingsHistoryQuery,
} from './settings.models';

const BASE = '/platform/config';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const settingErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'CONFIG_EN_CAMBIO') return 'cfg.error.changed';
  if (code === 'CONFIG_FUERA_DE_RANGO') return 'cfg.error.range';
  if (code === 'CONFIG_CAMBIO_NO_EXISTE') return 'cfg.error.gone';
  if (errorStatusOf(error) === 403) return 'cfg.error.forbidden';
  return 'cfg.error.failed';
};

@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<{ items: SettingItem[] }> {
    return this.http.get<{ items: SettingItem[] }>(BASE, { context: silent() });
  }

  credentials(): Observable<{ groups: CredentialGroup[] }> {
    return this.http.get<{ groups: CredentialGroup[] }>(`${BASE}/credentials`, {
      context: silent(),
    });
  }

  history(query: SettingsHistoryQuery): Observable<SettingsHistoryPage> {
    return this.http.get<SettingsHistoryPage>(`${BASE}/history`, {
      params: toParams({ ...query }),
      context: silent(),
    });
  }

  change(key: string, value: SettingValue, action: SettingAction): Observable<SettingItem> {
    return this.http.put<SettingItem>(
      `${BASE}/${key}`,
      { value, ...action },
      { context: silent() },
    );
  }

  reset(key: string, action: SettingAction): Observable<SettingItem> {
    return this.http.post<SettingItem>(`${BASE}/${key}/reset`, action, { context: silent() });
  }

  restore(changeId: string, action: SettingAction): Observable<SettingItem> {
    return this.http.post<SettingItem>(`${BASE}/history/${changeId}/restore`, action, {
      context: silent(),
    });
  }
}
