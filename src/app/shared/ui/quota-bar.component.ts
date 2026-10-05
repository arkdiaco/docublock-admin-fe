import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { quotaToneOf } from '../domain/org-state';

@Component({
  selector: 'dba-quota-bar',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quota">
      <div class="quota__head">
        <span class="quota__label">{{ label() | translate }}</span>
        <code class="quota__value" [class]="'quota__value quota__value--' + tone()">{{ valueText() }}</code>
      </div>
      <div
        class="quota__track"
        role="meter"
        [attr.aria-label]="label() | translate"
        [attr.aria-valuenow]="used()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="limit() ?? used()"
      >
        <span class="quota__fill" [class]="'quota__fill quota__fill--' + tone()" [style.width.%]="percent()"></span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .quota__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }

    .quota__label {
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .quota__value {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-text);
      white-space: nowrap;
    }

    .quota__value--warn {
      color: var(--dba-state-warning-fg);
    }

    .quota__value--over {
      color: var(--dba-state-suspended-fg);
    }

    .quota__track {
      display: flex;
      height: 8px;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
      overflow: hidden;
    }

    .quota__fill {
      display: block;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-quota-ok);
      transition: width 0.2s;
    }

    .quota__fill--warn {
      background: var(--dba-quota-warn);
    }

    .quota__fill--over {
      background: var(--dba-quota-over);
    }
  `,
})
export class QuotaBarComponent {
  readonly label = input.required<string>();
  readonly used = input.required<number>();
  readonly limit = input.required<number | null>();
  readonly valueText = input.required<string>();

  protected readonly tone = computed(() => quotaToneOf(this.used(), this.limit()));
  protected readonly percent = computed(() => {
    const limit = this.limit();
    if (!limit || limit <= 0) return 0;
    return Math.min(100, (this.used() / limit) * 100);
  });
}
