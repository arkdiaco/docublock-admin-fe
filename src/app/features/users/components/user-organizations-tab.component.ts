import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import type { DialogRequest } from '../../../shared/ui/dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { USER_ERRORS, UsersApi } from '../data/users.api';
import type { PlatformUserDetail, UserMembership } from '../data/users.models';
import { MembershipFormComponent } from './membership-form.component';

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'usr.detail.col.organization', width: 'minmax(0, 1.5fr)' },
  { key: 'role', labelKey: 'usr.detail.col.role', width: 'minmax(0, 0.9fr)' },
  { key: 'contact', labelKey: 'usr.detail.col.contact', width: 'minmax(0, 1.1fr)' },
  { key: 'state', labelKey: 'usr.detail.col.state', width: '110px' },
  { key: 'actions', width: '40px', align: 'end' },
];

type Form = { kind: 'add' } | { kind: 'role'; membership: UserMembership };

@Component({
  selector: 'dba-user-organizations-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    MembershipFormComponent,
    OrgStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canManage()) {
      <div class="bd__actions">
        <button dba-button (click)="form.set({ kind: 'add' })">
          <db-icon name="plus" [size]="15" />
          {{ 'usr.membership.add' | translate }}
        </button>
      </div>
    }

    @if (user().memberships.length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.detail.noOrgsTitle" leadKey="usr.detail.noOrgsLead" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'usr.detail.organizationsLabel' | translate"
        [dense]="density.compact()"
        minWidth="760px"
      >
        @for (row of user().memberships; track $index) {
          <div class="dba-tr">
            <span class="dba-td cell">
              <a class="bd__link cell__label" [routerLink]="[orgsPath, row.organizationId]">{{
                orgOf(row)
              }}</a>
              <span class="cell__meta">
                <span class="dba-mono">{{ row.tributaryNumber || '—' }}</span>
                @if (row.personal) {
                  · {{ 'usr.detail.personal' | translate }}
                }
                @if (row.duplicate) {
                  · {{ 'usr.membership.duplicateTag' | translate }}
                }
              </span>
            </span>
            <span class="dba-td cell">
              <span class="cell__text">{{
                row.roleName || ('usr.detail.roleMissing' | translate)
              }}</span>
              @if (row.branchType) {
                <span class="cell__meta">{{
                  'usr.detail.branch.' + row.branchType | translate
                }}</span>
              }
            </span>
            <span class="dba-td cell">
              <span class="cell__text">{{ row.email || '—' }}</span>
              <span class="cell__meta dba-mono">{{ row.phone || '—' }}</span>
            </span>
            <span class="dba-td">
              <dba-org-state
                [state]="row.active ? 'active' : 'suspended'"
                [labelKey]="row.active ? 'usr.state.active' : 'usr.state.inactive'"
                variant="inline"
              />
            </span>
            <span class="dba-td dba-td--end">
              @if (canManage()) {
                <button
                  type="button"
                  class="uo__more"
                  [attr.aria-label]="'usr.membership.actionsFor' | translate: { org: orgOf(row) }"
                  (click)="acting.set(row); actions.toggle($event)"
                >
                  <db-icon name="moreVertical" [size]="16" />
                </button>
              }
            </span>
          </div>
        }
      </dba-data-table>
    }

    <dba-action-menu
      #actions
      label="usr.membership.actions"
      [items]="actionItems()"
      (picked)="onAction($event)"
    />

    @if (form(); as open) {
      <dba-membership-form
        [userName]="fullName()"
        [memberOf]="memberOf()"
        [membership]="open.kind === 'role' ? open.membership : null"
        [orgName]="open.kind === 'role' ? orgOf(open.membership) : ''"
        [busy]="working()"
        (submitted)="submitForm($event)"
        (dismissed)="form.set(null)"
      />
    }
  `,
  styles: `
    .uo__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .uo__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .uo__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class UserOrganizationsTabComponent {
  readonly user = input.required<PlatformUserDetail>();
  readonly changed = output<PlatformUserDetail>();

  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly working = signal(false);
  protected readonly form = signal<Form | null>(null);
  protected readonly acting = signal<UserMembership | null>(null);
  protected readonly fullName = computed(() =>
    `${this.user().names} ${this.user().surNames}`.trim(),
  );
  protected readonly memberOf = computed(() =>
    this.user().memberships.map((membership) => membership.organizationId),
  );
  protected readonly actionItems = computed<ActionMenuItem[]>(() => {
    const row = this.acting();
    return [
      { key: 'role', labelKey: 'usr.membership.menu.role' },
      row?.active
        ? { key: 'deactivate', labelKey: 'usr.membership.menu.deactivate' }
        : { key: 'activate', labelKey: 'usr.membership.menu.activate' },
      ...(row?.duplicate && row.membershipId
        ? [{ key: 'duplicate', labelKey: 'usr.membership.menu.duplicate', separated: true }]
        : []),
      {
        key: 'remove',
        labelKey: 'usr.membership.menu.remove',
        danger: true,
        separated: !row?.duplicate,
      },
    ];
  });

  protected orgOf(row: UserMembership): string {
    return row.organizationName || this.label('usr.detail.orgMissing');
  }

  protected onAction(key: string): void {
    const row = this.acting();
    if (!row) return;
    if (key === 'role') this.form.set({ kind: 'role', membership: row });
    if (key === 'activate' || key === 'deactivate') void this.setState(row, key === 'activate');
    if (key === 'duplicate') void this.removeDuplicate(row);
    if (key === 'remove') void this.remove(row);
  }

  protected async submitForm(value: {
    orgId: string;
    roleId: string;
    reason: string;
  }): Promise<void> {
    const open = this.form();
    if (!open) return;
    const id = this.user().id;
    const request =
      open.kind === 'add'
        ? this.api.addMembership(id, value.orgId, value.roleId, value.reason)
        : this.api.updateMembership(id, value.orgId, { roleId: value.roleId }, value.reason);
    const updated = await this.run(request);
    if (!updated) return;
    this.form.set(null);
    const org =
      updated.memberships.find((m) => m.organizationId === value.orgId)?.organizationName ?? '';
    this.notify.success(
      this.label(open.kind === 'add' ? 'usr.membership.added' : 'usr.membership.roleChanged', {
        org,
      }),
    );
  }

  private async setState(row: UserMembership, activate: boolean): Promise<void> {
    const params = this.paramsOf(row);
    const reason = await this.ask({
      intent: activate ? 'primary' : 'danger',
      icon: activate ? 'circleCheck' : 'lock',
      title: activate ? 'usr.membership.activateTitle' : 'usr.membership.deactivateTitle',
      message: activate ? 'usr.membership.activateMessage' : 'usr.membership.deactivateMessage',
      params,
      confirmLabel: activate ? 'usr.membership.menu.activate' : 'usr.membership.menu.deactivate',
    });
    if (!reason) return;
    const updated = await this.run(
      this.api.updateMembership(
        this.user().id,
        row.organizationId,
        { state: activate ? 1 : 0 },
        reason,
      ),
    );
    if (updated) {
      this.notify.success(
        this.label(activate ? 'usr.membership.activated' : 'usr.membership.deactivated', params),
      );
    }
  }

  private async remove(row: UserMembership): Promise<void> {
    const params = this.paramsOf(row);
    const reason = await this.ask({
      intent: 'danger',
      icon: 'trash',
      title: 'usr.membership.removeTitle',
      message: 'usr.membership.removeMessage',
      params,
      confirmLabel: 'usr.membership.menu.remove',
      challenge: { identifier: this.user().identification, actionKey: 'members.removeVerb' },
    });
    if (!reason) return;
    const updated = await this.run(
      this.api.removeMembership(this.user().id, row.organizationId, reason),
    );
    if (updated) this.notify.success(this.label('usr.membership.removed', params));
  }

  private async removeDuplicate(row: UserMembership): Promise<void> {
    if (!row.membershipId) return;
    const reason = await this.ask({
      intent: 'danger',
      icon: 'trash',
      title: 'usr.membership.duplicateTitle',
      message: 'usr.membership.duplicateMessage',
      params: this.paramsOf(row),
      confirmLabel: 'usr.membership.menu.duplicate',
    });
    if (!reason) return;
    const updated = await this.run(
      this.api.removeDuplicate(this.user().id, row.organizationId, row.membershipId, reason),
    );
    if (updated) this.notify.success(this.label('usr.membership.duplicateRemoved'));
  }

  private paramsOf(row: UserMembership): { name: string; org: string } {
    return { name: this.fullName(), org: this.orgOf(row) };
  }

  private async ask(request: DialogRequest): Promise<string | null> {
    const answer = await this.dialogs.open({
      ...request,
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    return answer.answer === 'confirm' && answer.reason ? answer.reason : null;
  }

  private async run(request: Observable<PlatformUserDetail>): Promise<PlatformUserDetail | null> {
    this.working.set(true);
    try {
      const updated = await firstValueFrom(request);
      this.changed.emit(updated);
      return updated;
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && USER_ERRORS.includes(code);
      this.notify.error(this.label(known ? `usr.error.${code}` : 'usr.error.generic'));
      return null;
    } finally {
      this.working.set(false);
    }
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
