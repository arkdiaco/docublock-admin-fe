import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type { TransactionStatus } from '../../../shared/domain/billing-status';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  Invoice,
  InvoiceBody,
  InvoicesPage,
  InvoicesQuery,
  ManualPaymentBody,
  ManualPlanOption,
  PaymentConfigStatus,
  ReconcileResult,
  RevenueFilter,
  RevenuePage,
  RevenueQuery,
  RevenueSummary,
  TransactionDetail,
  TransactionRow,
  TransactionsPage,
  TransactionsQuery,
} from './billing.models';

const TRANSACTIONS = '/platform/transactions';
const INVOICES = '/platform/invoices';
const REVENUE = '/platform/revenue';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  transactions(query: TransactionsQuery): Observable<TransactionsPage> {
    return this.http.get<TransactionsPage>(TRANSACTIONS, { params: toParams({ ...query }) });
  }

  transaction(id: string): Observable<TransactionDetail> {
    return this.http.get<TransactionDetail>(`${TRANSACTIONS}/${id}`, { context: silent() });
  }

  registerManual(body: ManualPaymentBody): Observable<TransactionRow> {
    return this.http.post<TransactionRow>(`${TRANSACTIONS}/manual`, body, { context: silent() });
  }

  reconcile(): Observable<ReconcileResult> {
    return this.http.post<ReconcileResult>(`${TRANSACTIONS}/reconcile`, {}, { context: silent() });
  }

  setStatus(id: string, status: TransactionStatus): Observable<TransactionRow> {
    return this.http.put<TransactionRow>(
      `${TRANSACTIONS}/${id}/status`,
      { status },
      { context: silent() },
    );
  }

  setInvoiced(id: string, invoiced: boolean): Observable<TransactionRow> {
    return this.http.patch<TransactionRow>(
      `${TRANSACTIONS}/${id}/invoiced`,
      { invoiced },
      { context: silent() },
    );
  }

  plans(): Observable<ManualPlanOption[]> {
    return this.http.get<ManualPlanOption[]>('/platform/plans', {
      params: toParams({ state: 'active' }),
      context: silent(),
    });
  }

  invoices(query: InvoicesQuery): Observable<InvoicesPage> {
    return this.http.get<InvoicesPage>(INVOICES, { params: toParams({ ...query }) });
  }

  invoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${INVOICES}/${id}`, { context: silent() });
  }

  createInvoice(body: InvoiceBody): Observable<Invoice> {
    return this.http.post<Invoice>(INVOICES, body, { context: silent() });
  }

  invoiceFromTransaction(transactionId: string): Observable<Invoice> {
    return this.http.post<Invoice>(
      `${INVOICES}/from-transaction/${transactionId}`,
      {},
      { context: silent() },
    );
  }

  updateInvoice(id: string, body: InvoiceBody): Observable<Invoice> {
    return this.http.put<Invoice>(`${INVOICES}/${id}`, body, { context: silent() });
  }

  voidInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES}/${id}/void`, {}, { context: silent() });
  }

  sendInvoice(id: string, email: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES}/${id}/send`, { email }, { context: silent() });
  }

  invoicePdf(id: string): Observable<Blob> {
    return this.http.get(`${INVOICES}/${id}/pdf`, { responseType: 'blob', context: silent() });
  }

  revenueSummary(range: { from?: string; to?: string }): Observable<RevenueSummary> {
    return this.http.get<RevenueSummary>(`${REVENUE}/summary`, { params: toParams(range) });
  }

  revenueTransactions(query: RevenueQuery): Observable<RevenuePage> {
    return this.http.get<RevenuePage>(`${REVENUE}/transactions`, {
      params: toParams({ ...query }),
    });
  }

  revenueCsv(filter: RevenueFilter): Observable<ExportedFile> {
    return this.http
      .get(`${REVENUE}/transactions.csv`, {
        params: toParams({ ...filter }),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(map((response) => exportedFileOf(response, 'ingresos.csv')));
  }

  paymentConfig(): Observable<PaymentConfigStatus> {
    return this.http.get<PaymentConfigStatus>('/platform/billing/config', { context: silent() });
  }
}
