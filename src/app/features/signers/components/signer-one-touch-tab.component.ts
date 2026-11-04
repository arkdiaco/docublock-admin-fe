import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
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
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SIGNER_ERRORS, SignersApi } from '../data/signers.api';
import type { SignerOneTouch, SignerPasskey } from '../data/signers.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'device', labelKey: 'sig.oneTouch.col.device', width: 'minmax(0, 1.6fr)' },
  { key: 'synced', labelKey: 'sig.oneTouch.col.synced', width: '110px' },
  { key: 'created', labelKey: 'sig.oneTouch.col.created', width: '120px' },
  { key: 'lastUsed', labelKey: 'sig.oneTouch.col.lastUsed', width: '120px' },
  { key: 'actions', width: '110px', align: 'end' },
];

@Component({
  selector: 'dba-signer-one-touch-tab',
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
      <db-section-loader [label]="'sig.oneTouch.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.oneTouch.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (status(); as current) {
      @if (current.credentials.length === 0) {
        <div class="bd__panel">
          <dba-empty-state
            titleKey="sig.oneTouch.emptyTitle"
            [leadKey]="current.enabled ? 'sig.oneTouch.flagWithoutKeys' : 'sig.oneTouch.emptyLead'"
          />
        </div>
      } @else {
        <p class="dba-meta">{{ 'sig.oneTouch.lead' | translate }}</p>
        <dba-data-table
          [columns]="columns"
          [label]="'sig.tab.oneTouch' | translate"
          [dense]="density.compact()"
          minWidth="680px"
        >
          @for (row of current.credentials; track row.credentialId) {
            <div class="dba-tr">
              <span class="dba-td cell">
                <span class="cell__text">{{
                  row.deviceName || ('sig.oneTouch.unknownDevice' | translate)
                }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{
                  (row.backedUp ? 'sig.yes' : 'sig.no') | translate
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
                    {{ 'sig.oneTouch.revoke' | translate }}
                  </button>
                }
              </span>
            </div>
          }
        </dba-data-table>
      }
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class SignerOneTouchTabComponent {
  readonly signerId = input.required<string>();
  readonly signerName = input.required<string>();
  readonly changed = output<void>();

  private readonly api = inject(SignersApi);
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
  protected readonly status = signal<SignerOneTouch | null>(null);

  constructor() {
    effect(() => {
      this.signerId();
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
      const status = await firstValueFrom(this.api.oneTouch(this.signerId()));
      if (current()) this.status.set(status);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async revoke(row: SignerPasskey): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'trash',
      title: 'sig.oneTouch.revokeTitle',
      message: 'sig.oneTouch.revokeMessage',
      params: { name: this.signerName() },
      confirmLabel: 'sig.oneTouch.revoke',
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
        this.status.set(
          await firstValueFrom(this.api.revokeOneTouch(this.signerId(), row.credentialId, reason)),
        );
        this.changed.emit();
        this.notify.success(this.label('sig.oneTouch.revoked'));
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && SIGNER_ERRORS.includes(code);
        this.notify.error(this.label(known ? `sig.error.${code}` : 'sig.error.generic'));
      }
    });
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
