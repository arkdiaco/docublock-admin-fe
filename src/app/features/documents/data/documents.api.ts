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
  LinksRevocationOutcome,
  PlatformDocumentDetail,
  RawDocument,
  RawSigner,
  ReactivationChoice,
  ReactivationOutcome,
  SignerChange,
  SignerChangeOutcome,
  SignerFileKind,
  SignerRemovalOutcome,
  TurnFixOutcome,
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

  signerRaw(id: string, identityId: string): Observable<RawSigner> {
    return this.http.get<RawSigner>(`${BASE}/${id}/signers/${identityId}/raw`, {
      context: silent(),
    });
  }

  removedSignerCopy(id: string, identityId: string): Observable<RawSigner> {
    return this.http.get<RawSigner>(`${BASE}/${id}/signers/${identityId}/removed-copy`, {
      context: silent(),
    });
  }

  signerFile(
    id: string,
    identityId: string,
    kind: SignerFileKind,
    history?: number,
  ): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/signers/${identityId}/files/${kind}`, {
      params: toParams({ history }),
      responseType: 'blob',
      context: silent(),
    });
  }

  signerAttachmentFile(id: string, identityId: string, index: number): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/signers/${identityId}/attachments/${index}/file`, {
      responseType: 'blob',
      context: silent(),
    });
  }

  signerReport(id: string, identityId: string): Observable<Blob> {
    return this.http.get(`${BASE}/${id}/signers/${identityId}/validation-report`, {
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

  reactivateValidations(
    id: string,
    identityId: string,
    scope: ReactivationChoice,
    reason: string,
  ): Observable<ReactivationOutcome> {
    return this.http.post<ReactivationOutcome>(
      `${BASE}/${id}/signers/${identityId}/reactivate-validations`,
      { reason, scope },
      { context: silent() },
    );
  }

  changeSigner(
    id: string,
    identityId: string,
    change: SignerChange,
    reason: string,
  ): Observable<SignerChangeOutcome> {
    return this.http.patch<SignerChangeOutcome>(
      `${BASE}/${id}/signers/${identityId}`,
      { reason, ...change },
      { context: silent() },
    );
  }

  removeSigner(
    id: string,
    identityId: string,
    reason: string,
    notify: boolean,
  ): Observable<SignerRemovalOutcome> {
    return this.http.post<SignerRemovalOutcome>(
      `${BASE}/${id}/signers/${identityId}/remove`,
      { reason, notify },
      { context: silent() },
    );
  }

  revokeLinks(id: string, identityId: string, reason: string): Observable<LinksRevocationOutcome> {
    return this.http.post<LinksRevocationOutcome>(
      `${BASE}/${id}/signers/${identityId}/revoke-links`,
      { reason },
      { context: silent() },
    );
  }

  fixTurn(id: string, reason: string, notify: boolean): Observable<TurnFixOutcome> {
    return this.http.post<TurnFixOutcome>(
      `${BASE}/${id}/turn/fix`,
      { reason, notify },
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
