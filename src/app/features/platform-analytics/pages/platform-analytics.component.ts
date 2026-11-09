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
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import {
  BarChartComponent,
  type BarChartCategory,
  type BarChartSeries,
} from '../../../shared/ui/bar-chart.component';
import { BarListComponent, type BarListItem } from '../../../shared/ui/bar-list.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import { PlatformAnalyticsApi } from '../data/platform-analytics.api';
import type { PlatformOverview } from '../data/platform-analytics.models';
import { shareOf, yearOf, yearOptionsOf, yearQueryParamsOf } from '../data/platform-analytics-view';

type LoadState = 'loading' | 'ready' | 'failed';

@Component({
  selector: 'dba-platform-analytics',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    BarChartComponent,
    BarListComponent,
    ButtonComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.platformAnalytics' | translate }}</h1>
          <span class="dba-meta">{{ 'pan.lead' | translate }}</span>
        </div>
      </header>

      <div class="bl__tools">
        <div class="pa__control">
          <label class="pa__label" for="pan-year">{{ 'pan.year' | translate }}</label>
          <p-select
            inputId="pan-year"
            [options]="yearOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="year()"
            (ngModelChange)="pick($event)"
            appendTo="body"
            styleClass="bl__select"
          />
        </div>
      </div>

      @if (state() === 'loading') {
        <db-section-loader [label]="'pan.loading' | translate" />
      } @else if (state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="pan.errorTitle" leadKey="pan.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (overview(); as data) {
        <db-stat-band [cells]="cells()" [label]="'pan.statsLabel' | translate" />

        <div class="pa__grid">
          <section class="pa__card">
            <h2 class="dba-panel">
              {{ 'pan.transactionsByMonth' | translate: { year: data.year } }}
            </h2>
            @if (data.transactions.total === 0) {
              <dba-empty-state
                titleKey="pan.noTransactionsTitle"
                leadKey="pan.noTransactionsLead"
              />
            } @else {
              <dba-bar-chart
                [categories]="months()"
                [series]="transactionSeries()"
                [integers]="true"
                [label]="'pan.transactionsByMonth' | translate: { year: data.year }"
              />
            }
          </section>
          <section class="pa__card">
            <h2 class="dba-panel">
              {{ 'pan.documentsByMonth' | translate: { year: data.year } }}
            </h2>
            @if (data.documents.created === 0 && data.documents.signed === 0) {
              <dba-empty-state titleKey="pan.noDocumentsTitle" leadKey="pan.noDocumentsLead" />
            } @else {
              <dba-bar-chart
                [categories]="months()"
                [series]="documentSeries()"
                [integers]="true"
                [label]="'pan.documentsByMonth' | translate: { year: data.year }"
              />
            }
          </section>
        </div>

        <section class="pa__card">
          <h2 class="dba-panel">{{ 'pan.plans' | translate }}</h2>
          <span class="dba-meta">{{ 'pan.plansLead' | translate }}</span>
          @if (plans().length === 0) {
            <dba-empty-state titleKey="pan.noPlansTitle" leadKey="pan.noPlansLead" />
          } @else {
            <dba-bar-list [items]="plans()" [label]="'pan.plans' | translate" />
          }
        </section>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .pa__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 0 1 160px;
      min-width: 0;
    }

    .pa__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    :host ::ng-deep .pa__control .bl__select.p-select {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
    }

    .pa__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }

    .pa__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .pa__card h2 {
      margin: 0;
    }

    @media (max-width: 960px) {
      .pa__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PlatformAnalyticsComponent {
  private readonly api = inject(PlatformAnalyticsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly timeZone = browserTimeZone();
  private readonly currentYear = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, year: 'numeric' }).format(
      new Date(),
    ),
  );

  protected readonly year = signal(yearOf(this.route.snapshot.queryParams, this.currentYear));
  protected readonly state = signal<LoadState>('loading');
  protected readonly overview = signal<PlatformOverview | null>(null);

  protected readonly yearOptions = computed(() =>
    yearOptionsOf(this.overview()?.firstYear ?? this.year(), this.currentYear, this.year()),
  );

  protected readonly months = computed<BarChartCategory[]>(() => {
    const format = new Intl.DateTimeFormat(this.locale, { month: 'short', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, index) => ({
      key: String(index + 1),
      label: format.format(new Date(Date.UTC(2000, index, 15))),
    }));
  });

  protected readonly transactionSeries = computed<BarChartSeries[]>(() => {
    const months = this.overview()?.months ?? [];
    return [
      {
        key: 'approved',
        label: this.text('pan.series.approved'),
        values: months.map((m) => m.transactions.approved),
      },
      {
        key: 'total',
        label: this.text('pan.series.total'),
        values: months.map((m) => m.transactions.total),
      },
    ];
  });

  protected readonly documentSeries = computed<BarChartSeries[]>(() => {
    const months = this.overview()?.months ?? [];
    return [
      {
        key: 'created',
        label: this.text('pan.series.created'),
        values: months.map((m) => m.documents.created),
      },
      {
        key: 'signed',
        label: this.text('pan.series.signed'),
        values: months.map((m) => m.documents.signed),
      },
    ];
  });

  protected readonly plans = computed<BarListItem[]>(() => {
    const plans = this.overview()?.plans ?? [];
    const total = plans.reduce((sum, plan) => sum + plan.count, 0);
    return plans.map((plan) => ({
      key: plan.code ?? plan.name,
      label: plan.name,
      value: plan.count,
      valueText: this.count(plan.count),
      note: this.text('pan.planShare', {
        share: formatNumber(shareOf(plan.count, total), this.locale, '1.0-1'),
      }),
    }));
  });

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.overview();
    if (!data) return [];
    return [
      {
        key: 'users',
        label: this.text('pan.stat.users'),
        value: this.count(data.users),
        note: this.text('pan.stat.usersNote'),
      },
      {
        key: 'clients',
        label: this.text('pan.stat.clients'),
        value: this.count(data.organizations.clients),
      },
      {
        key: 'resellers',
        label: this.text('pan.stat.resellers'),
        value: this.count(data.organizations.resellers),
      },
      {
        key: 'documents',
        label: this.text('pan.stat.documents', { year: data.year }),
        value: this.count(data.documents.created),
        note: this.text('pan.stat.documentsNote', { signed: this.count(data.documents.signed) }),
      },
      {
        key: 'transactions',
        label: this.text('pan.stat.transactions', { year: data.year }),
        value: this.count(data.transactions.total),
        note: this.text('pan.stat.transactionsNote', {
          approved: this.count(data.transactions.approved),
        }),
      },
    ];
  });

  constructor() {
    void this.load();
  }

  protected pick(year: number): void {
    if (year === this.year()) return;
    this.year.set(year);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: yearQueryParamsOf(year, this.currentYear),
      replaceUrl: true,
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    this.state.set('loading');
    try {
      const overview = await firstValueFrom(this.api.overview(this.year(), this.timeZone));
      if (!current()) return;
      this.overview.set(overview);
      this.state.set('ready');
    } catch {
      if (!current()) return;
      this.state.set('failed');
    }
  }

  private count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
