import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, type Params } from '@angular/router';

export type ActionRowTone = 'bad' | 'warn' | 'info' | 'neutral';

@Component({
  selector: 'dba-action-row',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="row" [routerLink]="link()" [queryParams]="query()">
      <span class="row__dot" [class]="'row__dot row__dot--' + tone()" aria-hidden="true"></span>
      <code class="row__ref">{{ reference() }}</code>
      <span class="row__text">
        <strong class="row__subject">{{ subject() }}</strong>
        · {{ text() }}
      </span>
      <span class="row__cta">{{ cta() }}</span>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 52px;
      padding: 0 18px;
      border-bottom: 1px solid var(--dba-border-row);
      color: var(--dba-ink);
      text-decoration: none;
    }

    :host(:last-child) .row {
      border-bottom: 0;
    }

    .row:hover {
      background: var(--dba-surface-hover);
    }

    .row:focus-visible {
      outline: 2px solid var(--dba-violet-500);
      outline-offset: -2px;
    }

    .row__dot {
      flex: none;
      box-sizing: border-box;
      width: var(--dba-size-dot);
      height: var(--dba-size-dot);
      border-radius: 1px;
    }

    .row__dot--bad {
      background: var(--dba-state-suspended-dot);
    }

    .row__dot--warn {
      background: var(--dba-state-warning-dot);
    }

    .row__dot--info {
      border: 2px solid var(--dba-state-trial-dot);
      border-radius: var(--dba-radius-pill);
      background: transparent;
    }

    .row__dot--neutral {
      border-radius: 0;
      background: var(--dba-state-closed-dot);
    }

    .row__ref {
      flex: none;
      width: 96px;
      overflow: hidden;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row__text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: var(--dba-text-body);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row__subject {
      font-weight: 600;
    }

    .row__cta {
      flex: none;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
    }

    @media (max-width: 520px) {
      .row__ref {
        display: none;
      }
    }
  `,
})
export class ActionRowComponent {
  readonly tone = input<ActionRowTone>('neutral');
  readonly reference = input('');
  readonly subject = input.required<string>();
  readonly text = input.required<string>();
  readonly cta = input.required<string>();
  readonly link = input.required<string | readonly unknown[]>();
  readonly query = input<Params | null>(null);
}
