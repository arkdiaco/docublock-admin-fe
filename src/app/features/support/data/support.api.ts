import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  SlaPlanOption,
  SlaPolicy,
  SlaPolicyBody,
  SupportAgent,
  TicketDetail,
  TicketMetrics,
  TicketPriority,
  TicketsPage,
  TicketsQuery,
  TicketStatus,
} from './support.models';

const TICKETS = '/platform/support/tickets';
const POLICIES = '/platform/support/sla-policies';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class SupportApi {
  private readonly http = inject(HttpClient);

  list(query: TicketsQuery): Observable<TicketsPage> {
    return this.http.get<TicketsPage>(TICKETS, { params: toParams({ ...query }) });
  }

  metrics(organizationId?: string): Observable<TicketMetrics> {
    return this.http.get<TicketMetrics>('/platform/support/metrics', {
      params: toParams({ organizationId }),
    });
  }

  agents(): Observable<SupportAgent[]> {
    return this.http.get<SupportAgent[]>('/platform/support/agents');
  }

  detail(id: string): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${TICKETS}/${id}`, { context: silent() });
  }

  attachment(id: string, ref: string): Observable<Blob> {
    return this.http.get(`${TICKETS}/${id}/attachments`, {
      params: toParams({ ref }),
      responseType: 'blob',
      context: silent(),
    });
  }

  reply(id: string, body: string, internalNote: boolean): Observable<unknown> {
    return this.http.post(
      `${TICKETS}/${id}/messages`,
      { body, internalNote },
      { context: silent() },
    );
  }

  assign(id: string, assignedToId: string): Observable<unknown> {
    return this.http.patch(`${TICKETS}/${id}/assign`, { assignedToId }, { context: silent() });
  }

  setStatus(id: string, status: TicketStatus): Observable<unknown> {
    return this.http.patch(`${TICKETS}/${id}/status`, { status }, { context: silent() });
  }

  setPriority(id: string, priority: TicketPriority): Observable<unknown> {
    return this.http.patch(`${TICKETS}/${id}/priority`, { priority }, { context: silent() });
  }

  policies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(POLICIES);
  }

  planOptions(): Observable<SlaPlanOption[]> {
    return this.http.get<SlaPlanOption[]>('/platform/plans/legacy', { context: silent() });
  }

  createPolicy(body: SlaPolicyBody): Observable<SlaPolicy> {
    return this.http.post<SlaPolicy>(POLICIES, body, { context: silent() });
  }

  updatePolicy(id: string, body: Partial<SlaPolicyBody>): Observable<SlaPolicy> {
    return this.http.put<SlaPolicy>(`${POLICIES}/${id}`, body, { context: silent() });
  }

  deactivatePolicy(id: string): Observable<SlaPolicy> {
    return this.http.delete<SlaPolicy>(`${POLICIES}/${id}`, { context: silent() });
  }

  seedDefault(): Observable<SlaPolicy> {
    return this.http.post<SlaPolicy>(`${POLICIES}/seed-default`, {}, { context: silent() });
  }
}
