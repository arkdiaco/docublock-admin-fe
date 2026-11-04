import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { initialsOf } from '../../../shared/domain/initials';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { UserEditFormComponent } from '../components/user-edit-form.component';
import { UserHistoryTabComponent } from '../components/user-history-tab.component';
import { UserOrganizationsTabComponent } from '../components/user-organizations-tab.component';
import { UserPasskeysTabComponent } from '../components/user-passkeys-tab.component';
import { UserSessionsTabComponent } from '../components/user-sessions-tab.component';
import { USER_ERRORS, UsersApi } from '../data/users.api';
import type { PlatformUserDetail, UserChanges } from '../data/users.models';

type DetailTab = 'organizations' | 'sessions' | 'passkeys' | 'history';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

@Component({
  selector: 'dba-user-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    UnderlineTabsComponent,
    UserEditFormComponent,
    UserHistoryTabComponent,
    UserOrganizationsTabComponent,
    UserPasskeysTabComponent,
    UserSessionsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'usr.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.detail.missingTitle" leadKey="usr.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'usr.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.detail.errorTitle" leadKey="usr.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (user(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="fullName()"
          [state]="item.active ? 'active' : 'suspended'"
          [stateLabelKey]="item.active ? 'usr.state.active' : 'usr.state.inactive'"
          [meta]="item.identification"
        />

        @if (canManage()) {
          <div class="bd__actions">
            <button dba-button variant="secondary" (click)="editing.set(true)">
              {{ 'usr.action.edit' | translate }}
            </button>
            @if (item.active) {
              <button
                dba-button
                variant="destructive"
                [busy]="pending.key() === 'access'"
                [disabled]="!!pending.key()"
                (click)="block()"
              >
                {{ 'usr.action.block' | translate }}
              </button>
            } @else {
              <button
                dba-button
                variant="secondary"
                [busy]="pending.key() === 'access'"
                [disabled]="!!pending.key()"
                (click)="unblock()"
              >
                {{ 'usr.action.unblock' | translate }}
              </button>
            }
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'usr.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'usr.detail.email' | translate }}</dt>
            <dd>{{ item.email || '—' }}</dd>
            <dt>{{ 'usr.detail.phone' | translate }}</dt>
            <dd class="dba-mono">{{ item.phone || '—' }}</dd>
            <dt>{{ 'usr.detail.document' | translate }}</dt>
            <dd class="dba-mono">
              {{ item.identificationType ? item.identificationType + ' · ' : ''
              }}{{ item.identification }}
            </dd>
            <dt>{{ 'usr.detail.country' | translate }}</dt>
            <dd>{{ item.countryName || '—' }}</dd>
            <dt>{{ 'usr.detail.city' | translate }}</dt>
            <dd>{{ item.cityName || '—' }}</dd>
            <dt>{{ 'usr.detail.expedition' | translate }}</dt>
            <dd>{{ expedition(item) }}</dd>
            <dt>{{ 'usr.detail.terms' | translate }}</dt>
            <dd>
              {{ (item.termsAccepted ? 'usr.detail.termsYes' : 'usr.detail.termsNo') | translate }}
            </dd>
            <dt>{{ 'usr.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
            <dt>{{ 'usr.detail.updated' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.updatedAt) }}</dd>
          </dl>
        </section>

        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'usr.tab.label' | translate"
          (picked)="tab.set($any($event))"
        />
        @switch (tab()) {
          @case ('organizations') {
            <dba-user-organizations-tab [user]="item" (changed)="applied($event)" />
          }
          @case ('sessions') {
            <dba-user-sessions-tab
              [userId]="item.id"
              [userName]="fullName()"
              [version]="accessVersion()"
            />
          }
          @case ('passkeys') {
            <dba-user-passkeys-tab [userId]="item.id" [userName]="fullName()" />
          }
          @case ('history') {
            <dba-user-history-tab [userId]="item.id" />
          }
        }
      </div>

      @if (editing()) {
        <dba-user-edit-form
          [user]="item"
          [busy]="pending.key() === 'edit'"
          (submitted)="save($event)"
          (dismissed)="editing.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class UserDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('users');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly editing = signal(false);
  protected readonly accessVersion = signal(0);
  protected readonly tab = signal<DetailTab>('organizations');
  protected readonly user = signal<PlatformUserDetail | null>(null);
  protected readonly fullName = computed(() => {
    const user = this.user();
    return user ? `${user.names} ${user.surNames}`.trim() : '';
  });
  protected readonly initials = computed(() => initialsOf(this.fullName()));
  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'organizations',
      label: this.label('usr.tab.organizations'),
      count: this.user()?.memberships.length,
    },
    { key: 'sessions', label: this.label('usr.tab.sessions') },
    { key: 'passkeys', label: this.label('usr.tab.passkeys') },
    ...(this.auth.canRead('platform')
      ? [{ key: 'history', label: this.label('usr.tab.history') }]
      : []),
  ]);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected expedition(user: PlatformUserDetail): string {
    const date = user.expeditionDate;
    const shown = date && ISO_DAY.test(date) ? this.day(date) : date;
    return [user.expeditionCityName, shown].filter(Boolean).join(' · ') || '—';
  }

  protected applied(user: PlatformUserDetail): void {
    this.user.set(user);
  }

  protected async save(value: { changes: UserChanges; reason: string }): Promise<void> {
    await this.pending.run('edit', async () => {
      try {
        this.user.set(
          await firstValueFrom(this.api.update(this.id(), value.changes, value.reason)),
        );
        this.editing.set(false);
        this.notify.success(this.label('usr.edit.done'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  protected async block(): Promise<void> {
    const reason = await this.ask('danger', 'lock', 'block');
    if (!reason) return;
    await this.pending.run('access', async () => {
      try {
        const access = await firstValueFrom(this.api.block(this.id(), reason));
        await this.afterAccess();
        this.notify.success(this.label('usr.access.blocked', { count: access.revokedSessions }));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  protected async unblock(): Promise<void> {
    const reason = await this.ask('primary', 'circleCheck', 'unblock');
    if (!reason) return;
    await this.pending.run('access', async () => {
      try {
        await firstValueFrom(this.api.unblock(this.id(), reason));
        await this.afterAccess();
        this.notify.success(this.label('usr.access.unblocked'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  private async afterAccess(): Promise<void> {
    this.user.set(await firstValueFrom(this.api.get(this.id())));
    this.accessVersion.update((version) => version + 1);
  }

  private async ask(
    intent: 'danger' | 'primary',
    icon: 'lock' | 'circleCheck',
    action: 'block' | 'unblock',
  ): Promise<string | null> {
    const answer = await this.dialogs.open({
      intent,
      icon,
      title: `usr.access.${action}Title`,
      message: `usr.access.${action}Message`,
      params: { name: this.fullName() },
      confirmLabel: `usr.action.${action}`,
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

  private notifyFailure(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && USER_ERRORS.includes(code);
    this.notify.error(this.label(known ? `usr.error.${code}` : 'usr.error.generic'));
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const user = await firstValueFrom(this.api.get(id));
      if (!current()) return;
      this.user.set(user);
    } catch (error) {
      if (!current()) return;
      const status = errorStatusOf(error);
      if (status === 404 || status === 400) this.missing.set(true);
      else this.error.set(true);
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
