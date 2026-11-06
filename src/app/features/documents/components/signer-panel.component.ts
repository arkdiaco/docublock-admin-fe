import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import type { PlatformSigner } from '../data/documents.models';
import type { SignerPanelRequest } from '../data/signer-view';
import { SignerChecksComponent } from './signer-checks.component';
import { SignerRecordComponent } from './signer-record.component';

@Component({
  selector: 'dba-signer-panel',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    IconComponent,
    SignerChecksComponent,
    SignerRecordComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = signer();
    <section class="sp" [attr.aria-label]="s.name">
      <header class="sp__head">
        <span class="sp__naming">
          <h2 class="dba-panel sp__title">{{ s.name }}</h2>
          <span class="sp__meta">{{ meta() }}</span>
        </span>
        <span class="sp__actions">
          <button dba-button variant="secondary" (click)="request.emit({ kind: 'raw' })">
            <db-icon name="listBullets" [size]="15" />
            {{ 'docs.raw.open' | translate }}
          </button>
          @if (canOpenSigner() && s.signerId) {
            <a dba-button variant="secondary" [routerLink]="[signersPath, s.signerId]">
              <db-icon name="signers" [size]="15" />
              {{ 'docs.sp.openSigner' | translate }}
            </a>
          }
          <button
            dba-button
            variant="secondary"
            iconOnly
            [attr.aria-label]="'common.close' | translate"
            (click)="closed.emit()"
          >
            <db-icon name="close" [size]="15" />
          </button>
        </span>
      </header>
      <p class="dba-eyebrow sp__group">{{ 'docs.sp.groupChecks' | translate }}</p>
      <dba-signer-checks [signer]="s" />
      <p class="dba-eyebrow sp__group">{{ 'docs.sp.groupRecord' | translate }}</p>
      <dba-signer-record [signer]="s" [busy]="busy()" (request)="request.emit($event)" />
    </section>
  `,
  styles: `
    .sp {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .sp__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .sp__naming {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sp__title {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .sp__meta {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }

    .sp__actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .sp__group {
      margin: 4px 0 0;
    }
  `,
})
export class SignerPanelComponent {
  private readonly translate = inject(TranslateService);

  readonly signer = input.required<PlatformSigner>();
  readonly canOpenSigner = input(false);
  readonly busy = input<string | null>(null);
  readonly request = output<SignerPanelRequest>();
  readonly closed = output<void>();

  protected readonly signersPath = sectionPath('signers');

  protected readonly meta = computed(() => {
    const s = this.signer();
    const parts = [
      s.role,
      this.label(`docs.sp.type.${s.type}`),
      s.principal ? this.label('docs.sp.principal') : '',
      s.legalRep && s.type !== 'legalRep' ? this.label('docs.sp.type.legalRep') : '',
      s.email,
      s.identification,
    ].filter((part): part is string => !!part);
    return [...new Set(parts)].join(' · ');
  });

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
