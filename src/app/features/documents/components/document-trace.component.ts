import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuditEventComponent, type AuditActorKind } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import type { TraceEvent } from '../data/documents.models';
import { actorKindOf, traceKeyOf } from '../data/document-view';
import { TRACE_KEYS } from '../data/trace-keys';
import { traceReadingOf, type RemovedSigner, type TraceLine } from '../data/trace-reading';

type TraceFilter = 'all' | 'failed';

interface LineView {
  key: string;
  params?: Record<string, string | number>;
  failed: boolean;
  terms: string;
}

interface TraceView {
  id: string;
  kind: AuditActorKind;
  actor: string;
  key: string | null;
  code: string;
  lines: LineView[];
  failed: boolean;
  meta: string;
  copy?: RemovedSigner;
  cut?: RemovedSigner;
}

const REVOKED = 'admin.signer_links_revoked';

const revokedSince = (events: readonly TraceEvent[], identityId: string, since: string): boolean =>
  events.some(
    (event) =>
      event.type === REVOKED &&
      event.details?.['identityId'] === identityId &&
      Date.parse(event.timestamp) >= Date.parse(since),
  );

@Component({
  selector: 'dba-document-trace',
  imports: [
    TranslatePipe,
    AuditEventComponent,
    ButtonComponent,
    EmptyStateComponent,
    FilterPillsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tr">
      @if (views().length === 0) {
        <dba-empty-state titleKey="docs.traceUi.empty" />
      } @else {
        <div class="tr__tools">
          <db-filter-pills
            [pills]="pills()"
            [active]="filter()"
            [label]="'docs.traceUi.filter.label' | translate"
            (activeChange)="pick($event)"
          />
        </div>
        @if (shown().length === 0) {
          <dba-empty-state titleKey="docs.traceUi.noFailures" />
        }
        @for (view of shown(); track view.id; let last = $last) {
          <dba-audit-event [kind]="view.kind" [actor]="view.actor" [meta]="view.meta" [last]="last">
            @if (view.key) {
              {{ view.key | translate }}
            } @else {
              &ngsp;<code class="dba-ref">{{ view.code }}</code>
            }
            @for (line of view.lines; track $index) {
              <span class="tr__line" [class.tr__line--failed]="line.failed">
                {{ line.key | translate: line.params }}
                @if (line.terms) {
                  <span class="tr__term">{{ line.terms }}</span>
                }
              </span>
            }
            @if (view.copy || view.cut) {
              <span class="tr__action">
                @if (view.copy; as item) {
                  <button dba-button variant="secondary" (click)="removedCopy.emit(item)">
                    {{ 'docs.traceUi.removal.copy' | translate }}
                  </button>
                }
                @if (view.cut; as item) {
                  <button
                    dba-button
                    variant="secondary"
                    [busy]="pendingKey() === 'signer:' + item.identityId"
                    [disabled]="!!pendingKey()"
                    (click)="revokeRemoved.emit(item)"
                  >
                    {{ 'docs.signer.revokeLinks' | translate }}
                  </button>
                }
              </span>
            }
          </dba-audit-event>
        }
      }
    </section>
  `,
  styles: `
    .tr {
      padding: 16px 18px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .tr__tools {
      margin: 0 0 14px;
    }

    .tr__line {
      display: block;
      margin-top: 2px;
      color: var(--dba-text-soft);
    }

    .tr__line--failed {
      color: var(--dba-state-suspended-fg);
    }

    .tr__term {
      font-weight: 600;
    }

    .tr__action {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class DocumentTraceComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly events = input.required<readonly TraceEvent[]>();
  readonly canManage = input(false);
  readonly pendingKey = input<string | null>(null);
  readonly removedCopy = output<RemovedSigner>();
  readonly revokeRemoved = output<RemovedSigner>();

  protected readonly filter = signal<TraceFilter>('all');

  protected readonly views = computed<TraceView[]>(() =>
    this.events().map((event, index) => {
      const reading = traceReadingOf(event);
      return {
        id: `${event.timestamp}:${index}`,
        kind: actorKindOf(event),
        actor:
          event.actor.type === 'system'
            ? (this.translate.instant('docs.traceUi.system') as string)
            : event.actor.name || event.actor.email || '—',
        key: reading.titleKey ?? traceKeyOf(event.type, TRACE_KEYS),
        code: event.type,
        lines: reading.lines.map((line) => this.lineView(line)),
        failed: reading.failed,
        meta: [
          formatDate(event.timestamp, 'd/MM/y HH:mm:ss', this.locale),
          event.actor.name ? event.actor.email : undefined,
          event.actor.ip,
        ]
          .filter((part) => !!part)
          .join(' · '),
        ...(reading.copy ? { copy: reading.copy } : {}),
        ...(reading.cut &&
        this.canManage() &&
        !revokedSince(this.events(), reading.cut.identityId, event.timestamp)
          ? { cut: reading.cut }
          : {}),
      };
    }),
  );

  protected readonly pills = computed<FilterPill[]>(() => {
    const failed = this.views().filter((view) => view.failed).length;
    return [
      { key: 'all', labelKey: 'docs.traceUi.filter.all', count: this.views().length },
      {
        key: 'failed',
        labelKey: 'docs.traceUi.filter.failed',
        count: failed,
        danger: failed > 0,
      },
    ];
  });

  protected readonly shown = computed(() =>
    this.filter() === 'failed' ? this.views().filter((view) => view.failed) : this.views(),
  );

  protected pick(key: string): void {
    this.filter.set(key === 'failed' ? 'failed' : 'all');
  }

  private lineView(line: TraceLine): LineView {
    return {
      key: line.key,
      params: line.params,
      failed: line.failed === true,
      terms: (line.terms ?? [])
        .map((term) => this.translate.instant(term.key, term.params) as string)
        .join(', '),
    };
  }
}
