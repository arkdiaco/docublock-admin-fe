import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import { NotificationService } from '../../../../core/ui/notification.service';
import type { DialogRequest } from '../../../../shared/ui/dialog.component';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { MembersApi } from '../../data/members.api';
import type { InviteBody, OrgInvitation, OrgMember, OrgRole } from '../../data/members.models';
import { InviteMemberFormComponent } from './invite-member-form.component';
import { MemberRoleFormComponent } from './member-role-form.component';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const MEMBER_COLUMNS: readonly DataColumn[] = [
  { key: 'person', labelKey: 'members.col.person', width: 'minmax(220px, 2fr)' },
  { key: 'identification', labelKey: 'members.col.identification', width: '140px' },
  { key: 'role', labelKey: 'members.col.role', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'members.col.state', width: '110px' },
  { key: 'actions', width: '52px', align: 'end' },
];

const INVITATION_COLUMNS: readonly DataColumn[] = [
  { key: 'email', labelKey: 'members.col.email', width: 'minmax(200px, 2fr)' },
  { key: 'identification', labelKey: 'members.col.identification', width: '140px' },
  { key: 'role', labelKey: 'members.col.role', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'members.col.state', width: '120px' },
  { key: 'expires', labelKey: 'members.col.expires', width: '110px' },
  { key: 'actions', width: '170px', align: 'end' },
];

const KNOWN_ERRORS = [
  'ULTIMO_ADMIN',
  'ROL_INVALIDO',
  'ROL_RESERVADO',
  'MIEMBRO_YA_EXISTE',
  'INVITACION_PENDIENTE',
  'INVITACION_NO_PENDIENTE',
  'INVITACION_CORREO_FALLIDO',
];

const INVITATION_STATE: Record<string, string> = {
  PENDING: 'trial',
  ACCEPTED: 'active',
  REVOKED: 'closed',
  EXPIRED: 'warning',
};

type Open = { kind: 'invite' } | { kind: 'role'; member: OrgMember } | null;

