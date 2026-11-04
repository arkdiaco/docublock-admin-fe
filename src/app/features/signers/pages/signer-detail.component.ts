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
import { SignerDocumentsTabComponent } from '../components/signer-documents-tab.component';
import { SignerEditFormComponent } from '../components/signer-edit-form.component';
import { SignerOneTouchTabComponent } from '../components/signer-one-touch-tab.component';
import { SignerOrganizationsTabComponent } from '../components/signer-organizations-tab.component';
import { SIGNER_ERRORS, SignersApi } from '../data/signers.api';
import type { PlatformSignerDetail, SignerChanges } from '../data/signers.models';

type DetailTab = 'organizations' | 'documents' | 'oneTouch' | 'history';

@Component({
  selector: 'dba-signer-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    SignerDocumentsTabComponent,
    SignerEditFormComponent,
    SignerOneTouchTabComponent,
    SignerOrganizationsTabComponent,
    TargetHistoryComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'sig.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.detail.missingTitle" leadKey="sig.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'sig.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.detail.errorTitle" leadKey="sig.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (signer(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="displayName()"
          [state]="item.identified ? 'active' : 'trial'"
          [stateLabelKey]="item.identified ? 'sig.state.identified' : 'sig.state.unidentified'"
          [meta]="item.identification ?? ''"
        />

        @if (canManage()) {
          <div class="bd__actions">
            <button dba-button variant="secondary" (click)="editing.set(true)">
              {{ 'sig.action.edit' | translate }}
            </button>
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'sig.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'sig.detail.kind' | translate }}</dt>
            <dd>{{ item.kindPersonName || '—' }}</dd>
            @if (item.businessName) {
              <dt>{{ 'sig.detail.businessName' | translate }}</dt>
              <dd>{{ item.businessName }}</dd>
            }
            <dt>{{ 'sig.detail.document' | translate }}</dt>
            <dd class="dba-mono">
              {{ item.identificationTypeName ? item.identificationTypeName + ' · ' : ''
              }}{{ item.identification || '—' }}
            </dd>
            <dt>{{ 'sig.detail.email' | translate }}</dt>
            <dd>{{ item.email || '—' }}</dd>
            <dt>{{ 'sig.detail.personalMail' | translate }}</dt>
            <dd>{{ item.personalMail || '—' }}</dd>
            <dt>{{ 'sig.detail.cellphone' | translate }}</dt>
            <dd class="dba-mono">{{ item.cellphone || '—' }}</dd>
            <dt>{{ 'sig.detail.country' | translate }}</dt>
            <dd>{{ item.countryName || '—' }}</dd>
            <dt>{{ 'sig.detail.expedition' | translate }}</dt>
            <dd>{{ expedition(item) }}</dd>
            <dt>{{ 'sig.detail.birthDate' | translate }}</dt>
            <dd class="dba-mono">{{ utcDay(item.birthDate) }}</dd>
            <dt>{{ 'sig.detail.legalRep' | translate }}</dt>
            <dd>{{ (item.isLegalRep ? 'sig.yes' : 'sig.no') | translate }}</dd>
            <dt>{{ 'sig.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
          </dl>
        </section>

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'sig.autoSign.title' | translate }}</h2>
          @if (item.autoSign) {
            <dl class="bd__dl">
              <dt>{{ 'sig.autoSign.state' | translate }}</dt>
              <dd>{{ 'sig.autoSign.active' | translate }}</dd>
              <dt>{{ 'sig.autoSign.enabledAt' | translate }}</dt>
              <dd class="dba-mono">{{ moment(item.autoSignAuth?.enabledAt) }}</dd>
              <dt>{{ 'sig.autoSign.verifiedAt' | translate }}</dt>
              <dd class="dba-mono">{{ moment(item.autoSignAuth?.otpVerifiedAt) }}</dd>
              <dt>{{ 'sig.autoSign.channels' | translate }}</dt>
              <dd>{{ item.autoSignAuth?.otpChannels?.join(', ') || '—' }}</dd>
              <dt>{{ 'sig.autoSign.ip' | translate }}</dt>
              <dd class="dba-mono">{{ item.autoSignAuth?.ip || '—' }}</dd>
              <dt>{{ 'sig.autoSign.browser' | translate }}</dt>
              <dd>{{ item.autoSignAuth?.browser || '—' }}</dd>
            </dl>
            @if (canManage()) {
              <div class="bd__actions">
                <button
                  dba-button
                  variant="destructive"
                  [busy]="pending.key() === 'autoSign'"
                  [disabled]="!!pending.key()"
                  (click)="disableAutoSign()"
                >
                  {{ 'sig.autoSign.disable' | translate }}
                </button>
              </div>
            }
          } @else {
            <p class="dba-meta">{{ 'sig.autoSign.inactiveLead' | translate }}</p>
          }
        </section>

        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'sig.tab.label' | translate"
          (picked)="tab.set($any($event))"
        />
        @switch (tab()) {
          @case ('organizations') {
            <dba-signer-organizations-tab
              [signer]="item"
              [signerName]="displayName()"
              (changed)="signer.set($event)"
            />
          }
          @case ('documents') {
            <dba-signer-documents-tab [identityId]="item.identityId" />
          }
          @case ('oneTouch') {
            <dba-signer-one-touch-tab
              [signerId]="item.id"
              [signerName]="displayName()"
              (changed)="refresh()"
            />
          }
          @case ('history') {
            <dba-target-history [load]="history()" />
          }
        }
      </div>

      @if (editing()) {
        <dba-signer-edit-form
          [signer]="item"
          [busy]="pending.key() === 'edit'"
          (submitted)="save($event)"
          (dismissed)="editing.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class SignerDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(SignersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('signers');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly editing = signal(false);
  protected readonly tab = signal<DetailTab>('organizations');
  protected readonly signer = signal<PlatformSignerDetail | null>(null);
  protected readonly displayName = computed(() => {
    const signer = this.signer();
    if (!signer) return '';
    return signer.fullName || signer.businessName || this.label('sig.noName');
  });
  protected readonly initials = computed(() => initialsOf(this.displayName()));
  protected readonly history = computed<TargetHistoryLoader>(() => {
    const id = this.id();
    return (page, limit) => this.api.history(id, page, limit);
  });
  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'organizations',
      label: this.label('sig.tab.organizations'),
      count: this.signer()?.organizations.length,
    },
    ...(this.auth.canRead('operations')
      ? [{ key: 'documents', label: this.label('sig.tab.documents') }]
      : []),
    { key: 'oneTouch', label: this.label('sig.tab.oneTouch') },
    ...(this.auth.canRead('platform')
      ? [{ key: 'history', label: this.label('sig.tab.history') }]
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

  protected utcDay(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale, 'UTC') : '—';
  }

  protected moment(value?: string): string {
    return value ? `${formatDate(value, 'd/MM/y HH:mm', this.locale, 'UTC')} UTC` : '—';
  }

  protected expedition(signer: PlatformSignerDetail): string {
    const date = signer.expeditionDate ? this.utcDay(signer.expeditionDate) : '';
    return [signer.expeditionCityName, date].filter(Boolean).join(' · ') || '—';
  }

  protected async refresh(): Promise<void> {
    try {
      this.signer.set(await firstValueFrom(this.api.get(this.id())));
    } catch {
      return;
    }
  }

  protected async save(value: { changes: SignerChanges; reason: string }): Promise<void> {
    await this.pending.run('edit', async () => {
      try {
        this.signer.set(
          await firstValueFrom(this.api.update(this.id(), value.changes, value.reason)),
        );
        this.editing.set(false);
        this.notify.success(this.label('sig.edit.done'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  protected async disableAutoSign(): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'lock',
      title: 'sig.autoSign.disableTitle',
      message: 'sig.autoSign.disableMessage',
      params: { name: this.displayName() },
      confirmLabel: 'sig.autoSign.disable',
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
    await this.pending.run('autoSign', async () => {
      try {
        this.signer.set(await firstValueFrom(this.api.disableAutoSign(this.id(), reason)));
        this.notify.success(this.label('sig.autoSign.disabled'));
      } catch (error) {
        this.notifyFailure(error);
      }
    });
  }

  private notifyFailure(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && SIGNER_ERRORS.includes(code);
    this.notify.error(this.label(known ? `sig.error.${code}` : 'sig.error.generic'));
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const signer = await firstValueFrom(this.api.get(id));
      if (!current()) return;
      this.signer.set(signer);
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
