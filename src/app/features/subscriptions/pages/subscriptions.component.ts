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
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { ExportState } from '../../../shared/http/export-state';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgFlagComponent } from '../../../shared/ui/org-flag.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { SubscriptionsApi } from '../data/subscriptions.api';
import {
  SOURCES,
  WINDOWS,
  type Option,
  type SubscriptionListState,
  type SubscriptionRow,
  type SubscriptionRowState,
  type SubscriptionsFilter,
  type SubscriptionsPage,
} from '../data/subscriptions.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'subs.col.org', width: 'minmax(0, 1.6fr)' },
  { key: 'plan', labelKey: 'subs.col.plan', width: '170px' },
  { key: 'source', labelKey: 'subs.col.source', width: '130px' },
  { key: 'end', labelKey: 'subs.col.end', width: '150px' },
  { key: 'documents', labelKey: 'subs.col.documents', width: '170px' },
  { key: 'state', labelKey: 'subs.col.state', width: '140px' },
  { key: 'chevron', width: '40px', align: 'end' },
];

const FAMILY: Record<SubscriptionRowState, string> = {
  expiring: 'warning',
  expired: 'suspended',
  none: 'closed',
  active: 'active',
};

const EMPTY_COUNTS: SubscriptionsPage['counts'] = { expiring: 0, expired: 0, none: 0, active: 0 };

interface RowView extends SubscriptionRow {
  endText: string;
  endMeta: string;
}

