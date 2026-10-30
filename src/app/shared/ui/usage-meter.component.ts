import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { quotaToneOf } from '../domain/org-state';

@Component({
  selector: 'dba-usage-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <code class="usage__value">{{ text() }}</code>
    <span class="usage__track" aria-hidden="true">
      <span [class]="'usage__fill usage__fill--' + tone()" [style.width]="percent()"></span>
    </span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .usage__value {
      flex: none;
      width: 72px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
      white-space: nowrap;
    }

    .usage__track {
      flex: 1;
      display: flex;
      height: 5px;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
      overflow: hidden;
    }

    .usage__fill {
      background: var(--dba-quota-ok);
    }

    .usage__fill--warn {
      background: var(--dba-quota-warn);
    }

    .usage__fill--over {
      background: var(--dba-quota-over);
    }
  `,
})
export class UsageMeterComponent {
  readonly used = input.required<number>();
  readonly limit = input<number | null>(null);

  protected readonly text = computed(
    () => `${this.used()} / ${this.limit() === null ? '∞' : this.limit()}`,
  );
  protected readonly tone = computed(() => quotaToneOf(this.used(), this.limit()));
  protected readonly percent = computed(() => {
    const limit = this.limit();
    return `${limit && limit > 0 ? Math.min(100, (this.used() / limit) * 100) : 0}%`;
  });
}
