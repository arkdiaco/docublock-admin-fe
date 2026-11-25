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
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { safeDate } from '../../../shared/i18n/safe-date';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SignersApi } from '../data/signers.api';
import type { SignerChangeField, SignerIntegrationChange } from '../data/signers.models';

const LIMIT = 20;

@Component({
  selector: 'dba-signer-integration-changes-tab',
  imports: [
    TranslatePipe,
    AuditEventComponent,
    ButtonComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'sig.changes.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.changes.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.changes.emptyTitle" leadKey="sig.changes.emptyLead" />
      </div>
    } @else {
      <section class="bd__card">
        <p class="dba-meta">
          {{ 'sig.changes.count' | translate: { shown: items().length, total: total() } }}
        </p>
        <div class="ic__events">
          @for (row of items(); track row.id; let last = $last) {
            <dba-audit-event
              kind="system"
              [actor]="row.organization.name || ('sig.changes.unknownOrg' | translate)"
              [meta]="metaOf(row)"
              [last]="last && !hasMore()"
            >
              <span class="ic__what">{{ 'sig.changes.sent' | translate }}</span>
              @for (change of row.changes; track change.field) {
                <span class="ic__change">
                  <span class="ic__field">{{
                    'sig.changes.field.' + change.field | translate
                  }}</span>
                  <span class="ic__before dba-mono">{{
                    valueOf(change.field, change.before)
                  }}</span>
                  <span class="ic__arrow" aria-hidden="true">→</span>
                  <span class="ic__after dba-mono">{{ valueOf(change.field, change.after) }}</span>
                </span>
              }
            </dba-audit-event>
          }
        </div>
        @if (hasMore()) {
          <button dba-button variant="secondary" [busy]="loadingMore()" (click)="more()">
            {{ 'sig.changes.more' | translate }}
          </button>
        }
      </section>
    }
  `,
  styles: `
    .ic__events {
      display: flex;
      flex-direction: column;
    }

    .ic__what {
      margin-left: 8px;
    }

    .ic__change {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      margin-top: 4px;
    }

    .ic__field {
      min-width: 140px;
      color: var(--dba-text-muted);
    }

    .ic__before {
      color: var(--dba-text-muted);
      text-decoration: line-through;
      overflow-wrap: anywhere;
    }

    .ic__arrow {
      color: var(--dba-text-soft);
    }

    .ic__after {
      overflow-wrap: anywhere;
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class SignerIntegrationChangesTabComponent {
  readonly signerId = input.required<string>();

  private readonly api = inject(SignersApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);
  protected readonly items = signal<SignerIntegrationChange[]>([]);
  protected readonly total = signal(0);
  private readonly page = signal(1);
  protected readonly hasMore = computed(() => this.items().length < this.total());

  constructor() {
    effect(() => {
      this.signerId();
      untracked(() => void this.reload());
    });
  }

  protected metaOf(row: SignerIntegrationChange): string {
    return row.createdAt
      ? `${safeDate(row.createdAt, 'd/MM/y HH:mm', this.locale, 'UTC')} UTC`
      : '';
  }

  protected valueOf(field: SignerChangeField, value: string | undefined): string {
    if (!value) return '—';
    return field === 'expeditionDate' ? safeDate(value, 'd/MM/y', this.locale, 'UTC') : value;
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.page.set(1);
    try {
      const page = await firstValueFrom(this.api.integrationChanges(this.signerId(), 1, LIMIT));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async more(): Promise<void> {
    const current = this.latest.start();
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const page = await firstValueFrom(this.api.integrationChanges(this.signerId(), next, LIMIT));
      if (!current()) return;
      this.items.update((items) => [...items, ...page.items]);
      this.total.set(page.total);
      this.page.set(next);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loadingMore.set(false);
    }
  }
}