@Component({
  selector: 'dba-subscriptions',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    ToggleSwitch,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    FilterPillsComponent,
    OrgFlagComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    UsageMeterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="subs">
      <header class="subs__head">
        <div class="subs__title">
          <h1 class="dba-page">{{ 'nav.subscriptions' | translate }}</h1>
          <span class="dba-meta">{{ 'subs.count' | translate: { total: total() } }}</span>
        </div>
        <button
          dba-button
          variant="secondary"
          [busy]="exporting.busy()"
          [disabled]="loading() || total() === 0"
          (click)="exportCsv()"
        >
          <db-icon name="download" [size]="15" />
          {{ 'subs.csv' | translate }}
        </button>
      </header>

      <div class="subs__tools">
        <label class="subs__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="subs__input"
            autocomplete="off"
            [placeholder]="'subs.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills [pills]="pills()" [active]="state()" (activeChange)="pickState($event)" />
      </div>

      <div class="subs__filters">
        @if (state() === 'expiring') {
          <db-filter-pills
            [pills]="windows"
            [active]="'' + days()"
            (activeChange)="pickDays($event)"
          />
        }
        <p-select
          [options]="planOptions()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [ngModel]="planCode()"
          (ngModelChange)="setFilter(planCode, $event)"
          [ariaLabel]="'subs.f.plan' | translate"
          appendTo="body"
          styleClass="subs__select"
        />
        <p-select
          [options]="sourceOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="source()"
          (ngModelChange)="setFilter(source, $event)"
          [ariaLabel]="'subs.f.source' | translate"
          appendTo="body"
          styleClass="subs__select"
        />
        <p-select
          [options]="countryOptions()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [ngModel]="countryId()"
          (ngModelChange)="setFilter(countryId, $event)"
          [ariaLabel]="'subs.f.country' | translate"
          appendTo="body"
          styleClass="subs__select"
        />
        <span class="subs__toggle">
          <p-toggleswitch
            inputId="subs-include-test"
            [ngModel]="includeTest()"
            (ngModelChange)="setFilter(includeTest, $event)"
          />
          <label for="subs-include-test">{{ 'subs.f.includeTest' | translate }}</label>
        </span>
        <span class="subs__toggle">
          <p-toggleswitch
            inputId="subs-include-auto"
            [ngModel]="includeAutoRenew()"
            (ngModelChange)="setFilter(includeAutoRenew, $event)"
          />
          <label for="subs-include-auto">{{ 'subs.f.includeAutoRenew' | translate }}</label>
        </span>
      </div>

      @if (loading()) {
        <db-section-loader [label]="'subs.loading' | translate" />
      } @else if (error()) {
        <div class="subs__panel">
          <dba-empty-state titleKey="subs.errorTitle" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="subs__panel">
          <dba-empty-state titleKey="subs.emptyTitle" [leadKey]="'subs.emptyLead.' + state()" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.subscriptions' | translate"
          [dense]="density.compact()"
          minWidth="1080px"
          [total]="total()"
          [from]="from()"
          [to]="to()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.organization.id) {
            <button type="button" class="dba-tr" (click)="open(row)">
              <span class="dba-td sub-cell">
                <span class="sub-cell__name">
                  <span class="sub-cell__label">{{ row.organization.businessName }}</span>
                  @if (row.organization.isTest) {
                    <dba-org-flag kind="test" />
                  }
                </span>
                <span class="sub-cell__meta"
                  >{{ row.organization.tributaryNumber }} · {{ row.countryName || '—' }}</span
                >
              </span>
              <span class="dba-td sub-cell">
                @if (row.plan; as plan) {
                  <span class="sub-cell__label">{{ plan.name }}</span>
                  <span class="sub-cell__meta">{{ plan.code }} · v{{ plan.version }}</span>
                } @else {
                  <span class="dba-meta">—</span>
                }
              </span>
              <span class="dba-td sub-cell">
                <span class="sub-cell__label">{{
                  row.subscription ? ('subs.source.' + row.subscription.source | translate) : '—'
                }}</span>
                @if (row.autoRenew) {
                  <span class="sub-cell__meta">{{ 'subs.autoRenew' | translate }}</span>
                }
              </span>
              <span class="dba-td sub-cell">
                <span class="dba-mono">{{ row.endText }}</span>
                @if (row.endMeta) {
                  <span
                    class="sub-cell__meta"
                    [class.sub-cell__meta--warn]="row.state !== 'active'"
                    >{{ row.endMeta }}</span
                  >
                }
              </span>
              @if (row.documents; as docs) {
                <dba-usage-meter class="dba-td" [used]="docs.used" [limit]="docs.limit" />
              } @else {
                <span class="dba-td dba-meta">—</span>
              }
              <span class="dba-td">
                <dba-org-state
                  [state]="family[row.state]"
                  [labelKey]="'subs.rowState.' + row.state"
                  variant="inline"
                />
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .subs {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .subs__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .subs__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .subs__tools,
    .subs__filters {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .subs__tools {
      justify-content: space-between;
    }

    .subs__search {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 320px;
      max-width: 100%;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .subs__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .subs__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .subs__input:focus {
      outline: none;
    }

    :host ::ng-deep .subs__select.p-select {
      width: 190px;
      max-width: 100%;
      height: var(--dba-height-control);
    }

    .subs__toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
      cursor: pointer;
    }

    .subs__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sub-cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .sub-cell__name {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .sub-cell__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .sub-cell__meta {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .sub-cell__meta--warn {
      color: var(--dba-state-suspended-fg);
    }

    @media (max-width: 520px) {
      :host ::ng-deep .subs__select.p-select {
        width: 100%;
      }
    }
  `,
})
export class SubscriptionsComponent {
  private readonly api = inject(SubscriptionsApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly exporting = new ExportState();
  protected readonly columns = COLUMNS;
  protected readonly family = FAMILY;
  protected readonly windows: FilterPill[] = WINDOWS.map((days) => ({
    key: String(days),
    labelKey: `subs.window.${days}`,
  }));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<SubscriptionRow[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal(EMPTY_COUNTS);
  protected readonly page = signal(1);
  protected readonly state = signal<SubscriptionListState>('expiring');
  protected readonly days = signal(30);
  protected readonly searchDraft = signal('');
  protected readonly planCode = signal(ANY);
  protected readonly source = signal(ANY);
  protected readonly countryId = signal(ANY);
  protected readonly includeTest = signal(false);
  protected readonly includeAutoRenew = signal(false);
  private readonly plans = signal<Option[]>([]);
  private readonly countries = signal<Option[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pills = computed<FilterPill[]>(() => {
    const c = this.counts();
    return [
      { key: 'expiring', labelKey: 'subs.state.expiring', count: c.expiring },
      { key: 'expired', labelKey: 'subs.state.expired', count: c.expired, danger: true },
      { key: 'none', labelKey: 'subs.state.none', count: c.none },
      { key: 'active', labelKey: 'subs.state.active', count: c.active },
      { key: 'all', labelKey: 'subs.state.all', count: c.expiring + c.expired + c.none + c.active },
    ];
  });

  protected readonly planOptions = computed(() => [
    { id: ANY, label: this.label('subs.f.anyPlan') },
    ...this.plans(),
  ]);
  protected readonly sourceOptions = computed(() => [
    { id: ANY, label: this.label('subs.f.anySource') },
    ...SOURCES.map((source) => ({ id: source, label: this.label(`subs.source.${source}`) })),
  ]);
  protected readonly countryOptions = computed(() => [
    { id: ANY, label: this.label('subs.f.anyCountry') },
    ...this.countries(),
  ]);

  protected readonly rows = computed<RowView[]>(() => this.items().map((row) => this.toView(row)));
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.loadOptions();
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

  protected pickState(key: string): void {
    this.state.set(key as SubscriptionListState);
    this.restart();
  }

  protected pickDays(key: string): void {
    this.days.set(Number(key));
    this.restart();
  }

  protected setFilter<T>(target: { set: (value: T) => void }, value: T): void {
    target.set(value);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected open(row: SubscriptionRow): void {
    void this.router.navigate([sectionPath('organizations'), row.organization.id], {
      queryParams: { tab: 'subscription' },
    });
  }

  protected exportCsv(): void {
    void this.exporting.run(this.api.exportCsv(this.filter()));
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const result = await firstValueFrom(
        this.api.list({ ...this.filter(), page: this.page(), limit: LIMIT }),
      );
      if (!current()) return;
      this.items.set(result.items);
      this.total.set(result.total);
      this.counts.set(result.counts);
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

  private filter(): SubscriptionsFilter {
    return {
      state: this.state(),
      days: this.days(),
      planCode: this.planCode() || undefined,
      source: this.source() || undefined,
      countryId: this.countryId() || undefined,
      search: this.search || undefined,
      includeTest: this.includeTest(),
      includeAutoRenew: this.includeAutoRenew(),
    };
  }

  private toView(row: SubscriptionRow): RowView {
    const sub = row.subscription;
    if (!sub) {
      return {
        ...row,
        endText: '—',
        endMeta: row.lastEndedAt
          ? this.label('subs.endedOn', { date: this.day(row.lastEndedAt) })
          : '',
      };
    }
    if (!sub.periodEnd || sub.daysLeft === null) {
      return { ...row, endText: this.label('subs.noExpiry'), endMeta: '' };
    }
    const days = sub.daysLeft;
    const endMeta =
      days > 0
        ? this.label('subs.inDays', { days })
        : days === 0
          ? this.label('subs.today')
          : this.label('subs.daysAgo', { days: -days });
    return { ...row, endText: this.day(sub.periodEnd), endMeta };
  }

  private day(value: string): string {
    return formatDate(value, 'd/MM/y', this.locale);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }

  private async loadOptions(): Promise<void> {
    const [plans, countries] = await Promise.allSettled([
      firstValueFrom(this.api.plans()),
      firstValueFrom(this.api.countries()),
    ]);
    if (plans.status === 'fulfilled') this.plans.set(plans.value);
    if (countries.status === 'fulfilled') this.countries.set(countries.value);
  }
}
