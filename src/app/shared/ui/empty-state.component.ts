import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'dba-empty-state',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="empty__ring" aria-hidden="true"></span>
      <p class="empty__title">{{ titleKey() | translate }}</p>
      @if (leadKey()) {
        <p class="empty__lead">{{ leadKey() | translate }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 36px 20px;
      text-align: center;
    }

    .empty__ring {
      width: 12px;
      height: 12px;
      margin-bottom: 6px;
      border: 2px solid var(--dba-border-control);
      border-radius: var(--dba-radius-pill);
    }

    .empty__title {
      margin: 0;
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-text);
    }

    .empty__lead {
      max-width: 44ch;
      margin: 0;
      font-size: var(--dba-text-label);
      line-height: 1.5;
      color: var(--dba-text-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly titleKey = input.required<string>();
  readonly leadKey = input('');
}
