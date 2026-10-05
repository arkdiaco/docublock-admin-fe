import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { orgStateOf } from '../domain/org-state';

export type OrgStateVariant = 'pill' | 'inline';

@Component({
  selector: 'dba-org-state',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="st" [class]="'st st--' + view().key + ' st--' + variant()">
      <span class="st__dot" [class]="'st__dot st__dot--' + view().shape" aria-hidden="true"></span>
      {{ view().labelKey | translate }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }

    .st {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: var(--dba-height-state);
      padding: 0 10px;
      border: 1px solid;
      border-radius: var(--dba-radius-pill);
      font-size: var(--dba-text-small);
      font-weight: 600;
      white-space: nowrap;
    }

    .st--inline {
      height: auto;
      padding: 0;
      border: 0;
      background: transparent;
      font-size: var(--dba-text-label);
    }

    .st--active {
      background: var(--dba-state-active-bg);
      border-color: var(--dba-state-active-border);
      color: var(--dba-state-active-fg);
      --dot: var(--dba-state-active-dot);
    }

    .st--trial {
      background: var(--dba-state-trial-bg);
      border-color: var(--dba-state-trial-border);
      color: var(--dba-state-trial-fg);
      --dot: var(--dba-state-trial-dot);
    }

    .st--warning {
      background: var(--dba-state-warning-bg);
      border-color: var(--dba-state-warning-border);
      color: var(--dba-state-warning-fg);
      --dot: var(--dba-state-warning-dot);
    }

    .st--suspended {
      background: var(--dba-state-suspended-bg);
      border-color: var(--dba-state-suspended-border);
      color: var(--dba-state-suspended-fg);
      --dot: var(--dba-state-suspended-dot);
    }

    .st--closed {
      background: var(--dba-state-closed-bg);
      border-color: var(--dba-state-closed-border);
      color: var(--dba-state-closed-fg);
      --dot: var(--dba-state-closed-dot);
    }

    .st--inline.st--active,
    .st--inline.st--trial,
    .st--inline.st--warning,
    .st--inline.st--suspended,
    .st--inline.st--closed {
      background: transparent;
      border-color: transparent;
    }

    .st__dot {
      flex: none;
      box-sizing: border-box;
      width: var(--dba-size-dot);
      height: var(--dba-size-dot);
      background: var(--dot);
    }

    .st__dot--circle {
      border-radius: var(--dba-radius-pill);
    }

    .st__dot--ring {
      border: 2px solid var(--dot);
      border-radius: var(--dba-radius-pill);
      background: transparent;
    }

    .st__dot--square {
      border-radius: 1px;
    }

    .st__dot--dash {
      height: 2px;
      border-radius: 0;
    }
  `,
})
export class OrgStateComponent {
  readonly state = input.required<string>();
  readonly variant = input<OrgStateVariant>('pill');

  protected readonly view = computed(() => orgStateOf(this.state()));
}
