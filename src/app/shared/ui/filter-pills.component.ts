import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface FilterPill {
  key: string;
  labelKey: string;
  count?: number;
  danger?: boolean;
}

@Component({
  selector: 'db-filter-pills',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pills" role="group" [attr.aria-label]="label()">
      @for (pill of pills(); track pill.key) {
        <button
          type="button"
          class="pill"
          [class.pill--on]="active() === pill.key"
          [class.pill--danger]="pill.danger"
          [attr.aria-pressed]="active() === pill.key"
          (click)="activeChange.emit(pill.key)"
        >
          {{ pill.labelKey | translate }}
          @if (pill.count !== undefined) {
            <code class="pill__count">{{ pill.count }}</code>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .pills {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: var(--dba-height-pill);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-pill);
      background: var(--dba-surface);
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background 0.15s,
        border-color 0.15s;
    }

    .pill:hover {
      border-color: var(--dba-violet-300);
      background: var(--dba-surface-hover);
    }

    .pill:focus-visible {
      outline: none;
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .pill--on,
    .pill--on:hover {
      border-color: var(--dba-ink);
      background: var(--dba-ink);
      color: var(--dba-surface);
    }

    .pill--danger {
      border-color: var(--dba-state-suspended-border);
      background: var(--dba-state-suspended-bg);
      color: var(--dba-state-suspended-fg);
    }

    .pill--danger:hover {
      border-color: var(--dba-state-suspended-dot);
      background: var(--dba-state-suspended-bg);
    }

    .pill--danger.pill--on,
    .pill--danger.pill--on:hover {
      border-color: var(--dba-state-suspended-dot);
      background: var(--dba-state-suspended-dot);
      color: var(--dba-surface);
    }

    .pill__count {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      font-weight: 500;
      opacity: 0.75;
    }
  `,
})
export class FilterPillsComponent {
  readonly pills = input.required<readonly FilterPill[]>();
  readonly active = input.required<string>();
  readonly label = input('');
  readonly activeChange = output<string>();
}
