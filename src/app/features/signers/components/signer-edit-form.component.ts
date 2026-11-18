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
import { Select, type SelectFilterEvent } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { SignersApi } from '../data/signers.api';
import type {
  CountryOption,
  IdentificationTypeOption,
  NamedOption,
  PlatformSignerDetail,
  SignerChanges,
} from '../data/signers.models';

export interface SignerFormValue {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  personalMail: string;
  cellphone: string;
  expeditionDate: string;
  birthDate: string;
  countryId: string | null;
  kindPersonId: string | null;
  identificationTypeId: string | null;
  expeditionCityId: string | null;
}

const dayOf = (value?: string): string => value?.slice(0, 10) ?? '';

export const changesOf = (signer: PlatformSignerDetail, form: SignerFormValue): SignerChanges => {
  const changes: SignerChanges = {};
  const required = (key: 'firstName' | 'lastName' | 'email' | 'cellphone'): void => {
    const value = form[key].trim();
    if (value !== (signer[key] ?? '').trim()) changes[key] = value;
  };
  const optional = (key: 'businessName' | 'personalMail'): void => {
    const value = form[key].trim();
    if (value !== (signer[key] ?? '').trim()) changes[key] = value || null;
  };
  const date = (key: 'expeditionDate' | 'birthDate'): void => {
    const value = form[key].trim();
    if (value !== dayOf(signer[key])) changes[key] = value || null;
  };
  required('firstName');
  required('lastName');
  required('email');
  required('cellphone');
  optional('businessName');
  optional('personalMail');
  date('expeditionDate');
  date('birthDate');
  if (form.countryId && form.countryId !== signer.countryId) changes.countryId = form.countryId;
  const moved = !!changes.countryId;
  if (form.kindPersonId && (moved || form.kindPersonId !== signer.kindPersonId)) {
    changes.kindPersonId = form.kindPersonId;
  }
  if (
    form.identificationTypeId &&
    (moved || form.identificationTypeId !== signer.identificationTypeId)
  ) {
    changes.identificationTypeId = form.identificationTypeId;
  }
  if (form.expeditionCityId !== (signer.expeditionCityId ?? null)) {
    changes.expeditionCityId = form.expeditionCityId;
  }
  return changes;
};

