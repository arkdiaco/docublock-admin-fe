import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { EMAIL_PATTERN } from '../data/billing-view';

@Component({
  selector: 'dba-invoice-send-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="'billing.id.sendForm.title' | translate"
      [subtitle]="'billing.id.sendForm.subtitle' | translate: { number: number() }"
      confirmLabel="billing.id.sendForm.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field
          label="billing.id.sendForm.email"
          type="email"
          autocomplete="off"
          [error]="problem() ? 'billing.id.sendForm.invalid' : ''"
          [(value)]="email"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class InvoiceSendFormComponent implements OnInit {
  readonly number = input.required<string>();
  readonly initialEmail = input('');
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly email = signal('');
  protected readonly valid = computed(() => EMAIL_PATTERN.test(this.email().trim()));
  protected readonly problem = computed(() => this.email().trim() !== '' && !this.valid());

  ngOnInit(): void {
    this.email.set(this.initialEmail());
  }

  protected submit(): void {
    if (this.valid()) this.submitted.emit(this.email().trim());
  }
}
