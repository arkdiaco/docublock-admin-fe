import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { MaintenanceRun } from '../data/tasks.models';
import { MaintenanceRunComponent } from './maintenance-run.component';

@Component({
  selector: 'dba-maintenance-run-detail',
  imports: [TranslatePipe, MaintenanceRunComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="clock"
      [title]="'task.mnt.' + run().task + '.name' | translate"
      [subtitle]="'task.mnt.mode.' + run().mode | translate"
      [maxWidth]="620"
      confirmLabel="common.close"
      [cancelable]="false"
      (confirmed)="dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dba-maintenance-run [run]="run()" />
    </db-modal-shell>
  `,
})
export class MaintenanceRunDetailComponent {
  readonly run = input.required<MaintenanceRun>();
  readonly dismissed = output<void>();
}
