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
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorMessageOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { ErrorLogDetailComponent } from '../components/error-log-detail.component';
import {
  ALL,
  PERIODS,
  STATE_ERRORS,
  filtersOf,
  fromOf,
  groupLabelKeyOf,
  groupStateOf,
  queryParamsOf,
  statePills,
  type StateAction,
} from '../data/error-log-view';
import { ErrorLogsApi } from '../data/error-logs.api';
import {
  ERROR_SERVICES,
  type ErrorGroupDetail,
  type ErrorGroupRow,
  type ErrorGroupTotals,
  type ErrorLogFilters,
} from '../data/error-logs.models';

export const ERROR_LOGS_LIMIT = 25;
export const ERROR_LOGS_DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'lastSeen', labelKey: 'errl.col.lastSeen', width: '150px' },
  { key: 'service', labelKey: 'errl.col.service', width: '110px' },
  { key: 'route', labelKey: 'errl.col.route', width: 'minmax(0, 1.3fr)' },
  { key: 'message', labelKey: 'errl.col.message', width: 'minmax(0, 2fr)' },
  { key: 'count', labelKey: 'errl.col.count', width: '88px', align: 'end' },
  { key: 'state', labelKey: 'errl.col.state', width: '130px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

type FilterChange = Partial<Omit<ErrorLogFilters, 'page'>> & { page?: number };

@Component({
  selector: 'dba-error-logs',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    ErrorLogDetailComponent,
    FilterPillsComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.errors' | translate }}</h1>
          <span class="dba-meta">{{ 'errl.lead' | translate }}</span>
        </div>
      </header>

      <db-filter-pills
        [pills]="pills()"
        [active]="filters().state ?? all"
        [label]="'errl.col.state' | translate"
        (activeChange)="apply({ state: $any($event) || null })"
      />

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [attr.aria-label]="'errl.filter.search' | translate"
            [placeholder]="'errl.filter.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <p-select
          [options]="serviceOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().service ?? all"
          (ngModelChange)="apply({ service: $event || null })"
          [ariaLabel]="'errl.filter.service' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="periodOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().period ?? all"
          (ngModelChange)="apply({ period: $event || null })"
          [ariaLabel]="'errl.filter.period' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'errl.loading' | translate" />
      } @else if (failed()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="errl.errorTitle" leadKey="errl.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="filtered() ? 'errl.emptyFiltered' : 'errl.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'errl.tableLabel' | translate"
          [dense]="density.compact()"
          minWidth="1040px"
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
                ><span class="cell__muted dba-mono">{{ when(row.lastSeen) }}</span></span
              >
              <span class="dba-td cell"
                ><span class="cell__label">{{
                  'errl.service.' + row.service | translate
                }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__text dba-mono">{{ row.route }}</span>
                <span class="cell__muted">{{ row.kind }}</span>
              </span>
              <span class="dba-td cell"
                ><span class="cell__text">{{ row.message }}</span></span
              >
              <span class="dba-td cell cell--end dba-mono">{{ row.count }}</span>
              <span class="dba-td cell">
                <dba-org-state
                  [state]="stateOf(row.state)"
                  [labelKey]="labelOf(row.state)"
                  variant="inline"
                />
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>

    @if (selected(); as row) {
      <dba-error-log-detail
        [row]="row"
        [detail]="detail()"
        [failed]="detailFailed()"
        [busy]="!!pending.key()"
        (dismissed)="close()"
        (changeState)="changeState(row, $event)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class ErrorLogsComponent {
  private readonly api = inject(ErrorLogsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly latest = new LatestRequest();
  private readonly latestDetail = new LatestRequest();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly limit = ERROR_LOGS_LIMIT;
  protected readonly all = ALL;
  protected readonly stateOf = groupStateOf;
  protected readonly labelOf = groupLabelKeyOf;
  protected readonly filters = signal<ErrorLogFilters>(filtersOf(this.route.snapshot.queryParams));
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly rows = signal<ErrorGroupRow[]>([]);
  protected readonly total = signal(0);
  protected readonly totals = signal<ErrorGroupTotals | null>(null);
  protected readonly searchDraft = signal(this.filters().search ?? '');
  protected readonly selected = signal<ErrorGroupRow | null>(null);
  protected readonly detail = signal<ErrorGroupDetail | null>(null);
  protected readonly detailFailed = signal(false);

  protected readonly pills = computed(() => statePills(this.totals()));
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / ERROR_LOGS_LIMIT)),
  );
  protected readonly rangeTo = computed(() =>
    Math.min(this.total(), this.filters().page * ERROR_LOGS_LIMIT),
  );
  protected readonly filtered = computed(() => {
    const { state, service, search, period } = this.filters();
    return !!(state || service || search || period);
  });
  protected readonly serviceOptions = computed(() =>
    this.options('errl.filter.anyService', ERROR_SERVICES, 'errl.service'),
  );
  protected readonly periodOptions = computed(() =>
    this.options('errl.filter.anyPeriod', Object.keys(PERIODS), 'errl.periods'),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    void this.load();
    const group = this.filters().group;
    if (group) void this.openById(group);
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchDraft.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.apply({ search: value.trim() || null });
    }, ERROR_LOGS_DEBOUNCE_MS);
  }

  protected apply(change: FilterChange, keepPage = false): void {
    const next = { ...this.filters(), ...change, ...(keepPage ? {} : { page: 1 }) };
    this.filters.set(next);
    this.syncUrl();
    void this.load();
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected open(row: ErrorGroupRow): void {
    this.selected.set(row);
    this.setGroup(row.id);
    void this.loadDetail(row.id);
  }

  protected close(): void {
    this.latestDetail.start();
    this.selected.set(null);
    this.detail.set(null);
    this.setGroup(null);
  }

  protected async changeState(row: ErrorGroupRow, action: StateAction): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: action.to === 'open' ? 'rotate' : 'alert',
      title: `errl.confirm.${action.to}.title`,
      message: `errl.confirm.${action.to}.message`,
      params: { route: row.route },
      confirmLabel: action.labelKey,
      reason: {
        labelKey: 'errl.reason',
        placeholder: 'errl.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const reason = answer.reason;
    await this.pending.run('state', async () => {
      try {
        const updated = await firstValueFrom(this.api.changeState(row.id, action.to, reason));
        this.notify.success(this.text(`errl.done.${action.to}`));
        this.selected.set(updated);
        await this.loadDetail(updated.id);
      } catch (error) {
        this.notify.error(this.stateFailure(error));
      }
      await this.load();
    });
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    const filters = this.filters();
    this.loading.set(true);
    this.failed.set(false);
    try {
      const report = await firstValueFrom(
        this.api.list({
          state: filters.state,
          service: filters.service,
          search: filters.search,
          from: fromOf(filters.period, Date.now()),
          page: filters.page,
          limit: ERROR_LOGS_LIMIT,
        }),
      );
      if (!current()) return;
      const lastPage = Math.max(1, Math.ceil(report.total / ERROR_LOGS_LIMIT));
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

  private async openById(id: string): Promise<void> {
    const current = this.latestDetail.start();
    this.detailFailed.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(id));
      if (!current()) return;
      this.selected.set(detail);
      this.detail.set(detail);
    } catch {
      if (!current()) return;
      this.setGroup(null);
      this.notify.error(this.text('errl.detailFailed'));
    }
  }

  private async loadDetail(id: string): Promise<void> {
    const current = this.latestDetail.start();
    this.detail.set(null);
    this.detailFailed.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(id));
      if (current()) this.detail.set(detail);
    } catch {
      if (current()) this.detailFailed.set(true);
    }
  }

  private setGroup(group: string | null): void {
    if (this.filters().group === group) return;
    this.filters.set({ ...this.filters(), group });
    this.syncUrl();
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParamsOf(this.filters()),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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

  private stateFailure(error: unknown): string {
    const code = errorCodeOf(error);
    if (code !== null && STATE_ERRORS.includes(code)) {
      return this.text(`errl.error.${code}`);
    }
    const message = errorMessageOf(error);
    return message
      ? (this.translate.instant('errl.failed', { message }) as string)
      : this.text('errl.failedGeneric');
  }

  private text(key: string): string {
    return this.translate.instant(key) as string;
  }
}
