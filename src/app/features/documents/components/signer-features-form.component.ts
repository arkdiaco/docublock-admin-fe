import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type {
  AttachmentChangeKind,
  EnabledValidations,
  PlatformSigner,
  RequestedAttachment,
  SignerChange,
  SignerFeature,
} from '../data/documents.models';
import { reasonReady } from '../data/reason';
import {
  IDENTITY_FEATURES,
  VALIDATION_FEATURES,
  attachmentChangesOf,
  changedFeaturesOf,
  featureValuesOf,
  isDelivered,
  isLocked,
  raisesRequirements,
  registryCostOf,
  signerChangeOf,
  type FeatureValues,
} from '../data/signer-changes';

export interface SignerChangeRequest {
  change: SignerChange;
  reason: string;
}

interface FeatureRow {
  feature: SignerFeature;
  on: boolean;
  locked: boolean;
  labelKey: string;
  hintKey: string;
}

interface AttachmentRow {
  item: RequestedAttachment;
  delivered: boolean;
  mark?: AttachmentChangeKind;
}

const INVERTED: ReadonlySet<SignerFeature> = new Set(['skipEmail']);

@Component({
  selector: 'dba-signer-features-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ToggleSwitch,
    ButtonComponent,
    FieldComponent,
    ModalShellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="settings"
      [title]="'docs.feat.title' | translate"
      [subtitle]="signer().name"
      confirmLabel="docs.feat.confirm"
      [confirmDisabled]="!valid() || waiting()"
      [busy]="busy()"
      [note]="waiting() && !busy() ? 'docs.act.waiting' : ''"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="form__note--top">
          {{
            'docs.feat.lead' | translate: { type: ('docs.sp.type.' + signer().type | translate) }
          }}
        </p>

        @for (group of groups(); track group.titleKey) {
          <h3 class="dba-eyebrow form__section">{{ group.titleKey | translate }}</h3>
          @for (row of group.rows; track row.feature) {
            <div class="form__switch">
              <p-toggleswitch
                [inputId]="'feat-' + row.feature"
                [ngModel]="row.on"
                [disabled]="row.locked"
                (ngModelChange)="set(row.feature, $event)"
              />
              <span class="form__switchCopy">
                <label class="form__label" [for]="'feat-' + row.feature">{{
                  row.labelKey | translate
                }}</label>
                <span class="dba-meta">{{
                  (row.locked ? 'docs.feat.notEnabled' : row.hintKey) | translate
                }}</span>
              </span>
            </div>
          }
        }

        @if (raises()) {
          <p class="notice" role="note">{{ 'docs.feat.raises' | translate }}</p>
        }
        @if (registryCost(); as cost) {
          <p class="notice" role="note">{{ cost.key | translate: cost.params }}</p>
        }

        <h3 class="dba-eyebrow form__section">{{ 'docs.feat.attachments' | translate }}</h3>
        @if (attachmentRows().length) {
          <ul class="ft__list">
            @for (row of attachmentRows(); track row.item.index) {
              <li class="ft__item">
                <span class="form__switchCopy">
                  <span class="ft__name">{{ row.item.name }}</span>
                  <span class="dba-meta">{{ stateKey(row) | translate }}</span>
                </span>
                @if (!row.delivered) {
                  <span class="ft__actions">
                    @if (row.mark) {
                      <button dba-button variant="secondary" (click)="unmark(row.item.index)">
                        {{ 'docs.feat.undo' | translate }}
                      </button>
                    } @else {
                      @if (row.item.required) {
                        <button
                          dba-button
                          variant="secondary"
                          (click)="mark(row.item.index, 'optional')"
                        >
                          {{ 'docs.feat.makeOptional' | translate }}
                        </button>
                      }
                      <button
                        dba-button
                        variant="secondary"
                        (click)="mark(row.item.index, 'remove')"
                      >
                        {{ 'docs.feat.remove' | translate }}
                      </button>
                    }
                  </span>
                }
              </li>
            }
          </ul>
          @if (removesUploaded()) {
            <p class="dba-meta form__note">{{ 'docs.feat.removedFile' | translate }}</p>
          }
        } @else {
          <p class="dba-meta form__note">{{ 'docs.feat.noAttachments' | translate }}</p>
        }

        <dba-field
          label="docs.act.reasonLabel"
          placeholder="docs.act.reasonPlaceholder"
          hint="docs.act.reasonMin"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
  styles: `
    .form__switch p-toggleswitch {
      flex-shrink: 0;
    }

    .ft__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ft__item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 12px;
      padding: 10px 0;
      border-top: 1px solid var(--dba-border-row);
    }

    .ft__item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .ft__name {
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .ft__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class SignerFeaturesFormComponent implements OnInit {
  readonly signer = input.required<PlatformSigner>();
  readonly enabled = input.required<EnabledValidations>();
  readonly busy = input(false);
  readonly waiting = input(false);
  readonly submitted = output<SignerChangeRequest>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  private readonly before = signal<FeatureValues | null>(null);
  private readonly values = signal<FeatureValues | null>(null);
  private readonly marks = signal<ReadonlyMap<number, AttachmentChangeKind>>(new Map());

  protected readonly groups = computed(() => [
    { titleKey: 'docs.feat.validations', rows: this.rowsOf(VALIDATION_FEATURES) },
    { titleKey: 'docs.feat.identity', rows: this.rowsOf(IDENTITY_FEATURES) },
  ]);

  protected readonly features = computed(() => {
    const before = this.before();
    const values = this.values();
    return before && values ? changedFeaturesOf(before, values) : {};
  });

  protected readonly attachmentRows = computed<AttachmentRow[]>(() =>
    this.signer().attachments.map((item) => ({
      item,
      delivered: isDelivered(item),
      mark: this.marks().get(item.index),
    })),
  );

  protected readonly change = computed(() =>
    signerChangeOf(this.features(), attachmentChangesOf(this.signer().attachments, this.marks())),
  );

  protected readonly raises = computed(() => raisesRequirements(this.features()));

  protected readonly registryCost = computed(() =>
    this.features().checkDataRegistry === true
      ? registryCostOf(this.enabled().registryCredits)
      : null,
  );

  protected readonly removesUploaded = computed(() =>
    this.attachmentRows().some((row) => row.mark === 'remove' && row.item.file !== undefined),
  );

  protected readonly valid = computed(
    () => Object.keys(this.change()).length > 0 && reasonReady(this.reason()),
  );

  ngOnInit(): void {
    const values = featureValuesOf(this.signer());
    this.before.set(values);
    this.values.set({ ...values });
  }

  protected set(feature: SignerFeature, shown: boolean): void {
    const value = INVERTED.has(feature) ? !shown : shown;
    this.values.update((current) => (current ? { ...current, [feature]: value } : current));
  }

  protected mark(index: number, change: AttachmentChangeKind): void {
    this.marks.update((current) => new Map(current).set(index, change));
  }

  protected unmark(index: number): void {
    this.marks.update((current) => {
      const next = new Map(current);
      next.delete(index);
      return next;
    });
  }

  protected stateKey(row: AttachmentRow): string {
    if (row.delivered) return 'docs.sp.att.provided';
    if (row.mark === 'remove') return 'docs.feat.willRemove';
    if (row.mark === 'optional') return 'docs.feat.willOptional';
    return row.item.required ? 'docs.sp.att.required' : 'docs.sp.att.optional';
  }

  protected submit(): void {
    const reason = this.reason().trim();
    if (this.valid() && !this.busy() && !this.waiting())
      this.submitted.emit({ change: this.change(), reason });
  }

  private rowsOf(features: readonly SignerFeature[]): FeatureRow[] {
    const before = this.before();
    const values = this.values();
    if (!before || !values) return [];
    return features.map((feature) => ({
      feature,
      on: INVERTED.has(feature) ? !values[feature] : values[feature],
      locked: isLocked(feature, before, this.enabled()),
      labelKey: `docs.feat.${feature}`,
      hintKey: `docs.feat.hint.${feature}`,
    }));
  }
}
