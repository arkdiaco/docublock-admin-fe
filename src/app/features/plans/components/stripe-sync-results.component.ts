import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type { StripeSyncResult } from '../data/stripe-sync-view';

@Component({
  selector: 'dba-stripe-sync-results',
  imports: [TranslatePipe, ModalShellComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="chain"
      [title]="'plans.sync.resultsTitle' | translate"
      [subtitle]="'plans.sync.resultsLead' | translate: { ok: okCount(), failed: failedCount() }"
      [maxWidth]="620"
      confirmLabel="common.close"
      [cancelable]="false"
      (confirmed)="dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <ul class="sr">
        @for (result of results(); track result.code) {
          <li class="sr__row">
            <span class="sr__plan">
              <span class="sr__name">{{ result.name }}</span>
              <code class="sr__code">{{ result.code }}</code>
            </span>
            <span class="sr__outcome">
              <dba-org-state
                [state]="result.ok ? 'active' : 'suspended'"
                [labelKey]="result.ok ? 'plans.sync.published' : 'plans.sync.failed'"
                variant="inline"
              />
              @if (!result.ok) {
                <span class="dba-meta sr__message">{{ result.message }}</span>
              }
            </span>
          </li>
        }
      </ul>
    </db-modal-shell>
  `,
  styles: `
    .sr {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sr__row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--dba-border);
    }

    .sr__row:last-child {
      border-bottom: 0;
    }

    .sr__plan,
    .sr__outcome {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sr__name {
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .sr__code {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .sr__message {
      overflow-wrap: anywhere;
    }
  `,
})
export class StripeSyncResultsComponent {
  readonly results = input.required<StripeSyncResult[]>();
  readonly dismissed = output<void>();

  protected readonly okCount = computed(() => this.results().filter((r) => r.ok).length);
  protected readonly failedCount = computed(() => this.results().filter((r) => !r.ok).length);
}
