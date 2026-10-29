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
import type { OrgMember, OrgRole } from '../../data/members.models';

@Component({
  selector: 'dba-member-role-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="userKey"
      [title]="'members.role.title' | translate: { name: member().names }"
      [subtitle]="member().email"
      confirmLabel="members.role.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <label class="form__label" for="member-role">{{ 'members.f.role' | translate }}</label>
          <p-select
            inputId="member-role"
            [options]="roles()"
            optionLabel="name"
            optionValue="id"
            [ngModel]="roleId()"
            (ngModelChange)="roleId.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
        </div>
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
export class MemberRoleFormComponent implements OnInit {
  readonly member = input.required<OrgMember>();
  readonly roles = input.required<OrgRole[]>();
  readonly busy = input(false);
  readonly submitted = output<{ roleId: string; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly roleId = signal<string | null>(null);
  protected readonly reason = signal('');

  protected readonly valid = computed(
    () => !!this.roleId() && this.roleId() !== this.member().roleId && !!this.reason().trim(),
  );

  ngOnInit(): void {
    this.roleId.set(this.member().roleId);
  }

  protected submit(): void {
    const roleId = this.roleId();
    if (this.valid() && roleId) this.submitted.emit({ roleId, reason: this.reason().trim() });
  }
}
