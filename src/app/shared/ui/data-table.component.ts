import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';

export interface DataColumn {
  key: string;
  labelKey?: string;
  width: string;
  align?: 'start' | 'end' | 'center';
}

type PageItem = number | 'gap';

export const pageWindow = (page: number, pageCount: number): PageItem[] => {
  if (pageCount <= 1) return [1];
  const items: PageItem[] = [];
  const add = (n: number) => items.push(n);
  const near = (n: number) => n === 1 || n === pageCount || Math.abs(n - page) <= 1;
  let gapOpen = false;
  for (let n = 1; n <= pageCount; n += 1) {
    if (near(n)) {
      add(n);
      gapOpen = false;
    } else if (!gapOpen) {
      items.push('gap');
      gapOpen = true;
    }
  }
  return items;
};

@Component({
  selector: 'dba-data-table',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--dba-cols]': 'cols()', '[style.--dba-row-h]': 'rowHeight()' },
  template: `
    <div class="tbl" [attr.aria-label]="label()">
      <div class="tbl__head" role="row">
        @for (col of columns(); track col.key) {
          <span class="tbl__th" [class.tbl__th--end]="col.align === 'end'" [class.tbl__th--center]="col.align === 'center'">
            @if (col.labelKey) {
              {{ col.labelKey | translate }}
            }
          </span>
        }
      </div>

      <div class="tbl__body">
        <ng-content />
      </div>

      @if (total() !== null) {
        <div class="tbl__foot">
          <span class="tbl__range">{{ 'tbl.range' | translate: { from: from(), to: to(), total: total() } }}</span>
          <nav class="tbl__pager" [attr.aria-label]="'common.pagination' | translate">
            <button
              type="button"
              class="tbl__step"
              [attr.aria-label]="'common.prevPage' | translate"
              [disabled]="page() <= 1"
              (click)="pageChange.emit(page() - 1)"
            >
              <db-icon name="chevronLeft" [size]="13" />
            </button>
            @for (item of items(); track $index) {
              @if (item === 'gap') {
                <span class="tbl__gap" aria-hidden="true">…</span>
              } @else {
                <button
                  type="button"
                  class="tbl__page"
                  [class.tbl__page--on]="item === page()"
                  [attr.aria-current]="item === page() ? 'page' : null"
                  (click)="pageChange.emit(item)"
                >
                  {{ item }}
                </button>
              }
            }
            <button
              type="button"
              class="tbl__step"
              [attr.aria-label]="'common.nextPage' | translate"
              [disabled]="page() >= pageCount()"
              (click)="pageChange.emit(page() + 1)"
            >
              <db-icon name="chevronRight" [size]="13" />
            </button>
          </nav>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .tbl {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
      overflow: clip;
    }

    .tbl__head {
      display: grid;
      grid-template-columns: var(--dba-cols);
      gap: 12px;
      align-items: center;
      height: var(--dba-height-table-head);
      padding: 0 18px;
      border-bottom: 1px solid var(--dba-border-card);
      background: var(--dba-surface-head);
    }

    .tbl__th {
      min-width: 0;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-th);
      font-weight: 500;
      letter-spacing: var(--dba-tracking-th);
      text-transform: uppercase;
      color: var(--dba-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tbl__th--end {
      text-align: right;
    }

    .tbl__th--center {
      text-align: center;
    }

    .tbl__body {
      display: flex;
      flex-direction: column;
    }

    .tbl__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      height: var(--dba-height-control);
      padding: 0 18px;
      border-top: 1px solid var(--dba-border-card);
    }

    .tbl__range {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      color: var(--dba-text-muted);
    }

    .tbl__pager {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .tbl__step,
    .tbl__page {
      display: grid;
      place-items: center;
      min-width: 26px;
      height: 26px;
      padding: 0 6px;
      border: 0;
      border-radius: var(--dba-radius-key);
      background: transparent;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .tbl__step {
      color: var(--dba-text-soft);
    }

    .tbl__step:disabled {
      color: var(--dba-text-faint);
      cursor: not-allowed;
    }

    .tbl__page:hover,
    .tbl__step:not(:disabled):hover {
      background: var(--dba-surface-chip);
    }

    .tbl__page--on,
    .tbl__page--on:hover {
      background: var(--dba-violet-100);
      color: var(--dba-violet-700);
    }

    .tbl__gap {
      padding: 0 2px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      color: var(--dba-text-faint);
    }
  `,
})
export class DataTableComponent {
  readonly columns = input.required<readonly DataColumn[]>();
  readonly dense = input(false);
  readonly label = input('');
  readonly total = input<number | null>(null);
  readonly from = input(0);
  readonly to = input(0);
  readonly page = input(1);
  readonly pageCount = input(1);
  readonly pageChange = output<number>();

  protected readonly cols = computed(() => this.columns().map((c) => c.width).join(' '));
  protected readonly rowHeight = computed(() =>
    this.dense() ? 'var(--dba-height-row-dense)' : 'var(--dba-height-row)',
  );
  protected readonly items = computed(() => pageWindow(this.page(), this.pageCount()));
}
