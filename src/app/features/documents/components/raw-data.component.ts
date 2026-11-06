import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import type { RawDocument } from '../data/documents.models';
import { hiddenGroupsOf } from '../data/summary-view';

@Component({
  selector: 'dba-raw-data',
  imports: [TranslatePipe, ModalShellComponent, SectionLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="listBullets"
      [title]="'docs.raw.title' | translate"
      [subtitle]="subtitle()"
      [maxWidth]="760"
      confirmLabel="common.close"
      [cancelable]="false"
      (confirmed)="dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      @if (failed()) {
        <p class="raw__note">{{ 'docs.raw.error' | translate }}</p>
      } @else if (view(); as raw) {
        @if (groups().length) {
          <p class="dba-eyebrow raw__eyebrow">{{ 'docs.raw.hiddenTitle' | translate }}</p>
          <dl class="raw__hidden">
            @for (group of groups(); track group.reason) {
              <dt>{{ 'docs.raw.reason.' + group.reason | translate }}</dt>
              <dd class="dba-mono">{{ group.paths.join(', ') }}</dd>
            }
          </dl>
        }
        <pre class="raw__code dba-mono">{{ text() }}</pre>
        <p class="raw__note">{{ 'docs.raw.audited' | translate }}</p>
      } @else {
        <db-section-loader [label]="'docs.raw.loading' | translate" />
      }
    </db-modal-shell>
  `,
  styles: `
    .raw__eyebrow {
      margin: 0 0 8px;
    }

    .raw__hidden {
      display: grid;
      grid-template-columns: minmax(120px, 200px) minmax(0, 1fr);
      gap: 6px 16px;
      margin: 0 0 14px;
      font-size: var(--dba-text-label);
    }

    .raw__hidden dt {
      color: var(--dba-text-muted);
    }

    .raw__hidden dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--dba-ink);
    }

    .raw__code {
      margin: 0;
      padding: 12px;
      max-height: 56vh;
      overflow: auto;
      border: 1px solid var(--dba-border);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-size: var(--dba-text-small);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .raw__note {
      margin: 12px 0 0;
      font-size: var(--dba-text-label);
      color: var(--dba-text-soft);
    }

    @media (max-width: 520px) {
      .raw__hidden {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .raw__hidden dd {
        margin-bottom: 6px;
      }
    }
  `,
})
export class RawDataComponent {
  readonly subtitle = input('');
  readonly view = input<RawDocument | null>(null);
  readonly failed = input(false);
  readonly dismissed = output<void>();

  protected readonly groups = computed(() => hiddenGroupsOf(this.view()?.hidden ?? []));
  protected readonly text = computed(() => JSON.stringify(this.view()?.data ?? {}, null, 2));
}
