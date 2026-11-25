import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { safeDate } from '../../../shared/i18n/safe-date';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import {
  failureReasonKeyOf,
  type AutomaticFailure,
  type FailureRecord,
  type NoticeRecord,
} from '../data/automatic-failure';
import type { TicketSummary } from '../data/support.models';

interface FailureView {
  key: string;
  reason: string;
  detail: string;
  blocked: boolean;
  meta: string;
}

interface NoticeView {
  key: string;
  actor: string;
  text: string;
  messageId?: string;
  sent: boolean;
  meta: string;
}

const newestFirst = <T extends { at: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

@Component({
  selector: 'dba-ticket-failure',
  imports: [TranslatePipe, RouterLink, AuditEventComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tf">
      <section class="tf__card tf__summary">
        <h2 class="dba-panel">{{ 'support.failure.summary' | translate }}</h2>
        <dl class="tf__dl">
          <dt>{{ 'support.failure.signer' | translate }}</dt>
          <dd>{{ ticket().requesterName || '—' }}</dd>
          <dt>{{ 'support.failure.phone' | translate }}</dt>
          <dd class="dba-mono">{{ ticket().requesterPhone || '—' }}</dd>
          <dt>{{ 'support.failure.email' | translate }}</dt>
          <dd class="dba-mono">{{ failure().signerEmail || '—' }}</dd>
          <dt>{{ 'support.failure.document' | translate }}</dt>
          <dd>
            @if (ticket().documentId; as documentId) {
              <a class="tf__link" [routerLink]="[docsPath, documentId]">{{
                failure().documentName || documentId
              }}</a>
            } @else {
              {{ failure().documentName || '—' }}
            }
          </dd>
          @if (latest(); as last) {
            <dt>{{ 'support.failure.lastFailure' | translate }}</dt>
            <dd>{{ last.reason }}</dd>
            <dt>{{ 'support.failure.state' | translate }}</dt>
            <dd>
              <dba-org-state
                [state]="last.blocked ? 'suspended' : 'trial'"
                [labelKey]="last.blocked ? 'support.failure.blocked' : 'support.failure.canRetry'"
                variant="inline"
              />
            </dd>
          }
        </dl>
      </section>

      <div class="tf__cols">
        <section class="tf__card tf__failures">
          <h2 class="dba-panel">{{ 'support.failure.failures' | translate }}</h2>
          @if (failures().length === 0) {
            <p class="dba-meta tf__empty">{{ 'support.failure.failuresEmpty' | translate }}</p>
          } @else {
            @for (item of failures(); track item.key; let last = $last) {
              <dba-audit-event kind="system" [actor]="item.reason" [meta]="item.meta" [last]="last">
                <span class="tf__detail">{{ item.detail }}</span>
                @if (item.blocked) {
                  <dba-org-state
                    state="suspended"
                    labelKey="support.failure.blockedTag"
                    variant="inline"
                  />
                }
              </dba-audit-event>
            }
          }
        </section>

        <section class="tf__card tf__notices">
          <h2 class="dba-panel">{{ 'support.failure.notices' | translate }}</h2>
          @if (notices().length === 0) {
            <p class="dba-meta tf__empty">{{ 'support.failure.noticesEmpty' | translate }}</p>
          } @else {
            @for (item of notices(); track item.key; let last = $last) {
              <dba-audit-event kind="system" [actor]="item.actor" [meta]="item.meta" [last]="last">
                <span [class.tf__error]="!item.sent">{{ item.text }}</span>
                @if (item.messageId) {
                  <span class="tf__id"
                    >{{ 'support.failure.messageId' | translate }}:
                    <span class="dba-mono">{{ item.messageId }}</span></span
                  >
                }
              </dba-audit-event>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .tf {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .tf__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .tf__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .tf__card h2 {
      margin: 0;
    }

    .tf__dl {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .tf__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .tf__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .tf__link {
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .tf__link:hover {
      text-decoration: underline;
    }

    .tf__empty {
      margin: 0;
    }

    .tf__detail {
      margin-right: 8px;
    }

    .tf__error {
      color: var(--dba-text-soft);
    }

    .tf__id {
      display: block;
      margin-top: 2px;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }

    @media (max-width: 960px) {
      .tf__cols {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 520px) {
      .tf__dl {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .tf__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class TicketFailureComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly ticket = input.required<TicketSummary>();
  readonly failure = input.required<AutomaticFailure>();

  protected readonly docsPath = sectionPath('documents');

  protected readonly failures = computed<FailureView[]>(() =>
    newestFirst(this.failure().failures).map((item, index) => this.failureView(item, index)),
  );

  protected readonly latest = computed<FailureView | null>(() => this.failures()[0] ?? null);

  protected readonly notices = computed<NoticeView[]>(() =>
    newestFirst(this.failure().notices).map((item, index) => this.noticeView(item, index)),
  );

  private failureView(item: FailureRecord, index: number): FailureView {
    const parts = [
      item.attempts !== undefined && item.max !== undefined
        ? this.label('support.failure.attempt', { attempts: item.attempts, max: item.max })
        : '',
      this.label('support.failure.code', { code: item.code }),
    ].filter(Boolean);
    return {
      key: `${index}:${item.at}`,
      reason: this.label(failureReasonKeyOf(item)),
      detail: parts.join(' · '),
      blocked: item.blocked,
      meta: this.stamp(item.at),
    };
  }

  private noticeView(item: NoticeRecord, index: number): NoticeView {
    const text = item.sent
      ? item.phone
        ? this.label('support.failure.sent', { phone: item.phone })
        : this.label('support.failure.sentNoPhone')
      : this.label('support.failure.notSent', { error: item.error ?? '—' });
    return {
      key: `${index}:${item.at}`,
      actor: this.label(`support.failure.to.${item.to}`),
      text,
      messageId: item.messageId,
      sent: item.sent,
      meta: this.stamp(item.at),
    };
  }

  private stamp(value: string): string {
    return safeDate(value, 'd/MM/y HH:mm', this.locale);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