@Component({
  selector: 'dba-members-tab',
  imports: [
    TranslatePipe,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    InviteMemberFormComponent,
    MemberRoleFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'members.loading' | translate" />
    } @else if (error()) {
      <div class="mt__panel">
        <dba-empty-state titleKey="members.errorTitle" leadKey="members.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      <div class="mt">
        <section class="mt__card">
          <header class="mt__head">
            <h2 class="dba-panel">{{ 'members.title' | translate: { total: total() } }}</h2>
            <div class="mt__tools">
              <label class="mt__search">
                <db-icon name="search" [size]="15" />
                <input
                  type="search"
                  class="mt__input"
                  autocomplete="off"
                  [placeholder]="'members.search' | translate"
                  [value]="searchDraft()"
                  (input)="onSearch($event)"
                />
              </label>
              @if (canManage()) {
                <button dba-button variant="secondary" [busy]="working()" (click)="syncRoles()">
                  {{ 'members.sync.open' | translate }}
                </button>
                <button dba-button (click)="open.set({ kind: 'invite' })">
                  {{ 'members.invite.open' | translate }}
                </button>
              }
            </div>
          </header>

          @if (members().length === 0) {
            <p class="dba-body mt__muted">
              {{ (search ? 'members.noMatch' : 'members.none') | translate }}
            </p>
          } @else {
            <dba-data-table
              [columns]="memberColumns"
              [label]="'members.title' | translate: { total: total() }"
              minWidth="720px"
              [total]="total()"
              [from]="from()"
              [to]="to()"
              [page]="page()"
              [pageCount]="pageCount()"
              (pageChange)="goPage($event)"
            >
              @for (member of members(); track member.userId) {
                <div class="dba-tr">
                  <span class="dba-td mt__person">
                    <span class="mt__name">{{ member.names }} {{ member.surNames }}</span>
                    <span class="mt__mail">{{ member.email }}</span>
                  </span>
                  <code class="dba-td mt__mono">{{ member.identification }}</code>
                  <span class="dba-td mt__small">{{
                    member.roleName || roleName(member.roleId)
                  }}</span>
                  <span class="dba-td">
                    <dba-org-state
                      [state]="member.state === 1 ? 'active' : 'suspended'"
                      [labelKey]="
                        member.state === 1 ? 'members.state.active' : 'members.state.inactive'
                      "
                      variant="inline"
                    />
                  </span>
                  <span class="dba-td dba-td--end">
                    @if (canManage()) {
                      <button
                        type="button"
                        class="mt__more"
                        [attr.aria-label]="'members.actionsFor' | translate: { name: member.names }"
                        (click)="acting.set(member); actions.toggle($event)"
                      >
                        <db-icon name="moreVertical" [size]="16" />
                      </button>
                    }
                  </span>
                </div>
              }
            </dba-data-table>
          }
        </section>

        <section class="mt__card">
          <h2 class="dba-panel">{{ 'members.invitations' | translate }}</h2>
          @if (invitations().length === 0) {
            <p class="dba-body mt__muted">{{ 'members.noInvitations' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="invitationColumns"
              [label]="'members.invitations' | translate"
              minWidth="760px"
            >
              @for (invitation of invitations(); track invitation.id) {
                <div class="dba-tr">
                  <span class="dba-td mt__small">{{ invitation.email }}</span>
                  <code class="dba-td mt__mono">{{ invitation.identification }}</code>
                  <span class="dba-td mt__small">{{ roleName(invitation.roleId) }}</span>
                  <span class="dba-td">
                    <dba-org-state
                      [state]="invitationState(invitation)"
                      [labelKey]="'members.invitation.' + invitation.state"
                      variant="inline"
                    />
                  </span>
                  <span class="dba-td dba-mono mt__small">{{ day(invitation.expiresAt) }}</span>
                  <span class="dba-td dba-td--end mt__links">
                    @if (
                      canManage() &&
                      invitation.state !== 'ACCEPTED' &&
                      invitation.state !== 'REVOKED'
                    ) {
                      <button type="button" class="mt__link" (click)="resend(invitation)">
                        {{ 'members.resend' | translate }}
                      </button>
                      <button
                        type="button"
                        class="mt__link mt__link--danger"
                        (click)="revoke(invitation)"
                      >
                        {{ 'members.revoke' | translate }}
                      </button>
                    }
                  </span>
                </div>
              }
            </dba-data-table>
          }
        </section>
      </div>

      <dba-action-menu
        #actions
        label="members.actions"
        [items]="actionItems()"
        (picked)="onAction($event)"
      />

      @switch (open()?.kind) {
        @case ('invite') {
          <dba-invite-member-form
            [roles]="roles()"
            [orgName]="org().businessName"
            [busy]="working()"
            (submitted)="invite($event)"
            (dismissed)="open.set(null)"
          />
        }
        @case ('role') {
          <dba-member-role-form
            [member]="roleMember()!"
            [roles]="roles()"
            [busy]="working()"
            (submitted)="changeRole($event)"
            (dismissed)="open.set(null)"
          />
        }
      }
    }
  `,
  styles: `
    .mt {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .mt__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .mt__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .mt__tools {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mt__search {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 260px;
      max-width: 100%;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .mt__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .mt__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .mt__input:focus {
      outline: none;
    }

    .mt__muted {
      margin: 0;
      color: var(--dba-text-muted);
    }

    .mt__person {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .mt__name {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mt__mail {
      overflow: hidden;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mt__mono {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .mt__small {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mt__more {
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

    .mt__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .mt__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    .mt__links {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
    }

    .mt__link {
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--dba-text-small);
      font-weight: 600;
      color: var(--dba-violet-600);
      cursor: pointer;
    }

    .mt__link--danger {
      color: var(--dba-state-suspended-fg);
    }

    .mt__link:hover {
      text-decoration: underline;
    }

    .mt__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .mt__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 640px) {
      .mt__tools,
      .mt__search {
        width: 100%;
      }
    }
  `,
})
export class MembersTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(MembersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly memberColumns = MEMBER_COLUMNS;
  protected readonly invitationColumns = INVITATION_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly members = signal<OrgMember[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly invitations = signal<OrgInvitation[]>([]);
  protected readonly roles = signal<OrgRole[]>([]);
  protected readonly searchDraft = signal('');
  protected readonly acting = signal<OrgMember | null>(null);
  protected readonly open = signal<Open>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected search = '';

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.total(), this.page() * LIMIT));

  protected readonly roleMember = computed(() => {
    const open = this.open();
    return open?.kind === 'role' ? open.member : null;
  });

  protected readonly actionItems = computed<ActionMenuItem[]>(() => [
    { key: 'role', labelKey: 'members.action.role' },
    this.acting()?.state === 1
      ? { key: 'deactivate', labelKey: 'members.action.deactivate' }
      : { key: 'activate', labelKey: 'members.action.activate' },
    { key: 'remove', labelKey: 'members.action.remove', danger: true, separated: true },
  ]);

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected roleName(roleId: string): string {
    return this.roles().find((role) => role.id === roleId)?.name ?? '—';
  }

  protected invitationState(invitation: OrgInvitation): string {
    return INVITATION_STATE[invitation.state] ?? 'closed';
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.locale);
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.page.set(1);
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.roles().length === 0 && this.members().length === 0);
    this.error.set(false);
    try {
      const [members, invitations, roles] = await Promise.all([
        firstValueFrom(this.api.members(this.orgId(), this.page(), LIMIT, this.search)),
        firstValueFrom(this.api.invitations(this.orgId())),
        firstValueFrom(this.api.roles(this.orgId())),
      ]);
      if (!current()) return;
      this.members.set(members.items);
      this.total.set(members.total);
      this.invitations.set(invitations.items);
      this.roles.set(roles);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected onAction(key: string): void {
    const member = this.acting();
    if (!member) return;
    if (key === 'role') this.open.set({ kind: 'role', member });
    else if (key === 'deactivate') void this.setState(member, 0);
    else if (key === 'activate') void this.setState(member, 1);
    else if (key === 'remove') void this.remove(member);
  }

  protected async invite(body: InviteBody): Promise<void> {
    if (await this.run(this.api.invite(this.orgId(), body)))
      this.done('members.done.invite', { email: body.email });
  }

  protected async changeRole(change: { roleId: string; reason: string }): Promise<void> {
    const member = this.roleMember();
    if (!member) return;
    if (await this.run(this.api.update(this.orgId(), member.userId, change)))
      this.done('members.done.role', { name: member.names });
  }

  protected async syncRoles(): Promise<void> {
    const reason = await this.ask({
      intent: 'primary',
      icon: 'rotate',
      title: 'members.sync.title',
      message: 'members.sync.message',
      confirmLabel: 'members.sync.confirm',
    });
    if (!reason) return;
    const report = await this.run(this.api.syncRoles(this.orgId(), reason));
    if (report) this.done('members.done.sync', report as Record<string, number>);
  }

  protected async resend(invitation: OrgInvitation): Promise<void> {
    const reason = await this.ask({
      intent: 'primary',
      icon: 'send',
      title: 'members.resendTitle',
      message: 'members.resendMessage',
      params: { email: invitation.email },
      confirmLabel: 'members.resend',
    });
    if (reason && (await this.run(this.api.resend(this.orgId(), invitation.id, reason)))) {
      this.done('members.done.resend', { email: invitation.email });
    }
  }

  protected async revoke(invitation: OrgInvitation): Promise<void> {
    const reason = await this.ask({
      intent: 'danger',
      icon: 'circleX',
      title: 'members.revokeTitle',
      message: 'members.revokeMessage',
      params: { email: invitation.email },
      confirmLabel: 'members.revoke',
    });
    if (reason && (await this.run(this.api.revoke(this.orgId(), invitation.id, reason))))
      this.done('members.done.revoke');
  }

  private async setState(member: OrgMember, state: number): Promise<void> {
    const deactivate = state === 0;
    const reason = await this.ask({
      intent: deactivate ? 'danger' : 'primary',
      icon: deactivate ? 'lock' : 'circleCheck',
      title: deactivate ? 'members.deactivateTitle' : 'members.activateTitle',
      message: deactivate ? 'members.deactivateMessage' : 'members.activateMessage',
      params: { name: `${member.names} ${member.surNames}` },
      confirmLabel: deactivate ? 'members.action.deactivate' : 'members.action.activate',
    });
    if (
      reason &&
      (await this.run(this.api.update(this.orgId(), member.userId, { state, reason })))
    ) {
      this.done(deactivate ? 'members.done.deactivate' : 'members.done.activate', {
        name: member.names,
      });
    }
  }

  private async remove(member: OrgMember): Promise<void> {
    const reason = await this.ask({
      intent: 'danger',
      icon: 'trash',
      title: 'members.removeTitle',
      message: 'members.removeMessage',
      params: { name: `${member.names} ${member.surNames}` },
      confirmLabel: 'members.action.remove',
      challenge: { identifier: member.identification, actionKey: 'members.removeVerb' },
    });
    if (reason && (await this.run(this.api.remove(this.orgId(), member.userId, reason)))) {
      this.done('members.done.remove', { name: member.names });
    }
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

  private done(key: string, params?: Record<string, unknown>): void {
    this.notify.success(this.translate.instant(key, params) as string);
  }

  private async run(request: Observable<unknown>): Promise<unknown> {
    this.working.set(true);
    try {
      const result = await firstValueFrom(request);
      this.open.set(null);
      await this.reload();
      return result ?? true;
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(
        this.translate.instant(known ? `members.error.${code}` : 'members.error.generic') as string,
      );
      return null;
    } finally {
      this.working.set(false);
    }
  }
}
