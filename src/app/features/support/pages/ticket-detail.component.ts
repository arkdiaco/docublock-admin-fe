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
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { TicketHistoryComponent } from '../components/ticket-history.component';
import { TicketSlaComponent } from '../components/ticket-sla.component';
import { TicketThreadComponent, type ReplyDraft } from '../components/ticket-thread.component';
import { SupportApi } from '../data/support.api';
import { SUPPORT_ERRORS } from '../data/support-errors';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportAgent,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from '../data/support.models';
import {
  PRIORITY_FAMILY,
  SLA_FAMILY,
  STATUS_FAMILY,
  isOpenStatus,
  slaStateOf,
  staffNamesOf,
} from '../data/ticket-view';

const TAB_KEYS = ['conversation', 'sla', 'history', 'data'] as const;

interface Option {
  id: string;
  label: string;
}

@Component({
  selector: 'dba-ticket-detail',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    RecordHeaderComponent,
    UnderlineTabsComponent,
    ButtonComponent,
    EmptyStateComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    TicketThreadComponent,
    TicketSlaComponent,
    TicketHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'support.d.loading' | translate" />
    } @else if (missing()) {
      <div class="td__panel">
        <dba-empty-state titleKey="support.d.notFoundTitle" leadKey="support.d.notFoundLead" />
        <a dba-button variant="secondary" [routerLink]="supportPath">{{
          'nav.support' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="td__panel">
        <dba-empty-state titleKey="support.d.errorTitle" leadKey="support.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (detail(); as ticket) {
      <div class="td">
        <dba-record-header
          initials="TK"
          [title]="ticket.subject"
          [state]="statusFamily[ticket.status]"
          [stateLabelKey]="'support.status.' + ticket.status"
          [meta]="meta()"
        />

        <div class="td__chips">
          <span class="td__chip">
            <span class="dba-meta">{{ 'support.col.sla' | translate }}</span>
            <dba-org-state
              [state]="slaFamily[slaState()]"
              [labelKey]="'support.sla.' + slaState()"
              variant="inline"
            />
          </span>
          @if (!canManage()) {
            <span class="td__chip">
              <span class="dba-meta">{{ 'support.f.priority' | translate }}</span>
              <dba-org-state
                [state]="priorityFamily[ticket.priority]"
                [labelKey]="'support.priority.' + ticket.priority"
                variant="inline"
              />
            </span>
            <span class="td__chip">
              <span class="dba-meta">{{ 'support.col.agent' | translate }}</span>
              <span class="td__chipValue">{{
                ticket.assignee?.name || ('support.unassigned' | translate)
              }}</span>
            </span>
          }
        </div>

        @if (canManage()) {
          <section class="td__manage" [attr.aria-label]="'support.d.manage' | translate">
            <div class="td__control">
              <label class="td__label" for="ticket-status">{{
                'support.f.status' | translate
              }}</label>
              <p-select
                inputId="ticket-status"
                [options]="statusOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="statusDraft()"
                (ngModelChange)="changeStatus($event)"
                [disabled]="!!pending.key()"
                appendTo="body"
                styleClass="td__select"
              />
            </div>
            <div class="td__control">
              <label class="td__label" for="ticket-priority">{{
                'support.f.priority' | translate
              }}</label>
              <p-select
                inputId="ticket-priority"
                [options]="priorityOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="priorityDraft()"
                (ngModelChange)="changePriority($event)"
                [disabled]="!!pending.key()"
                appendTo="body"
                styleClass="td__select"
              />
            </div>
            <div class="td__control">
              <label class="td__label" for="ticket-agent">{{
                'support.f.agent' | translate
              }}</label>
              <p-select
                inputId="ticket-agent"
                [options]="agentOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="agentDraft()"
                (ngModelChange)="changeAgent($event)"
                [disabled]="!!pending.key() || agentOptions().length === 0"
                [placeholder]="'support.unassigned' | translate"
                [filter]="agentOptions().length > 8"
                appendTo="body"
                styleClass="td__select"
              />
            </div>
            @if (agentsError()) {
              <p class="dba-meta td__warn">{{ 'support.d.agentsError' | translate }}</p>
            }
          </section>
        }

        <db-underline-tabs [tabs]="tabs()" [active]="tab()" (picked)="tab.set($event)" />

        @switch (tab()) {
          @case ('conversation') {
            <dba-ticket-thread
              [messages]="ticket.messages"
              [canReply]="canManage()"
              [sending]="pending.key() === 'reply'"
              [opening]="opening()"
              [closed]="!open()"
              (send)="reply($event)"
              (open)="openAttachment($event)"
            />
          }
          @case ('sla') {
            <dba-ticket-sla [ticket]="ticket" />
          }
          @case ('history') {
            <dba-ticket-history [entries]="ticket.auditLog" [staffNames]="staffNames()" />
          }
          @case ('data') {
            <div class="td__cols">
              <section class="td__card">
                <h2 class="dba-panel">{{ 'support.d.requester' | translate }}</h2>
                <dl class="td__dl">
                  <dt>{{ 'support.d.f.name' | translate }}</dt>
                  <dd>{{ ticket.requesterName || '—' }}</dd>
                  <dt>{{ 'support.d.f.email' | translate }}</dt>
                  <dd class="dba-mono">{{ ticket.requesterEmail || '—' }}</dd>
                  <dt>{{ 'support.d.f.phone' | translate }}</dt>
                  <dd class="dba-mono">{{ ticket.requesterPhone || '—' }}</dd>
                  <dt>{{ 'support.d.f.createdBy' | translate }}</dt>
                  <dd>{{ 'support.author.' + ticket.createdByType | translate }}</dd>
                  <dt>{{ 'support.d.f.org' | translate }}</dt>
                  <dd>
                    @if (ticket.organization; as org) {
                      @if (canOpenOrg()) {
                        <a class="td__link" [routerLink]="[orgsPath, org.id]">{{
                          org.name || org.id
                        }}</a>
                      } @else {
                        {{ org.name || '—' }}
                      }
                    } @else {
                      —
                    }
                  </dd>
                </dl>
              </section>
              <section class="td__card">
                <h2 class="dba-panel">{{ 'support.d.context' | translate }}</h2>
                <dl class="td__dl">
                  <dt>{{ 'support.d.f.number' | translate }}</dt>
                  <dd class="dba-mono">{{ ticket.ticketNumber }}</dd>
                  <dt>{{ 'support.f.category' | translate }}</dt>
                  <dd>{{ 'support.category.' + ticket.category | translate }}</dd>
                  <dt>{{ 'support.f.channel' | translate }}</dt>
                  <dd>{{ 'support.channel.' + ticket.sourceChannel | translate }}</dd>
                  <dt>{{ 'support.d.f.document' | translate }}</dt>
                  <dd>
                    @if (ticket.documentId) {
                      <a class="td__link dba-mono" [routerLink]="[docsPath, ticket.documentId]">{{
                        ticket.documentId
                      }}</a>
                    } @else {
                      —
                    }
                  </dd>
                  <dt>{{ 'support.d.f.signer' | translate }}</dt>
                  <dd class="dba-mono">{{ ticket.signerId || '—' }}</dd>
                  <dt>{{ 'support.d.f.tags' | translate }}</dt>
                  <dd>{{ ticket.tags.length ? ticket.tags.join(', ') : '—' }}</dd>
                  <dt>{{ 'support.d.f.created' | translate }}</dt>
                  <dd class="dba-mono">{{ stamp(ticket.createdAt) }}</dd>
                  <dt>{{ 'support.d.f.updated' | translate }}</dt>
                  <dd class="dba-mono">{{ stamp(ticket.updatedAt) }}</dd>
                </dl>
              </section>
            </div>
          }
        }
      </div>
    }
  `,
  styles: `
    .td {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .td__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .td__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
    }

    .td__chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .td__chipValue {
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .td__manage {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px 16px;
      padding: 14px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .td__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .td__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text-soft);
    }

    :host ::ng-deep .td__select.p-select {
      width: 220px;
      max-width: 100%;
      height: var(--dba-height-control);
    }

    .td__warn {
      margin: 0;
      flex-basis: 100%;
    }

    .td__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .td__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .td__card h2 {
      margin: 0;
    }

    .td__dl {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .td__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .td__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .td__link {
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .td__link:hover {
      text-decoration: underline;
    }

    @media (max-width: 960px) {
      .td__cols {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 520px) {
      .td__control {
        flex-basis: 100%;
      }

      :host ::ng-deep .td__select.p-select {
        width: 100%;
      }

      .td__dl {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .td__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class TicketDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly thread = viewChild(TicketThreadComponent);

  protected readonly supportPath = sectionPath('support');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly docsPath = sectionPath('documents');
  protected readonly statusFamily = STATUS_FAMILY;
  protected readonly priorityFamily = PRIORITY_FAMILY;
  protected readonly slaFamily = SLA_FAMILY;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly agentsError = signal(false);
  protected readonly detail = signal<TicketDetail | null>(null);
  protected readonly agents = signal<SupportAgent[]>([]);
  protected readonly opening = signal<string | null>(null);
  protected readonly tab = signal<string>('conversation');

  protected readonly statusDraft = signal<TicketStatus | null>(null);
  protected readonly priorityDraft = signal<TicketPriority | null>(null);
  protected readonly agentDraft = signal<string | null>(null);

  protected readonly open = computed(() => {
    const ticket = this.detail();
    return ticket ? isOpenStatus(ticket.status) : true;
  });
  protected readonly slaState = computed(() => {
    const ticket = this.detail();
    return ticket ? slaStateOf(ticket, new Date()) : 'onTime';
  });
  protected readonly staffNames = computed(() => {
    const ticket = this.detail();
    const names = staffNamesOf(ticket?.assignmentHistory ?? [], ticket?.assignee ?? null);
    for (const agent of this.agents()) if (!names.has(agent.id)) names.set(agent.id, agent.name);
    return names;
  });
  protected readonly meta = computed(() => {
    const ticket = this.detail();
    if (!ticket) return '';
    return [
      ticket.ticketNumber,
      ticket.organization?.name,
      this.label(`support.channel.${ticket.sourceChannel}`),
      this.stamp(ticket.createdAt),
    ]
      .filter((part) => !!part && part !== '—')
      .join(' · ');
  });

  protected readonly statusOptions = computed<Option[]>(() =>
    TICKET_STATUSES.map((id) => ({ id, label: this.label(`support.status.${id}`) })),
  );
  protected readonly priorityOptions = computed<Option[]>(() =>
    TICKET_PRIORITIES.map((id) => ({ id, label: this.label(`support.priority.${id}`) })),
  );
  protected readonly agentOptions = computed<Option[]>(() => {
    const options = this.agents().map((agent) => ({ id: agent.id, label: agent.name }));
    const assignee = this.detail()?.assignee;
    if (assignee && !options.some((option) => option.id === assignee.id))
      options.unshift({ id: assignee.id, label: assignee.name || assignee.id });
    return options;
  });

  protected readonly tabs = computed<UnderlineTab[]>(() => {
    const ticket = this.detail();
    const counts: Record<string, number | undefined> = {
      conversation: ticket?.messages.length,
      history: ticket?.auditLog.length,
    };
    return TAB_KEYS.map((key) => ({
      key,
      label: this.label(`support.d.tab.${key}`),
      count: counts[key],
    }));
  });

  constructor() {
    const wanted = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    if (wanted && (TAB_KEYS as readonly string[]).includes(wanted)) this.tab.set(wanted);
    effect(() => {
      const id = this.id();
      if (id) void this.load(id, true);
    });
    if (this.canManage()) void this.loadAgents();
  }

  protected reload(): void {
    void this.load(this.id(), true);
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected async changeStatus(status: TicketStatus | null): Promise<void> {
    const ticket = this.detail();
    if (!ticket || !status || status === ticket.status) return;
    await this.change(this.statusDraft, status, ticket.status, 'status', {
      title: 'support.act.status.title',
      message: 'support.act.status.message',
      params: {
        from: this.label(`support.status.${ticket.status}`),
        to: this.label(`support.status.${status}`),
      },
      confirmLabel: 'support.act.status.confirm',
      request: this.api.setStatus(ticket.id, status),
      done: 'support.act.status.done',
    });
  }

  protected async changePriority(priority: TicketPriority | null): Promise<void> {
    const ticket = this.detail();
    if (!ticket || !priority || priority === ticket.priority) return;
    await this.change(this.priorityDraft, priority, ticket.priority, 'priority', {
      title: 'support.act.priority.title',
      message: 'support.act.priority.message',
      params: {
        from: this.label(`support.priority.${ticket.priority}`),
        to: this.label(`support.priority.${priority}`),
      },
      confirmLabel: 'support.act.priority.confirm',
      request: this.api.setPriority(ticket.id, priority),
      done: 'support.act.priority.done',
    });
  }

  protected async changeAgent(agentId: string | null): Promise<void> {
    const ticket = this.detail();
    const current = ticket?.assignedToId ?? null;
    if (!ticket || !agentId || agentId === current) return;
    await this.change(this.agentDraft, agentId, current, 'assign', {
      title: 'support.act.assign.title',
      message: 'support.act.assign.message',
      params: { name: this.staffNames().get(agentId) ?? agentId },
      confirmLabel: 'support.act.assign.confirm',
      request: this.api.assign(ticket.id, agentId),
      done: 'support.act.assign.done',
    });
  }

  protected async reply(draft: ReplyDraft): Promise<void> {
    const ticket = this.detail();
    if (!ticket) return;
    await this.pending.run('reply', async () => {
      try {
        await firstValueFrom(this.api.reply(ticket.id, draft.body, draft.internal));
        this.thread()?.clear();
        this.notify.success(
          this.label(draft.internal ? 'support.act.reply.noteDone' : 'support.act.reply.done'),
        );
        await this.load(ticket.id, false);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async openAttachment(ref: string): Promise<void> {
    const ticket = this.detail();
    if (!ticket || this.opening()) return;
    const tab = window.open('', '_blank');
    this.opening.set(ref);
    try {
      const blob = await firstValueFrom(this.api.attachment(ticket.id, ref));
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      this.notify.error(this.label('support.error.ADJUNTO_NO_DISPONIBLE'));
    } finally {
      this.opening.set(null);
    }
  }

  private async change<T>(
    draft: WritableSignal<T | null>,
    next: T,
    current: T | null,
    key: string,
    action: {
      title: string;
      message: string;
      params: Record<string, string>;
      confirmLabel: string;
      request: Observable<unknown>;
      done: string;
    },
  ): Promise<void> {
    draft.set(next);
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: key === 'assign' ? 'user' : 'circleCheck',
      title: action.title,
      message: action.message,
      params: action.params,
      confirmLabel: action.confirmLabel,
    });
    if (!confirmed) {
      draft.set(current);
      return;
    }
    await this.pending.run(key, async () => {
      try {
        await firstValueFrom(action.request);
        this.notify.success(this.label(action.done));
        await this.load(this.id(), false);
      } catch (error) {
        draft.set(current);
        this.fail(error);
      }
    });
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && SUPPORT_ERRORS.includes(code);
    this.notify.error(this.label(known ? `support.error.${code}` : 'support.error.generic'));
  }

  private async loadAgents(): Promise<void> {
    try {
      this.agents.set(await firstValueFrom(this.api.agents()));
      this.agentsError.set(false);
    } catch {
      this.agentsError.set(true);
    }
  }

  private async load(id: string, initial: boolean): Promise<void> {
    const current = this.latest.start();
    if (initial) {
      this.loading.set(true);
      this.error.set(false);
      this.missing.set(false);
    }
    try {
      const ticket = await firstValueFrom(this.api.detail(id));
      if (!current()) return;
      this.detail.set(ticket);
      this.statusDraft.set(ticket.status);
      this.priorityDraft.set(ticket.priority);
      this.agentDraft.set(ticket.assignedToId ?? null);
    } catch (error) {
      if (!current()) return;
      if (initial) {
        if (errorStatusOf(error) === 404) this.missing.set(true);
        else this.error.set(true);
      } else {
        this.notify.error(this.label('support.d.refreshError'));
      }
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
