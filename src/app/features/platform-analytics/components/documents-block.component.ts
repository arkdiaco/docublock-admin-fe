import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BarChartComponent,
  type BarChartCategory,
  type BarChartSeries,
} from '../../../shared/ui/bar-chart.component';
import { BarListComponent, type BarListItem } from '../../../shared/ui/bar-list.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { durationKeyOf, durationPartsOf, statTrendOf } from '../data/analytics-format';
import type { PlatformDocuments } from '../data/platform-activity.models';
import { shareOf } from '../data/platform-analytics-view';
import { bucketLabelOf } from '../data/signature-filters';

const COHORT_KEYS = ['completed', 'inProgress', 'rejected', 'cancelled'] as const;

@Component({
  selector: 'dba-documents-block',
  imports: [
    TranslatePipe,
    BarChartComponent,
    BarListComponent,
    EmptyStateComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-stat-band [cells]="cells()" [label]="'pan.doc.statsLabel' | translate" />

    @if (empty()) {
      <section class="db__card">
        <dba-empty-state titleKey="pan.doc.emptyTitle" leadKey="pan.doc.emptyLead" />
      </section>
    } @else {
      <div class="db__grid">
        <section class="db__card">
          <h2 class="dba-panel">{{ 'pan.doc.chart.' + data().granularity | translate }}</h2>
          <dba-bar-chart
            [categories]="categories()"
            [series]="series()"
            [integers]="true"
            [label]="'pan.doc.chart.' + data().granularity | translate"
          />
        </section>
        <section class="db__card">
          <h2 class="dba-panel">{{ 'pan.doc.cohort.title' | translate }}</h2>
          <span class="dba-meta">{{ 'pan.doc.cohort.lead' | translate }}</span>
          @if (data().totals.created === 0) {
            <dba-empty-state
              titleKey="pan.doc.cohort.emptyTitle"
              leadKey="pan.doc.cohort.emptyLead"
            />
          } @else {
            <dba-bar-list [items]="cohort()" [label]="'pan.doc.cohort.title' | translate" />
          }
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .db__grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .db__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .db__card h2 {
      margin: 0;
    }

    @media (max-width: 960px) {
      .db__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class DocumentsBlockComponent {
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly data = input.required<PlatformDocuments>();

  protected readonly empty = computed(() => {
    const { totals } = this.data();
    return totals.created === 0 && totals.completed === 0;
  });

  protected readonly cells = computed<StatCell[]>(() => {
    const { totals, previous } = this.data();
    const average = totals.averageCompletionMs;
    const before = previous.averageCompletionMs;
    return [
      {
        key: 'created',
        label: this.text('pan.doc.stat.created'),
        value: this.count(totals.created),
        trend: statTrendOf(totals.created, previous.created, this.locale),
        note: this.text('pan.sig.previous', { value: this.count(previous.created) }),
      },
      {
        key: 'completed',
        label: this.text('pan.doc.stat.completed'),
        value: this.count(totals.completed),
        trend: statTrendOf(totals.completed, previous.completed, this.locale),
        note: this.text('pan.sig.previous', { value: this.count(previous.completed) }),
      },
      {
        key: 'average',
        label: this.text('pan.doc.stat.average'),
        value: average === null ? '—' : this.duration(average),
        trend:
          average === null || before === null
            ? undefined
            : statTrendOf(average, before, this.locale, true),
        note:
          before === null
            ? this.text('pan.doc.stat.averageNote')
            : this.text('pan.sig.previous', { value: this.duration(before) }),
      },
    ];
  });

  protected readonly categories = computed<BarChartCategory[]>(() => {
    const { series, granularity, from, to } = this.data();
    const spansYears = from.slice(0, 4) !== to.slice(0, 4);
    return series.map((row) => ({
      key: row.bucket,
      label: bucketLabelOf(row.bucket, granularity, this.locale, spansYears),
    }));
  });

  protected readonly series = computed<BarChartSeries[]>(() => {
    const rows = this.data().series;
    return [
      {
        key: 'created',
        label: this.text('pan.series.created'),
        values: rows.map((row) => row.created),
      },
      {
        key: 'completed',
        label: this.text('pan.doc.series.completed'),
        values: rows.map((row) => row.completed),
      },
    ];
  });

  protected readonly cohort = computed<BarListItem[]>(() => {
    const { cohort, totals } = this.data();
    return COHORT_KEYS.map((key) => ({
      key,
      label: this.text(`pan.doc.cohort.${key}`),
      value: cohort[key],
      valueText: this.count(cohort[key]),
      note: this.text('pan.doc.cohort.share', {
        share: formatNumber(shareOf(cohort[key], totals.created), this.locale, '1.0-1'),
      }),
    }));
  });

  private duration(ms: number): string {
    const parts = durationPartsOf(ms);
    return this.text(durationKeyOf(parts), { ...parts });
  }

  private count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
