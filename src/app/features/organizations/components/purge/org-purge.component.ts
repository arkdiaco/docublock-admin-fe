import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../core/ui/notification.service';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../../shared/ui/stat-band.component';
import { OrganizationsApi } from '../../data/organizations.api';
import type {
  OrganizationPurgePreview,
  PlatformOrgDetail,
  PurgeGroup,
  PurgeJob,
  PurgeTargetCount,
} from '../../data/organizations.models';

type Stage = 'preview' | 'confirm' | 'running' | 'done' | 'failed';

const PREVIEW_ERRORS = ['PURGA_SOLO_PRUEBAS', 'ORG_NO_EXISTE'];
const START_ERRORS = [
  'CONFIRMACION_INVALIDA',
  'PURGA_VISTA_VENCIDA',
  'PURGA_EN_CURSO',
  'PURGA_SOLO_PRUEBAS',
];
const GROUPS: readonly PurgeGroup[] = ['operation', 'consumption', 'membership'];
const POLL_MS = 2000;

export const purgePhrase = (tributaryNumber: string): string => `PURGAR ${tributaryNumber}`;

const flatten = (preview: OrganizationPurgePreview): PurgeTargetCount[] =>
  preview.groups.flatMap((group) =>
    group.targets.map((target) => ({ ...target, group: group.group })),
  );

const sum = (targets: PurgeTargetCount[]): number =>
  targets.reduce((total, target) => total + target.count, 0);

