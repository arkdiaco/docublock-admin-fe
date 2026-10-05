import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { envLabelKey, type EnvName } from '../domain/environment';

@Component({
  selector: 'dba-env-pill',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="env" [class]="'env env--' + env()">
      <span class="env__dot" aria-hidden="true"></span>
      {{ labelKey() | translate }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .env {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: var(--dba-height-env);
      padding: 0 10px;
      border: 1px solid;
      border-radius: var(--dba-radius-env);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      font-weight: 600;
      letter-spacing: var(--dba-tracking-env);
      white-space: nowrap;
    }

    .env__dot {
      width: 7px;
      height: 7px;
      border-radius: var(--dba-radius-pill);
      background: var(--dot);
    }

    .env--production {
      background: var(--dba-state-active-bg);
      border-color: var(--dba-state-active-border);
      color: var(--dba-state-active-fg);
      --dot: var(--dba-state-active-dot);
    }

    .env--canary {
      background: var(--dba-state-warning-bg);
      border-color: var(--dba-state-warning-border);
      color: var(--dba-state-warning-fg);
      --dot: var(--dba-state-warning-dot);
    }

    .env--dev {
      background: var(--dba-state-closed-bg);
      border-color: var(--dba-state-closed-border);
      color: var(--dba-state-closed-fg);
      --dot: var(--dba-state-closed-dot);
    }
  `,
})
export class EnvPillComponent {
  readonly env = input.required<EnvName>();

  protected readonly labelKey = computed(() => envLabelKey(this.env()));
}
