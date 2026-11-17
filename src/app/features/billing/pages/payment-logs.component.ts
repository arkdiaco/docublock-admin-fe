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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { BillingNavComponent } from '../components/billing-nav.component';
import { PaymentLogDetailComponent } from '../components/payment-log-detail.component';
import {
  ALL,
  PERIODS,
  durationText,
  failureText,
  filtersOf,
  fromOf,
  logLabelKeyOf,
  logStateOf,
  okOf,
  queryParamsOf,
  resultPills,
} from '../data/payment-log-view';
import { PaymentLogsApi } from '../data/payment-logs.api';
import {
  PAYMENT_LOG_PROVIDERS,
  PAYMENT_LOG_STAGES,
  type PaymentLogDetail,
  type PaymentLogFilters,
  type PaymentLogRow,
  type PaymentLogTotals,
} from '../data/payment-logs.models';

export const PAYMENT_LOGS_LIMIT = 25;
export const PAYMENT_LOGS_DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'at', labelKey: 'plog.col.at', width: '150px' },
  { key: 'source', labelKey: 'plog.col.source', width: 'minmax(0, 1fr)' },
  { key: 'operation', labelKey: 'plog.col.operation', width: 'minmax(0, 1.4fr)' },
  { key: 'organization', labelKey: 'plog.col.organization', width: 'minmax(0, 1.2fr)' },
  { key: 'reference', labelKey: 'plog.col.reference', width: 'minmax(0, 1.2fr)' },
  { key: 'result', labelKey: 'plog.col.result', width: 'minmax(0, 1.4fr)' },
  { key: 'duration', labelKey: 'plog.col.duration', width: '88px', align: 'end' },
  { key: 'chevron', width: '24px', align: 'end' },
];

type FilterChange = Partial<Omit<PaymentLogFilters, 'page'>> & { page?: number };

