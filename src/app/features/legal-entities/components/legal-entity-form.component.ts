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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { LegalEntitiesApi } from '../data/legal-entities.api';
import type {
  CountryOption,
  KindOption,
  LegalEntityChanges,
  LegalEntityDetail,
  NewLegalEntity,
  PendingLegalEntity,
} from '../data/legal-entities.models';
import { LegalEntitySignerPickerComponent } from './legal-entity-signer-picker.component';

export interface LegalEntityFormValue {
  businessName: string;
  identification: string;
  countryId: string | null;
  kindPersonId: string | null;
}

export const changesOf = (
  entity: LegalEntityDetail,
  form: LegalEntityFormValue,
): LegalEntityChanges => {
  const changes: LegalEntityChanges = {};
  const businessName = form.businessName.trim();
  const identification = form.identification.trim();
  if (businessName !== entity.businessName) changes.businessName = businessName;
  if (identification !== entity.identification) changes.identification = identification;
  if (form.countryId !== (entity.countryId ?? null)) changes.countryId = form.countryId;
  if (form.kindPersonId !== (entity.kindPersonId ?? null)) changes.kindPersonId = form.kindPersonId;
  return changes;
};

export type LegalEntityFormResult =
  | { kind: 'create'; data: NewLegalEntity; reason: string }
  | { kind: 'edit'; changes: LegalEntityChanges; reason: string };

@Component({
  selector: 'dba-legal-entity-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ModalShellComponent,
    FieldComponent,
    Select,
    ToggleSwitch,
    LegalEntitySignerPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="entity() ? 'pencil' : 'plus'"
      [title]="(entity() ? 'jur.form.editTitle' : 'jur.form.createTitle') | translate"
      [subtitle]="entity()?.identification ?? ''"
      [confirmLabel]="entity() ? 'jur.form.editConfirm' : 'jur.form.createConfirm'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="580"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field label="jur.form.businessName" [maxlength]="200" [(value)]="businessName" />
        <dba-field label="jur.form.identification" [maxlength]="40" [(value)]="identification" />
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="entity-country">{{
              'jur.form.country' | translate
            }}</label>
            <p-select
              inputId="entity-country"
              [options]="countries()"
              optionLabel="label"
              optionValue="id"
              [filter]="true"
              [showClear]="true"
              [placeholder]="'jur.form.countryPlaceholder' | translate"
              [ngModel]="countryId()"
              (ngModelChange)="pickCountry($event ?? null)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="entity-kind">{{ 'jur.form.kind' | translate }}</label>
            <p-select
              inputId="entity-kind"
              [options]="kinds()"
              optionLabel="name"
              optionValue="id"
              [showClear]="true"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'jur.form.kindPlaceholder' : 'jur.form.noCountry') | translate
              "
              [ngModel]="kindPersonId()"
              (ngModelChange)="kindPersonId.set($event ?? null)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>

        @if (!entity()) {
          <div class="form__control">
            <label class="form__label" for="entity-representative">{{
              'jur.form.representative' | translate
            }}</label>
            <dba-legal-entity-signer-picker
              inputId="entity-representative"
              [value]="signerId()"
              [initial]="initialSigner()"
              (picked)="signerId.set($event)"
            />
            @if (missingNumber()) {
              <p class="dba-meta">
                {{ 'jur.form.representativeMissing' | translate: { number: missingNumber() } }}
              </p>
            }
          </div>
          @if (signerId()) {
            <div class="form__switch form__switch--bare">
              <p-toggleswitch
                inputId="entity-legal-rep"
                [ngModel]="isLegalRep()"
                (ngModelChange)="isLegalRep.set($event)"
              />
              <label class="form__label" for="entity-legal-rep">{{
                'jur.form.isLegalRep' | translate
              }}</label>
            </div>
          }
        }

        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class LegalEntityFormComponent implements OnInit {
  readonly entity = input<LegalEntityDetail | null>(null);
  readonly draft = input<PendingLegalEntity | null>(null);
  readonly busy = input(false);
  readonly submitted = output<LegalEntityFormResult>();
  readonly dismissed = output<void>();

  private readonly api = inject(LegalEntitiesApi);
  private readonly latestKinds = new LatestRequest();

  protected readonly businessName = signal('');
  protected readonly identification = signal('');
  protected readonly countryId = signal<string | null>(null);
  protected readonly kindPersonId = signal<string | null>(null);
  protected readonly signerId = signal<string | null>(null);
  protected readonly isLegalRep = signal(true);
  protected readonly reason = signal('');
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly kinds = signal<KindOption[]>([]);

  protected readonly initialSigner = computed(() => {
    const representative = this.draft()?.representative;
    if (!representative) return null;
    const number = this.draft()?.representativeIdentification;
    return {
      id: representative.signerId,
      label: [representative.fullName, number].filter(Boolean).join(' · '),
    };
  });
  protected readonly missingNumber = computed(() => {
    const draft = this.draft();
    return draft && !draft.representative && !this.signerId()
      ? (draft.representativeIdentification ?? '')
      : '';
  });
  private readonly changes = computed(() => {
    const entity = this.entity();
    return entity ? changesOf(entity, this.formValue()) : {};
  });
  protected readonly canSave = computed(() => {
    if (!this.businessName().trim() || !this.identification().trim()) return false;
    if (!this.reason().trim()) return false;
    return !this.entity() || Object.keys(this.changes()).length > 0;
  });

  ngOnInit(): void {
    const entity = this.entity();
    const draft = this.draft();
    this.businessName.set(entity?.businessName ?? draft?.businessName ?? '');
    this.identification.set(entity?.identification ?? draft?.identification ?? '');
    this.countryId.set(entity?.countryId ?? draft?.countryId ?? null);
    this.kindPersonId.set(entity?.kindPersonId ?? draft?.kindPersonId ?? null);
    this.signerId.set(draft?.representative?.signerId ?? null);
    void this.loadCountries();
    void this.loadKinds();
  }

  protected pickCountry(countryId: string | null): void {
    const entity = this.entity();
    const same = !!entity && countryId === (entity.countryId ?? null);
    this.countryId.set(countryId);
    this.kindPersonId.set(same ? (entity.kindPersonId ?? null) : null);
    this.kinds.set([]);
    void this.loadKinds();
  }

  protected submit(): void {
    if (!this.canSave()) return;
    const reason = this.reason().trim();
    if (this.entity()) {
      this.submitted.emit({ kind: 'edit', changes: this.changes(), reason });
      return;
    }
    const form = this.formValue();
    const signerId = this.signerId();
    this.submitted.emit({
      kind: 'create',
      reason,
      data: {
        businessName: form.businessName.trim(),
        identification: form.identification.trim(),
        ...(form.countryId ? { countryId: form.countryId } : {}),
        ...(form.kindPersonId ? { kindPersonId: form.kindPersonId } : {}),
        ...(signerId ? { representative: { signerId, isLegalRep: this.isLegalRep() } } : {}),
      },
    });
  }

  private formValue(): LegalEntityFormValue {
    return {
      businessName: this.businessName(),
      identification: this.identification(),
      countryId: this.countryId(),
      kindPersonId: this.kindPersonId(),
    };
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
    }
  }

  private async loadKinds(): Promise<void> {
    const countryId = this.countryId();
    if (!countryId) return;
    const current = this.latestKinds.start();
    try {
      const kinds = await firstValueFrom(this.api.companyKinds(countryId));
      if (!current()) return;
      this.kinds.set(kinds);
      const kind = this.kindPersonId();
      if (kind && !kinds.some((option) => option.id === kind)) this.kindPersonId.set(null);
    } catch {
      return;
    }
  }
}
