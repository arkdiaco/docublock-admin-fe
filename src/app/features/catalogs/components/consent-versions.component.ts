import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, inject, input, output, signal, type OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CatalogsApi } from '../data/catalogs.api';
import type { ConsentPolicy, PolicyLocale } from '../data/catalogs.models';

@Component({
  selector: 'dba-consent-versions',
  imports: [TranslatePipe, EmptyStateComponent, ModalShellComponent, SectionLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="clock"
      [title]="'cat.consent.versionsTitle' | translate"
      [subtitle]="policy().code"
      confirmLabel="common.close"
      [cancelable]="false"
      [maxWidth]="680"
      (confirmed)="dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      @if (loading()) {
        <db-section-loader [label]="'cat.loading' | translate" />
      } @else if (error()) {
        <dba-empty-state titleKey="cat.errorTitle" leadKey="cat.errorLead" />
      } @else {
        <div class="versions">
          @for (version of versions(); track version.id) {
            <article class="version">
              <h3 class="dba-panel">
                {{ 'cat.consent.version' | translate: { version: version.version } }} · {{ version.title }}
              </h3>
              <span class="dba-meta">{{ day(version.publishedAt) }}</span>
              <p class="version__text">{{ version.text }}</p>
            </article>
          }
        </div>
      }
    </db-modal-shell>
  `,
  styles: `
    .versions {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .version {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .version__text {
      margin: 4px 0 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      white-space: pre-wrap;
    }
  `,
})
export class ConsentVersionsComponent implements OnInit {
  readonly policy = input.required<ConsentPolicy>();
  readonly locale = input.required<PolicyLocale>();
  readonly dismissed = output<void>();

  private readonly api = inject(CatalogsApi);
  private readonly appLocale = inject(LOCALE_ID);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly versions = signal<ConsentPolicy[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.appLocale);
  }

  private async load(): Promise<void> {
    try {
      this.versions.set(
        await firstValueFrom(this.api.consentVersions(this.policy().code, this.locale())),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
