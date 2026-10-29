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
import { RoleTagComponent } from '../../../shared/ui/role-tag.component';
import {
  STAFF_ROLES,
  type GrantAccess,
  type StaffMember,
  type StaffRole,
} from '../data/staff.models';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffFormResult =
  { mode: 'grant'; data: GrantAccess } | { mode: 'role'; role: StaffRole };

@Component({
  selector: 'dba-staff-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent, RoleTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="userKey"
      [title]="(member() ? 'staff.form.roleTitle' : 'staff.form.grantTitle') | translate"
      [subtitle]="member() ? member()!.email : ('staff.form.grantLead' | translate)"
      [confirmLabel]="member() ? 'staff.form.roleConfirm' : 'staff.form.grantConfirm'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (!member()) {
          <dba-field
            label="staff.form.email"
            type="email"
            autocomplete="off"
            [maxlength]="160"
            [error]="emailError()"
            [(value)]="email"
          />
          <div class="form__pair">
            <dba-field label="staff.form.names" [maxlength]="80" [(value)]="names" />
            <dba-field label="staff.form.surNames" [maxlength]="80" [(value)]="surNames" />
          </div>
        }

        <fieldset class="roles">
          <legend class="roles__legend">{{ 'staff.form.role' | translate }}</legend>
          @for (option of roles; track option) {
            <label class="role" [class.role--on]="role() === option">
              <input
                class="role__radio"
                type="radio"
                name="staff-role"
                [value]="option"
                [checked]="role() === option"
                (change)="role.set(option)"
              />
              <span class="role__copy">
                <dba-role-tag [role]="option" />
                <span class="role__desc">{{ 'staff.roleDesc.' + option | translate }}</span>
              </span>
            </label>
          }
        </fieldset>

        @if (member()) {
          <p class="dba-meta form__note">{{ 'staff.form.roleNote' | translate }}</p>
        }
      </div>
    </db-modal-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form__pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .roles {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .roles__legend {
      margin-bottom: 6px;
      padding: 0;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    .role {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 4px;
      border-top: 1px solid var(--dba-border-row);
      cursor: pointer;
    }

    .role:hover {
      background: var(--dba-surface-hover);
    }

    .role__radio {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      accent-color: var(--dba-violet-500);
    }

    .role__radio:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .role__copy {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .role__desc {
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .form__note {
      margin: 0;
    }

    @media (max-width: 480px) {
      .form__pair {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class StaffFormComponent implements OnInit {
  readonly member = input<StaffMember | null>(null);
  readonly busy = input(false);
  readonly submitted = output<StaffFormResult>();
  readonly dismissed = output<void>();

  protected readonly roles = STAFF_ROLES;
  protected readonly email = signal('');
  protected readonly names = signal('');
  protected readonly surNames = signal('');
  protected readonly role = signal<StaffRole>('readonly');

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    return value && !EMAIL.test(value) ? 'staff.form.emailInvalid' : '';
  });

  protected readonly valid = computed(() => {
    const member = this.member();
    if (member) return this.role() !== member.role;
    return EMAIL.test(this.email().trim()) && !!this.names().trim() && !!this.surNames().trim();
  });

  ngOnInit(): void {
    const member = this.member();
    if (member) this.role.set(member.role);
  }

  protected submit(): void {
    if (!this.valid()) return;
    if (this.member()) {
      this.submitted.emit({ mode: 'role', role: this.role() });
      return;
    }
    this.submitted.emit({
      mode: 'grant',
      data: {
        email: this.email().trim(),
        names: this.names().trim(),
        surNames: this.surNames().trim(),
        role: this.role(),
      },
    });
  }
}