@Component({
  selector: 'dba-signer-edit-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="pencil"
      [title]="'sig.edit.title' | translate"
      [subtitle]="signer().identification ?? ''"
      confirmLabel="sig.edit.confirm"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="620"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <dba-field label="sig.edit.firstName" [maxlength]="80" [(value)]="firstName" />
          <dba-field label="sig.edit.lastName" [maxlength]="80" [(value)]="lastName" />
        </div>
        <dba-field label="sig.edit.businessName" [maxlength]="160" [(value)]="businessName" />
        <div class="form__pair">
          <dba-field label="sig.edit.email" [maxlength]="120" type="email" [(value)]="email" />
          <dba-field
            label="sig.edit.personalMail"
            [maxlength]="120"
            type="email"
            [(value)]="personalMail"
          />
        </div>
        <dba-field
          label="sig.edit.cellphone"
          hint="sig.edit.cellphoneHint"
          [maxlength]="30"
          [(value)]="cellphone"
        />
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="signer-country">{{
              'sig.edit.country' | translate
            }}</label>
            <p-select
              inputId="signer-country"
              [options]="countries()"
              optionLabel="label"
              optionValue="id"
              [filter]="true"
              [placeholder]="'sig.edit.countryPlaceholder' | translate"
              [ngModel]="countryId()"
              (ngModelChange)="pickCountry($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="signer-kind">{{ 'sig.edit.kind' | translate }}</label>
            <p-select
              inputId="signer-kind"
              [options]="kinds()"
              optionLabel="name"
              optionValue="id"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'sig.edit.kindPlaceholder' : 'sig.edit.noCountry') | translate
              "
              [ngModel]="kindPersonId()"
              (ngModelChange)="pickKind($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="signer-type">{{ 'sig.edit.type' | translate }}</label>
            <p-select
              inputId="signer-type"
              [options]="typeOptions()"
              optionLabel="name"
              optionValue="id"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'sig.edit.typePlaceholder' : 'sig.edit.noCountry') | translate
              "
              [ngModel]="identificationTypeId()"
              (ngModelChange)="identificationTypeId.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="signer-city">{{ 'sig.edit.city' | translate }}</label>
            <p-select
              inputId="signer-city"
              [options]="cities()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [showClear]="true"
              [resetFilterOnHide]="false"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'sig.edit.cityPlaceholder' : 'sig.edit.noCountry') | translate
              "
              [emptyFilterMessage]="'sig.edit.cityEmpty' | translate"
              [ngModel]="expeditionCityId()"
              (ngModelChange)="expeditionCityId.set($event ?? null)"
              (onFilter)="searchCities($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>
        @if (catalogMissing()) {
          <p class="form__note">{{ 'sig.edit.catalogRequired' | translate }}</p>
        }
        <div class="form__pair">
          <dba-field
            label="sig.edit.expeditionDate"
            hint="sig.edit.dateHint"
            [maxlength]="10"
            [(value)]="expeditionDate"
          />
          <dba-field
            label="sig.edit.birthDate"
            hint="sig.edit.dateHint"
            [maxlength]="10"
            [(value)]="birthDate"
          />
        </div>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
        @if (reasonMissing()) {
          <p class="form__note">{{ 'sig.edit.reasonRequired' | translate }}</p>
        }
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class SignerEditFormComponent implements OnInit {
  readonly signer = input.required<PlatformSignerDetail>();
  readonly busy = input(false);
  readonly submitted = output<{ changes: SignerChanges; reason: string }>();
  readonly dismissed = output<void>();

  private readonly api = inject(SignersApi);
  private readonly latestCities = new LatestRequest();
  private readonly latestCatalog = new LatestRequest();

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly businessName = signal('');
  protected readonly email = signal('');
  protected readonly personalMail = signal('');
  protected readonly cellphone = signal('');
  protected readonly expeditionDate = signal('');
  protected readonly birthDate = signal('');
  protected readonly countryId = signal<string | null>(null);
  protected readonly kindPersonId = signal<string | null>(null);
  protected readonly identificationTypeId = signal<string | null>(null);
  protected readonly expeditionCityId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly kinds = signal<NamedOption[]>([]);
  private readonly types = signal<IdentificationTypeOption[]>([]);
  protected readonly cities = signal<NamedOption[]>([]);

  private readonly typesForKind = computed(() => {
    const kind = this.kindPersonId();
    return this.types().filter((type) => !type.kindPersonId || !kind || type.kindPersonId === kind);
  });
  protected readonly typeOptions = computed(() => {
    const options = this.typesForKind();
    const selected = this.types().find((type) => type.id === this.identificationTypeId());
    return selected && !options.includes(selected) ? [selected, ...options] : options;
  });
  private readonly changes = computed(() =>
    changesOf(this.signer(), {
      firstName: this.firstName(),
      lastName: this.lastName(),
      businessName: this.businessName(),
      email: this.email(),
      personalMail: this.personalMail(),
      cellphone: this.cellphone(),
      expeditionDate: this.expeditionDate(),
      birthDate: this.birthDate(),
      countryId: this.countryId(),
      kindPersonId: this.kindPersonId(),
      identificationTypeId: this.identificationTypeId(),
      expeditionCityId: this.expeditionCityId(),
    }),
  );
  protected readonly catalogMissing = computed(() => {
    const changes = this.changes();
    const moved = !!changes.countryId;
    const kindMissing = moved && !this.kindPersonId() && this.kinds().length > 0;
    const typeMissing =
      (moved || !!changes.kindPersonId) &&
      !this.identificationTypeId() &&
      this.typeOptions().length > 0;
    return kindMissing || typeMissing;
  });
  private readonly ready = computed(
    () => Object.keys(this.changes()).length > 0 && !this.catalogMissing(),
  );
  protected readonly reasonMissing = computed(() => this.ready() && !this.reason().trim());
  protected readonly canSave = computed(() => this.ready() && !!this.reason().trim());

  ngOnInit(): void {
    const signer = this.signer();
    this.firstName.set(signer.firstName);
    this.lastName.set(signer.lastName);
    this.businessName.set(signer.businessName ?? '');
    this.email.set(signer.email ?? '');
    this.personalMail.set(signer.personalMail ?? '');
    this.cellphone.set(signer.cellphone ?? '');
    this.expeditionDate.set(dayOf(signer.expeditionDate));
    this.birthDate.set(dayOf(signer.birthDate));
    this.countryId.set(signer.countryId ?? null);
    this.kindPersonId.set(signer.kindPersonId ?? null);
    this.identificationTypeId.set(signer.identificationTypeId ?? null);
    this.expeditionCityId.set(signer.expeditionCityId ?? null);
    if (signer.kindPersonId && signer.kindPersonName) {
      this.kinds.set([{ id: signer.kindPersonId, name: signer.kindPersonName }]);
    }
    if (signer.identificationTypeId && signer.identificationTypeName) {
      this.types.set([{ id: signer.identificationTypeId, name: signer.identificationTypeName }]);
    }
    if (signer.expeditionCityId && signer.expeditionCityName) {
      this.cities.set([{ id: signer.expeditionCityId, name: signer.expeditionCityName }]);
    }
    void this.loadCountries();
    void this.loadCatalog();
    void this.loadCities('');
  }

  protected pickCountry(countryId: string | null): void {
    const signer = this.signer();
    const same = countryId === (signer.countryId ?? null);
    this.countryId.set(countryId);
    if (same) {
      this.kindPersonId.set(signer.kindPersonId ?? null);
      this.identificationTypeId.set(signer.identificationTypeId ?? null);
    }
    this.expeditionCityId.set(same ? (signer.expeditionCityId ?? null) : null);
    this.kinds.set([]);
    this.types.set([]);
    this.cities.set([]);
    void this.loadCatalog();
    void this.loadCities('');
  }

  protected pickKind(kindPersonId: string | null): void {
    this.kindPersonId.set(kindPersonId);
    const type = this.identificationTypeId();
    if (type && !this.typesForKind().some((option) => option.id === type)) {
      this.identificationTypeId.set(null);
    }
  }

  protected searchCities(event: SelectFilterEvent): void {
    void this.loadCities(event.filter ?? '');
  }

  protected submit(): void {
    if (this.canSave()) {
      this.submitted.emit({ changes: this.changes(), reason: this.reason().trim() });
    }
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
    }
  }

  private async loadCatalog(): Promise<void> {
    const countryId = this.countryId();
    if (!countryId) return;
    const current = this.latestCatalog.start();
    try {
      const [kinds, types] = await Promise.all([
        firstValueFrom(this.api.kindPersons(countryId)),
        firstValueFrom(this.api.identificationTypes(countryId)),
      ]);
      if (!current()) return;
      this.kinds.set(kinds);
      this.types.set(types);
      this.fitToCatalog();
    } catch {
      return;
    }
  }

  private fitToCatalog(): void {
    const type = this.types().find((option) => option.id === this.identificationTypeId());
    if (!type) this.identificationTypeId.set(null);
    const kind = this.kindPersonId();
    if (kind && !this.kinds().some((option) => option.id === kind)) this.kindPersonId.set(null);
    if (!this.kindPersonId() && type?.kindPersonId) this.kindPersonId.set(type.kindPersonId);
  }

  private async loadCities(search: string): Promise<void> {
    const countryId = this.countryId();
    if (!countryId) return;
    const current = this.latestCities.start();
    try {
      const found = await firstValueFrom(this.api.cities(countryId, search.trim()));
      if (!current()) return;
      const selected = this.cities().find((city) => city.id === this.expeditionCityId());
      const keep = selected && !found.some((city) => city.id === selected.id) ? [selected] : [];
      this.cities.set([...keep, ...found]);
    } catch {
      return;
    }
  }
}
