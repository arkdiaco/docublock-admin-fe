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
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import {
  TRANSACTION_STATUSES,
  transactionFamilyOf,
  transactionStatusKey,
  type TransactionStatus,
} from '../../../shared/domain/billing-status';
import { moneyExact } from '../../../shared/domain/money';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { BillingNavComponent } from '../components/billing-nav.component';
import { ManualPaymentFormComponent } from '../components/manual-payment-form.component';
import { BillingApi } from '../data/billing.api';
import { BILLING_ERRORS } from '../data/billing-errors';
import type { ManualPaymentBody, TransactionRow, TransactionsQuery } from '../data/billing.models';
import {
  TRANSACTION_VIEWS,
  VIEW_QUERY,
  dayEnd,
  dayStart,
  isManualInterval,
  isTransactionView,
  type TransactionView,
} from '../data/billing-view';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';
const INVOICED_YES = 'yes';
const INVOICED_NO = 'no';

const COLUMNS: readonly DataColumn[] = [
  { key: 'reference', labelKey: 'billing.tx.col.reference', width: 'minmax(0, 1.3fr)' },
  { key: 'org', labelKey: 'billing.tx.col.org', width: 'minmax(0, 1.2fr)' },
  { key: 'plan', labelKey: 'billing.tx.col.plan', width: 'minmax(0, 1fr)' },
  { key: 'amount', labelKey: 'billing.tx.col.amount', width: '130px', align: 'end' },
  { key: 'status', labelKey: 'billing.tx.col.status', width: '120px' },
  { key: 'invoiced', labelKey: 'billing.tx.col.invoiced', width: '70px' },
  { key: 'date', labelKey: 'billing.tx.col.date', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

interface RowView extends TransactionRow {
  amountText: string;
  dateText: string;
  intervalText: string;
}

@Component({
  selector: 'dba-transactions',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    OrgPickerComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
    BillingNavComponent,
    ManualPaymentFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <dba-billing-nav
        active="transactions"
        [meta]="'billing.tx.count' | translate: { total: total() }"
      >
        @if (canManage()) {
          <button
            dba-button
            variant="secondary"
            [busy]="pending.key() === 'reconcile'"
            (click)="reconcile()"
          >
            <db-icon name="rotate" [size]="15" />
            {{ 'billing.tx.reconcile.action' | translate }}
          </button>
          @if (canPickOrg()) {
            <button dba-button (click)="openManual()">
              <db-icon name="plus" [size]="15" />
              {{ 'billing.manual.action' | translate }}
            </button>
          }
        }
      </dba-billing-nav>

      <db-stat-band
        [cells]="cells()"
        [interactive]="true"
        [active]="view()"
        [busy]="countsLoading()"
        [label]="'billing.tx.viewsLabel' | translate"
        (picked)="pickView($event)"
      />

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'billing.tx.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        @if (canPickOrg()) {
          <dba-org-picker [value]="organization()" (picked)="pickOrganization($event)" />
        }
        @if (view() === 'todas') {
          <p-select
            [options]="statusOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="status()"
            (ngModelChange)="setFilter(status, $event)"
            [ariaLabel]="'billing.tx.f.status' | translate"
            appendTo="body"
            styleClass="bl__select"
          />
          <p-select
            [options]="invoicedOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="invoiced()"
            (ngModelChange)="setFilter(invoiced, $event)"
            [ariaLabel]="'billing.tx.f.invoiced' | translate"
            appendTo="body"
            styleClass="bl__select"
          />
        }
        <dba-field
          class="bl__date"
          label="billing.tx.f.from"
          type="date"
          [value]="from()"
          (valueChange)="setDate(from, $event)"
        />
        <dba-field
          class="bl__date"
          label="billing.tx.f.to"
          type="date"
          [error]="rangeInvalid() ? 'billing.tx.rangeInvalid' : ''"
          [value]="to()"
          (valueChange)="setDate(to, $event)"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'billing.tx.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="billing.tx.errorTitle" leadKey="billing.tx.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="billing.tx.emptyTitle" leadKey="billing.tx.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'billing.section.transactions' | translate"
          [dense]="density.compact()"
          minWidth="980px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[billingPath, row.id]">
              <span class="dba-td cell">
                <span class="cell__label dba-mono">{{ row.reference || row.idTransaction }}</span>
                <span class="cell__meta">{{ 'billing.source.' + row.source | translate }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.organization.name }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.planName }}</span>
                <span class="cell__meta">{{ row.intervalText }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.amountText }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="familyOf(row.status)"
                  [labelKey]="statusKey(row.status)"
                  variant="inline"
                />
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{
                  (row.invoiced ? 'billing.tx.invoicedYes' : 'billing.tx.invoicedNo') | translate
                }}</span>
              </span>
              <span class="dba-td dba-td--mono">{{ row.dateText }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (manualOpen()) {
      <dba-manual-payment-form
        [organizationId]="presetOrganization()"
        [busy]="pending.key() === 'manual'"
        (submitted)="registerManual($event)"
        (dismissed)="manualOpen.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class TransactionsComponent {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly countsRequest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly familyOf = transactionFamilyOf;
  protected readonly statusKey = transactionStatusKey;
  protected readonly billingPath = sectionPath('billing');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canPickOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly countsLoading = signal(true);
  protected readonly manualOpen = signal(false);
  protected readonly presetOrganization = signal<string | null>(null);
  protected readonly view = signal<TransactionView>('todas');
  protected readonly page = signal(1);
  protected readonly searchDraft = signal('');
  protected readonly organization = signal<string | null>(null);
  protected readonly status = signal<string>(ANY);
  protected readonly invoiced = signal<string>(ANY);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly total = signal(0);
  private readonly items = signal<TransactionRow[]>([]);
  private readonly counts = signal<Record<TransactionView, number> | null>(null);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rangeInvalid = computed(
    () => !!this.from() && !!this.to() && this.from() > this.to(),
  );

  protected readonly cells = computed<StatCell[]>(() => {
    const counts = this.counts();
    return TRANSACTION_VIEWS.map((key) => {
      const value = counts?.[key];
      const attention = (key === 'pendientes' || key === 'sin-facturar') && (value ?? 0) > 0;
      return {
        key,
        label: this.label(`billing.tx.view.${key}`),
        value: value === undefined ? '—' : String(value),
        tone: attention ? 'warn' : 'plain',
      };
    });
  });

  protected readonly statusOptions = computed(() => [
    { id: ANY, label: this.label('billing.tx.f.anyStatus') },
    ...TRANSACTION_STATUSES.map((id) => ({ id, label: this.label(`billing.txStatus.${id}`) })),
  ]);
  protected readonly invoicedOptions = computed(() => [
    { id: ANY, label: this.label('billing.tx.f.anyInvoiced') },
    { id: INVOICED_YES, label: this.label('billing.tx.f.yes') },
    { id: INVOICED_NO, label: this.label('billing.tx.f.no') },
  ]);

  protected readonly rows = computed<RowView[]>(() =>
    this.items().map((row) => ({
      ...row,
      amountText: moneyExact(row.amountMajor, row.currency, this.locale),
      dateText: formatDate(row.requestDate ?? row.createdAt ?? '', 'd/MM/y', this.locale),
      intervalText: isManualInterval(row.planDuration)
        ? this.label(`billing.interval.${row.planDuration}`)
        : row.planDuration,
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
    const params = this.route.snapshot.queryParamMap;
    const wanted = params.get('vista');
    if (isTransactionView(wanted)) this.view.set(wanted);
    const org = params.get('organizacion');
    if (org && this.canPickOrg()) this.organization.set(org);
    if (params.get('pago') === '1' && this.canManage() && this.canPickOrg()) {
      this.presetOrganization.set(org);
      this.manualOpen.set(true);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { pago: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    void this.loadCounts();
    void this.reload();
  }

  protected openManual(): void {
    this.presetOrganization.set(this.organization());
    this.manualOpen.set(true);
  }

  protected async registerManual(body: ManualPaymentBody): Promise<void> {
    await this.pending.run('manual', async () => {
      try {
        await firstValueFrom(this.api.registerManual(body));
        this.manualOpen.set(false);
        this.notify.success(this.label('billing.manual.done'));
        void this.loadCounts();
        await this.reload();
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async reconcile(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'rotate',
      title: 'billing.tx.reconcile.title',
      message: 'billing.tx.reconcile.message',
      confirmLabel: 'billing.tx.reconcile.confirm',
    });
    if (!confirmed) return;
    await this.pending.run('reconcile', async () => {
      try {
        const result = await firstValueFrom(this.api.reconcile());
        this.notify.success(
          result.checked === 0
            ? this.label('billing.tx.reconcile.none')
            : this.label('billing.tx.reconcile.done', {
                checked: result.checked,
                repaired: result.repaired.length,
                failed: result.failed.length,
              }),
        );
        void this.loadCounts();
        await this.reload();
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected pickView(key: string): void {
    const view: TransactionView = isTransactionView(key) ? key : 'todas';
    if (view === this.view()) return;
    this.view.set(view);
    this.syncUrl();
    this.restart();
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
    this.syncUrl();
    void this.loadCounts();
    this.restart();
  }

  protected setFilter(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    this.restart();
  }

  protected setDate(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    if (this.rangeInvalid()) return;
    void this.loadCounts();
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    if (this.rangeInvalid()) return;
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.transactions(this.query()));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async loadCounts(): Promise<void> {
    const current = this.countsRequest.start();
    this.countsLoading.set(true);
    const base = this.scope();
    const results = await Promise.allSettled(
      TRANSACTION_VIEWS.map((view) =>
        firstValueFrom(this.api.transactions({ ...base, ...VIEW_QUERY[view], page: 1, limit: 1 })),
      ),
    );
    if (!current()) return;
    const counts = {} as Record<TransactionView, number>;
    TRANSACTION_VIEWS.forEach((view, index) => {
      const result = results[index];
      counts[view] = result.status === 'fulfilled' ? result.value.total : 0;
    });
    this.counts.set(counts);
    this.countsLoading.set(false);
  }

  private restart(): void {
    this.page.set(1);
    void this.reload();
  }

  private scope(): TransactionsQuery {
    return {
      organizationId: this.organization() ?? undefined,
      from: this.from() ? dayStart(this.from()) : undefined,
      to: this.to() ? dayEnd(this.to()) : undefined,
    };
  }

  private query(): TransactionsQuery {
    const all = this.view() === 'todas';
    const invoiced = this.invoiced();
    return {
      ...this.scope(),
      ...VIEW_QUERY[this.view()],
      ...(all && this.status() !== ANY ? { status: this.status() as TransactionStatus } : {}),
      ...(all && invoiced !== ANY ? { invoiced: invoiced === INVOICED_YES } : {}),
      search: this.search || undefined,
      page: this.page(),
      limit: LIMIT,
    };
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        vista: this.view() === 'todas' ? null : this.view(),
        organizacion: this.organization(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && BILLING_ERRORS.includes(code);
    this.notify.error(this.label(known ? `billing.error.${code}` : 'billing.error.generic'));
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
