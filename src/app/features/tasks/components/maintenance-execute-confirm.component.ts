import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { MaintenanceTaskView } from '../data/tasks.models';

@Component({
  selector: 'dba-maintenance-execute-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'task.mnt.execute.title' | translate"
      [subtitle]="'task.mnt.' + task().key + '.name' | translate"
      confirmLabel="task.mnt.execute.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="sum">{{ 'task.mnt.execute.affected' | translate: { count: task().lastRehearsal?.pending ?? 0 } }}</p>
        <p class="notice" role="note">{{ 'task.mnt.' + task().key + '.notice' | translate }}</p>
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class MaintenanceExecuteConfirmComponent {
  readonly task = input.required<MaintenanceTaskView>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}
