import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import {
  INVOICE_FAMILY,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../../../shared/domain/billing-status';
import { moneyExact } from '../../../shared/domain/money';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { BillingNavComponent } from '../components/billing-nav.component';
import { InvoiceFormComponent } from '../components/invoice-form.component';
import { BillingApi } from '../data/billing.api';
import { BILLING_ERRORS } from '../data/billing-errors';
import type { Invoice, InvoiceBody } from '../data/billing.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';

const COLUMNS: readonly DataColumn[] = [
  { key: 'number', labelKey: 'billing.inv.col.number', width: '130px' },
  { key: 'client', labelKey: 'billing.inv.col.client', width: 'minmax(0, 1.5fr)' },
  { key: 'total', labelKey: 'billing.inv.col.total', width: '130px', align: 'end' },
  { key: 'status', labelKey: 'billing.inv.col.status', width: '110px' },
  { key: 'issued', labelKey: 'billing.inv.col.issued', width: '100px' },
  { key: 'sentTo', labelKey: 'billing.inv.col.sentTo', width: 'minmax(0, 1fr)' },
  { key: 'chevron', width: '24px', align: 'end' },
];

interface RowView extends Invoice {
  totalText: string;
  issuedText: string;
}

@Component({
  selector: 'dba-invoices',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    EmptyStateComponent,
    OrgPickerComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    BillingNavComponent,
    InvoiceFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <dba-billing-nav
        active="invoices"
        [meta]="'billing.inv.count' | translate: { total: total() }"
      >
        @if (canManage()) {
          <button dba-button (click)="formOpen.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'billing.inv.new' | translate }}
          </button>
        }
      </dba-billing-nav>

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'billing.inv.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        @if (canPickOrg()) {
          <dba-org-picker [value]="organization()" (picked)="pickOrganization($event)" />
        }
        <p-select
          [options]="statusOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="status()"
          (ngModelChange)="pickStatus($event)"
          [ariaLabel]="'billing.inv.f.status' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'billing.inv.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="billing.inv.errorTitle" leadKey="billing.inv.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="billing.inv.emptyTitle" leadKey="billing.inv.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'billing.section.invoices' | translate"
          [dense]="density.compact()"
          minWidth="860px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[billingPath, 'facturas', row.id]">
              <span class="dba-td dba-td--mono">{{ row.invoiceNumber }}</span>
              <span class="dba-td cell">
                <span class="cell__label">{{ row.clientName }}</span>
                <span class="cell__meta">{{ row.clientTaxId || row.clientEmail }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.totalText }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="family[row.status]"
                  [labelKey]="'billing.invStatus.' + row.status"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-td--mono">{{ row.issuedText }}</span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.sentTo || '—' }}</span>
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (formOpen()) {
      <dba-invoice-form
        [busy]="pending.key() === 'create'"
        (submitted)="create($event)"
        (dismissed)="formOpen.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class InvoicesComponent {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly family = INVOICE_FAMILY;
  protected readonly billingPath = sectionPath('billing');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canPickOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly organization = signal<string | null>(null);
  protected readonly status = signal<string>(ANY);
  private readonly items = signal<Invoice[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly statusOptions = computed(() => [
    { id: ANY, label: this.label('billing.inv.f.anyStatus') },
    ...INVOICE_STATUSES.map((id) => ({ id, label: this.label(`billing.invStatus.${id}`) })),
  ]);
  protected readonly rows = computed<RowView[]>(() =>
    this.items().map((row) => ({
      ...row,
      totalText: moneyExact(row.total, row.currency, this.locale),
      issuedText: row.issueDate ? formatDate(row.issueDate, 'd/MM/y', this.locale) : '—',
    })),
  );
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    const org = this.route.snapshot.queryParamMap.get('organizacion');
    if (org && this.canPickOrg()) this.organization.set(org);
    void this.reload();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.restart();
    }, DEBOUNCE_MS);
  }

  protected pickOrganization(id: string | null): void {
    this.organization.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { organizacion: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.restart();
  }

  protected pickStatus(status: string): void {
    this.status.set(status);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async create(body: InvoiceBody): Promise<void> {
    await this.pending.run('create', async () => {
      try {
        const invoice = await firstValueFrom(this.api.createInvoice(body));
        this.formOpen.set(false);
        this.notify.success(
          this.label('billing.form.createDone', { number: invoice.invoiceNumber }),
        );
        void this.router.navigate([this.billingPath, 'facturas', invoice.id]);
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && BILLING_ERRORS.includes(code);
        this.notify.error(this.label(known ? `billing.error.${code}` : 'billing.error.generic'));
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const status = this.status();
      const page = await firstValueFrom(
        this.api.invoices({
          search: this.search || undefined,
          organizationId: this.organization() ?? undefined,
          status: status === ANY ? undefined : (status as InvoiceStatus),
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private restart(): void {
    this.page.set(1);
    void this.reload();
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
