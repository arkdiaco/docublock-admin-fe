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
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { LEGAL_ENTITY_ERRORS, LegalEntitiesApi } from '../data/legal-entities.api';
import type { LegalEntityDetail, LegalEntityRepresentative } from '../data/legal-entities.models';
import { LegalEntityRepresentativeFormComponent } from './legal-entity-representative-form.component';

const COLUMNS: readonly DataColumn[] = [
  { key: 'person', labelKey: 'jur.representatives.col.person', width: 'minmax(0, 1.5fr)' },
  { key: 'document', labelKey: 'jur.representatives.col.document', width: 'minmax(0, 0.8fr)' },
  { key: 'role', labelKey: 'jur.representatives.col.role', width: '170px' },
  { key: 'flag', labelKey: 'jur.representatives.col.flag', width: '130px' },
  { key: 'actions', width: '48px', align: 'end' },
];

const REASON = {
  labelKey: 'sub.reasonLabel',
  placeholder: 'sub.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

@Component({
  selector: 'dba-legal-entity-representatives-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    LegalEntityRepresentativeFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rep">
      <p class="dba-meta">{{ 'jur.representatives.notice' | translate }}</p>

      @if (canManage()) {
        <div class="bd__actions">
          <button dba-button (click)="adding.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'jur.representatives.add' | translate }}
          </button>
        </div>
      }

      @if (entity().representatives.length === 0) {
        <div class="bd__panel">
          <dba-empty-state
            titleKey="jur.representatives.emptyTitle"
            leadKey="jur.representatives.emptyLead"
          />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'jur.representatives.label' | translate"
          [dense]="density.compact()"
          minWidth="680px"
        >
          @for (row of entity().representatives; track row.signerId) {
            <div class="dba-tr">
              <span class="dba-td cell">
                <a class="bd__link cell__label" [routerLink]="[signersPath, row.signerId]">{{
                  nameOf(row)
                }}</a>
                <span class="cell__meta">{{ row.email || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted dba-mono">{{ row.identification || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{
                  (row.isLegalRep ? 'jur.role.legalRep' : 'jur.role.proxy') | translate
                }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{
                  (row.signerIsLegalRep ? 'jur.yes' : 'jur.no') | translate
                }}</span>
              </span>
              <span class="dba-td dba-td--end">
                @if (canManage()) {
                  <button
                    type="button"
                    class="rep__more"
                    [disabled]="!!pending.key()"
                    [attr.aria-label]="
                      'jur.representatives.actionsFor' | translate: { name: nameOf(row) }
                    "
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
    </div>

    <dba-action-menu
      #actions
      label="jur.representatives.actions"
      [items]="actionItems()"
      (picked)="onAction($event)"
    />

    @if (adding()) {
      <dba-legal-entity-representative-form
        [entityName]="entity().businessName"
        [linked]="linked()"
        [busy]="pending.key() === 'add'"
        (submitted)="add($event)"
        (dismissed)="adding.set(false)"
      />
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
  styles: `
    .rep {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .rep__more {
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

    .rep__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .rep__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }
  `,
})
export class LegalEntityRepresentativesTabComponent {
  readonly entity = input.required<LegalEntityDetail>();
  readonly changed = output<LegalEntityDetail>();

  private readonly api = inject(LegalEntitiesApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly signersPath = sectionPath('signers');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly adding = signal(false);
  protected readonly acting = signal<LegalEntityRepresentative | null>(null);
  protected readonly linked = computed(() =>
    this.entity().representatives.map((row) => row.signerId),
  );
  protected readonly actionItems = computed<ActionMenuItem[]>(() => [
    this.acting()?.isLegalRep
      ? { key: 'role', labelKey: 'jur.representatives.menu.toProxy' }
      : { key: 'role', labelKey: 'jur.representatives.menu.toLegalRep' },
    { key: 'remove', labelKey: 'jur.representatives.menu.remove', danger: true, separated: true },
  ]);

  protected nameOf(row: LegalEntityRepresentative): string {
    return row.fullName || this.label('jur.representatives.noName');
  }

  protected onAction(key: string): void {
    const row = this.acting();
    if (!row) return;
    if (key === 'role') void this.changeRole(row);
    if (key === 'remove') void this.remove(row);
  }

  protected async add(value: {
    signerId: string;
    isLegalRep: boolean;
    reason: string;
  }): Promise<void> {
    await this.pending.run('add', async () => {
      try {
        this.changed.emit(
          await firstValueFrom(
            this.api.addRepresentative(
              this.entity().id,
              value.signerId,
              value.isLegalRep,
              value.reason,
            ),
          ),
        );
        this.adding.set(false);
        this.notify.success(this.label('jur.representatives.added'));
      } catch (error) {
        this.failed(error);
      }
    });
  }

  private async changeRole(row: LegalEntityRepresentative): Promise<void> {
    const next = !row.isLegalRep;
    const answer = await this.dialogs.open({
      icon: 'pencil',
      title: next ? 'jur.representatives.toLegalRepTitle' : 'jur.representatives.toProxyTitle',
      message: 'jur.representatives.roleMessage',
      params: { name: this.nameOf(row), entity: this.entity().businessName },
      confirmLabel: 'jur.representatives.roleConfirm',
      reason: REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const reason = answer.reason;
    await this.pending.run(row.signerId, async () => {
      try {
        this.changed.emit(
          await firstValueFrom(
            this.api.updateRepresentative(this.entity().id, row.signerId, next, reason),
          ),
        );
        this.notify.success(this.label('jur.representatives.roleChanged'));
      } catch (error) {
        this.failed(error);
      }
    });
  }

  private async remove(row: LegalEntityRepresentative): Promise<void> {
    const params = { name: this.nameOf(row), entity: this.entity().businessName };
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'trash',
      title: 'jur.representatives.removeTitle',
      message: 'jur.representatives.removeMessage',
      params,
      confirmLabel: 'jur.representatives.menu.remove',
      reason: REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const reason = answer.reason;
    await this.pending.run(row.signerId, async () => {
      try {
        this.changed.emit(
          await firstValueFrom(
            this.api.removeRepresentative(this.entity().id, row.signerId, reason),
          ),
        );
        this.notify.success(this.label('jur.representatives.removed', params));
      } catch (error) {
        this.failed(error);
      }
    });
  }

  private failed(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && LEGAL_ENTITY_ERRORS.includes(code);
    this.notify.error(this.label(known ? `jur.error.${code}` : 'jur.error.generic'));
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
