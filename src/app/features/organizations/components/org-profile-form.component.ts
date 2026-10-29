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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrganizationsApi } from '../data/organizations.api';
import type {
  CityOption,
  PlatformOrgDetail,
  PlatformOrgUpdate,
} from '../data/organizations.models';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const LANGUAGES: { value: string; labelKey: string }[] = [
  { value: 'es', labelKey: 'orgEdit.lang.es' },
  { value: 'en', labelKey: 'orgEdit.lang.en' },
];

type TextKey =
  | 'businessName'
  | 'tributaryNumber'
  | 'email'
  | 'phone'
  | 'address'
  | 'webSite'
  | 'constitutionDate';

const TEXT_KEYS: readonly TextKey[] = [
  'businessName',
  'tributaryNumber',
  'email',
  'phone',
  'address',
  'webSite',
  'constitutionDate',
];

@Component({
  selector: 'dba-org-profile-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="building"
      [title]="'orgEdit.title' | translate"
      [subtitle]="org().businessName"
      confirmLabel="orgEdit.save"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="600"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field
          label="orgEdit.f.businessName"
          [maxlength]="200"
          [error]="businessName().trim() ? '' : 'common.required'"
          [(value)]="businessName"
        />
        <div class="form__pair">
          <dba-field
            label="orgEdit.f.tributaryNumber"
            mono
            [maxlength]="40"
            [hint]="tributaryNumber() !== org().tributaryNumber ? 'orgEdit.nitHint' : ''"
            [error]="tributaryNumber().trim() ? '' : 'common.required'"
            [(value)]="tributaryNumber"
          />
          <dba-field
            label="orgEdit.f.constitutionDate"
            type="date"
            [error]="dateError()"
            [(value)]="constitutionDate"
          />
        </div>
        <div class="form__pair">
          <dba-field
            label="orgEdit.f.email"
            type="email"
            [maxlength]="160"
            [error]="emailError()"
            [(value)]="email"
          />
          <dba-field label="orgEdit.f.phone" [maxlength]="30" [(value)]="phone" />
        </div>
        <dba-field label="orgEdit.f.address" [maxlength]="200" [(value)]="address" />
        <dba-field label="orgEdit.f.webSite" [maxlength]="200" [(value)]="webSite" />

        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="org-edit-city">{{
              'orgEdit.f.city' | translate
            }}</label>
            <p-select
              inputId="org-edit-city"
              [options]="cities()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [resetFilterOnHide]="false"
              [disabled]="!org().countryId"
              [placeholder]="
                (org().countryId ? 'orgEdit.cityPlaceholder' : 'orgEdit.noCountry') | translate
              "
              [emptyFilterMessage]="'orgEdit.cityEmpty' | translate"
              [ngModel]="cityId()"
              (ngModelChange)="cityId.set($event)"
              (onFilter)="searchCities($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="org-edit-language">{{
              'orgEdit.f.language' | translate
            }}</label>
            <p-select
              inputId="org-edit-language"
              [options]="languages"
              optionValue="value"
              [ngModel]="language()"
              (ngModelChange)="language.set($event)"
              [placeholder]="'common.pick' | translate"
              appendTo="body"
              styleClass="form__select"
            >
              <ng-template #selectedItem let-item>{{ item.labelKey | translate }}</ng-template>
              <ng-template #item let-item>{{ item.labelKey | translate }}</ng-template>
            </p-select>
          </div>
        </div>

        <div class="form__switch">
          <p-toggleswitch
            inputId="org-edit-test"
            [ngModel]="isTest()"
            (ngModelChange)="isTest.set($event)"
          />
          <span class="form__switchCopy">
            <label class="form__label" for="org-edit-test">{{
              'orgEdit.f.isTest' | translate
            }}</label>
            <span class="dba-meta">{{ 'orgEdit.isTestHint' | translate }}</span>
          </span>
        </div>

        <dba-field
          label="orgEdit.f.reason"
          placeholder="orgEdit.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form__pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .form__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    ::ng-deep .form__select.p-select {
      width: 100%;
      height: var(--dba-height-control);
    }

    .form__switch {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--dba-border-row);
    }

    .form__switchCopy {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    @media (max-width: 520px) {
      .form__pair {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OrgProfileFormComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly latest = new LatestRequest();

  readonly org = input.required<PlatformOrgDetail>();
  readonly busy = input(false);
  readonly submitted = output<PlatformOrgUpdate>();
  readonly dismissed = output<void>();

  protected readonly languages = LANGUAGES;
  protected readonly businessName = signal('');
  protected readonly tributaryNumber = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly address = signal('');
  protected readonly webSite = signal('');
  protected readonly constitutionDate = signal('');
  protected readonly cityId = signal<string | null>(null);
  protected readonly language = signal<string | null>(null);
  protected readonly isTest = signal(false);
  protected readonly reason = signal('');
  protected readonly cities = signal<CityOption[]>([]);

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    return value && !EMAIL.test(value) ? 'orgEdit.emailInvalid' : '';
  });

  protected readonly dateError = computed(() => {
    const value = this.constitutionDate().trim();
    return value && !DAY.test(value) ? 'orgEdit.dateInvalid' : '';
  });

  protected readonly changes = computed<PlatformOrgUpdate>(() => {
    const org = this.org();
    const values: Record<TextKey, string> = {
      businessName: this.businessName(),
      tributaryNumber: this.tributaryNumber(),
      email: this.email(),
      phone: this.phone(),
      address: this.address(),
      webSite: this.webSite(),
      constitutionDate: this.constitutionDate(),
    };
    const changed: PlatformOrgUpdate = {};
    for (const key of TEXT_KEYS) {
      const value = values[key].trim();
      if (value !== (org[key] ?? '').trim() && (value || org[key])) changed[key] = value;
    }
    if (this.cityId() && this.cityId() !== org.cityId) changed.cityId = this.cityId() as string;
    if (this.language() && this.language() !== org.language)
      changed.language = this.language() as string;
    if (this.isTest() !== org.isTest) changed.isTest = this.isTest();
    return changed;
  });

  protected readonly canSave = computed(
    () =>
      Object.keys(this.changes()).length > 0 &&
      !!this.businessName().trim() &&
      !!this.tributaryNumber().trim() &&
      !this.emailError() &&
      !this.dateError(),
  );

  ngOnInit(): void {
    const org = this.org();
    this.businessName.set(org.businessName);
    this.tributaryNumber.set(org.tributaryNumber);
    this.email.set(org.email ?? '');
    this.phone.set(org.phone ?? '');
    this.address.set(org.address ?? '');
    this.webSite.set(org.webSite ?? '');
    this.constitutionDate.set(org.constitutionDate ?? '');
    this.cityId.set(org.cityId ?? null);
    this.language.set(org.language ?? null);
    this.isTest.set(org.isTest);
    if (org.cityId && org.cityName) this.cities.set([{ id: org.cityId, name: org.cityName }]);
    void this.loadCities('');
  }

  protected searchCities(event: SelectFilterEvent): void {
    void this.loadCities(event.filter ?? '');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    const reason = this.reason().trim();
    this.submitted.emit({ ...this.changes(), ...(reason && { reason }) });
  }

  private async loadCities(search: string): Promise<void> {
    const countryId = this.org().countryId;
    if (!countryId) return;
    const current = this.latest.start();
    try {
      const found = await firstValueFrom(this.api.cities(countryId, search.trim()));
      if (!current()) return;
      const selected = this.cities().find((city) => city.id === this.cityId());
      const keep = selected && !found.some((city) => city.id === selected.id) ? [selected] : [];
      this.cities.set([...keep, ...found]);
    } catch {
      return;
    }
  }
}
