import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { UsersApi } from '../data/users.api';
import type { OrganizationRole, UserMembership } from '../data/users.models';

@Component({
  selector: 'dba-membership-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ModalShellComponent,
    FieldComponent,
    OrgPickerComponent,
    Select,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="membership() ? 'userKey' : 'plus'"
      [title]="
        membership()
          ? ('usr.membership.roleTitle' | translate: { org: orgName() })
          : ('usr.membership.addTitle' | translate)
      "
      [subtitle]="userName()"
      [confirmLabel]="membership() ? 'usr.membership.roleConfirm' : 'usr.membership.addConfirm'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="480"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (!membership()) {
          <div class="form__control">
            <span class="form__label">{{ 'usr.membership.organization' | translate }}</span>
            <dba-org-picker
              anyKey="usr.membership.pickOrg"
              [value]="orgId()"
              (picked)="pickOrg($event)"
            />
            @if (alreadyMember()) {
              <p class="form__note">{{ 'usr.membership.already' | translate }}</p>
            }
          </div>
        }
        <div class="form__control">
          <label class="form__label" for="membership-role">{{
            'usr.membership.role' | translate
          }}</label>
          <p-select
            inputId="membership-role"
            [options]="roles()"
            optionLabel="name"
            optionValue="id"
            [disabled]="!orgId() || alreadyMember()"
            [placeholder]="
              (rolesLoading() ? 'usr.membership.rolesLoading' : 'usr.membership.rolePlaceholder')
                | translate
            "
            [ngModel]="roleId()"
            (ngModelChange)="roleId.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
          @if (rolesError()) {
            <p class="form__note">{{ 'usr.membership.rolesError' | translate }}</p>
          }
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
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class MembershipFormComponent implements OnInit {
  readonly userName = input.required<string>();
  readonly memberOf = input.required<readonly string[]>();
  readonly membership = input<UserMembership | null>(null);
  readonly orgName = input('');
  readonly busy = input(false);
  readonly submitted = output<{ orgId: string; roleId: string; reason: string }>();
  readonly dismissed = output<void>();

  private readonly api = inject(UsersApi);
  private readonly latest = new LatestRequest();

  protected readonly orgId = signal<string | null>(null);
  protected readonly roleId = signal<string | null>(null);
  protected readonly roles = signal<OrganizationRole[]>([]);
  protected readonly rolesLoading = signal(false);
  protected readonly rolesError = signal(false);
  protected readonly reason = signal('');

  protected readonly alreadyMember = computed(() => {
    const orgId = this.orgId();
    return !this.membership() && !!orgId && this.memberOf().includes(orgId);
  });
  protected readonly canSave = computed(() => {
    const roleId = this.roleId();
    return (
      !!this.orgId() &&
      !!roleId &&
      !this.alreadyMember() &&
      roleId !== this.membership()?.roleId &&
      !!this.reason().trim()
    );
  });

  ngOnInit(): void {
    const membership = this.membership();
    if (!membership) return;
    this.orgId.set(membership.organizationId);
    this.roleId.set(membership.roleId);
    void this.loadRoles(membership.organizationId);
  }

  protected pickOrg(orgId: string | null): void {
    this.orgId.set(orgId);
    this.roleId.set(null);
    this.roles.set([]);
    this.rolesError.set(false);
    if (orgId && !this.memberOf().includes(orgId)) void this.loadRoles(orgId);
  }

  protected submit(): void {
    const orgId = this.orgId();
    const roleId = this.roleId();
    if (this.canSave() && orgId && roleId) {
      this.submitted.emit({ orgId, roleId, reason: this.reason().trim() });
    }
  }

  private async loadRoles(orgId: string): Promise<void> {
    const current = this.latest.start();
    this.rolesLoading.set(true);
    this.rolesError.set(false);
    try {
      const roles = await firstValueFrom(this.api.roles(orgId));
      if (current()) this.roles.set(roles);
    } catch {
      if (current()) this.rolesError.set(true);
    } finally {
      if (current()) this.rolesLoading.set(false);
    }
  }
}
