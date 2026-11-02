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
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import {
  TRANSACTION_STATUSES,
  transactionFamilyOf,
  transactionStatusKey,
} from '../../../shared/domain/billing-status';
import { moneyExact } from '../../../shared/domain/money';
import { ExportState } from '../../../shared/http/export-state';
import { LatestRequest } from '../../../shared/http/latest-request';
import { BarListComponent, type BarListItem } from '../../../shared/ui/bar-list.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { BillingNavComponent } from '../components/billing-nav.component';
import { PaymentConfigPanelComponent } from '../components/payment-config-panel.component';
import { BillingApi } from '../data/billing.api';
import {
  REVENUE_SOURCES,
  type RevenueFilter,
  type RevenueRow,
  type RevenueSource,
  type RevenueSummary,
} from '../data/billing.models';
import {
  RANGE_PRESETS,
  REJECTED_STATUSES,
  REVENUE_ROW_CAP,
  countOf,
  dayEnd,
  dayStart,
  presetRange,
  type RangePreset,
} from '../data/billing-view';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';
const TOP_PLANS = 8;
const TOP_ORGANIZATIONS = 10;

const COLUMNS: readonly DataColumn[] = [
  { key: 'id', labelKey: 'billing.rev.col.id', width: 'minmax(0, 1.2fr)' },
  { key: 'source', labelKey: 'billing.rev.col.source', width: '110px' },
  { key: 'org', labelKey: 'billing.rev.col.org', width: 'minmax(0, 1.2fr)' },
  { key: 'plan', labelKey: 'billing.rev.col.plan', width: 'minmax(0, 1fr)' },
  { key: 'amount', labelKey: 'billing.rev.col.amount', width: '130px', align: 'end' },
  { key: 'status', labelKey: 'billing.rev.col.status', width: '120px' },
  { key: 'date', labelKey: 'billing.rev.col.date', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

interface RowView extends RevenueRow {
  amountText: string;
  dateText: string;
}

@Component({
  selector: 'dba-revenue',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    BarListComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
    BillingNavComponent,
    PaymentConfigPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <dba-billing-nav active="revenue" />

      <div class="bl__tools">
        <div class="rv__control">
          <label class="rv__label" for="rev-preset">{{ 'billing.rev.range' | translate }}</label>
          <p-select
            inputId="rev-preset"
            [options]="presetOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="preset()"
            (ngModelChange)="pickPreset($event)"
            appendTo="body"
            styleClass="bl__select"
          />
        </div>
        @if (preset() === 'personalizado') {
          <dba-field
            class="bl__date"
            label="billing.rev.from"
            type="date"
            [value]="from()"
            (valueChange)="setDate(from, $event)"
          />
          <dba-field
            class="bl__date"
            label="billing.rev.to"
            type="date"
            [error]="rangeInvalid() ? 'billing.rev.rangeInvalid' : ''"
            [value]="to()"
            (valueChange)="setDate(to, $event)"
          />
        }
        @if (currencies().length > 1) {
          <div class="rv__control">
            <label class="rv__label" for="rev-currency">{{
              'billing.rev.currency' | translate
            }}</label>
            <p-select
              inputId="rev-currency"
              [options]="currencyOptions()"
              optionLabel="label"
              optionValue="id"
              [ngModel]="currency()"
              (ngModelChange)="currencyChoice.set($event)"
              appendTo="body"
              styleClass="bl__select"
            />
          </div>
        }
      </div>

      @if (summaryLoading()) {
        <db-section-loader [label]="'billing.rev.loading' | translate" />
      } @else if (summaryError()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="billing.rev.errorTitle" leadKey="billing.rev.errorLead" />
          <button dba-button variant="secondary" (click)="reloadSummary()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <db-stat-band [cells]="cells()" [label]="'billing.rev.statsLabel' | translate" />
        @if (summary()?.capped) {
          <div class="rv__notice" role="note">{{ 'billing.rev.capped' | translate }}</div>
        }
        @if (currency()) {
          <div class="rv__grid">
            @for (block of blocks(); track block.titleKey) {
              <section class="rv__card">
                <h2 class="dba-panel">{{ block.titleKey | translate }}</h2>
                <dba-bar-list [items]="block.items" [label]="block.titleKey | translate" />
                @if (block.more > 0) {
                  <span class="dba-meta">{{
                    'billing.rev.more' | translate: { n: block.more }
                  }}</span>
                }
              </section>
            }
          </div>
        }
      }

      <div class="rv__listHead">
        <h2 class="dba-panel">{{ 'billing.rev.list' | translate }}</h2>
        <button dba-button variant="secondary" [busy]="exporting.busy()" (click)="downloadCsv()">
          <db-icon name="download" [size]="15" />
          {{ 'billing.rev.csv' | translate }}
        </button>
      </div>
      @if (csvCapped()) {
        <span class="dba-meta">{{ 'billing.rev.csvCapped' | translate }}</span>
      }

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'billing.rev.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <p-select
          [options]="sourceOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="source()"
          (ngModelChange)="setFilter(source, $event)"
          [ariaLabel]="'billing.rev.f.source' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="statusOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="status()"
          (ngModelChange)="setFilter(status, $event)"
          [ariaLabel]="'billing.rev.f.status' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (listLoading()) {
        <db-section-loader [label]="'billing.rev.listLoading' | translate" />
      } @else if (listError()) {
        <div class="bl__panel">
          <p class="dba-body rv__message">{{ 'billing.rev.listError' | translate }}</p>
          <button dba-button variant="secondary" (click)="reloadList()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <p class="dba-body rv__message">{{ 'billing.rev.listEmpty' | translate }}</p>
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'billing.rev.list' | translate"
          [dense]="density.compact()"
          minWidth="960px"
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
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ 'billing.source.' + row.source | translate }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.organization.name }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.plan.name }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.amountText }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="familyOf(row.status)"
                  [labelKey]="statusKey(row.status)"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-td--mono">{{ row.dateText }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }

      <dba-payment-config-panel />
    </section>
  `,
  styleUrl: './revenue.component.scss',
})
export class RevenueComponent {
  private readonly api = inject(BillingApi);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly summaryRequest = new LatestRequest();
  private readonly listRequest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly familyOf = transactionFamilyOf;
  protected readonly statusKey = transactionStatusKey;
  protected readonly billingPath = sectionPath('billing');
  protected readonly exporting = new ExportState();

  protected readonly preset = signal<RangePreset>('ultimos-12');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal(false);
  protected readonly summary = signal<RevenueSummary | null>(null);
  protected readonly currencyChoice = signal<string | null>(null);
  protected readonly listLoading = signal(true);
  protected readonly listError = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly source = signal<string>(ANY);
  protected readonly status = signal<string>(ANY);
  private readonly items = signal<RevenueRow[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rangeInvalid = computed(
    () =>
      this.preset() === 'personalizado' && !!this.from() && !!this.to() && this.from() > this.to(),
  );
  protected readonly currencies = computed(() =>
    (this.summary()?.totals ?? []).map((total) => total.currency),
  );
  protected readonly currency = computed(() => {
    const choice = this.currencyChoice();
    const all = this.currencies();
    return choice && all.includes(choice) ? choice : (all[0] ?? null);
  });
  protected readonly presetOptions = computed(() =>
    RANGE_PRESETS.map((id) => ({ id, label: this.label(`billing.rev.preset.${id}`) })),
  );
  protected readonly currencyOptions = computed(() =>
    this.currencies().map((id) => ({ id, label: id })),
  );
  protected readonly sourceOptions = computed(() => [
    { id: ANY, label: this.label('billing.rev.f.anySource') },
    ...REVENUE_SOURCES.map((id) => ({ id, label: this.label(`billing.source.${id}`) })),
  ]);
  protected readonly statusOptions = computed(() => [
    { id: ANY, label: this.label('billing.rev.f.anyStatus') },
    ...TRANSACTION_STATUSES.map((id) => ({ id, label: this.label(`billing.txStatus.${id}`) })),
  ]);

  protected readonly cells = computed<StatCell[]>(() => {
    const summary = this.summary();
    if (!summary) return [];
    const totals: StatCell[] = summary.totals.map((total) => ({
      key: `gross-${total.currency}`,
      label: this.label('billing.rev.gross', { currency: total.currency }),
      value: moneyExact(total.gross, total.currency, this.locale),
      note: this.label('billing.rev.grossNote', { count: total.count }),
    }));
    if (totals.length === 0)
      totals.push({
        key: 'gross',
        label: this.label('billing.rev.noRevenue'),
        value: '—',
        note: this.label('billing.rev.noApproved'),
      });
    const pending = countOf(summary.byStatus, ['PENDING']);
    return [
      ...totals,
      {
        key: 'pending',
        label: this.label('billing.rev.pending'),
        value: String(pending),
        tone: pending > 0 ? 'warn' : 'plain',
      },
      {
        key: 'rejected',
        label: this.label('billing.rev.rejected'),
        value: String(countOf(summary.byStatus, REJECTED_STATUSES)),
        note: this.label('billing.rev.rejectedNote'),
      },
    ];
  });

  protected readonly blocks = computed(() => {
    const summary = this.summary();
    const currency = this.currency();
    if (!summary || !currency) return [];
    const bar = (key: string, label: string, gross: number, count?: number): BarListItem => ({
      key,
      label,
      value: gross,
      valueText: moneyExact(gross, currency, this.locale),
      note: count === undefined ? undefined : this.label('billing.rev.barCount', { count }),
    });
    const mine = <T extends { currency: string; gross: number }>(rows: readonly T[]): T[] =>
      rows.filter((row) => row.currency === currency);
    const ranked = <T extends { gross: number }>(rows: readonly T[]): T[] =>
      [...rows].sort((a, b) => b.gross - a.gross);
    const plans = ranked(mine(summary.byPlan));
    const organizations = ranked(mine(summary.byOrganization));
    return [
      {
        titleKey: 'billing.rev.byMonth',
        more: 0,
        items: mine(summary.byMonth).map((row) =>
          bar(
            `${row.year}-${row.month}`,
            formatDate(Date.UTC(row.year, row.month - 1, 1), 'MMM y', this.locale, 'UTC'),
            row.gross,
          ),
        ),
      },
      {
        titleKey: 'billing.rev.byProvider',
        more: 0,
        items: ranked(mine(summary.byProvider)).map((row) =>
          bar(row.source, this.label(`billing.source.${row.source}`), row.gross, row.count),
        ),
      },
      {
        titleKey: 'billing.rev.byPlan',
        more: Math.max(0, plans.length - TOP_PLANS),
        items: plans
          .slice(0, TOP_PLANS)
          .map((row) => bar(row.plan, row.name || row.plan, row.gross, row.count)),
      },
      {
        titleKey: 'billing.rev.byOrganization',
        more: Math.max(0, organizations.length - TOP_ORGANIZATIONS),
        items: organizations
          .slice(0, TOP_ORGANIZATIONS)
          .map((row) => bar(row.organizationId, row.name, row.gross, row.count)),
      },
    ];
  });

  protected readonly rows = computed<RowView[]>(() =>
    this.items().map((row) => {
      const date = row.requestDate ?? row.createdAt;
      return {
        ...row,
        amountText: moneyExact(row.amountMajor, row.currency, this.locale),
        dateText: date ? formatDate(date, 'd/MM/y', this.locale) : '—',
      };
    }),
  );
  protected readonly csvCapped = computed(() => this.total() >= REVENUE_ROW_CAP);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.reloadSummary();
    void this.reloadList();
  }

  protected pickPreset(preset: RangePreset): void {
    this.preset.set(preset);
    if (this.rangeInvalid()) return;
    this.reloadAll();
  }

  protected setDate(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    if (this.rangeInvalid()) return;
    this.reloadAll();
  }

  protected setFilter(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    this.restartList();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.restartList();
    }, DEBOUNCE_MS);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reloadList();
  }

  protected async downloadCsv(): Promise<void> {
    if (this.rangeInvalid()) return;
    const done = await this.exporting.run(this.api.revenueCsv(this.filter()));
    if (!done && !this.exporting.busy()) this.notify.error(this.label('billing.rev.csvError'));
  }

  protected async reloadSummary(): Promise<void> {
    const current = this.summaryRequest.start();
    this.summaryLoading.set(true);
    this.summaryError.set(false);
    try {
      const summary = await firstValueFrom(this.api.revenueSummary(this.range()));
      if (!current()) return;
      this.summary.set(summary);
    } catch {
      if (current()) this.summaryError.set(true);
    } finally {
      if (current()) this.summaryLoading.set(false);
    }
  }

  protected async reloadList(): Promise<void> {
    const current = this.listRequest.start();
    this.listLoading.set(true);
    this.listError.set(false);
    try {
      const page = await firstValueFrom(
        this.api.revenueTransactions({ ...this.filter(), page: this.page(), limit: LIMIT }),
      );
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.listError.set(true);
    } finally {
      if (current()) this.listLoading.set(false);
    }
  }

  private reloadAll(): void {
    void this.reloadSummary();
    this.restartList();
  }

  private restartList(): void {
    this.page.set(1);
    void this.reloadList();
  }

  private range(): { from?: string; to?: string } {
    const preset = this.preset();
    if (preset !== 'personalizado') return presetRange(preset, new Date());
    return {
      from: this.from() ? dayStart(this.from()) : undefined,
      to: this.to() ? dayEnd(this.to()) : undefined,
    };
  }

  private filter(): RevenueFilter {
    return {
      ...this.range(),
      search: this.search || undefined,
      source: this.source() === ANY ? undefined : (this.source() as RevenueSource),
      status: this.status() === ANY ? undefined : this.status(),
    };
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
