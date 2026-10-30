import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../../shared/ui/stat-band.component';
import { OrganizationsApi } from '../../data/organizations.api';
import type { OrganizationPurgePreview, PlatformOrgDetail } from '../../data/organizations.models';

const KNOWN_ERRORS = ['PURGA_SOLO_PRUEBAS', 'ORG_NO_EXISTE'];

@Component({
  selector: 'dba-org-purge-preview',
  imports: [
    TranslatePipe,
    ModalShellComponent,
    SectionLoaderComponent,
    EmptyStateComponent,
    StatBandComponent,
    ButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="triangleAlert"
      [title]="'purge.title' | translate"
      [subtitle]="org().businessName"
      confirmLabel="common.close"
      [cancelable]="false"
      [maxWidth]="640"
      (confirmed)="dismissed.emit()"
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
      } @else if (preview(); as data) {
        <div class="pp">
          <p class="dba-body pp__lead">{{ 'purge.lead' | translate }}</p>
          <db-stat-band [cells]="cells()" [label]="'purge.band' | translate" />

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

          <section class="pp__group">
            <h3 class="dba-eyebrow">{{ 'purge.keptTitle' | translate }}</h3>
            <ul class="pp__kept">
              @for (key of data.kept; track key) {
                <li>{{ 'purge.kept.' + key | translate }}</li>
              }
            </ul>
          </section>
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

    .pp__group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .pp__group h3,
    .pp__group p {
      margin: 0;
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
export class OrgPurgePreviewComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly translate = inject(TranslateService);

  readonly org = input.required<PlatformOrgDetail>();
  readonly dismissed = output<void>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal<OrganizationPurgePreview | null>(null);

  protected readonly groups = computed(() =>
    (this.preview()?.groups ?? []).map((group) => ({
      ...group,
      targets: group.targets.filter((target) => target.count > 0).sort((a, b) => b.count - a.count),
    })),
  );

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.preview();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.translate.instant('purge.total') as string,
        value: String(data.total),
      },
      ...data.groups.map((group) => ({
        key: group.group,
        label: this.translate.instant('purge.group.' + group.group) as string,
        value: String(group.total),
      })),
    ];
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.preview.set(await firstValueFrom(this.api.purgePreview(this.org().id)));
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.error.set(code && KNOWN_ERRORS.includes(code) ? code : 'generic');
    } finally {
      this.loading.set(false);
    }
  }
}
