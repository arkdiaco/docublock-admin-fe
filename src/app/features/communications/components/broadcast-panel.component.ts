import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { BroadcastComposerComponent } from './broadcast-composer.component';
import { BroadcastHistoryComponent } from './broadcast-history.component';

@Component({
  selector: 'dba-broadcast-panel',
  imports: [BroadcastComposerComponent, BroadcastHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canManage()) {
      <dba-broadcast-composer (published)="refresh.update((n) => n + 1)" />
    }
    <dba-broadcast-history [refresh]="refresh()" />
  `,
})
export class BroadcastPanelComponent {
  private readonly auth = inject(AuthStore);

  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly refresh = signal(0);
}
