import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  TargetHistoryComponent,
  type TargetHistoryLoader,
} from '../../../shared/ui/target-history.component';
import { UsersApi } from '../data/users.api';

@Component({
  selector: 'dba-user-history-tab',
  imports: [TargetHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dba-target-history [load]="load()" />`,
})
export class UserHistoryTabComponent {
  readonly userId = input.required<string>();

  private readonly api = inject(UsersApi);

  protected readonly load = computed<TargetHistoryLoader>(() => {
    const id = this.userId();
    return (page, limit) => this.api.history(id, page, limit);
  });
}