@Component({
  selector: 'dba-org-purge',
  imports: [
    TranslatePipe,
    ModalShellComponent,
    SectionLoaderComponent,
    EmptyStateComponent,
    StatBandComponent,
    ButtonComponent,
    FieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="triangleAlert"
      [title]="'purge.title' | translate"
      [subtitle]="org().businessName"
      [confirmLabel]="confirmLabel()"
      [confirmDisabled]="confirmDisabled()"
      [busy]="starting()"
      [cancelable]="stage() === 'preview' || stage() === 'confirm'"
      [maxWidth]="640"
      (confirmed)="next()"
      (dismissed)="dismissed.emit()"
    >
      @if (loading()) {
        <db-section-loader [label]="'purge.loading' | translate" />
      } @else if (error(); as code) {
        <div class="pp__error">
          <dba-empty-state titleKey="purge.errorTitle" [leadKey]="'purge.error.' + code" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (stage() === 'confirm') {
        <div class="pp">
          <p class="dba-body pp__lead">
            {{ 'purge.confirmLead' | translate: { total: total(), name: org().businessName } }}
          </p>
          <dba-field
            label="purge.f.nit"
            mono
            [maxlength]="40"
            [error]="nitError()"
            [(value)]="nit"
          />
          <div class="pp__phrase">
            <dba-field
              label="purge.f.phrase"
              mono
              [maxlength]="60"
              [error]="phraseError()"
              [(value)]="typedPhrase"
            />
            <p class="dba-meta">{{ 'purge.phraseHint' | translate: { phrase: phrase() } }}</p>
          </div>
          <dba-field
            label="purge.f.reason"
            placeholder="purge.reasonPlaceholder"
            [maxlength]="500"
            [(value)]="reason"
          />
        </div>
      } @else if (stage() === 'running') {
        <db-section-loader [label]="'purge.running' | translate" />
      } @else if (stage() === 'failed') {
        <dba-empty-state titleKey="purge.failedTitle" leadKey="purge.failedLead" />
      } @else if (preview(); as data) {
        <div class="pp">
          <p class="dba-body pp__lead">
            {{ (stage() === 'done' ? 'purge.doneLead' : 'purge.lead') | translate }}
          </p>
          <db-stat-band
            [cells]="cells()"
            [label]="(stage() === 'done' ? 'purge.doneBand' : 'purge.band') | translate"
          />

          @for (group of groups(); track group.group) {
            <section class="pp__group">
              <h3 class="dba-eyebrow">{{ 'purge.group.' + group.group | translate }}</h3>
              <p class="dba-meta">{{ 'purge.groupHint.' + group.group | translate }}</p>
              @if (group.total === 0) {
                <p class="dba-meta pp__none">{{ 'purge.nothing' | translate }}</p>
              } @else {
                <ul class="pp__rows">
                  @for (target of group.targets; track target.collection) {
                    <li class="pp__row">
                      <span class="pp__name">
                        <span>{{ 'purge.c.' + target.collection | translate }}</span>
                        <span class="dba-id">{{ target.collection }}</span>
                      </span>
                      <span class="dba-mono pp__count">{{ target.count }}</span>
                    </li>
                  }
                </ul>
              }
            </section>
          }

          @if (stage() === 'preview') {
            <section class="pp__group">
              <h3 class="dba-eyebrow">{{ 'purge.keptTitle' | translate }}</h3>
              <ul class="pp__kept">
                @for (key of data.kept; track key) {
                  <li>{{ 'purge.kept.' + key | translate }}</li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </db-modal-shell>
  `,
  styles: `
    .pp {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pp__lead {
      margin: 0;
      color: var(--dba-text);
    }

    .pp__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .pp__phrase {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pp__phrase p,
    .pp__group h3,
    .pp__group p {
      margin: 0;
    }

    .pp__group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .pp__none {
      font-style: italic;
    }

    .pp__rows,
    .pp__kept {
      margin: 4px 0 0;
      padding: 0;
      list-style: none;
    }

    .pp__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--dba-border-row);
    }

    .pp__name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .pp__count {
      flex: none;
      font-variant-numeric: tabular-nums;
    }

    .pp__kept {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 16px;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    @media (max-width: 520px) {
      .pp__kept {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class OrgPurgeComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);
  private closed = false;

  readonly org = input.required<PlatformOrgDetail>();
  readonly dismissed = output<void>();
  readonly purged = output<void>();

  protected readonly stage = signal<Stage>('preview');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal<OrganizationPurgePreview | null>(null);
  protected readonly job = signal<PurgeJob | null>(null);
  protected readonly starting = signal(false);
  protected readonly nit = signal('');
  protected readonly typedPhrase = signal('');
  protected readonly reason = signal('');

  protected readonly phrase = computed(() => purgePhrase(this.org().tributaryNumber));

  protected readonly targets = computed<PurgeTargetCount[]>(() => {
    const done = this.job();
    if (this.stage() === 'done' && done) return done.report;
    const data = this.preview();
    return data ? flatten(data) : [];
  });

  protected readonly total = computed(() => sum(this.targets()));

  protected readonly groups = computed(() =>
    GROUPS.map((group) => {
      const targets = this.targets()
        .filter((target) => target.group === group && target.count > 0)
        .sort((a, b) => b.count - a.count);
      return { group, total: sum(targets), targets };
    }),
  );

  protected readonly cells = computed<StatCell[]>(() => [
    {
      key: 'total',
      label: this.translate.instant('purge.total') as string,
      value: String(this.total()),
    },
    ...this.groups().map((group) => ({
      key: group.group,
      label: this.translate.instant('purge.group.' + group.group) as string,
      value: String(group.total),
    })),
  ]);

  protected readonly nitError = computed(() =>
    this.nit().trim() && this.nit().trim() !== this.org().tributaryNumber
      ? 'purge.nitMismatch'
      : '',
  );

  protected readonly phraseError = computed(() =>
    this.typedPhrase().trim() && this.typedPhrase().trim() !== this.phrase()
      ? 'purge.phraseMismatch'
      : '',
  );

  protected readonly canPurge = computed(
    () =>
      this.nit().trim() === this.org().tributaryNumber &&
      this.typedPhrase().trim() === this.phrase() &&
      !!this.reason().trim(),
  );

  protected readonly confirmLabel = computed(() => {
    const stage = this.stage();
    if (stage === 'confirm') return 'purge.confirm';
    if (stage === 'preview' && !this.loading() && !this.error() && this.total() > 0)
      return 'purge.continue';
    return 'common.close';
  });

  protected readonly confirmDisabled = computed(
    () => this.stage() === 'confirm' && !this.canPurge(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.closed = true));
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.stage.set('preview');
    this.loading.set(true);
    this.error.set(null);
    try {
      this.preview.set(await firstValueFrom(this.api.purgePreview(this.org().id)));
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.error.set(code && PREVIEW_ERRORS.includes(code) ? code : 'generic');
    } finally {
      this.loading.set(false);
    }
  }

  protected next(): void {
    const label = this.confirmLabel();
    if (label === 'purge.continue') this.stage.set('confirm');
    else if (label === 'purge.confirm') void this.start();
    else this.dismissed.emit();
  }

  private async start(): Promise<void> {
    const preview = this.preview();
    if (!preview || !this.canPurge()) return;
    this.starting.set(true);
    try {
      const job = await firstValueFrom(
        this.api.purge(this.org().id, {
          previewToken: preview.previewToken,
          tributaryNumber: this.nit().trim(),
          phrase: this.typedPhrase().trim(),
          reason: this.reason().trim(),
        }),
      );
      this.job.set(job);
      this.stage.set('running');
      void this.follow(job.id);
    } catch (failure) {
      const code = errorCodeOf(failure);
      const known = code && START_ERRORS.includes(code);
      this.notify.error(
        this.translate.instant(
          known ? `purge.startError.${code}` : 'purge.startError.generic',
        ) as string,
      );
      if (code === 'PURGA_VISTA_VENCIDA') void this.load();
    } finally {
      this.starting.set(false);
    }
  }

  private async follow(jobId: string): Promise<void> {
    while (!this.closed) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (this.closed) return;
      try {
        const job = await firstValueFrom(this.api.purgeJob(this.org().id, jobId));
        if (job.state === 'running') continue;
        this.job.set(job);
        this.stage.set(job.state);
        if (job.state === 'done') {
          this.notify.success(
            this.translate.instant('purge.done', { total: this.total() }) as string,
          );
          this.purged.emit();
        }
        return;
      } catch {
        continue;
      }
    }
  }
}
