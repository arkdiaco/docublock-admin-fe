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
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsersApi } from '../data/users.api';
import type { UserPasskey } from '../data/users.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'device', labelKey: 'usr.passkeys.col.device', width: 'minmax(0, 1.6fr)' },
  { key: 'synced', labelKey: 'usr.passkeys.col.synced', width: '110px' },
  { key: 'created', labelKey: 'usr.passkeys.col.created', width: '120px' },
  { key: 'lastUsed', labelKey: 'usr.passkeys.col.lastUsed', width: '120px' },
  { key: 'actions', width: '110px', align: 'end' },
];

@Component({
  selector: 'dba-user-passkeys-tab',
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
      <db-section-loader [label]="'usr.passkeys.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.passkeys.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.passkeys.emptyTitle" leadKey="usr.passkeys.emptyLead" />
      </div>
    } @else {
      <p class="dba-meta">
        {{ 'usr.passkeys.count' | translate: { count: items().length } }} ·
        {{ 'usr.passkeys.lead' | translate }}
      </p>
      <dba-data-table
        [columns]="columns"
        [label]="'usr.passkeys.title' | translate"
        [dense]="density.compact()"
        minWidth="680px"
      >
        @for (row of items(); track row.credentialId) {
          <div class="dba-tr">
            <span class="dba-td cell">
              <span class="cell__text">{{
                row.deviceName || ('usr.passkeys.unknownDevice' | translate)
              }}</span>
            </span>
            <span class="dba-td cell">
              <span class="cell__muted">{{
                (row.backedUp ? 'usr.passkeys.yes' : 'usr.passkeys.no') | translate
              }}</span>
            </span>
            <span class="dba-td dba-td--mono">{{ day(row.createdAt) }}</span>
            <span class="dba-td dba-td--mono">{{ day(row.lastUsedAt) }}</span>
            <span class="dba-td dba-td--end">
              @if (canManage()) {
                <button
                  dba-button
                  variant="secondary"
                  [busy]="pending.key() === row.credentialId"
                  [disabled]="!!pending.key()"
                  (click)="revoke(row)"
                >
                  {{ 'usr.passkeys.revoke' | translate }}
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
export class UserPasskeysTabComponent {
  readonly userId = input.required<string>();
  readonly userName = input.required<string>();

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
  protected readonly items = signal<UserPasskey[]>([]);

  constructor() {
    effect(() => {
      this.userId();
      untracked(() => void this.reload());
    });
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const items = await firstValueFrom(this.api.passkeys(this.userId()));
      if (current()) this.items.set(items);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async revoke(row: UserPasskey): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'trash',
      title: 'usr.passkeys.revokeTitle',
      message: 'usr.passkeys.revokeMessage',
      params: { name: this.userName() },
      confirmLabel: 'usr.passkeys.revoke',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const reason = answer.reason;
    await this.pending.run(row.credentialId, async () => {
      try {
        await firstValueFrom(this.api.revokePasskey(this.userId(), row.credentialId, reason));
        this.notify.success(this.label('usr.passkeys.revoked'));
      } catch {
        this.notify.error(this.label('usr.error.generic'));
      }
      await this.reload();
    });
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
