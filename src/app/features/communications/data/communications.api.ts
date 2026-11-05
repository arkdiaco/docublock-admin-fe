import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type {
  CampaignImage,
  RecipientKind,
  RecipientsPage,
  RecipientsPreview,
  RecipientsSelection,
} from './communications.models';

const BASE = '/platform/communications';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const imageErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'ARCHIVO_DEMASIADO_GRANDE' || errorStatusOf(error) === 413) return 'comm.image.tooBig';
  if (code === 'TIPO_ARCHIVO_INVALIDO') return 'comm.image.badType';
  return 'comm.image.failed';
};

@Injectable({ providedIn: 'root' })
export class CommunicationsApi {
  private readonly http = inject(HttpClient);

  recipients(query: {
    kind: RecipientKind;
    search?: string;
    page: number;
    limit: number;
  }): Observable<RecipientsPage> {
    return this.http.get<RecipientsPage>(`${BASE}/recipients`, { params: toParams(query) });
  }

  preview(selection: RecipientsSelection): Observable<RecipientsPreview> {
    return this.http.post<RecipientsPreview>(`${BASE}/whatsapp/preview`, selection, {
      context: silent(),
    });
  }

  uploadImage(file: File): Observable<CampaignImage> {
    const form = new FormData();
    form.set('file', file);
    return this.http.post<CampaignImage>(`${BASE}/whatsapp/image`, form, { context: silent() });
  }
}
