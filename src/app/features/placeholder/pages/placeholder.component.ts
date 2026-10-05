import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'dba-placeholder',
  imports: [TranslatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ph">
      <header class="ph__head">
        <span class="dba-eyebrow">{{ 'nav.crumbRoot' | translate }}</span>
        <h1 class="dba-page">{{ titleKey() | translate }}</h1>
      </header>
      <div class="ph__panel">
        <dba-empty-state titleKey="placeholder.title" leadKey="placeholder.lead" />
      </div>
    </section>
  `,
  styles: `
    .ph {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .ph__head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ph__panel {
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }
  `,
})
export class PlaceholderComponent {
  readonly titleKey = input.required<string>();
}
