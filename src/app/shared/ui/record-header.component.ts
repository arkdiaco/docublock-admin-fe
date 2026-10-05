import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { OrgStateComponent } from './org-state.component';

@Component({
  selector: 'dba-record-header',
  imports: [TranslatePipe, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (crumbs().length) {
      <nav class="rec__crumbs" [attr.aria-label]="'shell.crumbs' | translate">
        @for (crumb of crumbs(); track $index) {
          @if ($index > 0) {
            <span class="rec__sep" aria-hidden="true">/</span>
          }
          <span class="rec__crumb" [class.rec__crumb--last]="$last">{{ crumb | translate }}</span>
        }
      </nav>
    }

    <div class="rec__card">
      <span class="rec__avatar" aria-hidden="true">{{ initials() }}</span>
      <div class="rec__body">
        <div class="rec__line">
          <h1 class="rec__name">{{ title() }}</h1>
          @if (state()) {
            <dba-org-state [state]="state()!" [labelKey]="stateLabelKey()" />
          }
        </div>
        @if (meta()) {
          <p class="rec__meta">{{ meta() }}</p>
        }
      </div>
      <div class="rec__actions">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .rec__crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      letter-spacing: var(--dba-tracking-th);
      text-transform: uppercase;
      color: var(--dba-text-muted);
    }

    .rec__crumb--last {
      color: var(--dba-ink);
    }

    .rec__card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .rec__avatar {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: var(--dba-ink);
      font-family: var(--dba-font-display);
      font-size: var(--dba-text-section);
      font-weight: 600;
      color: var(--dba-surface);
    }

    .rec__body {
      flex: 1;
      min-width: 0;
    }

    .rec__line {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .rec__name {
      margin: 0;
      font-family: var(--dba-font-display);
      font-size: 24px;
      font-weight: 600;
      letter-spacing: var(--dba-tracking-display);
      color: var(--dba-ink);
    }

    .rec__meta {
      margin: 4px 0 0;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rec__actions {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 640px) {
      .rec__card {
        flex-wrap: wrap;
      }

      .rec__actions {
        width: 100%;
      }
    }
  `,
})
export class RecordHeaderComponent {
  readonly crumbs = input<readonly string[]>([]);
  readonly initials = input.required<string>();
  readonly title = input.required<string>();
  readonly state = input<string | null>(null);
  readonly stateLabelKey = input('');
  readonly meta = input('');
}
