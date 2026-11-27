import { formatNumber } from '@angular/common';
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
import { AuthStore } from '../../../core/auth/auth.store';
import { canSeeSection, sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { saveBlob } from '../../../shared/http/save-blob';
import { safeDate } from '../../../shared/i18n/safe-date';
import {
  type BarChartCategory,
  BarChartComponent,
  type BarChartSeries,
} from '../../../shared/ui/bar-chart.component';
import { BarListComponent, type BarListItem } from '../../../shared/ui/bar-list.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { BlockLoad } from '../../platform-analytics/data/block-load';
import { shareOf } from '../../platform-analytics/data/platform-analytics-view';
import { bucketLabelOf, todayIn } from '../../platform-analytics/data/signature-filters';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import { IdenticaReportApi } from '../data/identica-report.api';
import {
  IDENTICA_QUERIES_LIMIT,
  identicaCategoriesFor,
  identicaExportRequestOf,
  identicaListFiltersOf,
  identicaListParamsOf,
  identicaQueriesRequestOf,
  isListFiltered,
  withListChange,
  type IdenticaListFilters,
} from '../data/identica-query-filters';
import {
  IDENTICA_PERIODS,
  identicaFiltersOf,
  identicaQueryParamsOf,
  identicaRangeIssue,
  identicaRequestOf,
  type IdenticaFilters,
} from '../data/identica-report-filters';
import {
  IDENTICA_GROUPS,
  IDENTICA_SERVICES,
  type IdenticaCategory,
  type IdenticaGroup,
  type IdenticaQueriesPage,
  type IdenticaReportRequest,
  type IdenticaReportSummary,
  type IdenticaService,
} from '../data/identica-report.models';

const ANY = '';

const GROUP_TONE: Record<IdenticaGroup, StatCell['tone']> = {
  identica: 'danger',
  review: 'warn',
  docublock: 'plain',
  ok: 'plain',
};

const SERVICE_COLUMNS: readonly DataColumn[] = [
  { key: 'service', labelKey: 'ide.col.service', width: 'minmax(0, 1.6fr)' },
  { key: 'total', labelKey: 'ide.col.total', width: '110px', align: 'end' },
  { key: 'identica', labelKey: 'ide.group.identica', width: '130px', align: 'end' },
  { key: 'review', labelKey: 'ide.group.review', width: '120px', align: 'end' },
  { key: 'docublock', labelKey: 'ide.group.docublock', width: '120px', align: 'end' },
  { key: 'ok', labelKey: 'ide.group.ok', width: '110px', align: 'end' },
  { key: 'share', labelKey: 'ide.col.identicaShare', width: '150px', align: 'end' },
];

const REASON_COLUMNS: readonly DataColumn[] = [
  { key: 'count', labelKey: 'ide.col.count', width: '80px', align: 'end' },
  { key: 'service', labelKey: 'ide.col.service', width: 'minmax(0, 1.2fr)' },
  { key: 'category', labelKey: 'ide.col.category', width: 'minmax(0, 1.6fr)' },
  { key: 'http', labelKey: 'ide.col.http', width: '80px', align: 'end' },
  { key: 'code', labelKey: 'ide.col.code', width: '120px' },
  { key: 'message', labelKey: 'ide.col.message', width: 'minmax(0, 1.8fr)' },
];

const QUERY_COLUMNS: readonly DataColumn[] = [
  { key: 'when', labelKey: 'ide.col.when', width: '140px' },
  { key: 'service', labelKey: 'ide.col.service', width: 'minmax(0, 1fr)' },
  { key: 'category', labelKey: 'ide.col.category', width: 'minmax(0, 1.7fr)' },
  { key: 'answer', labelKey: 'ide.col.answer', width: '110px' },
  { key: 'message', labelKey: 'ide.col.message', width: 'minmax(0, 1.6fr)' },
  { key: 'document', labelKey: 'ide.col.document', width: 'minmax(0, 1.2fr)' },
  { key: 'organization', labelKey: 'ide.col.organization', width: 'minmax(0, 1.2fr)' },
  { key: 'signer', labelKey: 'ide.col.signer', width: 'minmax(0, 1.1fr)' },
];

@Component({
  selector: 'dba-identica-report',
  imports: [
    FormsModule,
    TranslatePipe,
    RouterLink,
    Select,
    BarChartComponent,
    BarListComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    FilterPillsComponent,
    IconComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.identicaReport' | translate }}</h1>
          <span class="dba-meta">{{ 'ide.lead' | translate }}</span>
        </div>
      </header>

      <div class="bl__tools">
        <div class="ir__control">
          <label class="ir__label" for="ide-period">{{ 'pan.period.label' | translate }}</label>
          <p-select
            inputId="ide-period"
            [options]="periodOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="filters().period"
            (ngModelChange)="apply({ period: $event })"
            appendTo="body"
            styleClass="bl__select"
          />
        </div>
        @if (filters().period === 'personalizado') {
          <dba-field
            class="bl__date"
            label="pan.from"
            type="date"
            [value]="filters().from ?? ''"
            (valueChange)="apply({ from: $event || null })"
          />
          <dba-field
            class="bl__date"
            label="pan.to"
            type="date"
            [value]="filters().to ?? ''"
            (valueChange)="apply({ to: $event || null })"
          />
        }
      </div>

      @if (issue(); as code) {
        <p class="dba-meta">{{ 'pan.issue.' + code | translate }}</p>
      } @else if (summary.state() === 'loading') {
        <db-section-loader [label]="'ide.loading' | translate" />
      } @else if (summary.state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="ide.errorTitle" leadKey="pan.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (summary.data(); as data) {
        <p class="dba-meta ir__range">
          {{ 'ide.range' | translate: { range: rangeText(data.from, data.to) } }}
        </p>
        <db-stat-band [cells]="cells()" [label]="'ide.statsLabel' | translate" />
        <p class="dba-meta ir__note">{{ 'ide.definitions' | translate }}</p>
        <p class="dba-meta ir__note">{{ 'ide.scope' | translate }}</p>

        @if (data.totals.total === 0) {
          <dba-empty-state titleKey="ide.emptyTitle" leadKey="ide.emptyLead" />
        } @else {
          <div class="ir__grid">
            <section class="ir__card">
              <h2 class="dba-panel">{{ 'ide.byCategory' | translate }}</h2>
              <dba-bar-list [items]="categories()" [label]="'ide.byCategory' | translate" />
            </section>
            <section class="ir__card">
              <h2 class="dba-panel">{{ 'ide.byMonth' | translate }}</h2>
              <dba-bar-chart
                [categories]="months()"
                [series]="monthSeries()"
                [integers]="true"
                [label]="'ide.byMonth' | translate"
              />
            </section>
          </div>

          <section class="ir__section">
            <h2 class="dba-section">{{ 'ide.byService' | translate }}</h2>
            <dba-data-table
              [columns]="serviceColumns"
              [label]="'ide.byService' | translate"
              minWidth="1000px"
            >
              @for (row of data.services; track row.service) {
                <div class="dba-tr">
                  <span class="dba-td cell"
                    ><span class="cell__label">{{ serviceName(row.service) }}</span></span
                  >
                  <span class="dba-td cell cell--end"
                    ><span class="dba-mono">{{ count(row.total) }}</span></span
                  >
                  @for (group of groups; track group) {
                    <span class="dba-td cell cell--end"
                      ><span class="dba-mono">{{ count(row[group]) }}</span></span
                    >
                  }
                  <span class="dba-td cell cell--end"
                    ><span class="dba-mono">{{ percent(row.identica, row.total) }}</span></span
                  >
                </div>
              }
            </dba-data-table>
          </section>

          <section class="ir__section">
            <h2 class="dba-section">{{ 'ide.reasons' | translate }}</h2>
            <span class="dba-meta">{{ 'ide.reasonsLead' | translate }}</span>
            @if (data.reasons.length === 0) {
              <dba-empty-state titleKey="ide.noReasonsTitle" leadKey="ide.noReasonsLead" />
            } @else {
              <dba-data-table
                [columns]="reasonColumns"
                [label]="'ide.reasons' | translate"
                minWidth="1180px"
              >
                @for (reason of data.reasons; track $index) {
                  <div class="dba-tr">
                    <span class="dba-td cell cell--end"
                      ><span class="dba-mono">{{ count(reason.count) }}</span></span
                    >
                    <span class="dba-td cell"
                      ><span class="cell__label">{{ serviceName(reason.service) }}</span></span
                    >
                    <span class="dba-td cell">
                      <span class="cell__text">{{
                        'ide.category.' + reason.category | translate
                      }}</span>
                      <span class="cell__muted">{{ 'ide.group.' + reason.group | translate }}</span>
                    </span>
                    <span class="dba-td cell cell--end"
                      ><span class="dba-mono">{{
                        reason.httpStatus ?? ('ide.none' | translate)
                      }}</span></span
                    >
                    <span class="dba-td cell"
                      ><span class="dba-mono">{{
                        reason.responseCode ?? ('ide.none' | translate)
                      }}</span></span
                    >
                    <span class="dba-td cell"
                      ><span class="cell__text">{{
                        reason.message ?? ('ide.noMessage' | translate)
                      }}</span></span
                    >
                  </div>
                }
              </dba-data-table>
            }
          </section>

          <section class="ir__section">
            <header class="ir__head">
              <div class="ir__head-text">
                <h2 class="dba-section">{{ 'ide.list.title' | translate }}</h2>
                <span class="dba-meta">{{ 'ide.list.lead' | translate }}</span>
              </div>
              <button
                dba-button
                variant="secondary"
                class="ir__export"
                [busy]="exporting()"
                [disabled]="exporting()"
                (click)="exportCsv()"
              >
                <db-icon name="download" [size]="15" />
                {{ 'ide.list.csv' | translate }}
              </button>
            </header>

            <db-filter-pills
              [pills]="pills()"
              [active]="list().group ?? any"
              [label]="'ide.col.group' | translate"
              (activeChange)="applyList({ group: $any($event) || null })"
            />

            <div class="bl__tools">
              <p-select
                [options]="categoryOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="list().category ?? any"
                (ngModelChange)="applyList({ category: $event || null })"
                [ariaLabel]="'ide.col.category' | translate"
                appendTo="body"
                styleClass="bl__select"
              />
              <p-select
                [options]="serviceOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="list().service ?? any"
                (ngModelChange)="applyList({ service: $event || null })"
                [ariaLabel]="'ide.col.service' | translate"
                appendTo="body"
                styleClass="bl__select"
              />
            </div>

            @if (queries.state() === 'loading') {
              <db-section-loader [label]="'ide.list.loading' | translate" />
            } @else if (queries.state() === 'failed') {
              <div class="bl__panel">
                <dba-empty-state titleKey="ide.list.errorTitle" leadKey="pan.errorLead" />
                <button dba-button variant="secondary" (click)="loadQueries()">
                  {{ 'common.retry' | translate }}
                </button>
              </div>
            } @else if (queries.data(); as page) {
              @if (page.items.length === 0) {
                <div class="bl__panel">
                  <dba-empty-state
                    [titleKey]="listFiltered() ? 'ide.list.emptyFiltered' : 'ide.list.empty'"
                  />
                </div>
              } @else {
                <dba-data-table
                  [columns]="queryColumns"
                  [label]="'ide.list.title' | translate"
                  [dense]="density.compact()"
                  minWidth="1680px"
                  [total]="page.total"
                  [from]="(page.page - 1) * limit + 1"
                  [to]="rangeTo(page)"
                  [page]="page.page"
                  [pageCount]="pageCount(page)"
                  (pageChange)="applyList({ page: $event })"
                >
                  @for (row of page.items; track row.id ?? $index) {
                    <div class="dba-tr">
                      <span class="dba-td cell">
                        <span class="cell__muted dba-mono">{{ when(row.occurredAt) }}</span>
                        @if (row.durationMs !== null) {
                          <span class="cell__muted">{{ duration(row.durationMs) }}</span>
                        }
                      </span>
                      <span class="dba-td cell"
                        ><span class="cell__label">{{ serviceName(row.service) }}</span></span
                      >
                      <span class="dba-td cell">
                        <span class="cell__text">{{
                          'ide.category.' + row.category | translate
                        }}</span>
                        <span class="cell__muted">{{ 'ide.group.' + row.group | translate }}</span>
                      </span>
                      <span class="dba-td cell">
                        <span class="dba-mono">{{
                          row.httpStatus ?? ('ide.none' | translate)
                        }}</span>
                        @if (row.responseCode) {
                          <span class="cell__muted dba-mono">{{ row.responseCode }}</span>
                        }
                      </span>
                      <span class="dba-td cell"
                        ><span class="cell__text" [attr.title]="row.message">{{
                          row.message ?? ('ide.noMessage' | translate)
                        }}</span></span
                      >
                      <span class="dba-td cell">
                        @if (row.document; as document) {
                          @if (canOpenDocument()) {
                            <a
                              class="ir__link dba-mono"
                              [routerLink]="[documentsPath, document.id]"
                              >{{ document.code ?? document.id }}</a
                            >
                          } @else {
                            <span class="cell__label dba-mono">{{
                              document.code ?? document.id
                            }}</span>
                          }
                          @if (document.name) {
                            <span class="cell__muted">{{ document.name }}</span>
                          }
                        } @else {
                          <span class="cell__muted">{{ 'ide.list.noDocument' | translate }}</span>
                        }
                      </span>
                      <span class="dba-td cell">
                        @if (row.organization; as organization) {
                          @if (canOpenOrganization()) {
                            <a
                              class="ir__link"
                              [routerLink]="[organizationsPath, organization.id]"
                              >{{ organization.name ?? organization.id }}</a
                            >
                          } @else {
                            <span class="cell__label">{{
                              organization.name ?? organization.id
                            }}</span>
                          }
                          @if (organization.tributaryNumber) {
                            <span class="cell__muted">{{
                              'ide.list.nit' | translate: { nit: organization.tributaryNumber }
                            }}</span>
                          }
                        } @else {
                          <span class="cell__muted">{{
                            'ide.list.noOrganization' | translate
                          }}</span>
                        }
                      </span>
                      <span class="dba-td cell">
                        @if (row.signer; as signer) {
                          <span class="cell__label">{{ signer.name ?? signer.id }}</span>
                          @if (signer.identification) {
                            <span class="cell__muted dba-mono">{{ signer.identification }}</span>
                          }
                        } @else {
                          <span class="cell__muted">{{ 'ide.list.noSigner' | translate }}</span>
                        }
                      </span>
                    </div>
                  }
                </dba-data-table>
              }
            }
          </section>
        }
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .ir__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 0 1 200px;
      min-width: 0;
    }

    .ir__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    :host ::ng-deep .ir__control .bl__select.p-select {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
    }

    .ir__range,
    .ir__note {
      margin: 0;
    }

    .ir__note {
      margin-top: -6px;
    }

    .ir__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }

    .ir__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .ir__card h2,
    .ir__section h2 {
      margin: 0;
    }

    .ir__section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .cell--end {
      align-items: flex-end;
    }

    .ir__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
    }

    .ir__head-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .ir__export {
      margin-left: auto;
    }

    .ir__link {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-violet-600);
    }

    @media (max-width: 960px) {
      .ir__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 520px) {
      .ir__control {
        flex-basis: 100%;
      }
    }
  `,
})
export class IdenticaReportComponent {
  private readonly api = inject(IdenticaReportApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly timeZone = browserTimeZone();
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);

  protected readonly density = inject(DensityService);
  protected readonly any = ANY;
  protected readonly limit = IDENTICA_QUERIES_LIMIT;
  protected readonly queryColumns = QUERY_COLUMNS;
  protected readonly documentsPath = sectionPath('documents');
  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly canOpenDocument = computed(() =>
    canSeeSection(this.auth.platformPermissions(), 'documents'),
  );
  protected readonly canOpenOrganization = computed(() =>
    canSeeSection(this.auth.platformPermissions(), 'organizations'),
  );
  protected readonly list = signal<IdenticaListFilters>(
    identicaListFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly queries = new BlockLoad<IdenticaQueriesPage>();
  protected readonly exporting = signal(false);
  protected readonly listFiltered = computed(() => isListFiltered(this.list()));

  protected readonly serviceColumns = SERVICE_COLUMNS;
  protected readonly reasonColumns = REASON_COLUMNS;
  protected readonly groups = IDENTICA_GROUPS;
  protected readonly filters = signal<IdenticaFilters>(
    identicaFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly summary = new BlockLoad<IdenticaReportSummary>();
  protected readonly issue = computed(() =>
    identicaRangeIssue(this.filters(), todayIn(new Date(), this.timeZone)),
  );

  protected readonly periodOptions = computed(() =>
    IDENTICA_PERIODS.map((id) => ({ id, label: this.text(`pan.period.${id}`) })),
  );

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.summary.data();
    if (!data) return [];
    const { totals } = data;
    return [
      { key: 'total', label: this.text('ide.stat.total'), value: this.count(totals.total) },
      ...IDENTICA_GROUPS.map((group) => ({
        key: group,
        label: this.text(`ide.group.${group}`),
        value: this.count(totals[group]),
        note: this.text('ide.stat.share', { share: this.percent(totals[group], totals.total) }),
        tone: totals[group] > 0 ? GROUP_TONE[group] : 'plain',
      })),
    ];
  });

  protected readonly categories = computed<BarListItem[]>(() => {
    const data = this.summary.data();
    if (!data) return [];
    return data.categories.map((item) => ({
      key: item.category,
      label: this.text(`ide.category.${item.category}`),
      value: item.count,
      valueText: this.count(item.count),
      note: `${this.text(`ide.group.${item.group}`)} · ${this.percent(item.count, data.totals.total)}`,
    }));
  });

  protected readonly months = computed<BarChartCategory[]>(() => {
    const months = this.summary.data()?.months ?? [];
    const years = new Set(months.map((m) => m.month.slice(0, 4)));
    return months.map((m) => ({
      key: m.month,
      label: bucketLabelOf(`${m.month}-01`, 'month', this.locale, years.size > 1),
    }));
  });

  protected readonly monthSeries = computed<BarChartSeries[]>(() => {
    const months = this.summary.data()?.months ?? [];
    return [
      {
        key: 'total',
        label: this.text('ide.series.total'),
        values: months.map((m) => m.total),
      },
      {
        key: 'identica',
        label: this.text('ide.group.identica'),
        values: months.map((m) => m.identica),
      },
    ];
  });

  protected readonly pills = computed<FilterPill[]>(() => {
    const totals = this.summary.data()?.totals;
    return [
      {
        key: ANY,
        labelKey: 'ide.list.allPending',
        count: totals ? totals.identica + totals.review + totals.docublock : undefined,
      },
      ...IDENTICA_GROUPS.map((group) => ({
        key: group,
        labelKey: `ide.group.${group}`,
        count: totals?.[group],
        danger: group === 'identica' && (totals?.identica ?? 0) > 0,
      })),
    ];
  });

  protected readonly categoryOptions = computed(() => [
    { id: ANY, label: this.text('ide.list.anyCategory') },
    ...identicaCategoriesFor(this.list().group).map((id: IdenticaCategory) => ({
      id,
      label: this.text(`ide.category.${id}`),
    })),
  ]);

  protected readonly serviceOptions = computed(() => [
    { id: ANY, label: this.text('ide.list.anyService') },
    ...IDENTICA_SERVICES.map((id: IdenticaService) => ({ id, label: this.serviceName(id) })),
  ]);

  constructor() {
    this.load();
  }

  protected apply(change: Partial<IdenticaFilters>): void {
    this.filters.set({ ...this.filters(), ...change });
    this.list.set({ ...this.list(), page: 1 });
    this.syncUrl();
    this.load();
  }

  protected applyList(change: Partial<IdenticaListFilters>): void {
    this.list.set(withListChange(this.list(), change));
    this.syncUrl();
    void this.loadQueries();
  }

  protected load(): void {
    if (this.issue()) {
      this.summary.cancel();
      this.queries.cancel();
      return;
    }
    const request = this.periodRequest();
    void this.summary.run(() => this.api.summary(request));
    void this.loadQueries();
  }

  protected async loadQueries(): Promise<void> {
    if (this.issue()) return;
    const filters = this.list();
    await this.queries.run(() =>
      this.api.queries(identicaQueriesRequestOf(filters, this.periodRequest())),
    );
    const page = this.queries.data();
    if (this.queries.state() !== 'ready' || !page || page.items.length > 0) return;
    const last = this.pageCount(page);
    if (filters.page > last) this.applyList({ page: last });
  }

  protected async exportCsv(): Promise<void> {
    if (this.exporting() || this.issue()) return;
    this.exporting.set(true);
    try {
      const file = await firstValueFrom(
        this.api.queriesCsv(identicaExportRequestOf(this.list(), this.periodRequest())),
      );
      saveBlob(new Blob(['\uFEFF', file.blob], { type: 'text/csv;charset=utf-8' }), file.filename);
    } catch {
      this.notify.error(this.text('ide.list.csvError'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected pageCount(page: IdenticaQueriesPage): number {
    return Math.max(1, Math.ceil(page.total / IDENTICA_QUERIES_LIMIT));
  }

  protected rangeTo(page: IdenticaQueriesPage): number {
    return Math.min(page.total, page.page * IDENTICA_QUERIES_LIMIT);
  }

  protected when(value: string): string {
    return safeDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected duration(ms: number): string {
    if (ms < 1000) return `${this.count(ms)} ms`;
    return `${formatNumber(ms / 1000, this.locale, '1.0-1')} s`;
  }

  protected serviceName(service: string): string {
    const key = `ide.service.${service}`;
    const name = this.text(key);
    return name === key ? service : name;
  }

  protected count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  protected percent(part: number, total: number): string {
    return `${formatNumber(shareOf(part, total), this.locale, '1.0-1')} %`;
  }

  protected rangeText(from: string, to: string): string {
    const format = new Intl.DateTimeFormat(this.locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const day = (value: string) => format.format(new Date(`${value}T12:00:00Z`));
    return from === to ? day(from) : `${day(from)} – ${day(to)}`;
  }

  private periodRequest(): IdenticaReportRequest {
    return identicaRequestOf(this.filters(), todayIn(new Date(), this.timeZone), this.timeZone);
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...identicaQueryParamsOf(this.filters()),
        ...identicaListParamsOf(this.list()),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
