import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import {
  PLATFORM_GROUPS,
  canManageGroup,
  canReadGroup,
} from '../../../shared/domain/platform-permissions';
import { deviceLabel } from '../../../shared/domain/device-label';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { RoleTagComponent } from '../../../shared/ui/role-tag.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { errorCodeOf } from '../../../shared/http/error-code';
import { MyAccessApi, type MySession } from '../data/my-access.api';

const ACCESS_COLUMNS: readonly DataColumn[] = [
  { key: 'group', labelKey: 'mine.col.group', width: 'minmax(0, 1fr)' },
  { key: 'read', labelKey: 'mine.col.read', width: '110px' },
  { key: 'manage', labelKey: 'mine.col.manage', width: '110px' },
];

const SESSION_COLUMNS: readonly DataColumn[] = [
  { key: 'device', labelKey: 'mine.col.device', width: 'minmax(0, 2fr)' },
  { key: 'ip', labelKey: 'mine.col.ip', width: '140px' },
  { key: 'started', labelKey: 'mine.col.started', width: '150px' },
  { key: 'used', labelKey: 'mine.col.used', width: '150px' },
  { key: 'action', width: '130px', align: 'end' },
];

const DATE = 'd/MM/y, HH:mm';

interface SessionRow extends MySession {
  deviceName: string | null;
  started: string;
  used: string;
}

@Component({
  selector: 'dba-my-access',
  imports: [
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    RoleTagComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mine">
      <header class="mine__head">
        <h1 class="dba-page">{{ 'mine.title' | translate }}</h1>
        <span class="mine__who">
          <span class="dba-meta">{{ auth.displayName() }} · {{ auth.user()?.email }}</span>
          @if (auth.platformRole(); as role) {
            <dba-role-tag [role]="role" />
          }
        </span>
      </header>

      <div class="mine__block">
        <h2 class="dba-panel">{{ 'mine.permissionsTitle' | translate }}</h2>
        <dba-data-table [columns]="accessColumns" [label]="'mine.permissionsTitle' | translate">
          @for (row of access(); track row.group) {
            <div class="dba-tr">
              <span class="dba-td mine__group">{{ 'nav.group.' + row.group | translate }}</span>
              <span class="dba-td" [class.mine__no]="!row.read">
                <db-icon [name]="row.read ? 'check' : 'close'" [size]="15" />
                <span class="sr-only">{{
                  (row.read ? 'common.yes' : 'common.no') | translate
                }}</span>
              </span>
              <span class="dba-td" [class.mine__no]="!row.manage">
                <db-icon [name]="row.manage ? 'check' : 'close'" [size]="15" />
                <span class="sr-only">{{
                  (row.manage ? 'common.yes' : 'common.no') | translate
                }}</span>
              </span>
            </div>
          }
        </dba-data-table>
      </div>

      <div class="mine__block">
        <h2 class="dba-panel">{{ 'mine.sessionsTitle' | translate }}</h2>
        <p class="dba-meta mine__lead">{{ 'mine.sessionsLead' | translate }}</p>
        @if (loading()) {
          <db-section-loader [label]="'mine.loading' | translate" />
        } @else if (error()) {
          <div class="mine__panel">
            <dba-empty-state titleKey="mine.errorTitle" leadKey="mine.errorLead" />
            <button dba-button variant="secondary" (click)="reload()">
              {{ 'common.retry' | translate }}
            </button>
          </div>
        } @else {
          <dba-data-table
            [columns]="sessionColumns"
            [label]="'mine.sessionsTitle' | translate"
            minWidth="680px"
          >
            @for (row of sessions(); track row.sid) {
              <div class="dba-tr">
                <span class="dba-td mine__device" [title]="row.device || ''">{{
                  row.deviceName || ('mine.unknownDevice' | translate)
                }}</span>
                <code class="dba-td dba-mono mine__small">{{ row.ip || '—' }}</code>
                <span class="dba-td dba-mono mine__small">{{ row.started }}</span>
                <span class="dba-td dba-mono mine__small">{{ row.used }}</span>
                <span class="dba-td dba-td--end">
                  @if (row.current) {
                    <span class="mine__current">{{ 'mine.current' | translate }}</span>
                  } @else {
                    <button
                      dba-button
                      variant="secondary"
                      [busy]="revoking() === row.sid"
                      (click)="revoke(row)"
                    >
                      {{ 'mine.revoke' | translate }}
                    </button>
                  }
                </span>
              </div>
            }
          </dba-data-table>
        }
      </div>
    </section>
  `,
  styles: `
    .mine {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .mine__head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mine__who {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mine__block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mine__lead {
      margin: 0;
    }

    .mine__group {
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .mine__no {
      color: var(--dba-text-faint);
    }

    .mine__device {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mine__small {
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .mine__current {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      color: var(--dba-violet-700);
    }

    .mine__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class MyAccessComponent {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(MyAccessApi);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly accessColumns = ACCESS_COLUMNS;
  protected readonly sessionColumns = SESSION_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly revoking = signal<string | null>(null);
  private readonly raw = signal<MySession[]>([]);

  protected readonly access = computed(() => {
    const owned = this.auth.platformPermissions();
    return PLATFORM_GROUPS.map((group) => ({
      group,
      read: canReadGroup(owned, group),
      manage: canManageGroup(owned, group),
    }));
  });

  protected readonly sessions = computed<SessionRow[]>(() =>
    this.raw().map((session) => ({
      ...session,
      deviceName: deviceLabel(session.device),
      started: session.createdAt ? formatDate(session.createdAt, DATE, this.locale) : '—',
      used: session.lastUsedAt ? formatDate(session.lastUsedAt, DATE, this.locale) : '—',
    })),
  );

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const { items } = await firstValueFrom(this.api.sessions());
      this.raw.set(items);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async revoke(session: SessionRow): Promise<void> {
    const ok = await this.dialogs.confirm({
      intent: 'warn',
      icon: 'lock',
      title: 'mine.revokeTitle',
      message: 'mine.revokeMessage',
      params: {
        device: session.deviceName || (this.translate.instant('mine.unknownDevice') as string),
      },
      confirmLabel: 'mine.revoke',
    });
    if (!ok) return;
    this.revoking.set(session.sid);
    try {
      await firstValueFrom(this.api.revoke(session.sid));
      this.notify.success(this.translate.instant('mine.revoked') as string);
      await this.reload();
    } catch (error) {
      this.notify.error(
        this.translate.instant(
          errorCodeOf(error) === 'SESION_ACTUAL' ? 'mine.error.current' : 'mine.error.generic',
        ) as string,
      );
    } finally {
      this.revoking.set(null);
    }
  }
}
