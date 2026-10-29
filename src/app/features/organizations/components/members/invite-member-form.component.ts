import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { ADMIN_ROLE_CODE, type InviteBody, type OrgRole } from '../../data/members.models';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'dba-invite-member-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="mail"
      [title]="'members.invite.title' | translate"
      [subtitle]="orgName()"
      confirmLabel="members.invite.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="500"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <dba-field
            label="members.f.identification"
            mono
            [maxlength]="30"
            [(value)]="identification"
          />
          <dba-field
            label="members.f.email"
            type="email"
            [maxlength]="160"
            [error]="emailError()"
            [(value)]="email"
          />
        </div>
        <div class="form__control">
          <label class="form__label" for="invite-role">{{ 'members.f.role' | translate }}</label>
          <p-select
            inputId="invite-role"
            [options]="roles()"
            optionLabel="name"
            optionValue="id"
            [ngModel]="roleId()"
            (ngModelChange)="roleId.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
        </div>
        <p class="dba-meta">{{ 'members.invite.hint' | translate }}</p>
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
export class InviteMemberFormComponent implements OnInit {
  readonly roles = input.required<OrgRole[]>();
  readonly orgName = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<InviteBody>();
  readonly dismissed = output<void>();

  protected readonly identification = signal('');
  protected readonly email = signal('');
  protected readonly roleId = signal<string | null>(null);
  protected readonly reason = signal('');

  protected readonly emailError = computed(() =>
    this.email().trim() && !EMAIL.test(this.email().trim()) ? 'staff.form.emailInvalid' : '',
  );

  protected readonly valid = computed(
    () =>
      this.identification().trim().length >= 3 &&
      EMAIL.test(this.email().trim()) &&
      !!this.roleId() &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    this.roleId.set(this.roles().find((role) => role.code === ADMIN_ROLE_CODE)?.id ?? null);
  }

  protected submit(): void {
    const roleId = this.roleId();
    if (!this.valid() || !roleId) return;
    this.submitted.emit({
      identification: this.identification().trim(),
      email: this.email().trim(),
      roleId,
      reason: this.reason().trim(),
    });
  }
}
