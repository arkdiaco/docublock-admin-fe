import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type KpiDeltaTone = 'plain' | 'good' | 'warn' | 'bad';

@Component({
  selector: 'dba-kpi-card',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi" [class.kpi--dense]="dense()">
      <p class="kpi__label">{{ label() | translate }}</p>
      <p class="kpi__value">{{ value() }}</p>
      @if (delta()) {
        <p class="kpi__delta" [class]="'kpi__delta kpi__delta--' + deltaTone()">{{ delta() }}</p>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .kpi {
      box-sizing: border-box;
      height: 100%;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .kpi--dense {
      padding: 14px 16px;
      border-radius: var(--dba-radius-card);
    }

    .kpi__label {
      margin: 0 0 8px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text-muted);
    }

    .kpi--dense .kpi__label {
      margin-bottom: 6px;
    }

    .kpi__value {
      margin: 0;
      font-family: var(--dba-font-display);
      font-size: var(--dba-text-kpi);
      font-weight: 600;
      line-height: 1;
      letter-spacing: var(--dba-tracking-display);
      color: var(--dba-ink);
      font-variant-numeric: tabular-nums;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .kpi--dense .kpi__value {
      font-size: var(--dba-text-page);
    }

    .kpi__delta {
      margin: 10px 0 0;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .kpi--dense .kpi__delta {
      margin-top: 8px;
    }

    .kpi__delta--good {
      color: var(--dba-state-active-fg);
    }

    .kpi__delta--warn {
      color: var(--dba-state-warning-fg);
    }

    .kpi__delta--bad {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input('');
  readonly deltaTone = input<KpiDeltaTone>('plain');
  readonly dense = input(false, { transform: booleanAttribute });
}
