import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  BlockchainRegistration,
  BulkRegenerationResult,
  DocumentIssues,
  DocumentsPage,
  DocumentsQuery,
  DocumentTrace,
  InvitationOutcome,
  PlatformDocumentDetail,
  RawDocument,
  RetryableEvidence,
} from './documents.models';

const BASE = '/platform/documents';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);

  list(query: DocumentsQuery): Observable<DocumentsPage> {
    return this.http.get<DocumentsPage>(BASE, { params: toParams(query) });
  }

  issues(): Observable<DocumentIssues> {
    return this.http.get<DocumentIssues>(`${BASE}/issues`);
  }

  detail(id: string): Observable<PlatformDocumentDetail> {
    return this.http.get<PlatformDocumentDetail>(`${BASE}/${id}`, { context: silent() });
  }

  trace(id: string): Observable<DocumentTrace> {
    return this.http.get<DocumentTrace>(`${BASE}/${id}/traceability`, { context: silent() });
  }

  versionFile(id: string, versionId: string): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/versions/${versionId}/file`, {
      responseType: 'blob',
      context: silent(),
    });
  }

  raw(id: string): Observable<RawDocument> {
    return this.http.get<RawDocument>(`${BASE}/${id}/raw`, { context: silent() });
  }

  certificateFile(id: string): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/certificate/file`, {
      responseType: 'blob',
      context: silent(),
    });
  }

  attachmentFile(id: string, index: number): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/attachments/${index}/file`, {
      responseType: 'blob',
      context: silent(),
    });
  }

  bundle(id: string): Observable<ExportedFile> {
    return this.http
      .get(`${BASE}/${id}/bundle`, { responseType: 'blob', observe: 'response', context: silent() })
      .pipe(map((response) => exportedFileOf(response, 'expediente.zip')));
  }

  finalize(id: string, reason: string): Observable<unknown> {
    return this.http.post(`${BASE}/${id}/finalize`, { reason }, { context: silent() });
  }

  cancel(id: string, reason: string): Observable<unknown> {
    return this.http.post(`${BASE}/${id}/cancel`, { reason }, { context: silent() });
  }

  regenerate(id: string): Observable<unknown> {
    return this.http.post(`${BASE}/${id}/regenerate`, {}, { context: silent() });
  }

  registerBlockchain(id: string): Observable<BlockchainRegistration> {
    return this.http.post<BlockchainRegistration>(
      `${BASE}/${id}/register-blockchain`,
      {},
      { context: silent() },
    );
  }

  unblock(id: string, identityId: string, reason: string): Observable<unknown> {
    return this.http.post(
      `${BASE}/${id}/signers/${identityId}/unblock`,
      { reason },
      { context: silent() },
    );
  }

  enableRetry(
    id: string,
    identityId: string,
    type: RetryableEvidence,
    reason: string,
  ): Observable<unknown> {
    return this.http.post(
      `${BASE}/${id}/signers/${identityId}/enable-retry`,
      { reason, type },
      { context: silent() },
    );
  }

  resend(id: string, identityId: string): Observable<InvitationOutcome> {
    return this.http.post<InvitationOutcome>(
      `${BASE}/${id}/signers/${identityId}/resend`,
      {},
      { context: silent() },
    );
  }

  detach(id: string, versionId: string, reason: string): Observable<unknown> {
    return this.http.post(
      `${BASE}/${id}/versions/${versionId}/detach`,
      { reason },
      { context: silent() },
    );
  }

  regenerateBulk(ids: string[]): Observable<BulkRegenerationResult> {
    return this.http.post<BulkRegenerationResult>(
      `${BASE}/regenerate`,
      { ids },
      { context: silent() },
    );
  }
}
