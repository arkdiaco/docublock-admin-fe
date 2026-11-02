import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  valueText: string;
  note?: string;
}

@Component({
  selector: 'dba-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bars" [attr.aria-label]="label()">
      @for (row of rows(); track row.key) {
        <li class="bars__row">
          <div class="bars__head">
            <span class="bars__label">{{ row.label }}</span>
            <code class="bars__value">{{ row.valueText }}</code>
          </div>
          <div class="bars__track" aria-hidden="true">
            <span class="bars__fill" [style.width.%]="row.percent"></span>
          </div>
          @if (row.note) {
            <span class="bars__note">{{ row.note }}</span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .bars__row {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .bars__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }

    .bars__label {
      min-width: 0;
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bars__value {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-text);
      white-space: nowrap;
    }

    .bars__track {
      height: 8px;
      overflow: hidden;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
    }

    .bars__fill {
      display: block;
      height: 100%;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-quota-ok);
    }

    .bars__note {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }
  `,
})
export class BarListComponent {
  readonly items = input.required<readonly BarListItem[]>();
  readonly label = input('');

  protected readonly rows = computed(() => {
    const items = this.items();
    const top = items.reduce((max, item) => Math.max(max, item.value), 0);
    return items.map((item) => ({
      ...item,
      percent: top > 0 ? Math.max((item.value / top) * 100, item.value > 0 ? 2 : 0) : 0,
    }));
  });
}
