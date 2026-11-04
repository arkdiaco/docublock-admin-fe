import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { CatalogLabels, KindPersonRow, KindType } from '../data/catalogs.models';
import { CatalogCountrySelectComponent } from './catalog-country-select.component';

export interface KindPersonFormResult {
  countryId: string;
  name: string;
  type: KindType;
  labels: CatalogLabels;
  reason: string;
}

@Component({
  selector: 'dba-kind-person-form',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    FieldComponent,
    ModalShellComponent,
    CatalogCountrySelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="kind() ? 'pencil' : 'plus'"
      [title]="(kind() ? 'cat.kind.editTitle' : 'cat.kind.createTitle') | translate"
      [subtitle]="kind()?.countryName ?? ''"
      [confirmLabel]="kind() ? 'cat.action.save' : 'cat.action.create'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (!kind()) {
          <div class="form__control">
            <label class="form__label" for="kind-country">{{ 'cat.country.label' | translate }}</label>
            <dba-catalog-country-select
              inputId="kind-country"
              styleClass="form__select"
              [allowAll]="false"
              [value]="countryId()"
              (picked)="countryId.set($event)"
            />
          </div>
        }
        <dba-field label="cat.col.name" [maxlength]="120" [(value)]="name" />
        <div class="form__control">
          <label class="form__label" for="kind-type">{{ 'cat.kind.type' | translate }}</label>
          <p-select
            inputId="kind-type"
            [options]="types()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="type()"
            (ngModelChange)="type.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
          <p class="dba-meta">{{ 'cat.kind.typeHint' | translate }}</p>
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
export class KindPersonFormComponent implements OnInit {
  readonly kind = input<KindPersonRow | null>(null);
  readonly initialCountryId = input('');
  readonly busy = input(false);
  readonly submitted = output<KindPersonFormResult>();
  readonly dismissed = output<void>();

  private readonly translate = inject(TranslateService);

  protected readonly countryId = signal('');
  protected readonly name = signal('');
  protected readonly type = signal<KindType>('natural');
  protected readonly labelEs = signal('');
  protected readonly labelEn = signal('');
  protected readonly reason = signal('');
  protected readonly types = computed(() => [
    { id: 'natural', label: this.translate.instant('cat.kind.natural') as string },
    { id: 'legal', label: this.translate.instant('cat.kind.legal') as string },
  ]);
  protected readonly canSave = computed(
    () => !!this.countryId() && !!this.name().trim() && !!this.reason().trim(),
  );

  ngOnInit(): void {
    const kind = this.kind();
    this.countryId.set(kind?.countryId ?? this.initialCountryId());
    this.name.set(kind?.name ?? '');
    this.type.set(kind?.type ?? 'natural');
    this.labelEs.set(kind?.labels?.es ?? '');
    this.labelEn.set(kind?.labels?.en ?? '');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.submitted.emit({
      countryId: this.countryId(),
      name: this.name().trim(),
      type: this.type(),
      labels: { es: this.labelEs().trim(), en: this.labelEn().trim() },
      reason: this.reason().trim(),
    });
  }
}
