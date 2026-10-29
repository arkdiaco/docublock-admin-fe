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
  CountryOption,
  CreateOrganizationBody,
  ResellerOption,
} from '../data/organizations.models';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9\s()-]{7,20}$/;
const TRIBUTARY = /^[A-Za-z0-9.-]+$/;
const URL = /^https?:\/\/\S+$/i;
const NONE = '';

@Component({
  selector: 'dba-org-create-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="building"
      [title]="'orgCreate.title' | translate"
      [subtitle]="'orgCreate.subtitle' | translate"
      confirmLabel="orgCreate.save"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="640"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-eyebrow form__section">{{ 'orgCreate.org' | translate }}</p>
        <dba-field label="orgEdit.f.businessName" [maxlength]="120" [(value)]="businessName" />
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="org-create-person">{{
              'orgCreate.person' | translate
            }}</label>
            <p-select
              inputId="org-create-person"
              [options]="personOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="type()"
              (ngModelChange)="type.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <dba-field
            label="orgEdit.f.tributaryNumber"
            mono
            [maxlength]="30"
            [error]="tributaryError()"
            [(value)]="tributaryNumber"
          />
        </div>
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="org-create-country">{{
              'orgCreate.country' | translate
            }}</label>
            <p-select
              inputId="org-create-country"
              [options]="countries()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [placeholder]="'common.pick' | translate"
              [ngModel]="countryId()"
              (ngModelChange)="pickCountry($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="org-create-city">{{
              'orgEdit.f.city' | translate
            }}</label>
            <p-select
              inputId="org-create-city"
              [options]="cities()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [resetFilterOnHide]="false"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'orgEdit.cityPlaceholder' : 'orgCreate.countryFirst') | translate
              "
              [emptyFilterMessage]="'orgEdit.cityEmpty' | translate"
              [ngModel]="cityId()"
              (ngModelChange)="cityId.set($event)"
              (onFilter)="searchCities($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>
        <div class="form__pair">
          <dba-field
            label="orgEdit.f.email"
            type="email"
            [maxlength]="120"
            [error]="emailError(email())"
            [(value)]="email"
          />
          <dba-field
            label="orgEdit.f.phone"
            [maxlength]="20"
            [error]="phoneError()"
            [(value)]="phone"
          />
        </div>
        <dba-field label="orgEdit.f.address" [maxlength]="200" [(value)]="address" />
        <dba-field
          label="orgEdit.f.webSite"
          placeholder="orgCreate.webPlaceholder"
          [maxlength]="200"
          [error]="webError()"
          [(value)]="webSite"
        />
        <div class="form__control">
          <label class="form__label" for="org-create-reseller">{{
            'orgReseller.field' | translate
          }}</label>
          <p-select
            inputId="org-create-reseller"
            [options]="resellerOptions()"
            optionLabel="label"
            optionValue="id"
            [filter]="true"
            [resetFilterOnHide]="false"
            [emptyFilterMessage]="'orgReseller.empty' | translate"
            [ngModel]="resellerId()"
            (ngModelChange)="resellerId.set($event)"
            (onFilter)="searchResellers($event)"
            appendTo="body"
            styleClass="form__select"
          />
        </div>
        <div class="form__switch">
          <p-toggleswitch
            inputId="org-create-test"
            [ngModel]="isTest()"
            (ngModelChange)="isTest.set($event)"
          />
          <span class="form__switchCopy">
            <label class="form__label" for="org-create-test">{{
              'orgEdit.f.isTest' | translate
            }}</label>
            <span class="dba-meta">{{ 'orgEdit.isTestHint' | translate }}</span>
          </span>
        </div>

        <p class="dba-eyebrow form__section">{{ 'orgCreate.admin' | translate }}</p>
        <p class="dba-meta form__note">{{ 'orgCreate.adminLead' | translate }}</p>
        <div class="form__pair">
          <dba-field
            label="members.f.identification"
            mono
            [maxlength]="30"
            [(value)]="adminIdentification"
          />
          <dba-field
            label="members.f.email"
            type="email"
            [maxlength]="120"
            [error]="emailError(adminEmail())"
            [(value)]="adminEmail"
          />
        </div>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: './modal-form.scss',
})
export class OrgCreateFormComponent implements OnInit {
  private readonly api = inject(OrganizationsApi);
  private readonly citySearch = new LatestRequest();
  private readonly resellerSearch = new LatestRequest();

