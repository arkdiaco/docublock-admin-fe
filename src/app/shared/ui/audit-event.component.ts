import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AuditActorKind = 'person' | 'system' | 'support' | 'unknown';

@Component({
  selector: 'dba-audit-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ev" [class.ev--last]="last()">
      <div class="ev__rail" aria-hidden="true">
        <span class="ev__dot" [class]="'ev__dot ev__dot--' + kind()"></span>
        @if (!last()) {
          <span class="ev__line"></span>
        }
      </div>
      <div class="ev__body">
        <p class="ev__text">
          @if (actor()) {
            <strong class="ev__actor">{{ actor() }}</strong>
          }
          <ng-content />
        </p>
        @if (meta()) {
          <p class="ev__meta">{{ meta() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .ev {
      display: flex;
      gap: 12px;
    }

    .ev__rail {
      display: flex;
      flex: none;
      flex-direction: column;
      align-items: center;
      width: var(--dba-size-dot-event);
    }

    .ev__dot {
      flex: none;
      box-sizing: border-box;
      width: var(--dba-size-dot-event);
      height: var(--dba-size-dot-event);
      margin-top: 5px;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-violet-500);
    }

    .ev__dot--system {
      border-radius: 1px;
      background: var(--dba-text-soft);
    }

    .ev__dot--support {
      border: 2px solid var(--dba-state-trial-dot);
      background: transparent;
    }

    .ev__dot--unknown {
      border: 2px dashed var(--dba-state-suspended-dot);
      background: transparent;
    }

    .ev__line {
      flex: 1;
      width: 1px;
      min-height: 10px;
      background: var(--dba-border-card);
    }

    .ev__body {
      flex: 1;
      min-width: 0;
      padding-bottom: 14px;
    }

    .ev--last .ev__body {
      padding-bottom: 0;
    }

    .ev__text {
      margin: 0 0 3px;
      font-size: var(--dba-text-cell);
      line-height: 1.45;
      color: var(--dba-ink);
    }

    .ev__actor {
      font-weight: 600;
    }

    .ev__meta {
      margin: 0;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      color: var(--dba-text-muted);
    }
  `,
})
export class AuditEventComponent {
  readonly kind = input<AuditActorKind>('person');
  readonly actor = input('');
  readonly meta = input('');
  readonly last = input(false, { transform: booleanAttribute });
}
