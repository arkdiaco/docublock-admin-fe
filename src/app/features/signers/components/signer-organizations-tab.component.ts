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
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SIGNER_ERRORS, SignersApi } from '../data/signers.api';
import type { PlatformSignerDetail, SignerOrganization } from '../data/signers.models';
import { SignerOrganizationFormComponent } from './signer-organization-form.component';

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'sig.organizations.col.organization', width: 'minmax(0, 1.6fr)' },
  { key: 'tax', labelKey: 'sig.organizations.col.tax', width: 'minmax(0, 0.8fr)' },
  { key: 'actions', width: '130px', align: 'end' },
];

@Component({
  selector: 'dba-signer-organizations-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    SignerOrganizationFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canManage()) {
      <div class="bd__actions">
        <button dba-button (click)="adding.set(true)">
          <db-icon name="plus" [size]="15" />
          {{ 'sig.organizations.add' | translate }}
        </button>
      </div>
    }

    @if (signer().organizations.length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.organizations.emptyTitle" leadKey="sig.organizations.emptyLead" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'sig.organizations.label' | translate"
        [dense]="density.compact()"
        minWidth="560px"
      >
        @for (row of signer().organizations; track row.id) {
          <div class="dba-tr">
            <span class="dba-td cell">
              <a class="bd__link cell__label" [routerLink]="[orgsPath, row.id]">{{ orgOf(row) }}</a>
            </span>
            <span class="dba-td cell">
              <span class="cell__muted dba-mono">{{ row.tributaryNumber || '—' }}</span>
            </span>
            <span class="dba-td dba-td--end">
              @if (canManage()) {
                <button
                  dba-button
                  variant="secondary"
                  [busy]="pending.key() === row.id"
                  [disabled]="!!pending.key()"
                  (click)="remove(row)"
                >
                  {{ 'sig.organizations.remove' | translate }}
                </button>
              }
            </span>
          </div>
        }
      </dba-data-table>
    }

    @if (adding()) {
      <dba-signer-organization-form
        [signerName]="signerName()"
        [linked]="linked()"
        [busy]="pending.key() === 'add'"
        (submitted)="add($event)"
        (dismissed)="adding.set(false)"
      />
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class SignerOrganizationsTabComponent {
  readonly signer = input.required<PlatformSignerDetail>();
  readonly signerName = input.required<string>();
  readonly changed = output<PlatformSignerDetail>();

  private readonly api = inject(SignersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly adding = signal(false);
  protected readonly linked = computed(() => this.signer().organizations.map((org) => org.id));

  protected orgOf(row: SignerOrganization): string {
    return row.name || this.label('sig.organizations.missing');
  }

  protected async add(value: { orgId: string; reason: string }): Promise<void> {
    await this.pending.run('add', async () => {
      try {
        const updated = await firstValueFrom(
          this.api.addOrganization(this.signer().id, value.orgId, value.reason),
        );
        this.changed.emit(updated);
        this.adding.set(false);
        const org = updated.organizations.find((item) => item.id === value.orgId)?.name ?? '';
        this.notify.success(this.label('sig.organizations.added', { org }));
      } catch (error) {
        this.failed(error);
      }
    });
  }

  protected async remove(row: SignerOrganization): Promise<void> {
    const signer = this.signer();
    const params = { name: this.signerName(), org: this.orgOf(row) };
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'trash',
      title: 'sig.organizations.removeTitle',
      message: 'sig.organizations.removeMessage',
      params,
      confirmLabel: 'sig.organizations.remove',
      ...(signer.identification
        ? { challenge: { identifier: signer.identification, actionKey: 'members.removeVerb' } }
        : {}),
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
    await this.pending.run(row.id, async () => {
      try {
        this.changed.emit(
          await firstValueFrom(this.api.removeOrganization(signer.id, row.id, reason)),
        );
        this.notify.success(this.label('sig.organizations.removed', params));
      } catch (error) {
        this.failed(error);
      }
    });
  }

  private failed(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && SIGNER_ERRORS.includes(code);
    this.notify.error(this.label(known ? `sig.error.${code}` : 'sig.error.generic'));
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
