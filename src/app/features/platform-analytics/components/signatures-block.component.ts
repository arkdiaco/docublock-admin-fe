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
import { statTrendOf } from '../data/analytics-format';
import { shareOf } from '../data/platform-analytics-view';
import type { PlatformSignatures, SignatureTotals } from '../data/platform-signatures.models';
import { bucketLabelOf } from '../data/signature-filters';

const TOTAL_KEYS: (keyof SignatureTotals)[] = [
  'signatures',
  'people',
  'newPeople',
  'documents',
  'organizations',
];

interface BreakdownCard {
  key: string;
  items: BarListItem[];
  note: string | null;
}

@Component({
  selector: 'dba-signatures-block',
  imports: [
    TranslatePipe,
    BarChartComponent,
    BarListComponent,
    EmptyStateComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-stat-band [cells]="cells()" [label]="'pan.sig.statsLabel' | translate" />
    <p class="dba-meta sb__note">{{ 'pan.sig.definitions' | translate }}</p>

    <section class="sb__card">
      <h2 class="dba-panel">{{ 'pan.sig.chart.' + data().granularity | translate }}</h2>
      @if (data().totals.signatures === 0) {
        <dba-empty-state titleKey="pan.sig.emptyTitle" leadKey="pan.sig.emptyLead" />
      } @else {
        <dba-bar-chart
          [categories]="categories()"
          [series]="series()"
          [integers]="true"
          [label]="'pan.sig.chart.' + data().granularity | translate"
        />
      }
    </section>

    @if (data().totals.signatures > 0) {
      <div class="sb__grid">
        @for (card of breakdown(); track card.key) {
          <section class="sb__card">
            <h2 class="dba-panel">{{ 'pan.sig.breakdown.' + card.key + '.title' | translate }}</h2>
            <dba-bar-list
              [items]="card.items"
              [label]="'pan.sig.breakdown.' + card.key + '.title' | translate"
            />
            @if (card.note) {
              <span class="dba-meta">{{ card.note }}</span>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sb__note {
      margin: -6px 0 0;
    }

    .sb__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }

    .sb__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sb__card h2 {
      margin: 0;
    }

    @media (max-width: 960px) {
      .sb__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class SignaturesBlockComponent {
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly data = input.required<PlatformSignatures>();

  protected readonly cells = computed<StatCell[]>(() => {
    const { totals, previous } = this.data();
    return TOTAL_KEYS.map((key) => ({
      key,
      label: this.text(`pan.sig.stat.${key}`),
      value: this.count(totals[key]),
      trend: statTrendOf(totals[key], previous[key], this.locale),
      note: this.text('pan.sig.previous', { value: this.count(previous[key]) }),
    }));
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
        key: 'signatures',
        label: this.text('pan.sig.series.signatures'),
        values: rows.map((row) => row.signatures),
      },
      {
        key: 'people',
        label: this.text('pan.sig.series.people'),
        values: rows.map((row) => row.people),
      },
    ];
  });

  protected readonly breakdown = computed<BreakdownCard[]>(() => {
    const { breakdown, totals } = this.data();
    const total = totals.signatures;
    const list = (card: string, values: Record<string, number>, keepZero = true) =>
      Object.entries(values)
        .filter(([, value]) => keepZero || value > 0)
        .map(([key, value]) => ({
          key,
          label: this.text(`pan.sig.breakdown.${card}.${key}`),
          value,
          valueText: this.count(value),
          note: this.text('pan.sig.share', {
            share: formatNumber(shareOf(value, total), this.locale, '1.0-1'),
          }),
        }));
    const { other, ...origin } = breakdown.origin;
    return [
      {
        key: 'origin',
        items: [...list('origin', origin), ...list('origin', { other }, false)],
        note: null,
      },
      {
        key: 'mode',
        items: list('mode', breakdown.mode),
        note: this.text('pan.sig.legalRep', { value: this.count(breakdown.legalRep) }),
      },
      {
        key: 'otp',
        items: list('otp', breakdown.otp),
        note: this.text('pan.sig.breakdown.otp.note'),
      },
      {
        key: 'identity',
        items: list('identity', breakdown.identity),
        note: this.text('pan.sig.breakdown.identity.note'),
      },
    ];
  });

  private count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
