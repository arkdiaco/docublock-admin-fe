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
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import type { DialogRequest } from '../../../shared/ui/dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsersApi } from '../data/users.api';
import type { UserSession } from '../data/users.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'device', labelKey: 'usr.sessions.col.device', width: 'minmax(0, 1.6fr)' },
  { key: 'ip', labelKey: 'usr.sessions.col.ip', width: 'minmax(0, 0.7fr)' },
  { key: 'lastUsed', labelKey: 'usr.sessions.col.lastUsed', width: '150px' },
  { key: 'created', labelKey: 'usr.sessions.col.created', width: '150px' },
  { key: 'actions', width: '130px', align: 'end' },
];

@Component({
  selector: 'dba-user-sessions-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'usr.sessions.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.sessions.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.sessions.emptyTitle" leadKey="usr.sessions.emptyLead" />
      </div>
    } @else {
      <div class="bd__actions">
        <span class="dba-meta">{{
          'usr.sessions.count' | translate: { count: items().length }
        }}</span>
        @if (canManage()) {
          <button
            dba-button
            variant="secondary"
            [busy]="pending.key() === 'all'"
            [disabled]="!!pending.key()"
            (click)="closeAll()"
          >
            {{ 'usr.sessions.closeAll' | translate }}
          </button>
        }
      </div>
      <dba-data-table
        [columns]="columns"
        [label]="'usr.sessions.title' | translate"
        [dense]="density.compact()"
        minWidth="760px"
      >
        @for (row of items(); track row.sid) {
          <div class="dba-tr">
            <span class="dba-td cell">
              <span class="cell__text">{{
                row.device || ('usr.sessions.unknownDevice' | translate)
              }}</span>
            </span>
            <span class="dba-td dba-td--mono">{{ row.ip || '—' }}</span>
            <span class="dba-td dba-td--mono">{{ moment(row.lastUsedAt) }}</span>
            <span class="dba-td dba-td--mono">{{ moment(row.createdAt) }}</span>
            <span class="dba-td dba-td--end">
              @if (canManage()) {
                <button
                  dba-button
                  variant="secondary"
                  [busy]="pending.key() === row.sid"
                  [disabled]="!!pending.key()"
                  (click)="close(row)"
                >
                  {{ 'usr.sessions.close' | translate }}
                </button>
              }
            </span>
          </div>
        }
      </dba-data-table>
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class UserSessionsTabComponent {
  readonly userId = input.required<string>();
  readonly userName = input.required<string>();
  readonly version = input(0);

  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<UserSession[]>([]);

  constructor() {
    effect(() => {
      this.userId();
      this.version();
      untracked(() => void this.reload());
    });
  }

  protected moment(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const items = await firstValueFrom(this.api.sessions(this.userId()));
      if (current()) this.items.set(items);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async close(row: UserSession): Promise<void> {
    const reason = await this.ask({
      intent: 'danger',
      icon: 'lock',
      title: 'usr.sessions.closeTitle',
      message: 'usr.sessions.closeMessage',
      params: { name: this.userName() },
      confirmLabel: 'usr.sessions.close',
    });
    if (!reason) return;
    await this.pending.run(row.sid, async () => {
      try {
        await firstValueFrom(this.api.revokeSession(this.userId(), row.sid, reason));
        this.notify.success(this.label('usr.sessions.closed'));
      } catch {
        this.notify.error(this.label('usr.error.generic'));
      }
      await this.reload();
    });
  }

  protected async closeAll(): Promise<void> {
    const reason = await this.ask({
      intent: 'danger',
      icon: 'lock',
      title: 'usr.sessions.closeAllTitle',
      message: 'usr.sessions.closeAllMessage',
      params: { name: this.userName() },
      confirmLabel: 'usr.sessions.closeAll',
    });
    if (!reason) return;
    await this.pending.run('all', async () => {
      try {
        const { revoked } = await firstValueFrom(this.api.revokeSessions(this.userId(), reason));
        this.notify.success(this.label('usr.sessions.closedAll', { count: revoked }));
      } catch {
        this.notify.error(this.label('usr.error.generic'));
      }
      await this.reload();
    });
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

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
