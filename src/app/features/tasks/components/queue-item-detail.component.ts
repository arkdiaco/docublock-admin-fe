import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { canSeeSection, sectionPath } from '../../../core/layout/console-nav';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { hasError, hasOrganization, hasRetries, kindKeyOf, noRetryKeyOf } from '../data/queue-view';
import type { QueueItem, QueueKey } from '../data/tasks.models';

@Component({
  selector: 'dba-queue-item-detail',
  imports: [TranslatePipe, RouterLink, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="clock"
      [title]="'task.queue.' + queue() + '.name' | translate"
      [maxWidth]="620"
      [confirmLabel]="canRetry() ? 'task.retry.action' : 'common.close'"
      [cancelable]="canRetry()"
      cancelLabel="common.close"
      (confirmed)="canRetry() ? retry.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dl class="item">
        @if (withOrganization()) {
          <dt>{{ 'task.col.organization' | translate }}</dt>
          <dd>
            @if (item().organization; as organization) {
              @if (canOpenOrganization()) {
                <a class="dba-ref" [routerLink]="[organizationsPath, organization.id]">{{
                  organization.name || organization.id
                }}</a>
              } @else {
                {{ organization.name || organization.id }}
              }
            } @else {
              —
            }
          </dd>
        }
        @if (subtitle()) {
          <dt>{{ 'task.col.item' | translate }}</dt>
          <dd>{{ subtitle() }}</dd>
        }
        <dt>{{ 'task.col.state' | translate }}</dt>
        <dd>{{ 'task.itemState.' + item().state | translate }}</dd>
        @if (withRetries()) {
          <dt>{{ 'task.col.attempts' | translate }}</dt>
          <dd class="dba-mono">{{ item().attempts ?? 0 }}</dd>
          <dt>{{ 'task.col.next' | translate }}</dt>
          <dd class="dba-mono">{{ when(item().nextAt) }}</dd>
        }
        <dt>{{ 'task.col.created' | translate }}</dt>
        <dd class="dba-mono">{{ when(item().createdAt) }}</dd>
        <dt>{{ 'task.col.updated' | translate }}</dt>
        <dd class="dba-mono">{{ when(item().updatedAt) }}</dd>
      </dl>

      @if (withError()) {
        <h3 class="dba-panel item__heading">{{ 'task.col.error' | translate }}</h3>
        @if (item().error; as error) {
          <pre class="item__error dba-mono">{{ error }}</pre>
        } @else {
          <p class="dba-meta item__none">{{ 'task.noError' | translate }}</p>
        }
      }

      @if (noRetryKey(); as key) {
        <p class="dba-meta item__note">{{ key | translate }}</p>
      }
    </db-modal-shell>
  `,
  styles: `
    .item {
      display: grid;
      grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: var(--dba-text-label);
    }

    .item dt {
      color: var(--dba-text-muted);
    }

    .item dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .item__heading {
      margin: 18px 0 8px;
    }

    .item__none {
      margin: 0;
    }

    .item__note {
      margin: 14px 0 0;
    }

    .item__error {
      margin: 0;
      padding: 12px;
      max-height: 260px;
      overflow: auto;
      border: 1px solid var(--dba-border);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-size: var(--dba-text-small);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class QueueItemDetailComponent {
  readonly queue = input.required<QueueKey>();
  readonly item = input.required<QueueItem>();
  readonly dismissed = output<void>();
  readonly retry = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly canOpenOrganization = computed(() =>
    canSeeSection(this.auth.platformPermissions(), 'organizations'),
  );
  private readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly canRetry = computed(() => this.canManage() && this.item().retryable);
  protected readonly noRetryKey = computed(() =>
    this.canManage() ? noRetryKeyOf(this.queue(), this.item()) : null,
  );
  protected readonly withOrganization = computed(() => hasOrganization(this.queue()));
  protected readonly withRetries = computed(() => hasRetries(this.queue()));
  protected readonly withError = computed(() => hasError(this.queue()));
  protected readonly subtitle = computed(() => {
    const { kind, label } = this.item();
    const key = kind ? kindKeyOf(kind) : null;
    const kindText = key ? (this.translate.instant(key) as string) : kind;
    return [kindText, label].filter(Boolean).join(' · ');
  });

  protected when(value: string | null): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }
}
