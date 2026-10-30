import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import type { TicketAuditEntry } from '../data/support.models';
import { AUTHOR_KIND, auditValueKindOf } from '../data/ticket-view';

interface EventView {
  key: string;
  kind: 'person' | 'system' | 'support';
  actor: string;
  text: string;
  change: string;
  meta: string;
}

@Component({
  selector: 'dba-ticket-history',
  imports: [TranslatePipe, AuditEventComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hi">
      @if (views().length === 0) {
        <dba-empty-state titleKey="support.history.empty" />
      } @else {
        <p class="dba-meta hi__count">
          {{ 'support.history.count' | translate: { n: views().length } }}
        </p>
        @for (event of views(); track event.key; let last = $last) {
          <dba-audit-event
            [kind]="event.kind"
            [actor]="event.actor"
            [meta]="event.meta"
            [last]="last"
          >
            {{ event.text }}
            @if (event.change) {
              <span class="hi__change">{{ event.change }}</span>
            }
          </dba-audit-event>
        }
      }
    </section>
  `,
  styles: `
    .hi {
      display: flex;
      flex-direction: column;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .hi__count {
      margin: 0 0 12px;
    }

    .hi__change {
      margin-left: 6px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-soft);
    }
  `,
})
export class TicketHistoryComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly entries = input.required<readonly TicketAuditEntry[]>();
  readonly staffNames = input<ReadonlyMap<string, string>>(new Map());

  protected readonly views = computed<EventView[]>(() =>
    [...this.entries()]
      .map((entry, index) => ({ entry, index }))
      .sort(
        (a, b) =>
          new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime() ||
          b.index - a.index,
      )
      .map(({ entry, index }) => ({
        key: `${index}:${entry.createdAt}`,
        kind: AUTHOR_KIND[entry.byType],
        actor: entry.byName || this.label(`support.author.${entry.byType}`),
        text: this.label(`support.audit.${entry.action}`),
        change: this.changeOf(entry),
        meta: formatDate(entry.createdAt, 'd/MM/y HH:mm', this.locale),
      })),
  );

  private changeOf(entry: TicketAuditEntry): string {
    const kind = auditValueKindOf(entry.action);
    if (kind === 'none') return '';
    const show = (value: string | null): string => {
      if (!value) return kind === 'agent' ? this.label('support.unassigned') : '—';
      if (kind === 'agent') return this.staffNames().get(value) ?? value;
      return this.label(`support.${kind}.${value}`);
    };
    return `${show(entry.from)} → ${show(entry.to)}`;
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
