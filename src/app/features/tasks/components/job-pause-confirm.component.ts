import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { JobKey, JobView } from '../data/tasks.models';

const CRITICAL_JOBS: ReadonlySet<JobKey> = new Set(['closing', 'provisioning']);

@Component({
  selector: 'dba-job-pause-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="resuming() ? 'play' : 'stop'"
      [title]="(resuming() ? 'task.job.pause.resumeTitle' : 'task.job.pause.title') | translate"
      [subtitle]="'task.job.' + job().key + '.name' | translate"
      [confirmLabel]="resuming() ? 'task.job.pause.resumeConfirm' : 'task.job.pause.confirm'"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (resuming()) {
          <p class="sum">{{ 'task.job.pause.resumeNotice' | translate }}</p>
        } @else {
          @if (critical()) {
            <p class="notice" role="note">{{ 'task.job.pause.critical' | translate }}</p>
          }
          <p class="sum">{{ 'task.job.pause.notice' | translate }}</p>
        }
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class JobPauseConfirmComponent {
  readonly job = input.required<JobView>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly resuming = computed(() => !!this.job().pause);
  protected readonly critical = computed(() => CRITICAL_JOBS.has(this.job().key));

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}