@Component({
  selector: 'dba-payment-logs',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    BillingNavComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    OrgPickerComponent,
    OrgStateComponent,
    PaymentLogDetailComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <dba-billing-nav active="log" [meta]="'plog.lead' | translate" />

      <db-filter-pills
        [pills]="pills()"
        [active]="filters().result ?? all"
        [label]="'plog.col.result' | translate"
        (activeChange)="apply({ result: $any($event) || null })"
      />

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [attr.aria-label]="'plog.filter.search' | translate"
            [placeholder]="'plog.filter.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <dba-org-picker
          [value]="filters().organizationId"
          (picked)="apply({ organizationId: $event })"
        />
        <p-select
          [options]="providerOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().provider ?? all"
          (ngModelChange)="apply({ provider: $event || null })"
          [ariaLabel]="'plog.filter.provider' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="stageOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().stage ?? all"
          (ngModelChange)="apply({ stage: $event || null })"
          [ariaLabel]="'plog.filter.stage' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="periodOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().period ?? all"
          (ngModelChange)="apply({ period: $event || null })"
          [ariaLabel]="'plog.filter.period' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (filters().organizationId) {
        <p class="dba-meta notice">{{ 'plog.orgNotice' | translate }}</p>
      }

      @if (loading()) {
        <db-section-loader [label]="'plog.loading' | translate" />
      } @else if (failed()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="plog.errorTitle" leadKey="plog.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="filtered() ? 'plog.emptyFiltered' : 'plog.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'plog.tableLabel' | translate"
          [dense]="density.compact()"
          minWidth="1120px"
          [total]="total()"
          [from]="(filters().page - 1) * limit + 1"
          [to]="rangeTo()"
          [page]="filters().page"
          [pageCount]="pageCount()"
          (pageChange)="apply({ page: $event }, true)"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr bl-row" (click)="open(row)">
              <span class="dba-td cell"
                ><span class="cell__muted dba-mono">{{ when(row.at) }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__label">{{ 'plog.provider.' + row.provider | translate }}</span>
                <span class="cell__muted">{{ 'plog.stage.' + row.stage | translate }}</span>
              </span>
              <span class="dba-td cell"
                ><span class="cell__text dba-mono">{{ row.operation }}</span></span
              >
              <span class="dba-td cell"
                ><span class="cell__text">{{ organizationOf(row) }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__text dba-mono">{{ row.reference || '—' }}</span>
                @if (row.eventId && row.eventId !== row.reference) {
                  <span class="cell__muted dba-mono">{{ row.eventId }}</span>
                }
              </span>
              <span class="dba-td cell">
                <dba-org-state [state]="stateOf(row)" [labelKey]="labelOf(row)" variant="inline" />
                @if (row.error) {
                  <span class="cell__muted">{{ failure(row) }}</span>
                }
              </span>
              <span class="dba-td cell cell--end dba-mono">{{ duration(row.durationMs) }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>

    @if (selected(); as row) {
      <dba-payment-log-detail
        [row]="row"
        [detail]="detail()"
        [failed]="detailFailed()"
        (dismissed)="close()"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .notice {
      margin: 0;
    }
  `,
})
export class PaymentLogsComponent {
  private readonly api = inject(PaymentLogsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly latestDetail = new LatestRequest();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly limit = PAYMENT_LOGS_LIMIT;
  protected readonly all = ALL;
  protected readonly stateOf = logStateOf;
  protected readonly labelOf = logLabelKeyOf;
  protected readonly failure = failureText;
  protected readonly duration = durationText;
  protected readonly filters = signal<PaymentLogFilters>(
    filtersOf(this.route.snapshot.queryParams),
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly rows = signal<PaymentLogRow[]>([]);
  protected readonly total = signal(0);
  protected readonly totals = signal<PaymentLogTotals | null>(null);
  protected readonly searchDraft = signal(this.filters().search ?? '');
  protected readonly selected = signal<PaymentLogRow | null>(null);
  protected readonly detail = signal<PaymentLogDetail | null>(null);
  protected readonly detailFailed = signal(false);

  protected readonly pills = computed(() => resultPills(this.totals()));
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / PAYMENT_LOGS_LIMIT)),
  );
  protected readonly rangeTo = computed(() =>
    Math.min(this.total(), this.filters().page * PAYMENT_LOGS_LIMIT),
  );
  protected readonly filtered = computed(() => {
    const { result, provider, stage, organizationId, search, period } = this.filters();
    return !!(result || provider || stage || organizationId || search || period);
  });
  protected readonly providerOptions = computed(() =>
    this.options('plog.filter.anyProvider', PAYMENT_LOG_PROVIDERS, 'plog.provider'),
  );
  protected readonly stageOptions = computed(() =>
    this.options('plog.filter.anyStage', PAYMENT_LOG_STAGES, 'plog.stage'),
  );
  protected readonly periodOptions = computed(() =>
    this.options('plog.filter.anyPeriod', Object.keys(PERIODS), 'plog.periods'),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    void this.load();
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchDraft.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.apply({ search: value.trim() || null });
    }, PAYMENT_LOGS_DEBOUNCE_MS);
  }

  protected apply(change: FilterChange, keepPage = false): void {
    const next = { ...this.filters(), ...change, ...(keepPage ? {} : { page: 1 }) };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParamsOf(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.load();
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }

  protected organizationOf(row: PaymentLogRow): string {
    if (!row.organizationId) return this.text('plog.noOrganization');
    return row.organizationName || row.organizationId;
  }

  protected async open(row: PaymentLogRow): Promise<void> {
    const current = this.latestDetail.start();
    this.selected.set(row);
    this.detail.set(null);
    this.detailFailed.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(row.id));
      if (current()) this.detail.set(detail);
    } catch {
      if (current()) this.detailFailed.set(true);
    }
  }

  protected close(): void {
    this.latestDetail.start();
    this.selected.set(null);
    this.detail.set(null);
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    const filters = this.filters();
    this.loading.set(true);
    this.failed.set(false);
    try {
      const report = await firstValueFrom(
        this.api.list({
          ok: okOf(filters.result),
          provider: filters.provider,
          stage: filters.stage,
          organizationId: filters.organizationId,
          search: filters.search,
          from: fromOf(filters.period, Date.now()),
          page: filters.page,
          limit: PAYMENT_LOGS_LIMIT,
        }),
      );
      if (!current()) return;
      const lastPage = Math.max(1, Math.ceil(report.total / PAYMENT_LOGS_LIMIT));
      if (report.items.length === 0 && filters.page > lastPage) {
        this.apply({ page: lastPage }, true);
        return;
      }
      this.rows.set(report.items);
      this.total.set(report.total);
      this.totals.set(report.totals);
    } catch {
      if (!current()) return;
      this.failed.set(true);
      this.totals.set(null);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private options(
    anyKey: string,
    ids: readonly string[],
    prefix: string,
  ): { id: string; label: string }[] {
    return [
      { id: ALL, label: this.text(anyKey) },
      ...ids.map((id) => ({ id, label: this.text(`${prefix}.${id}`) })),
    ];
  }

  private text(key: string): string {
    return this.translate.instant(key) as string;
  }
}
