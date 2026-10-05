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
            <span class="pill__count">{{ pill.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .pills {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 33px;
      padding: 0 13px;
      border: 1px solid var(--db-border-subtle);
      border-radius: var(--db-radius-pill);
      background: var(--db-surface);
      font-family: var(--db-font);
      font-size: var(--db-text-small);
      font-weight: 500;
      color: var(--db-ink-muted);
      white-space: nowrap;
      cursor: pointer;
    }

    .pill:hover {
      background: var(--db-surface-sunken);
    }

    .pill--on {
      border: 0;
      background: var(--db-primary);
      font-weight: 600;
      color: var(--db-primary-contrast);
    }

    .pill--on:hover {
      background: var(--db-primary-ink);
    }

    .pill--danger {
      border-color: var(--db-danger-border);
      background: var(--db-danger-tint);
      font-weight: 600;
      color: var(--db-danger-ink);
    }

    .pill--danger:hover {
      background: var(--db-danger-wash);
    }

    .pill--danger .pill__count {
      color: var(--db-danger-ink);
    }

    .pill--danger.pill--on {
      background: var(--db-danger);
      color: var(--db-primary-contrast);
    }

    .pill--danger.pill--on:hover {
      background: var(--db-danger-ink);
    }

    .pill--danger.pill--on .pill__count {
      color: var(--db-primary-contrast);
    }

    .pill__count {
      font-family: var(--db-font-mono);
      font-size: var(--db-text-nano);
      font-weight: 600;
      color: var(--db-ink-ghost);
    }

    .pill--on .pill__count {
      color: var(--db-primary-contrast);
    }
  `,
})
export class FilterPillsComponent {
  readonly pills = input.required<readonly FilterPill[]>();
  readonly active = input.required<string>();
  readonly label = input('');
  readonly activeChange = output<string>();
}
