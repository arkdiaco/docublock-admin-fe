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
import { UsersApi } from '../data/users.api';
import type {
  CityOption,
  CountryOption,
  PlatformUserDetail,
  UserChanges,
} from '../data/users.models';

export const changesOf = (
  user: PlatformUserDetail,
  form: Required<Pick<UserChanges, 'names' | 'surNames' | 'email' | 'phone' | 'expeditionDate'>> & {
    countryId: string | null;
    cityId: string | null;
  },
): UserChanges => {
  const changes: UserChanges = {};
  const text = (key: 'names' | 'surNames' | 'email' | 'phone' | 'expeditionDate'): void => {
    const value = form[key].trim();
    if (value !== (user[key] ?? '').trim()) changes[key] = value;
  };
  text('names');
  text('surNames');
  text('email');
  text('phone');
  text('expeditionDate');
  if (form.countryId && form.countryId !== user.countryId) changes.countryId = form.countryId;
  if (form.cityId && form.cityId !== user.cityId) changes.cityId = form.cityId;
  return changes;
};

@Component({
  selector: 'dba-user-edit-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="pencil"
      [title]="'usr.edit.title' | translate"
      [subtitle]="user().identification"
      confirmLabel="usr.edit.confirm"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <dba-field label="usr.edit.names" [maxlength]="120" [(value)]="names" />
          <dba-field label="usr.edit.surNames" [maxlength]="120" [(value)]="surNames" />
        </div>
        <div class="form__pair">
          <dba-field label="usr.edit.email" [maxlength]="160" type="email" [(value)]="email" />
          <dba-field
            label="usr.edit.phone"
            hint="usr.edit.phoneHint"
            [maxlength]="30"
            [(value)]="phone"
          />
        </div>
        <dba-field
          label="usr.edit.expeditionDate"
          hint="usr.edit.expeditionHint"
          [maxlength]="10"
          [(value)]="expeditionDate"
        />
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="user-country">{{
              'usr.edit.country' | translate
            }}</label>
            <p-select
              inputId="user-country"
              [options]="countries()"
              optionLabel="label"
              optionValue="id"
              [filter]="true"
              [placeholder]="'usr.edit.countryPlaceholder' | translate"
              [ngModel]="countryId()"
              (ngModelChange)="pickCountry($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <div class="form__control">
            <label class="form__label" for="user-city">{{ 'usr.edit.city' | translate }}</label>
            <p-select
              inputId="user-city"
              [options]="cities()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [resetFilterOnHide]="false"
              [disabled]="!countryId()"
              [placeholder]="
                (countryId() ? 'usr.edit.cityPlaceholder' : 'usr.edit.noCountry') | translate
              "
              [emptyFilterMessage]="'usr.edit.cityEmpty' | translate"
              [ngModel]="cityId()"
              (ngModelChange)="cityId.set($event)"
              (onFilter)="searchCities($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>
        @if (cityMissing()) {
          <p class="form__note">{{ 'usr.edit.cityRequired' | translate }}</p>
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
export class UserEditFormComponent implements OnInit {
  readonly user = input.required<PlatformUserDetail>();
  readonly busy = input(false);
  readonly submitted = output<{ changes: UserChanges; reason: string }>();
  readonly dismissed = output<void>();

  private readonly api = inject(UsersApi);
  private readonly latest = new LatestRequest();

  protected readonly names = signal('');
  protected readonly surNames = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly expeditionDate = signal('');
  protected readonly countryId = signal<string | null>(null);
  protected readonly cityId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly cities = signal<CityOption[]>([]);

  private readonly changes = computed(() =>
    changesOf(this.user(), {
      names: this.names(),
      surNames: this.surNames(),
      email: this.email(),
      phone: this.phone(),
      expeditionDate: this.expeditionDate(),
      countryId: this.countryId(),
      cityId: this.cityId(),
    }),
  );
  protected readonly cityMissing = computed(() => !!this.changes().countryId && !this.cityId());
  protected readonly canSave = computed(
    () => Object.keys(this.changes()).length > 0 && !this.cityMissing() && !!this.reason().trim(),
  );

  ngOnInit(): void {
    const user = this.user();
    this.names.set(user.names);
    this.surNames.set(user.surNames);
    this.email.set(user.email ?? '');
    this.phone.set(user.phone ?? '');
    this.expeditionDate.set(user.expeditionDate ?? '');
    this.countryId.set(user.countryId ?? null);
    this.cityId.set(user.cityId ?? null);
    if (user.cityId && user.cityName) this.cities.set([{ id: user.cityId, name: user.cityName }]);
    void this.loadCountries();
    void this.loadCities('');
  }

  protected pickCountry(countryId: string | null): void {
    this.countryId.set(countryId);
    this.cityId.set(countryId === this.user().countryId ? (this.user().cityId ?? null) : null);
    this.cities.set([]);
    void this.loadCities('');
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

  private async loadCities(search: string): Promise<void> {
    const countryId = this.countryId();
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
