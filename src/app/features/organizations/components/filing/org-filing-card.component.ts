import { formatNumber } from '@angular/common';
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
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/ui/notification.service';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { hasFiling } from '../../data/org-filing';
import { OrgFilingApi } from '../../data/org-filing.api';
import type { FilingPrefixBody, PlatformFilingView } from '../../data/org-filing.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { FilingPrefixFormComponent } from './filing-prefix-form.component';

const PREFIX_ERRORS = ['PREFIJO_INVALIDO', 'PREFIJO_EN_USO'];

@Component({
  selector: 'dba-org-filing-card',
  imports: [TranslatePipe, ButtonComponent, SectionLoaderComponent, FilingPrefixFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="fc">
        <header class="fc__head">
          <h2 class="dba-panel">{{ 'orgFiling.title' | translate }}</h2>
          @if (canManage() && view()) {
            <button dba-button variant="secondary" (click)="editing.set(true)">
              {{ 'orgFiling.changePrefix' | translate }}
            </button>
          }
        </header>
        @if (loading()) {
          <db-section-loader [label]="'orgFiling.loading' | translate" />
        } @else if (error()) {
          <p class="dba-body fc__muted">{{ 'orgFiling.error' | translate }}</p>
          <button dba-button variant="secondary" class="fc__retry" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        } @else if (view(); as filing) {
          <dl class="fc__dl">
            <dt>{{ 'orgFiling.balance' | translate }}</dt>
            <dd class="dba-mono">{{ balanceText() }}</dd>
            <dt>{{ 'orgFiling.prefix' | translate }}</dt>
            <dd class="fc__prefix">
              @if (filing.prefix) {
                <span class="dba-mono">{{ filing.prefix }}</span>
                <span class="dba-meta">{{
                  'orgFiling.example' | translate: { example: filing.example }
                }}</span>
              } @else {
                <span class="fc__muted">{{ 'orgFiling.noPrefix' | translate }}</span>
              }
            </dd>
          </dl>
        }
      </section>
    }

    @if (editing() && view(); as filing) {
      <dba-filing-prefix-form
        [current]="filing.prefix"
        [busy]="saving()"
        (submitted)="changePrefix($event)"
        (dismissed)="editing.set(false)"
      />
    }
  `,
  styles: `
    .fc {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .fc__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .fc__dl {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .fc__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .fc__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .fc__prefix {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .fc__muted {
      margin: 0;
      color: var(--dba-text-muted);
    }

    .fc__retry {
      align-self: flex-start;
    }
  `,
})
export class OrgFilingCardComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(OrgFilingApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal(false);
  protected readonly view = signal<PlatformFilingView | null>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly moduleOn = computed(() => this.org().modules.includes('radicacion'));
  protected readonly visible = computed(() => this.moduleOn() || hasFiling(this.view()));

  protected readonly balanceText = computed(() => {
    const balance = this.view()?.balance;
    if (!balance) return '';
    if (balance.unlimited) return this.t('orgFiling.unlimited');
    return this.t(balance.remaining === 1 ? 'orgFiling.one' : 'orgFiling.count', {
      count: formatNumber(balance.remaining, this.locale),
    });
  });

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const view = await firstValueFrom(this.api.view(this.orgId()));
      if (current()) this.view.set(view);
    } catch {
      if (!current()) return;
      this.view.set(null);
      this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async changePrefix(body: FilingPrefixBody): Promise<void> {
    this.saving.set(true);
    try {
      const view = await firstValueFrom(this.api.changePrefix(this.orgId(), body));
      this.view.set(view);
      this.editing.set(false);
      this.notify.success(this.t('orgFiling.done', { prefix: view.prefix }));
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && PREFIX_ERRORS.includes(code);
      this.notify.error(this.t(known ? `orgFiling.errors.${code}` : 'orgFiling.errors.generic'));
    } finally {
      this.saving.set(false);
    }
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
