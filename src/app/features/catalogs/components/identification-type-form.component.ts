import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { CatalogsApi } from '../data/catalogs.api';
import type { CatalogLabels, IdentificationTypeRow, KindPersonRow } from '../data/catalogs.models';
import { CatalogCountrySelectComponent } from './catalog-country-select.component';

export interface IdentificationTypeFormResult {
  kindPersonId: string;
  name: string;
  abbreviation: string;
  alphanumeric: boolean;
  labels: CatalogLabels;
  reason: string;
}

@Component({
  selector: 'dba-identification-type-form',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    ToggleSwitch,
    FieldComponent,
    ModalShellComponent,
    CatalogCountrySelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="type() ? 'pencil' : 'plus'"
      [title]="(type() ? 'cat.idType.editTitle' : 'cat.idType.createTitle') | translate"
      [subtitle]="type()?.countryName ?? ''"
      [confirmLabel]="type() ? 'cat.action.save' : 'cat.action.create'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (!type()) {
          <div class="form__control">
            <label class="form__label" for="type-country">{{ 'cat.country.label' | translate }}</label>
            <dba-catalog-country-select
              inputId="type-country"
              styleClass="form__select"
              [allowAll]="false"
              [value]="countryId()"
              (picked)="pickCountry($event)"
            />
          </div>
        }
        <div class="form__control">
          <label class="form__label" for="type-kind">{{ 'cat.idType.kind' | translate }}</label>
          <p-select
            inputId="type-kind"
            [options]="kinds()"
            optionLabel="name"
            optionValue="id"
            [disabled]="!countryId()"
            [placeholder]="
              (countryId() ? 'cat.idType.kindPlaceholder' : 'cat.idType.noCountry') | translate
            "
            [ngModel]="kindPersonId()"
            (ngModelChange)="kindPersonId.set($event ?? '')"
            appendTo="body"
            styleClass="form__select"
          />
          @if (countryId() && kindsLoaded() && kinds().length === 0) {
            <p class="dba-meta">{{ 'cat.idType.noKinds' | translate }}</p>
          }
        </div>
        <div class="form__pair">
          <dba-field label="cat.col.name" [maxlength]="120" [(value)]="name" />
          <dba-field label="cat.idType.abbreviation" [maxlength]="20" mono [(value)]="abbreviation" />
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch
            inputId="type-alphanumeric"
            [ngModel]="alphanumeric()"
            (ngModelChange)="alphanumeric.set($event)"
          />
          <label class="form__label" for="type-alphanumeric">{{
            'cat.idType.alphanumeric' | translate
          }}</label>
        </div>
        <div class="form__pair">
          <dba-field label="cat.labels.es" [maxlength]="120" [(value)]="labelEs" />
          <dba-field label="cat.labels.en" [maxlength]="120" [(value)]="labelEn" />
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
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class IdentificationTypeFormComponent implements OnInit {
  readonly type = input<IdentificationTypeRow | null>(null);
  readonly initialCountryId = input('');
  readonly busy = input(false);
  readonly submitted = output<IdentificationTypeFormResult>();
  readonly dismissed = output<void>();

  private readonly api = inject(CatalogsApi);
  private readonly latest = new LatestRequest();

  protected readonly countryId = signal('');
  protected readonly kindPersonId = signal('');
  protected readonly name = signal('');
  protected readonly abbreviation = signal('');
  protected readonly alphanumeric = signal(false);
  protected readonly labelEs = signal('');
  protected readonly labelEn = signal('');
  protected readonly reason = signal('');
  protected readonly kinds = signal<KindPersonRow[]>([]);
  protected readonly kindsLoaded = signal(false);
  protected readonly canSave = computed(
    () =>
      !!this.kindPersonId() &&
      !!this.name().trim() &&
      !!this.abbreviation().trim() &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    const type = this.type();
    this.countryId.set(type?.countryId ?? this.initialCountryId());
    this.kindPersonId.set(type?.kindPersonId ?? '');
    this.name.set(type?.name ?? '');
    this.abbreviation.set(type?.abbreviation ?? '');
    this.alphanumeric.set(type?.alphanumeric ?? false);
    this.labelEs.set(type?.labels?.es ?? '');
    this.labelEn.set(type?.labels?.en ?? '');
    void this.loadKinds();
  }

  protected pickCountry(countryId: string): void {
    this.countryId.set(countryId);
    this.kindPersonId.set('');
    void this.loadKinds();
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.submitted.emit({
      kindPersonId: this.kindPersonId(),
      name: this.name().trim(),
      abbreviation: this.abbreviation().trim(),
      alphanumeric: this.alphanumeric(),
      labels: { es: this.labelEs().trim(), en: this.labelEn().trim() },
      reason: this.reason().trim(),
    });
  }

  private async loadKinds(): Promise<void> {
    const countryId = this.countryId();
    this.kinds.set([]);
    this.kindsLoaded.set(false);
    if (!countryId) return;
    const current = this.latest.start();
    try {
      const page = await firstValueFrom(this.api.kindPersons({ countryId, page: 1, limit: 100 }));
      if (!current()) return;
      this.kinds.set(page.items);
      this.kindsLoaded.set(true);
    } catch {
      return;
    }
  }
}