  readonly labels = input.required<{ legal: string; natural: string; noReseller: string }>();
  readonly busy = input(false);
  readonly submitted = output<CreateOrganizationBody>();
  readonly dismissed = output<void>();

  protected readonly businessName = signal('');
  protected readonly type = signal(1);
  protected readonly tributaryNumber = signal('');
  protected readonly countryId = signal<string | null>(null);
  protected readonly cityId = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly address = signal('');
  protected readonly webSite = signal('');
  protected readonly resellerId = signal(NONE);
  protected readonly isTest = signal(false);
  protected readonly adminIdentification = signal('');
  protected readonly adminEmail = signal('');
  protected readonly reason = signal('');
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly cities = signal<CityOption[]>([]);
  private readonly resellers = signal<ResellerOption[]>([]);

  protected readonly personOptions = computed(() => [
    { value: 1, label: this.labels().legal },
    { value: 2, label: this.labels().natural },
  ]);

  protected readonly resellerOptions = computed(() => [
    { id: NONE, label: this.labels().noReseller },
    ...this.resellers().map((r) => ({
      id: r.id,
      label: r.tributaryNumber ? `${r.businessName} · ${r.tributaryNumber}` : r.businessName,
    })),
  ]);

  protected readonly tributaryError = computed(() => {
    const value = this.tributaryNumber().trim();
    return value && !TRIBUTARY.test(value) ? 'orgCreate.tributaryInvalid' : '';
  });

  protected readonly phoneError = computed(() => {
    const value = this.phone().trim();
    return value && !PHONE.test(value) ? 'orgCreate.phoneInvalid' : '';
  });

  protected readonly webError = computed(() => {
    const value = this.webSite().trim();
    return value && !URL.test(value) ? 'orgCreate.webInvalid' : '';
  });

  protected readonly valid = computed(
    () =>
      !!this.businessName().trim() &&
      TRIBUTARY.test(this.tributaryNumber().trim()) &&
      !!this.countryId() &&
      !!this.cityId() &&
      EMAIL.test(this.email().trim()) &&
      PHONE.test(this.phone().trim()) &&
      !!this.address().trim() &&
      !this.webError() &&
      !!this.adminIdentification().trim() &&
      EMAIL.test(this.adminEmail().trim()) &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    void this.loadCountries();
    void this.loadResellers('');
  }

  protected emailError(value: string): string {
    return value.trim() && !EMAIL.test(value.trim()) ? 'orgEdit.emailInvalid' : '';
  }

  protected pickCountry(id: string | null): void {
    this.countryId.set(id);
    this.cityId.set(null);
    this.cities.set([]);
    if (id) void this.loadCities('');
  }

  protected searchCities(event: SelectFilterEvent): void {
    void this.loadCities(event.filter ?? '');
  }

  protected searchResellers(event: SelectFilterEvent): void {
    void this.loadResellers(event.filter ?? '');
  }

  protected submit(): void {
    if (!this.valid()) return;
    const webSite = this.webSite().trim();
    this.submitted.emit({
      businessName: this.businessName().trim(),
      tributaryNumber: this.tributaryNumber().trim(),
      type: this.type(),
      countryId: this.countryId() as string,
      cityId: this.cityId() as string,
      phone: this.phone().trim(),
      address: this.address().trim(),
      email: this.email().trim(),
      ...(webSite && { webSite }),
      ...(this.resellerId() && { resellerId: this.resellerId() }),
      isTest: this.isTest(),
      admin: { identification: this.adminIdentification().trim(), email: this.adminEmail().trim() },
      reason: this.reason().trim(),
    });
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
    }
  }

  private async loadCities(search: string): Promise<void> {
    const countryId = this.countryId();
    if (!countryId) return;
    const current = this.citySearch.start();
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

  private async loadResellers(search: string): Promise<void> {
    const current = this.resellerSearch.start();
    try {
      const items = await firstValueFrom(this.api.resellers(search.trim()));
      if (!current()) return;
      const seen = new Map(this.resellers().map((r) => [r.id, r]));
      for (const item of items) seen.set(item.id, item);
      this.resellers.set([...seen.values()]);
    } catch {
      return;
    }
  }
}
