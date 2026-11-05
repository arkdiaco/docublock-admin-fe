import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { canExecute, rehearsalNoteKey } from '../data/maintenance-view';
import type { MaintenanceTaskView } from '../data/tasks.models';
import { MaintenanceRunComponent } from './maintenance-run.component';

@Component({
  selector: 'dba-maintenance-detail',
  imports: [TranslatePipe, ButtonComponent, MaintenanceRunComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'task.mnt.' + task().key + '.name' | translate"
      [maxWidth]="680"
      [confirmLabel]="confirmLabel()"
      [confirmDisabled]="canManage() && task().running"
      [cancelable]="canManage()"
      [busy]="busy()"
      cancelLabel="common.close"
      (confirmed)="confirm()"
      (dismissed)="dismissed.emit()"
    >
      <p class="lead">{{ 'task.mnt.' + task().key + '.lead' | translate }}</p>

      <section class="part">
        <header class="part__head">
          <h3 class="dba-panel">{{ 'task.mnt.col.rehearsal' | translate }}</h3>
          @if (canManage() && executable()) {
            <button dba-button variant="secondary" [disabled]="task().running || busy()" (click)="rehearse.emit()">
              {{ 'task.mnt.rehearse.again' | translate }}
            </button>
          }
        </header>
        <p class="dba-meta part__note">{{ noteKey() | translate }}</p>
        @if (task().lastRehearsal; as rehearsal) {
          <dba-maintenance-run [run]="rehearsal" />
        }
      </section>

      @if (task().lastExecution; as execution) {
        <section class="part">
          <h3 class="dba-panel">{{ 'task.mnt.col.execution' | translate }}</h3>
          <dba-maintenance-run [run]="execution" />
        </section>
      }
    </db-modal-shell>
  `,
  styles: `
    .lead {
      margin: 0 0 16px;
      font-size: var(--dba-text-body);
      line-height: 1.45;
    }

    .part + .part {
      margin-top: 20px;
    }

    .part__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .part h3 {
      margin: 0 0 8px;
    }

    .part__note {
      margin: 0 0 12px;
    }
  `,
})
export class MaintenanceDetailComponent {
  readonly task = input.required<MaintenanceTaskView>();
  readonly busy = input(false);
  readonly rehearse = output<void>();
  readonly execute = output<void>();
  readonly dismissed = output<void>();

  private readonly auth = inject(AuthStore);

  protected readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly executable = computed(() => canExecute(this.task()));
  protected readonly noteKey = computed(() => rehearsalNoteKey(this.task()));
  protected readonly confirmLabel = computed(() => {
    if (!this.canManage()) return 'common.close';
    if (this.executable()) return 'task.mnt.execute.action';
    return this.task().lastRehearsal ? 'task.mnt.rehearse.again' : 'task.mnt.rehearse.action';
  });

  protected confirm(): void {
    if (!this.canManage()) this.dismissed.emit();
    else if (this.executable()) this.execute.emit();
    else this.rehearse.emit();
  }
}
