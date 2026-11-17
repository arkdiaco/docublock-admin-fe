import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChoiceListComponent, type ChoiceOption } from '../../../shared/ui/choice-list.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { ResellerModel } from '../data/resellers.models';

const OPTIONS: readonly ChoiceOption[] = [
  { value: 'POOL', labelKey: 'rsl.model.POOL', leadKey: 'rsl.detail.model.POOL.lead' },
  { value: 'PLANS', labelKey: 'rsl.model.PLANS', leadKey: 'rsl.detail.model.PLANS.lead' },
];

@Component({
  selector: 'dba-reseller-model-form',
  imports: [TranslatePipe, ModalShellComponent, ChoiceListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="blocks"
      [title]="'rsl.detail.model.title' | translate"
      [subtitle]="subtitle()"
      confirmLabel="rsl.detail.model.confirm"
      [confirmDisabled]="!choice()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-choice-list
          [options]="options"
          [value]="choice()"
          [label]="'rsl.detail.model.title' | translate"
          [disabled]="busy()"
          (picked)="choice.set($any($event))"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ResellerModelFormComponent {
  readonly current = input<ResellerModel | null>(null);
  readonly subtitle = input('');
  readonly busy = input(false);
  readonly submitted = output<ResellerModel>();
  readonly dismissed = output<void>();

  protected readonly options = OPTIONS;
  protected readonly choice = linkedSignal<ResellerModel | null>(() => this.current());

  protected submit(): void {
    const choice = this.choice();
    if (choice) this.submitted.emit(choice);
  }
}
