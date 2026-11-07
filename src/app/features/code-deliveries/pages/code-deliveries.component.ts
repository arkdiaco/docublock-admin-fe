import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CodeDeliveriesApi } from '../data/code-deliveries.api';
import {
  CODE_CHANNELS,
  CODE_PURPOSES,
  type CodeChannel,
  type CodeDeliveryFilters,
  type CodeDeliveryRow,
  type CodeDeliveryStatus,
  type CodePurpose,
} from '../data/code-deliveries.models';
import {
  ALL,
  PERIODS,
  codeStateOf,
  detailOf,
  filtersOf,
  fromOf,
  queryParamsOf,
  statusPills,
} from '../data/code-delivery-view';

export const CODE_DELIVERIES_LIMIT = 25;

const COLUMNS: readonly DataColumn[] = [
  { key: 'created', labelKey: 'cdl.col.created', width: '140px' },
  { key: 'purpose', labelKey: 'cdl.col.purpose', width: 'minmax(0, 1fr)' },
  { key: 'channel', labelKey: 'cdl.col.channel', width: 'minmax(0, 1fr)' },
  { key: 'status', labelKey: 'cdl.col.status', width: '132px' },
  { key: 'person', labelKey: 'cdl.col.person', width: 'minmax(0, 1.2fr)' },
  { key: 'organization', labelKey: 'cdl.col.organization', width: 'minmax(0, 1.2fr)' },
  { key: 'document', labelKey: 'cdl.col.document', width: 'minmax(0, 1.2fr)' },
  { key: 'detail', labelKey: 'cdl.col.detail', width: 'minmax(0, 1.3fr)' },
];

@Component({
  selector: 'dba-code-deliveries',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    OrgPickerComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.codeDeliveries' | translate }}</h1>
          <span class="dba-meta">{{ 'cdl.lead' | translate }}</span>
        </div>
      </header>

      <db-filter-pills
        [pills]="pills"
        [active]="filters().status ?? all"
        [label]="'cdl.col.status' | translate"
        (activeChange)="apply({ status: $any($event) || null })"
      />

      <div class="bl__tools">
        <dba-org-picker
          [value]="filters().organizationId"
          (picked)="apply({ organizationId: $event })"
        />
        <p-select
          [options]="purposeOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().purpose ?? all"
          (ngModelChange)="apply({ purpose: $event || null })"
          [ariaLabel]="'cdl.col.purpose' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="channelOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().channel ?? all"
          (ngModelChange)="apply({ channel: $event || null })"
          [ariaLabel]="'cdl.col.channel' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="periodOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().period ?? all"
          (ngModelChange)="apply({ period: $event || null })"
          [ariaLabel]="'cdl.filter.period' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (filters().organizationId) {
        <p class="dba-meta notice">{{ 'cdl.orgNotice' | translate }}</p>
      }

      @if (loading()) {
        <db-section-loader [label]="'cdl.loading' | translate" />
      } @else if (failed()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cdl.errorTitle" leadKey="cdl.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="filtered() ? 'cdl.emptyFiltered' : 'cdl.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'cdl.tableLabel' | translate"
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
            <div class="dba-tr">
              <span class="dba-td cell"
                ><span class="cell__muted dba-mono">{{ when(row.createdAt) }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__label">{{ 'cdl.purpose.' + row.purpose | translate }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ 'cdl.channel.' + row.channel | translate }}</span>
                <span class="cell__muted dba-mono">{{ row.to }}</span>
              </span>
              <span class="dba-td cell">
                <dba-org-state
                  [state]="stateOf(row.status)"
                  [labelKey]="'cdl.status.' + row.status"
                  variant="inline"
                />
              </span>
              <span class="dba-td cell"
                ><span class="cell__text">{{ row.personName || '—' }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__text">{{ organizationOf(row) }}</span>
              </span>
              <span class="dba-td cell">
                @if (row.documentId) {
                  <a
                    class="dba-ref cell__text"
                    [routerLink]="[documentsPath, row.documentId]"
                    [queryParams]="{ tab: 'trace' }"
                  >
                    {{ row.documentName || ('cdl.unknownDocument' | translate) }}
                  </a>
                } @else {
                  <span class="cell__muted">—</span>
                }
              </span>
              <span class="dba-td cell"
                ><span class="cell__muted">{{ detail(row) }}</span></span
              >
            </div>
          }
        </dba-data-table>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .notice {
      margin: 0;
    }
  `,
})
export class CodeDeliveriesComponent {
  private readonly api = inject(CodeDeliveriesApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly limit = CODE_DELIVERIES_LIMIT;
  protected readonly all = ALL;
  protected readonly pills = statusPills();
  protected readonly documentsPath = sectionPath('documents');
  protected readonly stateOf = codeStateOf;
  protected readonly detail = detailOf;
  protected readonly filters = signal<CodeDeliveryFilters>(
    filtersOf(this.route.snapshot.queryParams),
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly rows = signal<CodeDeliveryRow[]>([]);
  protected readonly total = signal(0);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / CODE_DELIVERIES_LIMIT)),
  );
  protected readonly rangeTo = computed(() =>
    Math.min(this.total(), this.filters().page * CODE_DELIVERIES_LIMIT),
  );
  protected readonly filtered = computed(() => {
    const { purpose, channel, status, organizationId, period } = this.filters();
    return !!(purpose || channel || status || organizationId || period);
  });
  protected readonly purposeOptions = computed(() =>
    this.options('cdl.filter.anyPurpose', CODE_PURPOSES, 'cdl.purpose'),
  );
  protected readonly channelOptions = computed(() =>
    this.options('cdl.filter.anyChannel', CODE_CHANNELS, 'cdl.channel'),
  );
  protected readonly periodOptions = computed(() =>
    this.options('cdl.filter.anyPeriod', Object.keys(PERIODS), 'cdl.periods'),
  );

  constructor() {
    void this.load();
  }

  protected apply(
    change: Partial<{
      purpose: CodePurpose | null;
      channel: CodeChannel | null;
      status: CodeDeliveryStatus | null;
      organizationId: string | null;
      period: string | null;
      page: number;
    }>,
    keepPage = false,
  ): void {
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
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected organizationOf(row: CodeDeliveryRow): string {
    if (!row.organizationId) return this.text('cdl.noOrganization');
    return row.organizationName || this.text('cdl.unknownOrganization');
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    const filters = this.filters();
    this.loading.set(true);
    this.failed.set(false);
    try {
      const report = await firstValueFrom(
        this.api.list({
          purpose: filters.purpose,
          channel: filters.channel,
          status: filters.status,
          organizationId: filters.organizationId,
          from: fromOf(filters.period, Date.now()),
          page: filters.page,
          limit: CODE_DELIVERIES_LIMIT,
        }),
      );
      if (!current()) return;
      const lastPage = Math.max(1, Math.ceil(report.total / CODE_DELIVERIES_LIMIT));
      if (report.items.length === 0 && filters.page > lastPage) {
        this.apply({ page: lastPage }, true);
        return;
      }
      this.rows.set(report.items);
      this.total.set(report.total);
    } catch {
      if (current()) this.failed.set(true);
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
