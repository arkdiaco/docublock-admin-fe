import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

export type TabDot = 'warn' | 'danger';

export interface UnderlineTab {
  key: string;
  label: string;
  count?: number;
  dot?: TabDot;
  link?: readonly string[] | string;
}

@Component({
  selector: 'db-underline-tabs',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.key) {
        @if (tab.link) {
          <a
            class="tab"
            [routerLink]="tab.link"
            [class.tab--on]="tab.key === active()"
            [attr.aria-current]="tab.key === active() ? 'page' : null"
          >
            <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: tab }" />
          </a>
        } @else {
          <button
            type="button"
            class="tab"
            [class.tab--on]="tab.key === active()"
            [attr.aria-pressed]="tab.key === active()"
            (click)="picked.emit(tab.key)"
          >
            <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: tab }" />
          </button>
        }
      }
    </nav>

    <ng-template #body let-tab>
      <span class="tab__label">{{ tab.label }}</span>
      @if (tab.count !== undefined) {
        @if (tab.dot) {
          <span class="tab__flag">
            <span class="tab__dot" [class]="'tab__dot tab__dot--' + tab.dot" aria-hidden="true"></span>
            <span class="tab__count tab__count--strong" [class]="'tab__count tab__count--strong tab__count--' + tab.dot">{{ tab.count }}</span>
          </span>
        } @else {
          <span class="tab__count">{{ tab.count }}</span>
        }
      }
    </ng-template>
  `,
  styles: `
    .tabs {
      display: flex;
      align-items: center;
      gap: 26px;
      border-bottom: 1px solid var(--db-border-band);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tab {
      flex: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 0 12px;
      border: 0;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      background: none;
      font-family: var(--db-font);
      text-decoration: none;
      cursor: pointer;
    }

    .tab__label {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.012em;
      color: var(--db-ink-note-soft);
      white-space: nowrap;
    }

    .tab:hover .tab__label {
      color: var(--db-ink-strong);
    }

    .tab--on {
      border-bottom-color: var(--db-ink-strong);
    }

    .tab--on .tab__label {
      font-weight: 600;
      color: var(--db-ink-strong);
    }

    .tab__count {
      font: 500 12px var(--db-font-mono);
      font-variant-numeric: tabular-nums;
      color: var(--db-ink-soft);
    }

    .tab__flag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .tab__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .tab__dot--warn {
      background: var(--db-warn-dot);
    }

    .tab__dot--danger {
      background: var(--db-danger);
    }

    .tab__count--strong {
      font-weight: 600;
    }

    .tab__count--warn {
      color: var(--db-warn-deep);
    }

    .tab__count--danger {
      color: var(--db-danger-ink);
    }
  `,
})
export class UnderlineTabsComponent {
  readonly tabs = input.required<readonly UnderlineTab[]>();
  readonly active = input.required<string>();
  readonly label = input('');
  readonly picked = output<string>();
}
