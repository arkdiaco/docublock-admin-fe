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
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type {
  EnabledValidations,
  PlatformSigner,
  ReactivationChoice,
} from '../data/documents.models';
import {
  reactivationChoicesOf,
  registryCostOf,
  scopesOfChoice,
  type Phrase,
} from '../data/signer-changes';

export interface ReactivationRequest {
  scope: ReactivationChoice;
  reason: string;
}

@Component({
  selector: 'dba-signer-reactivate-form',
  imports: [TranslatePipe, FieldComponent, FilterPillsComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'docs.react.title' | translate"
      [subtitle]="signer().name"
      confirmLabel="docs.react.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="form__note--top">{{ 'docs.react.lead' | translate }}</p>
        <div class="form__control">
          <span class="form__label">{{ 'docs.react.scopeLabel' | translate }}</span>
          <db-filter-pills
            [pills]="pills()"
            [active]="choice()"
            [label]="'docs.react.scopeLabel' | translate"
            (activeChange)="pick($event)"
          />
        </div>
        <div class="form__summary">
          @for (line of summary(); track line.key) {
            <span>{{ line.key | translate: line.params }}</span>
          }
        </div>
        @if (registryCost(); as cost) {
          <p class="notice" role="note">{{ cost.key | translate: cost.params }}</p>
        }
        <dba-field
          label="docs.act.reasonLabel"
          placeholder="docs.act.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SignerReactivateFormComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  readonly signer = input.required<PlatformSigner>();
  readonly enabled = input.required<EnabledValidations>();
  readonly busy = input(false);
  readonly submitted = output<ReactivationRequest>();
  readonly dismissed = output<void>();

  protected readonly choice = signal<ReactivationChoice>('all');
  protected readonly reason = signal('');

  protected readonly choices = computed(() =>
    reactivationChoicesOf(this.signer().reactivationScopes),
  );

  protected readonly pills = computed<FilterPill[]>(() =>
    this.choices().map((choice) => ({ key: choice, labelKey: `docs.react.scope.${choice}` })),
  );

  protected readonly summary = computed<Phrase[]>(() => {
    const signer = this.signer();
    const { retries, reactivations } = signer.attempts;
    const lines: Phrase[] = [
      {
        key: 'docs.react.orgRetries',
        params: {
          biometric: retries.biometric.granted,
          biometricMax: retries.biometric.max,
          document: retries.document.granted,
          documentMax: retries.document.max,
        },
      },
      {
        key: 'docs.react.before',
        params: {
          list: signer.reactivationScopes
            .map((scope) => `${this.label(`docs.react.scope.${scope}`)} ${reactivations[scope]}`)
            .join(' · '),
        },
      },
    ];
    if (signer.blocked) lines.push({ key: 'docs.react.unblocks' });
    else if (signer.signingAttempts > 0)
      lines.push({ key: 'docs.react.resets', params: { count: signer.signingAttempts } });
    return lines;
  });

  protected readonly registryCost = computed(() =>
    scopesOfChoice(this.choice(), this.signer().reactivationScopes).includes('registry')
      ? registryCostOf(this.enabled().registryCredits)
      : null,
  );

  protected readonly valid = computed(
    () => this.choices().includes(this.choice()) && !!this.reason().trim(),
  );

  ngOnInit(): void {
    this.choice.set(this.choices().at(-1) ?? 'all');
  }

  protected pick(key: string): void {
    const choice = this.choices().find((option) => option === key);
    if (choice) this.choice.set(choice);
  }

  protected submit(): void {
    const reason = this.reason().trim();
    if (this.valid() && !this.busy()) this.submitted.emit({ scope: this.choice(), reason });
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
