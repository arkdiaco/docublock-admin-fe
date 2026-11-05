import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type {
  CampaignDetail,
  CampaignImage,
  CampaignRecipientState,
  CampaignRecipientsPage,
  CampaignView,
  CampaignsPage,
  NewCampaign,
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

export const CAMPAIGN_UNCERTAIN = 'comm.send.unknown';

export const campaignErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'CAMPANA_TEXTO_INVALIDO') return 'comm.send.badText';
  if (code === 'CAMPANA_SIN_DESTINATARIOS') return 'comm.send.noRecipients';
  const status = errorStatusOf(error);
  if (status === 400) return 'comm.send.badRequest';
  if (status === 403) return 'comm.send.forbidden';
  return CAMPAIGN_UNCERTAIN;
};

export const retryErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'CAMPANA_EN_CURSO') return 'comm.retry.inProgress';
  if (code === 'CAMPANA_SIN_FALLIDOS') return 'comm.retry.noFailed';
  if (errorStatusOf(error) === 403) return 'comm.retry.forbidden';
  return 'comm.retry.unknown';
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

  createCampaign(campaign: NewCampaign): Observable<CampaignView> {
    return this.http.post<CampaignView>(`${BASE}/whatsapp/campaigns`, campaign, {
      context: silent(),
    });
  }

  campaigns(query: { page: number; limit: number }): Observable<CampaignsPage> {
    return this.http.get<CampaignsPage>(`${BASE}/whatsapp/campaigns`, {
      params: toParams(query),
      context: silent(),
    });
  }

  campaign(id: string): Observable<CampaignDetail> {
    return this.http.get<CampaignDetail>(`${BASE}/whatsapp/campaigns/${id}`, { context: silent() });
  }

  campaignRecipients(
    id: string,
    query: { state?: CampaignRecipientState; search?: string; page: number; limit: number },
  ): Observable<CampaignRecipientsPage> {
    return this.http.get<CampaignRecipientsPage>(`${BASE}/whatsapp/campaigns/${id}/recipients`, {
      params: toParams(query),
      context: silent(),
    });
  }

  retryCampaign(id: string, reason: string): Observable<CampaignView> {
    return this.http.post<CampaignView>(
      `${BASE}/whatsapp/campaigns/${id}/retry`,
      { reason },
      { context: silent() },
    );
  }
}
