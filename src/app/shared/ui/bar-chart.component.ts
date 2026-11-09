import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';

export interface BarChartCategory {
  key: string;
  label: string;
}

export interface BarChartSeries {
  key: string;
  label: string;
  values: readonly number[];
}

export const MAX_BAR_SERIES = 3;

const TICKS = 4;

export const niceTicks = (max: number, count = TICKS, minStep = 0): number[] => {
  if (!(max > 0)) return [0];
  const rough = Math.max(max / count, minStep);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((f) => f * magnitude)
      .find((s) => s >= rough && (minStep === 0 || Number.isInteger(s))) ?? rough;
  const steps = Math.ceil(max / step);
  return Array.from({ length: steps + 1 }, (_, i) => Number((i * step).toPrecision(12)));
};

@Component({
  selector: 'dba-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <div class="chart__plot" role="img" [attr.aria-label]="label()">
        <div class="chart__axis" aria-hidden="true">
          @for (tick of ticksDesc(); track $index) {
            <span class="chart__tick">{{ formatter()(tick) }}</span>
          }
        </div>
        <div class="chart__area" aria-hidden="true">
          <div class="chart__grids">
            @for (tick of ticksDesc(); track $index) {
              <span class="chart__grid" [style.bottom.%]="(tick / top()) * 100"></span>
            }
          </div>
          <div class="chart__cols">
            @for (col of columns(); track col.key) {
              <div class="chart__col">
                <div class="chart__bars">
                  @for (bar of col.bars; track bar.key) {
                    <span
                      [class]="'chart__bar chart__bar--' + bar.index"
                      [style.height.%]="bar.percent"
                      [attr.title]="col.label + ' · ' + bar.label + ': ' + bar.text"
                    ></span>
                  }
                </div>
                <span class="chart__x">{{ col.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>
      @if (visibleSeries().length > 1) {
        <figcaption class="chart__legend">
          @for (serie of visibleSeries(); track serie.key; let i = $index) {
            <span class="chart__key">
              <span [class]="'chart__swatch chart__bar--' + i"></span>{{ serie.label }}
            </span>
          }
        </figcaption>
      }
      <table class="visually-hidden">
        <caption>
          {{
            label()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col"></th>
            @for (serie of visibleSeries(); track serie.key) {
              <th scope="col">{{ serie.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (col of columns(); track col.key) {
            <tr>
              <th scope="row">{{ col.label }}</th>
              @for (bar of col.bars; track bar.key) {
                <td>{{ bar.text }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }

    .chart {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
    }

    .chart__plot {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      height: var(--chart-height, 220px);
    }

    .chart__axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-bottom: 22px;
      text-align: right;
    }

    .chart__tick {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      line-height: 1;
      color: var(--dba-text-faint);
      transform: translateY(-50%);
    }

    .chart__tick:last-child {
      transform: translateY(50%);
    }

    .chart__area {
      position: relative;
      min-width: 0;
    }

    .chart__grids {
      position: absolute;
      inset: 0 0 22px;
    }

    .chart__grid {
      position: absolute;
      right: 0;
      left: 0;
      height: 0;
      border-top: 1px solid var(--dba-chart-grid);
    }

    .chart__cols {
      position: absolute;
      inset: 0;
      display: flex;
      gap: 6px;
    }

    .chart__col {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }

    .chart__bars {
      display: flex;
      flex: 1 1 auto;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
    }

    .chart__bar {
      flex: 0 1 14px;
      min-width: 3px;
      border-radius: var(--dba-radius-bar) var(--dba-radius-bar) 0 0;
    }

    .chart__bar--0 {
      background: var(--dba-chart-1);
    }

    .chart__bar--1 {
      background: var(--dba-chart-2);
    }

    .chart__bar--2 {
      background: var(--dba-chart-3);
    }

    .chart__x {
      height: 22px;
      overflow: hidden;
      padding-top: 6px;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chart__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: var(--dba-text-label);
      color: var(--dba-text);
    }

    .chart__key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .chart__swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: var(--dba-radius-bar);
    }
  `,
})
export class BarChartComponent {
  readonly categories = input.required<readonly BarChartCategory[]>();
  readonly series = input.required<readonly BarChartSeries[]>();
  readonly label = input.required<string>();
  readonly format = input<((value: number) => string) | null>(null);
  readonly integers = input(false);

  private readonly number = new Intl.NumberFormat(inject(LOCALE_ID));

  protected readonly formatter = computed(
    () => this.format() ?? ((value: number) => this.number.format(value)),
  );

  protected readonly visibleSeries = computed(() => this.series().slice(0, MAX_BAR_SERIES));

  private readonly ticks = computed(() =>
    niceTicks(
      Math.max(0, ...this.visibleSeries().flatMap((serie) => serie.values)),
      TICKS,
      this.integers() ? 1 : 0,
    ),
  );

  protected readonly top = computed(() => this.ticks().at(-1) || 1);

  protected readonly ticksDesc = computed(() => [...this.ticks()].reverse());

  protected readonly columns = computed(() => {
    const top = this.top();
    const format = this.formatter();
    return this.categories().map((category, column) => ({
      ...category,
      bars: this.visibleSeries().map((serie, index) => {
        const value = serie.values[column] ?? 0;
        return {
          key: serie.key,
          index,
          label: serie.label,
          text: format(value),
          percent: value > 0 ? Math.max((value / top) * 100, 1) : 0,
        };
      }),
    }));
  });
}
