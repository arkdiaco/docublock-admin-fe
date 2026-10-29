import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import type { PeriodBody } from '../../data/subscription.models';
import { endOfDay, isFutureDay } from '../../data/form-values';

@Component({
  selector: 'dba-period-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="calendar"
      [title]="'sub.period.title' | translate"
      [subtitle]="current()"
      confirmLabel="sub.period.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field label="sub.period.until" type="date" [error]="dateError()" [(value)]="until" />
        <p class="dba-meta">{{ 'sub.period.hint' | translate }}</p>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../modal-form.scss',
})
export class PeriodFormComponent {
  readonly current = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<PeriodBody>();
  readonly dismissed = output<void>();

  protected readonly until = signal('');
  protected readonly reason = signal('');

  protected readonly dateError = computed(() =>
    this.until().trim() && !isFutureDay(this.until()) ? 'sub.error.futureDate' : '',
  );

  protected readonly valid = computed(() => isFutureDay(this.until()) && !!this.reason().trim());

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({ periodEnd: endOfDay(this.until()), reason: this.reason().trim() });
  }
}
