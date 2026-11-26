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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
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
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { BlockLoad } from '../../platform-analytics/data/block-load';
import { shareOf } from '../../platform-analytics/data/platform-analytics-view';
import { bucketLabelOf, todayIn } from '../../platform-analytics/data/signature-filters';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import { IdenticaReportApi } from '../data/identica-report.api';
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
  type IdenticaGroup,
  type IdenticaReportSummary,
} from '../data/identica-report.models';

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

@Component({
  selector: 'dba-identica-report',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    BarChartComponent,
    BarListComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
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

  constructor() {
    this.load();
  }

  protected apply(change: Partial<IdenticaFilters>): void {
    const next = { ...this.filters(), ...change };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: identicaQueryParamsOf(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load();
  }

  protected load(): void {
    if (this.issue()) {
      this.summary.cancel();
      return;
    }
    const request = identicaRequestOf(
      this.filters(),
      todayIn(new Date(), this.timeZone),
      this.timeZone,
    );
    void this.summary.run(() => this.api.summary(request));
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

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
