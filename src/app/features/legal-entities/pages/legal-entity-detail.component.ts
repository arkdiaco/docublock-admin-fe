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
import { initialsOf } from '../../../shared/domain/initials';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  TargetHistoryComponent,
  type TargetHistoryLoader,
} from '../../../shared/ui/target-history.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import {
  LegalEntityFormComponent,
  type LegalEntityFormResult,
} from '../components/legal-entity-form.component';
import { LegalEntityRepresentativesTabComponent } from '../components/legal-entity-representatives-tab.component';
import { LEGAL_ENTITY_ERRORS, LegalEntitiesApi } from '../data/legal-entities.api';
import type { LegalEntityDetail } from '../data/legal-entities.models';

type DetailTab = 'representatives' | 'history';

@Component({
  selector: 'dba-legal-entity-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    LegalEntityFormComponent,
    LegalEntityRepresentativesTabComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    TargetHistoryComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'jur.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="jur.detail.missingTitle" leadKey="jur.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'jur.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="jur.detail.errorTitle" leadKey="jur.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (entity(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="item.businessName"
          [state]="item.active ? 'active' : 'closed'"
          [stateLabelKey]="item.active ? 'jur.state.active' : 'jur.state.inactive'"
          [meta]="item.identification"
        />

        @if (canManage()) {
          <div class="bd__actions">
            <button dba-button variant="secondary" (click)="editing.set(true)">
              {{ 'jur.action.edit' | translate }}
            </button>
            @if (item.active) {
              <button
                dba-button
                variant="destructive"
                [busy]="pending.key() === 'state'"
                [disabled]="!!pending.key()"
                (click)="setActive(false)"
              >
                {{ 'jur.action.deactivate' | translate }}
              </button>
            } @else {
              <button
                dba-button
                variant="secondary"
                [busy]="pending.key() === 'state'"
                [disabled]="!!pending.key()"
                (click)="setActive(true)"
              >
                {{ 'jur.action.activate' | translate }}
              </button>
            }
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'jur.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'jur.detail.businessName' | translate }}</dt>
            <dd>{{ item.businessName }}</dd>
            <dt>{{ 'jur.detail.identification' | translate }}</dt>
            <dd class="dba-mono">{{ item.identification }}</dd>
            <dt>{{ 'jur.detail.country' | translate }}</dt>
            <dd>{{ item.countryName || '—' }}</dd>
            <dt>{{ 'jur.detail.kind' | translate }}</dt>
            <dd>{{ item.kindPersonName || '—' }}</dd>
            <dt>{{ 'jur.detail.companySigner' | translate }}</dt>
            <dd>
              @if (item.companySignerId) {
                <a class="bd__link" [routerLink]="[signersPath, item.companySignerId]">{{
                  'jur.detail.companySignerLink' | translate
                }}</a>
              } @else {
                —
              }
            </dd>
            <dt>{{ 'jur.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
          </dl>
        </section>

        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'jur.tab.label' | translate"
          (picked)="tab.set($any($event))"
        />
        @switch (tab()) {
          @case ('representatives') {
            <dba-legal-entity-representatives-tab [entity]="item" (changed)="entity.set($event)" />
          }
          @case ('history') {
            <dba-target-history [load]="history()" />
          }
        }
      </div>

      @if (editing()) {
        <dba-legal-entity-form
          [entity]="item"
          [busy]="pending.key() === 'edit'"
          (submitted)="save($event)"
          (dismissed)="editing.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class LegalEntityDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(LegalEntitiesApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('legalEntities');
  protected readonly signersPath = sectionPath('signers');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly editing = signal(false);
  protected readonly tab = signal<DetailTab>('representatives');
  protected readonly entity = signal<LegalEntityDetail | null>(null);
  protected readonly initials = computed(() => initialsOf(this.entity()?.businessName ?? ''));
  protected readonly history = computed<TargetHistoryLoader>(() => {
    const id = this.id();
    return (page, limit) => this.api.history(id, page, limit);
  });
  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'representatives',
      label: this.label('jur.tab.representatives'),
      count: this.entity()?.representatives.length,
    },
    ...(this.auth.canRead('platform')
      ? [{ key: 'history', label: this.label('jur.tab.history') }]
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

  protected async save(result: LegalEntityFormResult): Promise<void> {
    if (result.kind !== 'edit') return;
    await this.pending.run('edit', async () => {
      try {
        this.entity.set(
          await firstValueFrom(this.api.update(this.id(), result.changes, result.reason)),
        );
        this.editing.set(false);
        this.notify.success(this.label('jur.action.edited'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  protected async setActive(active: boolean): Promise<void> {
    const name = this.entity()?.businessName ?? '';
    const answer = await this.dialogs.open({
      ...(active ? {} : { intent: 'danger' as const }),
      icon: active ? 'check' : 'lock',
      title: active ? 'jur.action.activateTitle' : 'jur.action.deactivateTitle',
      message: active ? 'jur.action.activateMessage' : 'jur.action.deactivateMessage',
      params: { name },
      confirmLabel: active ? 'jur.action.activate' : 'jur.action.deactivate',
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
    await this.pending.run('state', async () => {
      try {
        this.entity.set(await firstValueFrom(this.api.setActive(this.id(), active, reason)));
        this.notify.success(this.label(active ? 'jur.action.activated' : 'jur.action.deactivated'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  private notifyFailure(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && LEGAL_ENTITY_ERRORS.includes(code);
    this.notify.error(this.label(known ? `jur.error.${code}` : 'jur.error.generic'));
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const entity = await firstValueFrom(this.api.get(id));
      if (!current()) return;
      this.entity.set(entity);
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
